import fs from 'fs'
import moment from 'moment-timezone'
import fetch from 'node-fetch'
import baileys from '@whiskeysockets/baileys'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'

// --- FUNGSI UTILITY (PENGGANTI myfunction.js) ---

/**
 * Fungsi untuk menghitung uptime (waktu aktif) bot dalam format yang dapat dibaca.
 * @param {number} seconds - Total detik uptime.
 * @returns {string} Format waktu yang dibaca manusia.
 */
function runtime(seconds) {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor(seconds % (3600 * 24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);
    var dDisplay = d > 0 ? d + (d == 1 ? " hari, " : " hari, ") : "";
    var hDisplay = h > 0 ? h + (h == 1 ? " jam, " : " jam, ") : "";
    var mDisplay = m > 0 ? m + (m == 1 ? " menit, " : " menit, ") : "";
    var sDisplay = s > 0 ? s + (s == 1 ? " detik" : " detik") : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
}

// --- FUNGSI UTILITY DARI VYZEN MENU ---

const { generateWAMessageFromContent } = baileys

// --- Fungsi waktu & uptime ---
const getUptime = () => {
  let uptime = process.uptime()
  let hours = Math.floor(uptime / 3600)
  let minutes = Math.floor((uptime % 3600) / 60)
  let seconds = Math.floor(uptime % 60)
  return `${hours}h ${minutes}m ${seconds}s`
}

// --- Fungsi konversi ke teks kecil ---
function toSmallText(text) {
  const map = {
    'A': 'ᴀ', 'B': 'ʙ', 'C': 'ᴄ', 'D': 'ᴅ', 'E': 'ᴇ', 'F': 'ꜰ', 'G': 'ɢ',
    'H': 'ʜ', 'I': 'ɪ', 'J': 'ᴊ', 'K': 'ᴋ', 'L': 'ʟ', 'M': 'ᴍ', 'N': 'ɴ',
    'O': 'ᴏ', 'P': 'ᴘ', 'Q': 'ǫ', 'R': 'ʀ', 'S': 'ꜱ', 'T': 'ᴛ', 'U': 'ᴜ',
    'V': 'ᴠ', 'W': 'ᴡ', 'X': 'x', 'Y': 'ʏ', 'Z': 'ᴢ',
    'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ꜰ', 'g': 'ɢ',
    'h': 'ʜ', 'i': 'ɪ', 'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ',
    'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ', 's': 'ꜱ', 't': 'ᴛ', 'u': 'ᴜ',
    'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ'
  }
  return text.split('').map(c => map[c] || c).join('')
}

// --- Fungsi Status User ---
function getUserStatus(m, conn, user) {
  const sender = m.sender.replace(/[^0-9]/g, '')
  const isDev = global.owner?.some(([number]) => number === sender)
  const isPremium = user?.premium
  const isModerator = global.db.data.settings?.[conn.user.jid]?.moderator?.includes(m.sender)

  if (isDev) return '👑 ᴅᴇᴠᴇʟᴏᴘᴇʀ'
  if (isModerator) return '⚡ ᴍᴏᴅᴇʀᴀᴛᴏʀ'
  if (isPremium) return '💎 ᴘʀᴇᴍɪᴜᴍ'
  return '❌ ꜰʀᴇᴇ'
}

// --- Fetch dengan timeout ---
const fetchWithTimeout = (url, timeout = 5000) =>
  Promise.race([
    fetch(url),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
  ])

// --- Fake document context menu ---
// [UPDATE] Diperbarui ke versi vyzen2
const fdocMenu = {
  key: { remoteJid: 'status@broadcast', participant: '0@s.whatsapp.net' },
  message: { documentMessage: { title: '𝘏𝘶𝘛𝘢𝘰 𝘔𝘶𝘭𝘵𝘪 𝘋𝘦𝘷𝘪𝘤𝘦' } }
}

// --- Fungsi kata-kata bijak ---
// [UPDATE] Diperbarui ke versi vyzen2
const getRandomKata = async () => {
  // [MODIFIKASI] Mengganti default kata ke teks normal
  const defaultKata = "HuTao - Asisten Digital Anda" 
  try {
    const res = await fetchWithTimeout('https://raw.githubusercontent.com/ditss-dev/database/main/kata%20kata%20hari%20ini.json', 5000)
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return defaultKata
    
    // [MODIFIKASI] Menghapus toSmallText() agar teks tidak menjadi kecil
    return data[Math.floor(Math.random() * data.length)]
  } catch (e) {
    console.error('Gagal fetch kata-kata:', e)
    return defaultKata
  }
}

// --- Simbol bunga random ---
const symbols = ['❀', '✿', '✧', '✦', '⿻', '⚚', '❖', '✦', '▢', '❏']
const getRandomSymbol = () => symbols[Math.floor(Math.random() * symbols.length)]

// --- Fungsi convert MP3 ke OPUS ---
// [UPDATE] Diperbarui ke versi vyzen2 (dengan try-catch)
async function toOpus(url) {
  try {
    const res = await fetch(url)
    const buffer = Buffer.from(await res.arrayBuffer())
    
    // Pastikan direktori tmp ada
    if (!fs.existsSync('./tmp')) {
      fs.mkdirSync('./tmp');
    }

    const inputPath = path.join('./tmp', `input-${Date.now()}.mp3`)
    const outputPath = inputPath.replace('.mp3', '.opus')

    fs.writeFileSync(inputPath, buffer)

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec('libopus')
        .format('opus')
        .save(outputPath)
        .on('end', () => {
          const out = fs.readFileSync(outputPath)
          fs.unlinkSync(inputPath)
          fs.unlinkSync(outputPath)
          resolve(out)
        })
        .on('error', (err) => {
            console.error('FFMPEG Error:', err);
            // Hapus file jika terjadi error
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            reject(err);
        });
    })
  } catch (error) {
    console.error('Error in toOpus function:', error);
    throw error; // Lemparkan error agar bisa ditangkap di catch utama
  }
}

// --- AKHIR FUNGSI UTILITY VYZEN MENU ---


/**
 * Main handler function to determine the platform and call the appropriate menu handler.
 * @param {object} m - The message object.
 * @param {object} params - Destructured parameters from the command.
 */
const handler = async (m, { conn, args, usedPrefix, command }) => {
    if (m.platform === 'telegram') {
        return handleTelegramMenu(m, { conn, args, usedPrefix });
    } else {
        return handleWhatsAppMenu(m, { conn, args, usedPrefix, command });
    }
};

// --- NEW DEFAULT MENU TEMPLATE ---
const defaultMenu = {
  before: `
*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*

“ Halo *%name*, saya *𝘏𝘶𝘛𝘢𝘰 𝘔𝘋*, %greeting ”

╭── ︿︿︿︿︿ *⭒   ⭒   ⭒   ⭒   ⭒   ⭒*
┊ ‹‹ *Halo* :: *%name*
┊•*⁀➷ °⭒⭒⭒ *【 ✯ 𝘏𝘶𝘛𝘢𝘰 𝘔𝘋 ✰ 】*
╰─── ︶︶︶︶ ✰⃕  ⌇ *⭒ ⭒ ⭒* ˚̩̥̩̥*̩̩͙✩
┊🍬 [ *Mode* :: *Publik*
┊📚 [ *Baileys* :: *Multi Device*
┊⏱ [ *Waktu Aktif* :: *%uptime*
┊👤 [ *Total Pengguna* :: *%totalreg*
╰─────────
%readmore
  `.trimStart(),
  after: `> [ ✰ ] ${global.textbot || '𝘏𝘶𝘛𝘢𝘰 𝘔𝘋'}`,
}
// ---------------------------------


/**
 * Handles the menu display for WhatsApp platform.
 * @param {object} m - The message object.
 * @param {object} params - Destructured parameters.
 */
const handleWhatsAppMenu = async (m, { conn, args, usedPrefix, command }) => {
    const user = global.db.data.users[m.sender];
    const setting = global.db.data.settings?.default || {};
    const menuMode = setting.menuMode || 'button';

    if (!user?.registered) {
        return sendRegistrationMenu(m, conn);
    }

    const sender = m.sender.replace(/[^0-9]/g, '');
    const isDev = global.owner?.some(([number]) => number === sender);
    const isPremium = user.premium;
    const tagArg = (args[0] || '').toLowerCase();
    
    const allPlugins = Object.values(global.plugins).filter(p => !p.disabled && p.help);
    const allTags = [...new Set(allPlugins.flatMap(p => p.tags || []))].sort();
    
    const name = m.pushName || 'User';
    const status = isDev
        ? '👑 𝙳𝙴𝚅𝙴𝙻𝙾𝙿𝙴𝚁'
        : global.db.data.settings?.[conn.user.jid]?.moderator?.includes(m.sender)
            ? '⚡ 𝙼𝙾𝙳𝙴𝚁𝙰𝚃𝙾𝚁'
            : isPremium
                ? '💎 𝙿𝚁𝙴𝙼𝙸𝚄𝙼'
                : '❌ 𝙵𝚁𝙴𝙴';

    let caption = createTemplatedDashboardCaption(name, user, isDev, isPremium, conn, m, defaultMenu);

    // --- LOGIKA UTAMA PERUBAHAN ADA DI SINI ---
    if (tagArg && tagArg !== 'all' && allTags.includes(tagArg)) {
        const matchedPlugins = allPlugins.filter(p => (p.tags || []).includes(tagArg));
        let commands;

        // KONDISI KHUSUS UNTUK TAG 'CLAN'
        if (tagArg === 'clan') {
            // Ambil seluruh teks help untuk tag 'clan'
            commands = matchedPlugins.flatMap(p => p.help); 
        } else {
            // Ambil hanya kata pertama dari help untuk tag lainnya
            commands = matchedPlugins.flatMap(p => p.help).map(cmd => cmd.split(' ')[0]);
        }
        
        if (commands.length > 0) {
            caption += `\n` + createFeaturesCaptionForTag(tagArg.toUpperCase(), commands, usedPrefix);
        } else {
            return m.reply(`❌ Tidak ada menu tersedia untuk tag *${tagArg}*`);
        }
    } else if (tagArg === 'all') {
        let allFeaturesCaption = ``;
        for (const tag of allTags) {
            const matchedPlugins = allPlugins.filter(p => (p.tags || []).includes(tag));
            let commands;

            if (tag === 'clan') {
                commands = matchedPlugins.flatMap(p => p.help);
            } else {
                commands = matchedPlugins.flatMap(p => p.help).map(cmd => cmd.split(' ')[0]);
            }
            
            if (commands.length > 0) {
                allFeaturesCaption += `\n` + createFeaturesCaptionForTag(tag.toUpperCase(), commands, usedPrefix);
            }
        }
        caption += allFeaturesCaption;
    } else if (tagArg) {
        return m.reply(`❌ 𝚃𝚊𝚐 *${tagArg}* 𝚝𝚒𝚍𝚊𝚔 𝚍𝚒𝚝𝚎𝚖𝚞𝚔𝚊𝚗!\n𝚂𝚒𝚕𝚊𝚔𝚊𝚗 𝚙𝚒𝚕𝚒𝚑: ${allTags.map(t => `*${t}*`).join(', ')}`);
    } else {
        caption += `\n_「 Ketuk Tombol Di Bawah Untuk Melihat Fitur! 」_`
    }
    
    // Append the 'after' text only if it's not a specific tag menu and the template exists
    if (!tagArg) {
         caption += `\n${defaultMenu.after}`
    }

    const textOnlyCaption = caption + `\n\n` + createTagsSection(allTags, usedPrefix);
    const interactiveButtonList = createInteractiveButtons(allTags);
    const primaryOwnerJid = global.owner[0][0] + '@s.whatsapp.net';
    const botName = global.namebot || '𝘏𝘶𝘛𝘢𝘰 𝘔𝘋';

    switch (menuMode) {
        case 'button':
            return conn.sendMessage(m.chat, {
                product: {
                    productImage: { url: global.foto || 'https://files.catbox.moe/0o03p5.jpg' },
                    productId: '9999999999999999',
                    title: `${botName} - Dashboard`,
                    description: `Halo ${name}! Gambar Utama Menu Bot`,
                    currencyCode: 'IDR',
                    priceAmount1000: '0',
                    retailerId: 'menu_dashboard',
                    url: 'vyzen.biz.id',
                    productImageCount: 1
                },
                businessOwnerJid: primaryOwnerJid,
                caption: caption,
                title: '✨ Pilih Kategori Menu ✨',
                subtitle: `Halo, ${name}! | Status: ${status}`,
                footer: `> © ${botName} 2025`,
                interactiveButtons: [interactiveButtonList],
                showAdAttribution: true
            }, { quoted: m });
        case 'gif':
            return conn.sendMessage(m.chat, {
                video: { url: 'https://files.catbox.moe/yqlyjt.mp4' },
                gifPlayback: true,
                caption: caption,
                contextInfo: { mentionedJid: [m.sender] },
                title: '✨ Pilih Kategori Menu ✨',
                subtitle: `Halo, ${name}! | Status: ${status}`,
                footer: `> © ${botName} 2025`,
                interactiveButtons: [interactiveButtonList],
                headerType: 4,
                showAdAttribution: true
            }, { quoted: m });
        case 'gambar':
            const imageBuffer = await (await fetch(global.foto || 'https://files.catbox.moe/0o03p5.jpg')).buffer();
            return conn.sendMessage(m.chat, {
                image: imageBuffer,
                caption: textOnlyCaption,
                contextInfo: { mentionedJid: [m.sender] },
                showAdAttribution: true
            }, { quoted: m });
        case 'text':
            return conn.sendMessage(m.chat, {
                text: textOnlyCaption,
                contextInfo: { mentionedJid: [m.sender] },
                showAdAttribution: true
            }, { quoted: m });
        case 'vyzen':
            return handleVyzenMenu(m, { conn, args, usedPrefix, command });
        // [MODIFIKASI BARU] Menambahkan case 'vyzen2'
        case 'vyzen2':
            return handleVyzenMenu2(m, { conn, args, usedPrefix, command });
        default:
            return m.reply("Mode menu tidak valid!");
    }
};

/**
 * Handles the menu display for Telegram platform.
 * @param {object} m - The message object.
 * @param {object} params - Destructured parameters.
 */
const handleTelegramMenu = async (m, { conn, args }) => {
    const userId = m.from?.id;
    const isOwner = global.config?.owner?.includes(userId) || false;
    const role = isOwner ? 'Developer' : 'User';
    
    let command = m.text?.startsWith('/') ? m.text.split(' ')[0] : m.text;
    let currentPage = parseInt(args[1]) || 1;

    const allPlugins = Object.values(global.plugins).filter(p => !p.disabled && p.help);
    const allTags = [...new Set(allPlugins.flatMap(p => p.tags || []))].sort();

    if (command === '/menu_all' || command.startsWith('/menu_')) {
        let menuTitle = '';
        let commandsByTag = [];

        if (command === '/menu_all') {
            menuTitle = 'Semua Menu';
            for (const tag of allTags) {
                const pluginsByTag = allPlugins.filter(p => (p.tags || []).includes(tag));
                let commands;
                if (tag === 'clan') {
                    commands = pluginsByTag.flatMap(p => p.help).map(cmd => `/${cmd}`);
                } else {
                    commands = pluginsByTag.flatMap(p => p.help).map(cmd => `/${cmd.split(' ')[0]}`);
                }
                commandsByTag.push({
                    tag: tag.charAt(0).toUpperCase() + tag.slice(1),
                    commands: commands
                });
            }
        } else {
            const tag = command.replace('/menu_', '');
            menuTitle = tag.charAt(0).toUpperCase() + tag.slice(1);
            if (allTags.includes(tag)) {
                const pluginsByTag = allPlugins.filter(p => (p.tags || []).includes(tag));
                let commands;
                if (tag === 'clan') {
                    commands = pluginsByTag.flatMap(p => p.help).map(cmd => `/${cmd}`);
                } else {
                    commands = pluginsByTag.flatMap(p => p.help).map(cmd => `/${cmd.split(' ')[0]}`);
                }
                commandsByTag.push({
                    tag: menuTitle,
                    commands: commands
                });
            }
        }
        
        const totalPages = Math.ceil(commandsByTag.length / 15);
        const startIndex = (currentPage - 1) * 15;
        const pageCommands = commandsByTag.slice(startIndex, startIndex + 15);

        let fullTextMessage = `╭──❍ 𝙸𝚗𝚏𝚘 𝙿𝚎𝚗𝚐𝚐𝚞𝚗𝚊\n`
            + `│ ⿻ 𝙽𝚊𝚖𝚊: ${m.from.first_name || 'User'}\n`
            + `╰──────────────\n`
            + `▰▰ 𝗠𝗲𝗻𝘂: ${menuTitle} ▰▰\n`
            + `𝗣𝗮𝚐𝚎: ${currentPage} of ${totalPages}\n\n`;

        for (const group of pageCommands) {
            fullTextMessage += `▰▰ 𝗖𝗔𝗧𝗘𝗚𝗢𝗥𝗬: ${group.tag.toUpperCase()} ▰▰\n`
            for (const cmd of group.commands) {
                fullTextMessage += `  ├─ ${cmd}\n`
            }
            fullTextMessage += '\n'
        }

        const buttons = createPaginationButtons(currentPage, totalPages, command);

        return conn.sendMessage(m.chat.id, fullTextMessage, {
            reply_markup: buttons,
            reply_to_message_id: m.message_id
        });
    } else {
        const captionMessage = `╭──❍ 𝙸𝚗𝚏𝚘 𝙿𝚎𝚗𝚐𝚐𝚞𝚗𝚊\n`
            + `│ ⿻ 𝙽𝚊𝚖𝚊: ${m.from.first_name || 'User'}\n`
            + `│ ⿻ 𝚂𝚝𝚊𝚝𝚞𝚜: ${isOwner ? 'Developer' : 'Pengguna'}\n`
            + `│ ⿻ 𝚁𝚘le: ${role}\n`
            + `╰──────────────\n\n`
            + `Silahkan pilih menu di bawah ini untuk melihat daftar perintah.`;
    
        const menuButtons = createTelegramMainButtons(allPlugins);
        const photoUrl = 'https://files.catbox.moe/y2y21m.jpg';
        
        return conn.sendPhoto(m.chat.id, photoUrl, {
            caption: captionMessage,
            parse_mode: 'Markdown',
            reply_markup: menuButtons
        });
    }
};

/**
 * Handles the menu display for Vyzen mode. (Mode 1)
 * @param {object} m - The message object.
 * @param {object} params - Destructured parameters.
 */
const handleVyzenMenu = async (m, { conn, args, usedPrefix, command }) => {
  const vyzen = conn || m?.conn
  if (!vyzen) return console.error('Error: conn is undefined')

  const botname = global.info?.namebot || '𝘏𝘶T𝘢𝘰 𝘔𝘋'
  const thumbnailMain = 'https://files.catbox.moe/8r79u0.jpg'
  const thumbnailSmall = 'https://files.catbox.moe/kaljyn.jpg'
  const prefix = usedPrefix || '.'

  const user = global.db?.data?.users[m.sender] || {}
  // Menggunakan fungsi getUserStatus yang sudah ada di scope ini
  const userStatus = getUserStatus(m, vyzen, user) 

  const groups = {}
  for (const name in global.plugins) {
    const p = global.plugins[name]
    if (!p || p.disabled) continue
    const tags = Array.isArray(p.tags) ? p.tags : (p.tags ? [p.tags] : [])
    for (const t of tags) {
      const tag = String(t || '').toLowerCase()
      if (!tag) continue
      groups[tag] = true
    }
  }
  const tagList = Object.keys(groups).sort()

  const sections = [
    {
      title: toSmallText('📚 All Menu'),
      rows: [{
        header: toSmallText('📚 All'),
        title: toSmallText('Semua fitur'),
        description: toSmallText('Lihat semua fitur yang tersedia'),
        id: `${prefix}menu all`
      }]
    },
    {
      title: toSmallText('📂 Categories'),
      rows: tagList.map(t => ({
        header: toSmallText(`▢ ${t}`),
        title: toSmallText(`Menu ${t}`),
        description: toSmallText(`Daftar fitur kategori ${t}`),
        id: `${prefix}menu ${t}`
      }))
    }
  ]

  const flowActions = [
    { buttonId: 'action', buttonText: { displayText: '📌 Open Menu' }, type: 4, nativeFlowInfo: { name: 'single_select', paramsJson: JSON.stringify({ title: '✨ Pilih kategori menu', sections }) } },
    { buttonId: `.owner`, buttonText: { displayText: '👤 Hubungi Owner' } },
    { buttonId: `.sewa`, buttonText: { displayText: '🤖 Sewa Bot' } }
  ]

  const totalUser = Object.keys(global.db?.data?.users || {}).length
  const mode = global.opts?.self ? 'ᴘʀɪᴠᴀᴛᴇ' : 'ᴘᴜʙʟɪᴄ'
  const pushName = m.pushName || 'ᴛᴀɴᴘᴀ ɴᴀᴍᴀ'
  const tagArg = (args && args[0] ? String(args[0]) : '').toLowerCase().trim()

  const getCommandList = (tag) => {
    if (tag === 'all') {
      const byTag = {}
      for (const name in global.plugins) {
        const p = global.plugins[name]
        if (!p || p.disabled) continue
        const helps = Array.isArray(p.help) ? p.help : (p.help ? [p.help] : [])
        const tags = Array.isArray(p.tags) ? p.tags : (p.tags ? [p.tags] : ['others'])
        tags.forEach(t => {
          const tagName = String(t).toLowerCase()
          if (!byTag[tagName]) byTag[tagName] = []
          helps.forEach(h => byTag[tagName].push(toSmallText(`${prefix}${h}`)))
        })
      }
      return byTag
    } else {
      const list = []
      let tagExists = false
      for (const name in global.plugins) {
        const p = global.plugins[name]
        if (!p || p.disabled) continue
        const helps = Array.isArray(p.help) ? p.help : (p.help ? [p.help] : [])
        const tags = Array.isArray(p.tags) ? p.tags : (p.tags ? [p.tags] : [])
        if (tags.map(t => String(t).toLowerCase()).includes(tag)) {
          tagExists = true
          helps.forEach(h => list.push(toSmallText(`${prefix}${h}`)))
        }
      }
      return tagExists ? list : null
    }
  }

  const featureData = tagArg ? getCommandList(tagArg) : null
  if (tagArg && featureData === null)
    return vyzen.sendMessage(m.chat, { text: `⚠️ ${toSmallText(`kategori ${tagArg} tidak ditemukan`)}` }, { quoted: fdocMenu })

  const kataBijak = await getRandomKata() // Akan menggunakan getRandomKata versi vyzen2 (yg sudah dimodif)

  // --- [FIX] Pindahkan definisi waktu ke dalam handler agar akurat ---
  const time = moment().tz('Asia/Jakarta').format('HH:mm:ss') + ' WIB'
  // --- [FIX] Hapus format 'dddd, ' (hari) dari tanggal ---
  const hariini = moment().tz('Asia/Jakarta').format('DD MMMM YYYY')
  
  // Menggunakan getUptime() dari utility Vyzen
  const uptimeVyzen = getUptime(); 

  let menu = `
╭──❍「 ${toSmallText('user info')} 」❍
├⊱ ${toSmallText('nama')} : ${toSmallText(pushName)}
├⊱ ${toSmallText('status')} : ${toSmallText(userStatus)}
├⊱ ${toSmallText('limit')} : ${toSmallText(String(user.limit || 0))}
├⊱ ${toSmallText('money')} : ${toSmallText(String(user.money || 0))}
├⊱ ${toSmallText('level')} : ${toSmallText(String(user.level || 0))}
╰─┬────❍
╭─┴─❍「 ${toSmallText('bot info')} 」❍
├⊱ ${toSmallText('nama bot')} : ${toSmallText(botname)}
├⊱ ${toSmallText('owner')} : ${toSmallText('vyzen sensei')}
├⊱ ${toSmallText('mode')} : ${toSmallText(mode)}
├⊱ ${toSmallText('prefix')} : ${toSmallText(`[ ${prefix} ] [ ! ] [ / ]`)}
├⊱ ${toSmallText('user')} : ${toSmallText(`${totalUser} terdaftar`)}
╰─┬────❍
╭─┴─❍「 ${toSmallText('about')} 」❍
├⊱ ${toSmallText('tanggal')} : ${toSmallText(hariini)}
├⊱ ${toSmallText('jam')} : ${toSmallText(time)}
├⊱ ${toSmallText('uptime')} : ${toSmallText(uptimeVyzen)}
╰──────❍`

  if (tagArg === 'all') {
    const tags = Object.keys(featureData)
    menu += `\n`
    tags.forEach((tag, i) => {
      const cmds = featureData[tag]
      const symbol = getRandomSymbol()
      const categoryTitle = toSmallText(tag)
      menu += (i === 0)
        ? `\n╭──❍「 ${categoryTitle} 」❍\n`
        : `╭─┴❍「 ${categoryTitle} 」❍\n`
      menu += (cmds.length ? cmds.map(x => `│${symbol} ${x}`).join('\n') : `│${symbol} ${toSmallText('belum ada fitur')}`) + '\n'
      menu += (i < tags.length - 1 ? '╰─┬────❍\n' : '╰──────❍\n')
    })
  } else if (tagArg) {
    const symbol = getRandomSymbol()
    const categoryTitle = toSmallText(tagArg)
    menu += `
  
╭──❍「 ${categoryTitle} 」❍
${featureData.length ? featureData.map(x => `│${symbol} ${x}`).join('\n') : `│${symbol} ${toSmallText('belum ada fitur di kategori ini')}`}
╰──────❍`
  }

  const buttonMessage = {
    image: { url: thumbnailMain },
    caption: menu,
    footer: global.wm,
    buttons: flowActions,
    contextInfo: {
      forwardingScore: 99,
      isForwarded: true,
      externalAdReply: { title: botname, thumbnailUrl: thumbnailSmall, mediaType: 1, renderLargerThumbnail: false }
    },
    headerType: 4
  }

  try {
    await vyzen.sendMessage(m.chat, buttonMessage, { quoted: fdocMenu }) // Akan menggunakan fdocMenu versi vyzen2

    const musicRes = await fetchWithTimeout('https://raw.githubusercontent.com/maultzy/vyzen-dev/refs/heads/main/music.json')
    const musicData = await musicRes.json()
    const randomMusic = musicData[Math.floor(Math.random() * musicData.length)]
    
    // [MODIFIKASI DARI VYZEN2] Ambil URL jika ada, jika tidak, anggap randomMusic adalah URL
    const musicUrl = randomMusic.url || randomMusic;
    const opusBuffer = await toOpus(musicUrl) // Akan menggunakan toOpus versi vyzen2

    const fdocPttWithKata = {
      key: { remoteJid: 'status@broadcast', participant: '0@s.whatsapp.net' },
      message: {
        documentMessage: {
          title: `*${kataBijak}*`, // kataBijak sudah dari getRandomKata v2 (teks normal)
          jpegThumbnail: await (await fetch('https://files.catbox.moe/mj1m8y.jpg')).buffer()
        }
      }
    }

    await vyzen.sendMessage(m.chat, {
      audio: opusBuffer,
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true
    }, { quoted: fdocPttWithKata })

    await vyzen.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
  } catch (err) {
    console.error('Gagal proses menu:', err)
    // Mengirim pesan error yang lebih spesifik
    await vyzen.sendMessage(m.chat, { text: `⚠️ ${toSmallText('gagal memuat menu interaktif atau musik. menampilkan menu teks biasa.')}` }, { quoted: fdocMenu })
    // Fallback ke menu teks biasa jika interactive gagal
    await vyzen.sendMessage(m.chat, { text: menu + '\n\n' + global.wm }, { quoted: m });
  }
}

// [MODIFIKASI BARU] Menambahkan handler untuk menu mode 'vyzen2'
/**
 * Handles the menu display for Vyzen mode 2.
 * @param {object} m - The message object.
 * @param {object} params - Destructured parameters.
 */
const handleVyzenMenu2 = async (m, { conn, args, usedPrefix, command }) => {
  const vyzen = conn || m?.conn
  if (!vyzen) return console.error('Error: conn is undefined')

  const botname = global.info?.namebot || 'ʜᴜᴛᴀᴏ ᴍᴅ' // Menggunakan variabel botname yang ada
  const thumbnailMain = 'https://files.catbox.moe/8r79u0.jpg'
  const thumbnailSmall = 'https://files.catbox.moe/kaljyn.jpg'
  const prefix = usedPrefix || '.'

  const user = global.db?.data?.users[m.sender] || {}
  const userStatus = getUserStatus(m, vyzen, user) // Menggunakan helper global

  const groups = {}
  for (const name in global.plugins) {
    const p = global.plugins[name]
    if (!p || p.disabled) continue
    const tags = Array.isArray(p.tags) ? p.tags : (p.tags ? [p.tags] : [])
    for (const t of tags) {
      const tag = String(t || '').toLowerCase()
      if (!tag) continue
      groups[tag] = true
    }
  }
  const tagList = Object.keys(groups).sort()

  const menuSections = [
    {
      title: toSmallText("📚 Semua Kategori"),
      rows: [
        { title: toSmallText("All Menu"), description: toSmallText("Tampilkan semua fitur bot"), id: `${prefix}menu all` },
        ...tagList.map(t => ({
          title: toSmallText(`Menu ${t}`),
          description: toSmallText(`Daftar fitur kategori ${t}`),
          id: `${prefix}menu ${t}`
        }))
      ]
    }
  ];

  const infoSections = [
    {
      title: toSmallText("🔍 Informasi & Bantuan"),
      rows: [
        { title: toSmallText("👑 Owner"), description: toSmallText("Hubungi developer bot"), id: `${prefix}owner` },
        { title: toSmallText("🤖 Sewa Bot"), description: toSmallText("Lihat info harga sewa"), id: `${prefix}sewa` },
        { title: toSmallText("📜 Script"), description: toSmallText("Liat source code bot"), id: `${prefix}sc` },
        { title: toSmallText("⚡ Speed"), description: toSmallText("Cek kecepatan respon bot"), id: `${prefix}ping` }
      ]
    }
  ];
  
  const flowButtons = [
    {
      buttonId: 'menu_button',
      buttonText: { displayText: '📌 ᴏᴘᴇɴ ᴍᴇɴᴜ' },
      type: 4,
      nativeFlowInfo: {
        name: 'single_select',
        paramsJson: JSON.stringify({
          title: '✨ ᴘɪʟɪʜ ᴋᴀᴛᴇɢᴏʀɪ ᴍᴇɴᴜ',
          sections: menuSections
        })
      }
    },
    {
      buttonId: 'info_button',
      buttonText: { displayText: 'ℹ️ ɪɴғᴏ & ᴍᴏʀᴇ' },
      type: 4,
      nativeFlowInfo: {
        name: 'single_select',
        paramsJson: JSON.stringify({
          title: '✨ ɪɴғᴏ ᴛᴀᴍʙᴀʜᴀɴ',
          sections: infoSections
        })
      }
    }
  ];

  const totalUser = Object.keys(global.db?.data?.users || {}).length
  const mode = global.opts?.self ? 'ᴘʀɪᴠᴀᴛᴇ' : 'ᴘᴜʙʟɪᴄ'
  const pushName = m.pushName || 'ᴛᴀɴᴘᴀ ɴᴀᴍᴀ'
  const tagArg = (args && args[0] ? String(args[0]) : '').toLowerCase().trim()

  const getCommandList = (tag) => {
    if (tag === 'all') {
      const byTag = {}
      for (const name in global.plugins) {
        const p = global.plugins[name]
        if (!p || p.disabled) continue
        const helps = Array.isArray(p.help) ? p.help : (p.help ? [p.help] : [])
        const tags = Array.isArray(p.tags) ? p.tags : (p.tags ? [p.tags] : ['others'])
        tags.forEach(t => {
          const tagName = String(t).toLowerCase()
          if (!byTag[tagName]) byTag[tagName] = []
          helps.forEach(h => byTag[tagName].push(toSmallText(`${prefix}${h}`)))
        })
      }
      return byTag
    } else {
      const list = []
      let tagExists = false
      for (const name in global.plugins) {
        const p = global.plugins[name]
        if (!p || p.disabled) continue
        const helps = Array.isArray(p.help) ? p.help : (p.help ? [p.help] : [])
        const tags = Array.isArray(p.tags) ? p.tags : (p.tags ? [p.tags] : [])
        if (tags.map(t => String(t).toLowerCase()).includes(tag)) {
          tagExists = true
          helps.forEach(h => list.push(toSmallText(`${prefix}${h}`)))
        }
      }
      return tagExists ? list : null
    }
  }

  const featureData = tagArg ? getCommandList(tagArg) : null
  if (tagArg && featureData === null)
    return vyzen.sendMessage(m.chat, { text: `⚠️ ${toSmallText(`kategori ${tagArg} tidak ditemukan`)}` }, { quoted: fdocMenu }) // Menggunakan fdocMenu global

  const kataBijak = await getRandomKata() // Menggunakan getRandomKata global (yg sudah dimodif)

  // --- [FIX] Pindahkan definisi waktu ke dalam handler agar akurat ---
  const time = moment().tz('Asia/Jakarta').format('HH:mm:ss') + ' WIB'
  // --- [FIX] Hapus format 'dddd, ' (hari) dari tanggal ---
  const hariini = moment().tz('Asia/Jakarta').format('DD MMMM YYYY')

  // --- MODIFIKASI TAMPILAN MENU DIMULAI DISINI ---
  let menu = `╭━❖「 ${botname} 」❖━╮
┃
┃ ┯ *User Info*
┃ ┣» ${toSmallText('nama')} : ${toSmallText(pushName)}
┃ ┣» ${toSmallText('status')} : ${userStatus}
┃ ┣» ${toSmallText('limit')} : ${toSmallText(String(user.limit || 0))}
┃ ┣» ${toSmallText('money')} : ${toSmallText(String(user.money || 0))}
┃ ┗» ${toSmallText('level')} : ${toSmallText(String(user.level || 0))}
┃
┃ ┯ *Bot Info*
┃ ┣» ${toSmallText('nama bot')} : ${botname}
┃ ┣» ${toSmallText('owner')} : ${toSmallText('vyzen sensei')}
┃ ┣» ${toSmallText('mode')} : ${toSmallText(mode)}
┃ ┣» ${toSmallText('prefix')} : ${toSmallText(`[ ${prefix} ] [ ! ] [ / ]`)}
┃ ┗» ${toSmallText('user')} : ${toSmallText(`${totalUser} terdaftar`)}
┃
┃ ┯ *About*
┃ ┣» ${toSmallText('tanggal')} : ${toSmallText(hariini)}
┃ ┣» ${toSmallText('jam')} : ${toSmallText(time)}
┃ ┗» ${toSmallText('uptime')} : ${toSmallText(getUptime())}
`

  if (tagArg === 'all') {
    const tags = Object.keys(featureData)
    tags.forEach((tag, i) => {
      const cmds = featureData[tag]
      // Judul kategori dengan huruf kapital di awal dan diapit *
      const categoryTitle = '*' + tag.charAt(0).toUpperCase() + tag.slice(1) + '*'
      
      menu += `┃\n┃ ┯ ${categoryTitle}\n` // Separator + Judul Kategori
      
      if (cmds.length > 0) {
        cmds.forEach((cmd, j) => {
          // Cek apakah ini item terakhir di list
          const prefixCmd = (j === cmds.length - 1) ? '┗»' : '┣»' 
          menu += `┃ ${prefixCmd} ${cmd}\n` // cmd sudah di toSmallText dari getCommandList
        })
      } else {
        menu += `┃ ┗» ${toSmallText('belum ada fitur')}\n`
      }
    })
  } else if (tagArg) {
    // Judul kategori dengan huruf kapital di awal dan diapit *
    const categoryTitle = '*' + tagArg.charAt(0).toUpperCase() + tagArg.slice(1) + '*'
    menu += `┃\n┃ ┯ ${categoryTitle}\n` // Separator + Judul Kategori

    if (featureData.length > 0) {
      featureData.forEach((cmd, j) => {
        // Cek apakah ini item terakhir di list
        const prefixCmd = (j === featureData.length - 1) ? '┗»' : '┣»' 
        menu += `┃ ${prefixCmd} ${cmd}\n` // cmd sudah di toSmallText dari getCommandList
      })
    } else {
      menu += `┃ ┗» ${toSmallText('belum ada fitur di kategori ini')}\n`
    }
  }

  // Tambahkan footer di akhir
  menu += `┃\n╰━❖━━━━━━━━━━❖━╯`
  // --- MODIFIKASI TAMPILAN MENU SELESAI ---

  try {
    const interactiveMessage = {
      document: { url: thumbnailMain },
      mimetype: 'image/jpeg',
      fileName: botname,
      fileLength: 9999999999,
      caption: menu,
      footer: global.wm,
      buttons: flowButtons,
      headerType: 4,
      contextInfo: {
        forwardingScore: 99,
        isForwarded: true,
        externalAdReply: { 
          title: botname, 
          body: 'ʙᴏᴛ ᴀssɪsᴛᴀɴᴛ',
          thumbnailUrl: thumbnailSmall, 
          mediaType: 1, 
          renderLargerThumbnail: false 
        }
      }
    };
    
    await vyzen.sendMessage(m.chat, interactiveMessage, { quoted: fdocMenu }); // Menggunakan fdocMenu global

    const musicRes = await fetchWithTimeout('https://raw.githubusercontent.com/maultzy/vyzen-dev/refs/heads/main/music.json')
    const musicData = await musicRes.json()
    const randomMusic = musicData[Math.floor(Math.random() * musicData.length)]
    const opusBuffer = await toOpus(randomMusic.url || randomMusic) // Menggunakan toOpus global

    const fdocPttWithKata = {
      key: { remoteJid: 'status@broadcast', participant: '0@s.whatsapp.net' },
      message: {
        documentMessage: {
          title: `*${kataBijak}*`, // Menggunakan kataBijak global (teks normal)
          jpegThumbnail: await (await fetch('https://files.catbox.moe/mj1m8y.jpg')).buffer()
        }
      }
    }

    await vyzen.sendMessage(m.chat, {
      audio: opusBuffer,
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true
    }, { quoted: fdocPttWithKata })

    await vyzen.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (err) {
    console.error('Gagal proses menu interaktif:', err)
    await vyzen.sendMessage(m.chat, { text: menu + '\n\n' + global.wm }, { quoted: m });
    await vyzen.sendMessage(m.chat, { text: '⚠️ ɢᴀɢᴀʟ ᴍᴇᴍᴜᴀᴛ ᴍᴇɴᴜ ɪɴᴛᴇʀᴀᴋᴛɪғ. ᴍᴇɴᴀᴍᴘɪʟᴋᴀɴ ᴍᴇɴᴜ ᴛᴇᴋs ʙɪᴀsᴀ.' }, { quoted: fdocMenu }) // Menggunakan fdocMenu global
  }
}


/**
 * Handles Telegram callback queries for menu navigation.
 * @param {object} params - Destructured parameters.
 */
handler.callback = async ({ conn, callback_query }) => {
    const { id, from, message, data } = callback_query;
    const { chat, message_id } = message;

    if (data === 'menunoop') {
        return conn.answerCallbackQuery(id, { text: 'Current page indicator', show_alert: false });
    }

    const [command, pageStr] = data.split(' ');
    const pageNum = parseInt(pageStr) || 1;
    
    // Create a fake message object to pass to the handler
    const fakeMessage = {
        from: from,
        chat: { id: chat.id },
        message_id: message_id,
        text: command,
        platform: 'telegram'
    };
    
    const fakeArgs = [command.replace('/menu_', ''), pageNum];

    // Re-use the existing handler logic for consistency
    try {
        await handleTelegramMenu(fakeMessage, { conn, args: fakeArgs });
        await conn.answerCallbackQuery(id, { text: `Switched to page ${pageNum}`, show_alert: false });
    } catch (e) {
        console.error("Error in callback handler:", e);
        // Fallback or error message
        await conn.answerCallbackQuery(id, { text: 'An error occurred. Please try again.', show_alert: true });
    }
};

// -----------------------------------------------------------------------------
// HELPER FUNCTIONS (FUNGSI BANTUAN)
// -----------------------------------------------------------------------------

/**
 * Creates the dashboard caption text for WhatsApp using a template.
 * @param {string} name - User's name.
 * @param {object} user - User data object.
 * @param {boolean} isDev - Is the user a developer?
 * @param {boolean} isPremium - Is the user a premium user?
 * @param {object} conn - Connection object.
 * @param {object} m - Message object.
 * @param {object} template - The menu template object with 'before' and 'after' properties.
 * @returns {string} The formatted caption string.
 */
function createTemplatedDashboardCaption(name, user, isDev, isPremium, conn, m, template) {
    const totalreg = Object.keys(global.db.data.users).length;
    
    // Menggunakan fungsi runtime yang sudah digabungkan
    const uptime = runtime(process.uptime()); 
    
    // Logika sapaan yang diminta
    var hour = moment().tz('Asia/Jakarta').hour();
    var greetingMessage;
    switch(hour){
      case 0: greetingMessage = 'semoga malammu indah 🌙'; break;
      case 1: greetingMessage = 'semoga malammu tenang 💤'; break;
      case 2: greetingMessage = 'semoga malammu sepi 🦉'; break;
      case 3: greetingMessage = 'semoga pagi ini indah ✨'; break;
      case 4: greetingMessage = 'semoga pagi ini cerah 💫'; break;
      case 5: greetingMessage = 'semoga pagi ini damai 🌅'; break;
      case 6: greetingMessage = 'semoga pagi ini menyegarkan 🌄'; break;
      case 7: greetingMessage = 'semoga pagi ini ceria 🌅'; break;
      case 8: greetingMessage = 'semoga harimu bersinar 💫'; break;
      case 9: greetingMessage = 'semoga harimu menyenangkan ✨'; break;
      case 10: greetingMessage = 'semoga harimu baik 🌞'; break;
      case 11: greetingMessage = 'semoga harimu lancar 🌨'; break;
      case 12: greetingMessage = 'semoga harimu sejuk ❄'; break;
      case 13: greetingMessage = 'semoga harimu cerah 🌤'; break;
      case 14: greetingMessage = 'semoga soremu tenang 🌇'; break;
      case 15: greetingMessage = 'semoga soremu indah 🥀'; break;
      case 16: greetingMessage = 'semoga soremu menyenangkan 🌹'; break;
      case 17: greetingMessage = 'semoga soremu damai 🌆'; break;
      case 18: greetingMessage = 'semoga malammu tenang 🌙'; break;
      case 19: greetingMessage = 'semoga malammu damai 🌃'; break;
      case 20: greetingMessage = 'semoga malammu cerah 🌌'; break;
      case 21: greetingMessage = 'semoga malammu nyaman 🌃'; break;
      case 22: greetingMessage = 'semoga malammu sejuk 🌙'; break;
      case 23: greetingMessage = 'semoga malammu sunyi 🌃'; break;
    }
    var greeting = "saya harap kamu memiliki " + greetingMessage;

    const readmore = String.fromCharCode(8206).repeat(4001);

    let text = template.before
        .replace(/%name/g, name)
        .replace(/%greeting/g, greeting)
        .replace(/%uptime/g, uptime)
        .replace(/%totalreg/g, totalreg.toString())
        .replace(/%readmore/g, readmore);
        
    return text;
}

/**
 * Creates the menu section for a specific tag with the new formatting.
 * @param {string} tag - The name of the tag.
 * @param {string[]} commands - Array of command strings.
 * @param {string} usedPrefix - The bot's command prefix.
 * @returns {string} The formatted features caption.
 */
function createFeaturesCaptionForTag(tag, commands, usedPrefix) {
    let caption = `\n\`\`\`──「 M E N U  ${tag} 」──\`\`\`\n`;
    const lastIndex = commands.length - 1;
    commands.forEach((cmd, index) => {
        const linePrefix = index === lastIndex ? '     └' : '     │';
        caption += `\n${linePrefix}  ⭓  ${usedPrefix}${cmd}`;
    });
    return caption;
}

/**
 * Sends the registration menu for new users on WhatsApp.
 * @param {object} m - The message object.
 * @param {object} conn - The connection object.
 */
async function sendRegistrationMenu(m, conn) {
    const pp = await conn.profilePictureUrl(m.sender, "image").catch(() => global.img);
    const primaryOwnerJid = global.owner[0][0] + '@s.whatsapp.net';
    const registerOptions = [
        { header: '🔓 Verify Akun', title: 'Verifikasi akun Anda', description: 'Pastikan akun Anda terverifikasi untuk akses penuh.', id: '@verify' },
        { header: '🔐 Daftar Sekarang', title: 'Daftar dengan nama Anda', description: 'Contoh: .daftar ubed atau .daftar ubed.20', id: '.register' },
        { header: '📞 Ubed CS', title: 'Hubungi Owner untuk bantuan', description: 'Jika ada masalah atau pertanyaan.', id: '.owner' }
    ];

    await conn.sendMessage(m.chat, {
        product: {
            productImage: { url: pp },
            productId: '9999999999999999',
            title: `🌟 Hai Kak ${await conn.getName(m.sender)}!`,
            description: `Selamat datang di Ubed Bot, sebelum menggunakan Ubed Bot, sebaiknya daftar dulu ya agar bisa menggunakan Fitur yang ada di Ubed Bot🍏\n\n\`Cara Daftar Nya\`\n.daftar nama\n\n\`\`\`Contoh:\`\`\` .daftar ubed\n\n\`REST API UBED\`\nhttps://api.ubed.my.id\n\nJika Kurang Paham Kamu Bisa Bertanya Sama Owner\n\`\`\`Ketuk tombol:\`\`\` Ubed CS\`\n\n🍏 .daftar nama.umur\n🍏 Pencet tombol Verify di bawah`.trim(),
            currencyCode: 'IDR',
            priceAmount1000: '0',
            retailerId: 'register_info',
            url: 'https://linkbio.co/Ubedbot',
            productImageCount: 1
        },
        businessOwnerJid: primaryOwnerJid,
        caption: '> © 2025 - Ubed Bot\nDaftar Dulu Yuks Kak sebelum menggunakan perintah Bot ! 💐',
        title: '✨ Daftar Dulu Yuk! ✨',
        subtitle: 'Akses Fitur Eksklusif Menantimu!',
        interactiveButtons: [{
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
                title: 'Pilih Opsi Pendaftaran',
                sections: [{
                    title: 'Tindakan Penting',
                    highlight_label: 'Pilih Salah Satu',
                    rows: registerOptions
                }]
            })
        }],
        showAdAttribution: true
    }, { quoted: m });
}

/**
 * Creates the tags section for text/gambar menu modes.
 * @param {string[]} tags - Array of tags.
 * @param {string} usedPrefix - The bot's command prefix.
 * @returns {string} The formatted tags section.
 */
function createTagsSection(tags, usedPrefix) {
    const menuListFormatted = tags.map(tag => `│ ⿻ ${usedPrefix}menu ${tag}`).join('\n');
    return `
╭──❍ *𝙿𝙸𝙻𝙸𝙷𝙰𝙽 𝙼𝙴𝙽𝚄 𝙱𝙴𝚁𝙳𝙰𝚂𝙰𝚁𝙺𝙰𝙽 𝚃𝙰𝙶𝚂*
${menuListFormatted}
╰──────────────
_𝙺𝚎𝚝𝚒𝚔 ${usedPrefix}menu [nama_tags] 𝚞𝚗𝚝𝚞𝚔 𝚖𝚎𝚗𝚊𝚖𝚙𝚒𝚕𝚔𝚊𝚗 𝚖𝚎𝚗𝚞 𝚔𝚊𝚝𝚎gori 𝚝𝚎𝚛𝚜𝚎𝚋𝚞𝚝._
`.trim();
}

/**
 * Creates the interactive buttons for WhatsApp menu.
 * @param {string[]} tags - Array of tags.
 * @returns {object} The interactive button list object.
 */
function createInteractiveButtons(tags) {
    const tagRows = tags.map(tag => ({
        header: `𝙼𝚎𝚗𝚞 ${tag.charAt(0).toUpperCase() + tag.slice(1)}`,
        title: `Tampilkan Menu ${tag.charAt(0).toUpperCase() + tag.slice(1)}`,
        description: `Lihat daftar menu ${tag}`,
        id: `.menu ${tag}`
    }));

    return {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
            title: 'Lihat Daftar Menu',
            sections: [
                {
                    title: 'Kategori Bot & Bantuan',
                    highlight_label: 'Pilih Kategori',
                    rows: tagRows
                },
                {
                    title: 'Tindakan Penting',
                    highlight_label: 'Pilih Salah Satu',
                    rows: [
                        { header: '📑 𝚂𝚎𝚖𝚞𝚊 𝙼𝚎𝚗𝚞', title: 'Tampilkan semua perintah bot', description: 'Lihat daftar lengkap fitur bot.', id: '.menu all' },
                        { header: '✆ 𝚄𝚋𝚎𝚍 𝙲𝚂', title: 'Hubungi pengembang bot', description: 'Untuk bantuan atau pertanyaan.', id: '.owner' }
                    ]
                }
            ]
        })
    };
}

/**
 * Creates the main inline buttons for Telegram menu.
 * @param {object[]} plugins - Array of plugin objects.
 * @returns {object} The inline keyboard object.
 */
function createTelegramMainButtons(plugins) {
    const keyboard = [];
    const allTags = [...new Set(plugins.flatMap(p => p.tags || []))].sort();
    
    keyboard.push([{ text: '⿻ Semua Menu', callback_data: '/menu_all' }]);
    
    for (let i = 0; i < allTags.length; i += 2) {
        const row = [];
        row.push({ text: `⿻ ${allTags[i].charAt(0).toUpperCase() + allTags[i].slice(1)}`, callback_data: `/menu_${allTags[i]}` });
        if (allTags[i + 1]) {
            row.push({ text: `⿻ ${allTags[i + 1].charAt(0).toUpperCase() + allTags[i + 1].slice(1)}`, callback_data: `/menu_${allTags[i + 1]}` });
        }
        keyboard.push(row);
    }
    
    keyboard.push([
        { text: '⿻ 𝗪𝗲𝗯𝘀𝗶𝘁𝗲', url: 'https://api.ubed.my.id' },
        { text: '⿻ 𝗖𝗵𝗮𝗻𝗻𝗲𝗹', url: 'https://t.me/Punyaliana' }
    ]);
    
    return { inline_keyboard: keyboard };
}

/**
 * Creates pagination buttons for Telegram menu.
 * @param {number} currentPage - The current page number.
 * @param {number} totalPages - The total number of pages.
 * @param {string} commandType - The base command for navigation.
 * @returns {object} The inline keyboard object.
 */
function createPaginationButtons(currentPage, totalPages, commandType) {
    const keyboard = [];
    
    if (totalPages > 1) {
        const navRow = [];
        if (currentPage > 1) {
            navRow.push({ text: '⿻ ◀ Previous', callback_data: `${commandType} ${currentPage - 1}` });
        }
        navRow.push({ text: `⿻ Page ${currentPage}/${totalPages}`, callback_data: 'menunoop' });
        if (currentPage < totalPages) {
            navRow.push({ text: '⿻ Next ▶', callback_data: `${commandType} ${currentPage + 1}` });
        }
        keyboard.push(navRow);
    }
    
    keyboard.push([{ text: '⿻ Kembali ke Menu Utama', callback_data: '/start' }]);
    
    return { inline_keyboard: keyboard };
}

// Properti handler dari file asli (BaseMenu) dipertahankan
handler.command = ['menu', 'start']
handler.help = ['menu <tags>', 'start']
handler.tags = ['main', 'tags']
// Properti 'register' dari VyzenMenu dipertahankan
handler.register = true 

export default handler;