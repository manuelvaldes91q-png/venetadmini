import TelegramBot from 'node-telegram-bot-api';
import { getDb } from '../db.js';
import crypto from 'crypto';
import { provisionClientToRouter, getLeasesFromRouters, toggleClientOnRouter } from './mikrotik.js';

let bot: TelegramBot | null = null;
const userStates = new Map<number, any>();

export function setupTelegramBot() {
  try {
    const db = getDb();
    const tokenSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('telegram_token') as { value: string } | undefined;
    
    if (!tokenSetting?.value) {
      console.log('Telegram Bot: No token configured.');
      return;
    }

    const token = tokenSetting.value;
    bot = new TelegramBot(token, { polling: true });

    bot.onText(/\/(start|menu)/, (msg) => {
      bot?.sendMessage(msg.chat.id, '🔌 *NexusISP Bot - Menú Principal*\n\nSelecciona una opción abajo o usa:\n`/estado <nombre>` para buscar.', { 
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            [{ text: '👥 Ver Todos los Clientes' }, { text: '📡 Aprovisionar DHCP' }]
          ],
          resize_keyboard: true
        }
      });
    });

    const sendClientPanel = (chatId: number, client: any) => {
      const statusIcon = client.disabled ? '🔴 CORTADO' : '🟢 ACTIVO';
      const text = `👤 *Cliente:* ${client.name}\n🌐 *IP:* ${client.ip}\n🔗 *MAC:* ${client.mac}\n⚡ *Estado:* ${statusIcon}`;
      const actionText = client.disabled ? '🟢 Activar Cliente' : '🔴 Cortar Cliente';
      const actionData = `toggle_client_${client.id}`;
      
      bot?.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: actionText, callback_data: actionData }]
          ]
        }
      });
    };

    bot.onText(/\/estado (.+)/, (msg, match) => {
      const chatId = msg.chat.id;
      const clientName = match?.[1];
      if (!clientName) return bot?.sendMessage(chatId, 'Uso: /estado <nombre>');
      
      const clients = db.prepare('SELECT * FROM clients WHERE name LIKE ? LIMIT 5').all(`%${clientName}%`) as any[];
      
      if (clients.length > 0) {
         clients.forEach(c => sendClientPanel(chatId, c));
      } else {
         bot?.sendMessage(chatId, `❌ Cliente no encontrado.`);
      }
    });

    bot.onText(/\/buscar/, (msg) => {
      userStates.set(msg.chat.id, { step: 'await_search_name' });
      bot?.sendMessage(msg.chat.id, 'Escribe el nombre del cliente a buscar:');
    });

    bot.onText(/\/aprovisionar/, async (msg) => {
       const chatId = msg.chat.id;
       try {
           const leases = await getLeasesFromRouters();
           if (leases.length === 0) {
               bot?.sendMessage(chatId, '❌ No se encontraron IPs disponibles en DHCP.');
               return;
           }

           userStates.set(chatId, { step: 'select_lease', leases }); // Store leases here to use later
           
           const keyboard = leases.slice(0, 10).map(ls => ([{ text: `${ls.ip} (${ls.hostname})`, callback_data: `lease_${ls.id}` }]));
           
           bot?.sendMessage(chatId, 'Selecciona una IP detectada en DHCP para aprovisionar:', {
               reply_markup: { inline_keyboard: keyboard }
           });
       } catch (err) {
           bot?.sendMessage(chatId, '❌ Error conectando con router.');
       }
    });

    bot.on('callback_query', async (query) => {
       const chatId = query.message?.chat.id;
       if (!chatId) return;
       const data = query.data;

       if (data === 'menu_search') {
          userStates.set(chatId, { step: 'await_search_name' });
          bot?.sendMessage(chatId, 'Escribe el nombre del cliente a buscar:');
          return bot?.answerCallbackQuery(query.id);
       }
       if (data === 'menu_provision') {
           try {
               const leases = await getLeasesFromRouters();
               if (leases.length === 0) {
                   bot?.sendMessage(chatId, '❌ No se encontraron IPs disponibles en DHCP.');
                   return bot?.answerCallbackQuery(query.id);
               }
               userStates.set(chatId, { step: 'select_lease', leases });
               const keyboard = leases.slice(0, 10).map(ls => ([{ text: `${ls.ip} (${ls.hostname})`, callback_data: `lease_${ls.id}` }]));
               bot?.sendMessage(chatId, 'Selecciona una IP detectada en DHCP para aprovisionar:', {
                   reply_markup: { inline_keyboard: keyboard }
               });
           } catch (err) {
               bot?.sendMessage(chatId, '❌ Error conectando con router.');
           }
           return bot?.answerCallbackQuery(query.id);
       }

       if (data?.startsWith('toggle_client_')) {
          const clientId = data.replace('toggle_client_', '');
          try {
             const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId) as any;
             if (!client) {
                 bot?.sendMessage(chatId, '❌ Cliente no encontrado.');
                 return bot?.answerCallbackQuery(query.id);
             }
             const newDisabled = client.disabled ? 0 : 1;
             await toggleClientOnRouter(client.routerId, client.ip, !!newDisabled);
             db.prepare('UPDATE clients SET disabled = ?, status = ? WHERE id = ?').run(
                 newDisabled, newDisabled ? 'cut' : 'active', clientId
             );
             
             const statusIcon = newDisabled ? '🔴 CORTADO' : '🟢 ACTIVO';
             const text = `👤 *Cliente:* ${client.name}\n🌐 *IP:* ${client.ip}\n🔗 *MAC:* ${client.mac}\n⚡ *Estado:* ${statusIcon}`;
             const actionText = newDisabled ? '🟢 Activar Cliente' : '🔴 Cortar Cliente';
             
             if (query.message?.message_id) {
                bot?.editMessageText(text, {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: actionText, callback_data: `toggle_client_${client.id}` }]
                        ]
                    }
                });
             } else {
                bot?.sendMessage(chatId, `✅ *Status Actualizado*\n\nEl cliente *${client.name}* ha sido ${newDisabled ? '🔴 CORTADO' : '🟢 ACTIVADO'}.`, { parse_mode: 'Markdown' });
             }
          } catch(err) {
             bot?.sendMessage(chatId, `❌ Error al cambiar estado.`);
          }
          return bot?.answerCallbackQuery(query.id);
       }

       const state = userStates.get(chatId);
       if (!state) return bot?.answerCallbackQuery(query.id);

       if (state.step === 'select_lease' && data?.startsWith('lease_')) {
           const leaseId = data.replace('lease_', '');
           const lease = state.leases?.find((l: any) => l.id === leaseId);
           if (!lease) return;
           state.lease = lease;
           state.step = 'await_name';
           bot?.sendMessage(chatId, `IP *${lease.ip}* seleccionada.\n\nEscribe el *Nombre del Cliente*:`, { parse_mode: 'Markdown' });
       }
       else if (state.step === 'select_router' && data?.startsWith('rt_')) {
           state.routerId = data.replace('rt_', '');
           state.step = 'select_profile';
           
           const profiles = db.prepare('SELECT * FROM profiles').all() as any[];
           const keyboard = profiles.map(p => ([{ text: `${p.name} (${p.rxLimit}/${p.txLimit})`, callback_data: `prof_${p.id}` }]));
           
           if(keyboard.length === 0) {
               keyboard.push([{ text: `Crear Perfil por Defecto`, callback_data: `prof_default` }]);
           }

           bot?.sendMessage(chatId, 'Selecciona el Plan de Velocidad:', {
               reply_markup: { inline_keyboard: keyboard }
           });
       }
       else if (state.step === 'select_profile' && data?.startsWith('prof_')) {
           state.profileId = data.replace('prof_', '');
           if(state.profileId === 'default') state.profileId = null;

           // Finalize
           const id = crypto.randomUUID();
           try {
             let limit = '0/0';
             if (state.profileId) {
                const prof = db.prepare('SELECT rxLimit, txLimit FROM profiles WHERE id = ?').get(state.profileId) as any;
                if (prof) limit = `${prof.txLimit}/${prof.rxLimit}`;
             }
             
             await provisionClientToRouter(state.routerId, state.name, state.lease.ip, state.lease.mac, limit);

             db.prepare('INSERT INTO clients (id, routerId, name, ip, mac, status, profileId, disabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
               .run(id, state.routerId, state.name, state.lease.ip, state.lease.mac, 'active', state.profileId, 0);
             bot?.sendMessage(chatId, `✅ *¡Cliente Aprovisionado!*\n\nNombre: ${state.name}\nIP: ${state.lease.ip}`, { parse_mode: 'Markdown' });
             notifyTelegram(`[SISTEMA] Nuevo cliente aprovisionado vía Telegram: ${state.name} (${state.lease.ip})`);
           } catch(err: any) {
             console.error(err);
             bot?.sendMessage(chatId, `❌ Error al aprovisionar: ${err.message || 'Error desconocido'}`);
           }
           userStates.delete(chatId);
       }

       bot?.answerCallbackQuery(query.id);
    });

    bot.on('message', async (msg) => {
       const chatId = msg.chat.id;
       const text = msg.text;
       if (!text || text.startsWith('/')) return;

       if (text === '👥 Ver Todos los Clientes') {
          const clients = db.prepare('SELECT * FROM clients').all() as any[];
          if (clients.length === 0) {
              bot?.sendMessage(chatId, '❌ No hay clientes registrados.');
              return;
          }
          clients.forEach(c => sendClientPanel(chatId, c));
          return;
       }

       if (text === '📡 Aprovisionar DHCP') {
           try {
               const leases = await getLeasesFromRouters();
               if (leases.length === 0) {
                   bot?.sendMessage(chatId, '❌ No se encontraron IPs disponibles en DHCP.');
                   return;
               }
               userStates.set(chatId, { step: 'select_lease', leases });
               const keyboard = leases.slice(0, 10).map(ls => ([{ text: `${ls.ip} (${ls.hostname})`, callback_data: `lease_${ls.id}` }]));
               bot?.sendMessage(chatId, 'Selecciona una IP detectada en DHCP para aprovisionar:', {
                   reply_markup: { inline_keyboard: keyboard }
               });
           } catch (err) {
               bot?.sendMessage(chatId, '❌ Error conectando con router.');
           }
           return;
       }

       const state = userStates.get(chatId);
       if (state && state.step === 'await_search_name') {
           userStates.delete(chatId);
           const clients = db.prepare('SELECT * FROM clients WHERE name LIKE ? LIMIT 5').all(`%${text}%`) as any[];
           if (clients.length > 0) {
              clients.forEach(c => sendClientPanel(chatId, c));
           } else {
              bot?.sendMessage(chatId, `❌ Cliente no encontrado.`);
           }
           return;
       }
       if (state && state.step === 'await_name') {
           state.name = text;
           state.step = 'select_router';

           const routers = db.prepare('SELECT * FROM routers').all() as any[];
           if (routers.length === 0) {
              bot?.sendMessage(chatId, '❌ No hay Nodos (Routers) creados en el sistema. Créalos primero en Web.');
              userStates.delete(chatId);
              return;
           }

           const keyboard = routers.map(r => ([{ text: r.name, callback_data: `rt_${r.id}` }]));
           bot?.sendMessage(chatId, `Nombre guardado: *${text}*.\n\nSelecciona el Nodo MikroTik de destino:`, {
               parse_mode: 'Markdown',
               reply_markup: { inline_keyboard: keyboard }
           });
       }
    });

    // Handle errors globally
    bot.on('polling_error', (error) => {
      console.error('Telegram Polling Error:', error);
    });

    console.log('Telegram Bot service started successfully.');
  } catch (err) {
    console.error('Failed to initialize Telegram Bot:', err);
  }
}

export function notifyTelegram(message: string) {
  if (!bot) return;
  const db = getDb();
  const techs = db.prepare('SELECT value FROM settings WHERE key = ?').get('telegram_tech_chats') as { value: string } | undefined;
  
  if (techs?.value) {
     const chatIds = techs.value.split(',');
     chatIds.forEach(id => {
       try {
         bot?.sendMessage(id.trim(), message);
       } catch(e) {}
     });
  }
}
