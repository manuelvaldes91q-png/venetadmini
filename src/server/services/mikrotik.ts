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

        // Fetch Interfaces
        const interfaces = await conn.write('/interface/print');

        // Fetch Address Lists
        const addressLists = await conn.write('/ip/firewall/address-list/print');

        // Update SALIDA stats
        let salidaInt = interfaces.find((i: any) => i.name && i.name.trim().toUpperCase() === 'SALIDA');
        
        let txB = 0;
        let rxB = 0;

        if (salidaInt) {
            txB = parseInt(salidaInt['tx-byte'] || '0', 10);
            rxB = parseInt(salidaInt['rx-byte'] || '0', 10);
        }

        // If bytes are 0 or NaN, we might need a more specific query or stats-detail
        if (isNaN(txB) || txB === 0) {
            try {
                // In some RouterOS versions, interface traffic is retrieved via print stats-detail
                const statsReply = await conn.write('/interface/print', ['stats-detail']).catch(() => []);
                const altSalida = statsReply.find((i: any) => i.name && i.name.trim().toUpperCase() === 'SALIDA');
                if (altSalida && (altSalida['tx-byte'] || altSalida['rx-byte'])) {
                    txB = parseInt(altSalida['tx-byte'] || '0', 10);
                    rxB = parseInt(altSalida['rx-byte'] || '0', 10);
                } else {
                    const printReply = await conn.write('/interface/print', ['?name=SALIDA']).catch(() => []);
                    if (printReply.length > 0) {
                        txB = parseInt(printReply[0]['tx-byte'] || '0', 10);
                        rxB = parseInt(printReply[0]['rx-byte'] || '0', 10);
                    }
                }
            } catch(e) {
                console.error("Error fetching specific SALIDA stats", e);
            }
        }
        
        // Close connection now that we are done with it
        conn.close();
        
        if (isNaN(txB)) txB = 0;
        if (isNaN(rxB)) rxB = 0;

        if (txB > 0 || rxB > 0 || salidaInt) {
            const rData = db.prepare('SELECT salidaTx, salidaRx, lastSalidaTx, lastSalidaRx FROM routers WHERE id = ?').get(router.id) as any;
            if (rData) {
                let deltaTx = txB - (rData.lastSalidaTx || 0);
                let deltaRx = rxB - (rData.lastSalidaRx || 0);

                if (deltaTx < 0) deltaTx = txB;
                if (deltaRx < 0) deltaRx = rxB;

                let newTx = (rData.salidaTx || 0) + deltaTx;
                let newRx = (rData.salidaRx || 0) + deltaRx;
                
                db.prepare('UPDATE routers SET salidaTx = ?, salidaRx = ?, lastSalidaTx = ?, lastSalidaRx = ? WHERE id = ?').run(
                    newTx, newRx, txB, rxB, router.id
                );
            }
        }

        // Basic synchronization logic:
        // We will match a client by MAC address primarily, then ip.
        const existingClients = db.prepare('SELECT id, mac, ip, name, profileId, txBytes, rxBytes, lastQueueTx, lastQueueRx FROM clients WHERE routerId = ?').all(router.id) as any[];
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
                        let rxDisplay = rx;
                        let txDisplay = tx;
                        if (!rx.includes('M') && parseInt(rx) >= 1000) {
                            rxDisplay = `${Math.round(parseInt(rx)/1000000)}M`;
                        }
                        if (!tx.includes('M') && parseInt(tx) >= 1000) {
                            txDisplay = `${Math.round(parseInt(tx)/1000000)}M`;
                        }
                        const newProfName = `${rxDisplay} / ${txDisplay} (Auto)`;
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

            // Determine provider from address-lists
            let providerDetected = null;
            const inInter = addressLists.find((al: any) => al.list === 'Grupo_Inter' && al.address === target);
            const inAirtek = addressLists.find((al: any) => al.list === 'Grupo_Airtek' && al.address === target);
            
            if (inInter) providerDetected = 'Inter';
            else if (inAirtek) providerDetected = 'Airtek';

            if (existing) {
                let deltaTx = txB - (existing.lastQueueTx || 0);
                let deltaRx = rxB - (existing.lastQueueRx || 0);

                if (deltaTx < 0) deltaTx = txB;
                if (deltaRx < 0) deltaRx = rxB;

                let newTx = (existing.txBytes || 0) + deltaTx;
                let newRx = (existing.rxBytes || 0) + deltaRx;
                let newTotal = newTx + newRx;

                db.prepare('UPDATE clients SET ip = ?, mac = ?, disabled = ?, status = ?, profileId = ?, provider = ?, lastQueueTx = ?, lastQueueRx = ?, txBytes = ?, rxBytes = ?, totalBytes = ? WHERE id = ?').run(
                    target, mac, isDisabled, statusValue, profileId, providerDetected, txB, rxB, newTx, newRx, newTotal, existing.id
                );
            } else {
                const newId = crypto.randomUUID();
                const newTotal = txB + rxB;
                db.prepare('INSERT INTO clients (id, routerId, name, ip, mac, status, profileId, provider, disabled, txBytes, rxBytes, totalBytes, lastQueueTx, lastQueueRx) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
                    newId, router.id, name, target, mac, statusValue, profileId, providerDetected, isDisabled, txB, rxB, newTotal, txB, rxB
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

function ipToLong(ip: string) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}
function longToIp(long: number) {
    return [ (long >>> 24), (long >> 16) & 255, (long >> 8) & 255, long & 255 ].join('.');
}

export async function setClientProviderOnRouter(routerId: string, ip: string, provider: 'Inter' | 'Airtek' | null) {
    const db = getDb();
    const router = db.prepare('SELECT * FROM routers WHERE id = ?').get(routerId) as any;
    if (!router) return;

    try {
        const conn = new RouterOSAPI({ host: router.host, port: router.port || 8728, user: router.username, password: router.password || '' });
        await conn.connect();
        
        // 1. Fetch current lists
        const addressLists = await conn.write('/ip/firewall/address-list/print');
        const targetIpLong = ipToLong(ip);

        // 2. Clear existing entries for this IP, and split any ranges if the IP is inside them
        for (const entry of addressLists) {
            if (entry.list !== 'Grupo_Inter' && entry.list !== 'Grupo_Airtek') continue;
            
            let startEnd = null;
            if (entry.address.includes('-')) {
                const parts = entry.address.split('-');
                if (parts.length === 2 && parts[0].includes('.') && parts[1].includes('.')) {
                    startEnd = { start: ipToLong(parts[0]), end: ipToLong(parts[1]) };
                }
            } else if (entry.address.includes('/')) {
                const [base, maskStr] = entry.address.split('/');
                const mask = parseInt(maskStr, 10);
                if (!isNaN(mask) && base.includes('.')) {
                   const start = (ipToLong(base) & (~((1 << (32 - mask)) - 1))) >>> 0;
                   const end = (start + (1 << (32 - mask)) - 1) >>> 0;
                   startEnd = { start, end };
                }
            } else if (entry.address.includes('.')) {
                startEnd = { start: ipToLong(entry.address), end: ipToLong(entry.address) };
            }
            
            if (startEnd && targetIpLong >= startEnd.start && targetIpLong <= startEnd.end) {
                // IP is inside this entry! Remove the original entry.
                await conn.write('/ip/firewall/address-list/remove', [ `=.id=${entry['.id']}` ]);
                
                // If it was a range/subnet containing more than one IP, split it.
                if (startEnd.start !== startEnd.end) {
                    if (targetIpLong > startEnd.start) {
                       const newLower = targetIpLong - 1 === startEnd.start 
                           ? longToIp(startEnd.start) 
                           : `${longToIp(startEnd.start)}-${longToIp(targetIpLong - 1)}`;
                       await conn.write('/ip/firewall/address-list/add', [ `=list=${entry.list}`, `=address=${newLower}` ]);
                    }
                    if (targetIpLong < startEnd.end) {
                       const newUpper = targetIpLong + 1 === startEnd.end
                           ? longToIp(startEnd.end)
                           : `${longToIp(targetIpLong + 1)}-${longToIp(startEnd.end)}`;
                       await conn.write('/ip/firewall/address-list/add', [ `=list=${entry.list}`, `=address=${newUpper}` ]);
                    }
                }
            }
        }

        // 3. Add to new list if provider is specified
        if (provider === 'Inter') {
            await conn.write('/ip/firewall/address-list/add', [ `=list=Grupo_Inter`, `=address=${ip}` ]);
        } else if (provider === 'Airtek') {
            await conn.write('/ip/firewall/address-list/add', [ `=list=Grupo_Airtek`, `=address=${ip}` ]);
        }

        conn.close();
    } catch(err) {
        console.error('MikroTik Update Provider Error:', err);
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

      // Check if it's the 5th of the month
      const now = new Date();
      if (now.getDate() === 5) {
         const currentMonthStr = `${now.getFullYear()}-${now.getMonth()}`;
         const lastResetSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('last_monthly_reset') as {value: string} | undefined;
         if (!lastResetSetting || lastResetSetting.value !== currentMonthStr) {
             console.log('Performing monthly data reset (5th day of month)');
             // Reset accumulators, but keep the current MikroTik counter cache (lastQueueTx) 
             // so the next sync doesn't re-add the current queue bytes.
             db.prepare('UPDATE clients SET txBytes = 0, rxBytes = 0, totalBytes = 0').run();
             // Reset router interfaces accumulated counters
             try {
                db.prepare('UPDATE routers SET salidaTx = 0, salidaRx = 0').run();
             } catch(e){}
             if (lastResetSetting) {
                 db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(currentMonthStr, 'last_monthly_reset');
             } else {
                 db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('last_monthly_reset', currentMonthStr);
             }
         }
      }

      const routers = db.prepare('SELECT id FROM routers').all() as {id: string}[];
      for (const router of routers) {
          await syncRouter(router.id);
      }
    } catch(err) {
       console.error('MikroTik loop error:', err);
    }
  }, 30000); // 30 second sync frequency
}
