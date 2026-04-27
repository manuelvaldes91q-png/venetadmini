import { getDb } from '../db.js';
import { RouterOSAPI } from 'node-routeros';
import crypto from 'crypto';

let syncInterval: NodeJS.Timeout | null = null;

export async function syncRouter(routerId: string) {
    const db = getDb();
    const router = db.prepare('SELECT * FROM routers WHERE id = ?').get(routerId) as any;
    if (!router) return;

    try {
        const conn = new RouterOSAPI({ 
            host: router.host, 
            port: router.port || 8728, 
            user: router.username, 
            password: router.password || '',
            keepalive: true
        });

        await conn.connect();
        
        // Mark as connected
        db.prepare('UPDATE routers SET status = ?, lastCheck = ? WHERE id = ?').run('connected', Date.now(), router.id);

        // Fetch queues (speed profiles and clients if they have queues)
        const queues = await conn.write('/queue/simple/print');
        
        // Fetch DHCP Leases
        const leases = await conn.write('/ip/dhcp-server/lease/print');
        
        // Fetch ARP
        const arp = await conn.write('/ip/arp/print');

        // Close connection
        conn.close();

        // Basic synchronization logic:
        // We will match a client by MAC address primarily, then ip.
        const existingClients = db.prepare('SELECT id, mac, ip, name, profileId FROM clients WHERE routerId = ?').all(router.id) as any[];
        const profiles = db.prepare('SELECT id, name, rxLimit, txLimit FROM profiles').all() as any[];

        for (const queue of queues) {
            // Some queues might just be PCQ o total, we try to see if it's a client
            const target = queue.target ? queue.target.split('/')[0] : null; // typically "192.168.88.10/32"
            if (!target || target === '0.0.0.0' || target.includes(',')) continue;

            const macObj = arp.find((a: any) => a.address === target);
            const mac = macObj ? macObj['mac-address'] : null;

            if (!mac) continue;

            // Extract bytes usage: "tx/rx"
            let txB = 0, rxB = 0;
            if (queue.bytes) {
                const bParts = queue.bytes.split('/');
                txB = parseInt(bParts[0]) || 0;
                rxB = parseInt(bParts[1]) || 0;
            }
            const totalB = txB + rxB;

            // Find matching profile or create one based on max-limit "tx/rx"
            let profileId = null;
            if (queue['max-limit']) {
                const limitStr = queue['max-limit']; // e.g., "5M/10M" (TX/RX)
                const [tx, rx] = limitStr.split('/');
                if (tx && rx) {
                    // Try to find if profile exists
                    let prof = profiles.find(p => p.txLimit === tx && p.rxLimit === rx);
                    if (!prof) {
                        const newProfId = crypto.randomUUID();
                        const newProfName = `${parseInt(rx)/1000000}M/${parseInt(tx)/1000000}M`; // Rough MB naming
                        db.prepare('INSERT INTO profiles (id, name, rxLimit, txLimit) VALUES (?, ?, ?, ?)').run(newProfId, newProfName, rx, tx);
                        profiles.push({ id: newProfId, name: newProfName, rxLimit: rx, txLimit: tx });
                        profileId = newProfId;
                    } else {
                        profileId = prof.id;
                    }
                }
            }

            // Sync with local DB
            const existing = existingClients.find(c => c.mac === mac || c.ip === target);
            const isQueueDisabled = queue.disabled === "true";
            const isArpDisabled = macObj && macObj.disabled === "true";
            const isDisabled = (isQueueDisabled || isArpDisabled) ? 1 : 0;
            const statusValue = isDisabled ? 'cut' : 'active';
            const name = queue.name || "Default Queue";

            if (existing) {
                db.prepare('UPDATE clients SET ip = ?, mac = ?, disabled = ?, status = ?, profileId = IFNULL(profileId, ?), txBytes = ?, rxBytes = ?, totalBytes = ? WHERE id = ?').run(
                    target, mac, isDisabled, statusValue, profileId, txB, rxB, totalB, existing.id
                );
            } else {
                const newId = crypto.randomUUID();
                db.prepare('INSERT INTO clients (id, routerId, name, ip, mac, status, profileId, disabled, txBytes, rxBytes, totalBytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
                    newId, router.id, name, target, mac, statusValue, profileId, isDisabled, txB, rxB, totalB
                );
            }
        }
        
    } catch(err: any) {
        // Mark as offline
        db.prepare('UPDATE routers SET status = ?, lastCheck = ? WHERE id = ?').run('offline', Date.now(), router.id);
        console.error(`MikroTik sync error for router ${router.name} (${router.host}):`, err.message);
    }
}

export async function provisionClientToRouter(routerId: string, clientName: string, ip: string, mac: string, profileLimit: string) {
    const db = getDb();
    const router = db.prepare('SELECT * FROM routers WHERE id = ?').get(routerId) as any;
    if (!router) return;

    try {
        const conn = new RouterOSAPI({ host: router.host, port: router.port || 8728, user: router.username, password: router.password || '' });
        await conn.connect();
        
        // 1. Make DHCP lease static if dynamic
        const leases = await conn.write('/ip/dhcp-server/lease/print');
        const lease = leases.find((l: any) => l['mac-address'] === mac || l.address === ip);
        if (lease && lease.dynamic === "true") {
           await conn.write('/ip/dhcp-server/lease/make-static', [ `=.id=${lease['.id']}` ]);
           await conn.write('/ip/dhcp-server/lease/set', [ `=.id=${lease['.id']}`, `=comment=${clientName}` ]);
        } else if (!lease) {
           await conn.write('/ip/dhcp-server/lease/add', [ `=address=${ip}`, `=mac-address=${mac}`, `=comment=${clientName}` ]);
        }

        // 2. Add or update ARP
        const arps = await conn.write('/ip/arp/print');
        const existingArp = arps.find((a: any) => a['mac-address'] === mac || a.address === ip);
        if (!existingArp) {
           await conn.write('/ip/arp/add', [ `=address=${ip}`, `=mac-address=${mac}`, `=comment=${clientName}`, `=interface=SALIDA` ]);
        } else {
           await conn.write('/ip/arp/set', [ `=.id=${existingArp['.id']}`, `=comment=${clientName}`, `=interface=SALIDA` ]);
        }

        // 3. Add or update Simple Queue
        const queues = await conn.write('/queue/simple/print');
        const existingQ = queues.find((q: any) => q.target && q.target.startsWith(ip));
        if (existingQ) {
            await conn.write('/queue/simple/set', [ `=.id=${existingQ['.id']}`, `=max-limit=${profileLimit}`, `=name=${clientName}`, `=comment=${clientName}` ]);
        } else {
            await conn.write('/queue/simple/add', [ `=name=${clientName}`, `=target=${ip}`, `=max-limit=${profileLimit}`, `=comment=${clientName}` ]);
        }

        conn.close();
    } catch(err) {
        console.error('MikroTik Provisioning Error:', err);
        throw err;
    }
}

export async function toggleClientOnRouter(routerId: string, ip: string, disable: boolean) {
    const db = getDb();
    const router = db.prepare('SELECT * FROM routers WHERE id = ?').get(routerId) as any;
    if (!router) return;

    try {
        const conn = new RouterOSAPI({ host: router.host, port: router.port || 8728, user: router.username, password: router.password || '', timeout: 3 });
        await conn.connect();
        
        const queues = await conn.write('/queue/simple/print');
        const q = queues.find((q: any) => q.target && q.target.startsWith(ip));
        
        if (q) {
            await conn.write(disable ? '/queue/simple/disable' : '/queue/simple/enable', [ `=.id=${q['.id']}` ]);
        }

        const arps = await conn.write('/ip/arp/print');
        const arp = arps.find((a: any) => a.address === ip);

        if (arp) {
            await conn.write(disable ? '/ip/arp/disable' : '/ip/arp/enable', [ `=.id=${arp['.id']}` ]);
        }
        
        conn.close();
    } catch(err) {
        console.error('MikroTik Toggle Error:', err);
        throw err;
    }
}

export async function deleteClientOnRouter(routerId: string, ip: string, mac: string) {
    const db = getDb();
    const router = db.prepare('SELECT * FROM routers WHERE id = ?').get(routerId) as any;
    if (!router) return;

    try {
        const conn = new RouterOSAPI({ host: router.host, port: router.port || 8728, user: router.username, password: router.password || '' });
        await conn.connect();
        
        const queues = await conn.write('/queue/simple/print');
        const q = queues.find((q: any) => q.target && q.target.startsWith(ip));
        if (q) await conn.write('/queue/simple/remove', [ `=.id=${q['.id']}` ]);
        
        const leases = await conn.write('/ip/dhcp-server/lease/print');
        const lease = leases.find((l: any) => l['mac-address'] === mac || l.address === ip);
        if (lease) await conn.write('/ip/dhcp-server/lease/remove', [ `=.id=${lease['.id']}` ]);

        const arps = await conn.write('/ip/arp/print');
        const arp = arps.find((a: any) => a.address === ip || a['mac-address'] === mac);
        if (arp) await conn.write('/ip/arp/remove', [ `=.id=${arp['.id']}` ]);

        conn.close();
    } catch(err) {
        console.error('MikroTik Delete Error:', err);
    }
}

export async function getLeasesFromRouters() {
    const db = getDb();
    const routers = db.prepare('SELECT * FROM routers').all() as any[];
    const allLeases = [];

    for (const router of routers) {
        try {
            const conn = new RouterOSAPI({ host: router.host, port: router.port || 8728, user: router.username, password: router.password || '', timeout: 3 });
            await conn.connect();
            const leases = await conn.write('/ip/dhcp-server/lease/print');
            conn.close();
            
            for (const l of leases) {
               // Only return un-provisioned "dynamic" leases or bound leases
               if (l.dynamic === "true" || !l.comment) {
                  allLeases.push({
                      id: l['.id'] || crypto.randomUUID(),
                      ip: l.address,
                      mac: l['mac-address'],
                      hostname: l['host-name'] || 'Unknown',
                      status: l.status,
                      routerId: router.id
                  });
               }
            }
        } catch(err) {
            console.error(`Failed to fetch leases from ${router.name}`, err);
        }
    }
    return allLeases;
}

export function startMikrotikSync() {
  console.log('Background MikroTik sync initialized');
  
  if (syncInterval) clearInterval(syncInterval);

  syncInterval = setInterval(async () => {
    try {
      const db = getDb();
      const routers = db.prepare('SELECT id FROM routers').all() as {id: string}[];
      for (const router of routers) {
          await syncRouter(router.id);
      }
    } catch(err) {
       console.error('MikroTik loop error:', err);
    }
  }, 30000); // 30 second sync frequency
}
