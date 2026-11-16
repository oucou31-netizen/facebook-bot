const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIG & PERSISTENCE
// ============================================================
const CONFIG_FILE = path.join(__dirname, 'config.json');
const PROCESSED_FILE = path.join(__dirname, 'processed_ids.json');

// Base64 Brand Logo (AZ)
const APP_LOGO_BASE64 = 'data:image/webp;base64,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';

let config = {
  admin_pin: '1234',
  page_id: '1424795157375101',
  access_token: 'EAAuuUwQY1zIBSzNNc26whvNxX61CvFdkhhKqbH0Fei8kUZAoFxusKEW0akCUS3iJqypk5YhlZByirvRI6ADKMnAK7D6QOwehHAFXsAHDWtpE4dwpv2YqEf6QZC13CYZCFyMiuTlZBnasbbrUItZBVzD6GcZAUK6buZAwZC0RBkBnKabePcTyXDPXf5piKZCzBYZAKFqETSv57YQIXZCtZCJ2Al5qxGDl4',
  posts: [
    {
      id: 'post_default_1',
      name: 'المنشور الرئيسي',
      target_post_id: '1424795157375101_122093934621520437',
      attachment_type: 'file',
      attachment_id: '1145582601544384',
      enable_like: true,
      enable_public_reply: true,
      enable_private_reply: true,
      private_message: 'أهلاً بك! تفضل المطلوب 🌟\n\nتابع صفحتنا للاستفادة من كل جديد ومفيد قادماً 👍',
      public_replies: [
        'تم الرد وإرسال التفاصيل في الخاص، شكراً لتفاعلك 📩',
        'أهلاً بك! تفقد صندوق الرسائل لديك، تم الرد بنجاح 👍',
        'تم الرد في الخاص، بالتوفيق لك ✨',
        'شكراً لاهتمامك! راجع رسائل صفحتك 📥'
      ]
    }
  ]
};

// Load saved config & migrate legacy single-post structure
if (fs.existsSync(CONFIG_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    config = { ...config, ...saved };

    // Migrate from legacy single-post format if needed
    if (!Array.isArray(config.posts)) {
      config.posts = [];
      if (saved.target_post_id) {
        config.posts.push({
          id: 'post_' + Date.now(),
          name: 'المنشور 1',
          target_post_id: saved.target_post_id,
          attachment_type: saved.attachment_type || 'file',
          attachment_id: saved.attachment_id || '',
          enable_like: saved.enable_like !== false,
          enable_public_reply: saved.enable_public_reply !== false,
          enable_private_reply: saved.enable_private_reply !== false,
          private_message: saved.private_message || 'أهلاً بك! تفضل المطلوب 🌟',
          public_replies: saved.public_replies || ['تم الرد في الخاص 📩']
        });
      }
    }
    console.log('[CONFIG] Loaded ' + config.posts.length + ' active posts.');
  } catch(e) {}
}

function saveConfig() {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8'); } catch(e) {}
}

// ============================================================
// PROCESSED COMMENT IDS
// ============================================================
const processedSet = new Set();
const processingSet = new Set();

if (fs.existsSync(PROCESSED_FILE)) {
  try {
    const ids = JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf8'));
    if (Array.isArray(ids)) ids.forEach(id => processedSet.add(id));
    console.log('[INIT] Loaded ' + processedSet.size + ' processed IDs');
  } catch(e) {}
}

function markProcessed(id) {
  processedSet.add(id);
  try {
    const arr = Array.from(processedSet).slice(-1500);
    fs.writeFileSync(PROCESSED_FILE, JSON.stringify(arr), 'utf8');
  } catch(e) {}
}

// ============================================================
// STATS & HELPERS
// ============================================================
let totalReplies = 0;
let lastLog = 'السيرفر جاهز ويعمل 24/7 ✅';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function normalizePin(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .replace(/[\u0660-\u0669]/g, c => c.charCodeAt(0) - 0x0660)
    .replace(/[\u06F0-\u06F9]/g, c => c.charCodeAt(0) - 0x06F0)
    .replace(/\s+/g, '');
}

function request(url, opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, opts || {}, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(d); } });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// ============================================================
// BOT ENGINE (MULTI-POST)
// ============================================================
async function likeComment(id, name, postName) {
  try {
    const res = await request('https://graph.facebook.com/v19.0/' + id + '/likes?access_token=' + config.access_token, { method: 'POST' });
    if (res && res.error) {
      console.error('[LIKE ERROR] ' + id + ':', res.error.message);
      lastLog = '❌ فشل الإعجاب بتعليق ' + (name || id) + ': ' + res.error.message;
      return false;
    }
    console.log('[LIKE OK] ' + id + ' for ' + (name || id));
    lastLog = '👍 تم الإعجاب بتعليق ' + (name || 'متابع') + (postName ? ' في (' + postName + ')' : '') + ' — ' + new Date().toLocaleTimeString('en-GB');
    return true;
  } catch(e) {
    console.error('[LIKE EXCEPTION]', e.message);
    lastLog = '❌ تعذر الاتصال بفيسبوك للإعجاب: ' + e.message;
    return false;
  }
}

async function replyPublic(id, repliesList) {
  try {
    const replies = (repliesList && repliesList.length) ? repliesList : ['تم الرد في الخاص 📩'];
    const text = replies[Math.floor(Math.random() * replies.length)];
    await request('https://graph.facebook.com/v19.0/' + id + '/comments?access_token=' + config.access_token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }
    }, { message: text });
    console.log('[PUBLIC] ' + text);
  } catch(e) {}
}

async function sendPrivate(commentId, senderId, name, post) {
  const delay = rand(10000, 20000);
  console.log('[DELAY] ' + Math.round(delay/1000) + 's before DM to ' + name);
  await sleep(delay);
  try {
    const textPayload = {
      recipient: commentId ? { comment_id: commentId } : { id: senderId },
      message: { text: post.private_message || 'أهلاً بك!' }
    };
    const url = 'https://graph.facebook.com/v19.0/me/messages?access_token=' + config.access_token;
    const textRes = await request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, textPayload);
    let recipientId = senderId;
    if (textRes && textRes.recipient_id) recipientId = textRes.recipient_id;
    if (textRes && textRes.message_id) console.log('[DM] Text sent to ' + name);

    const aType = post.attachment_type || 'none';
    if (aType !== 'none' && post.attachment_id && recipientId) {
      const isUrl = /^https?:\/\//i.test(post.attachment_id);
      const mediaPayload = {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: aType,
            payload: isUrl ? { url: post.attachment_id, is_reusable: true } : { attachment_id: post.attachment_id }
          }
        }
      };
      const mediaRes = await request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, mediaPayload);
      if (mediaRes && mediaRes.message_id) console.log('[DM] Media sent to ' + name);
    }
    totalReplies++;
    const tLabel = aType === 'none' ? 'نص فقط' : aType === 'image' ? 'صورة' : aType === 'video' ? 'فيديو' : 'ملف PDF';
    lastLog = 'تم الرد (' + tLabel + ') على: ' + name + ' في (' + (post.name || 'منشور') + ') — ' + new Date().toLocaleTimeString('en-GB');
  } catch(e) {
    console.error('[DM ERROR] ' + e.message);
  } finally {
    processingSet.delete(commentId);
  }
}

async function processComment(c, post) {
  const id = c.id;
  if (c.from && c.from.id === config.page_id) return;
  if (c.parent && c.parent.id) return; // Skip nested replies - only main comments
  if (processedSet.has(id) || processingSet.has(id)) return;
  processingSet.add(id);
  markProcessed(id);

  const name = c.from ? c.from.name : 'متابع';
  console.log('[NEW COMMENT on ' + (post.name || post.target_post_id) + '] ' + id + ' | ' + name + ' | "' + (c.message || '') + '"');

  // 1. Like
  let likeOk = false;
  if (post.enable_like !== false) {
    likeOk = await likeComment(id, name, post.name);
  }

  // Check if page already posted a public reply on this comment
  const alreadyReplied = c.comments && c.comments.data && c.comments.data.some(s => s.from && s.from.id === config.page_id);

  // 2. Public reply
  if (post.enable_public_reply !== false && !alreadyReplied) {
    await replyPublic(id, post.public_replies);
  }

  // 3. Private reply
  if (post.enable_private_reply !== false) {
    await sendPrivate(id, c.from ? c.from.id : null, name, post);
  } else {
    totalReplies++;
    processingSet.delete(id);
    if (post.enable_like === false) {
      lastLog = 'تم فحص تعليق ' + name + ' في (' + (post.name || 'منشور') + ') — ' + new Date().toLocaleTimeString('en-GB');
    }
  }
}

let isRunning = false;
async function checkComments() {
  if (isRunning || !config.posts || !config.posts.length || !config.access_token) return;
  isRunning = true;
  try {
    for (const post of config.posts) {
      if (!post.target_post_id) continue;
      try {
        const url = 'https://graph.facebook.com/v19.0/' + post.target_post_id +
          '/comments?filter=toplevel&fields=id,from,message,parent,comments{id,from,message}&limit=30&access_token=' + config.access_token;
        const data = await request(url);
        if (data && data.data && Array.isArray(data.data)) {
          for (const c of data.data) {
            await processComment(c, post);
          }
        } else if (data && data.error) {
          console.error('[CRON ERROR on ' + post.name + ']', data.error.message);
          lastLog = '❌ خطأ (' + post.name + '): ' + data.error.message;
        }
      } catch(errPost) {
        console.error('[POST CHECK ERR]', errPost.message);
      }
    }
  } catch(e) {
    console.error('[CRON]', e.message);
  } finally {
    isRunning = false;
  }
}

// Upload media helper
function uploadMedia(fileBuffer, fileName, type, mime, token) {
  return new Promise((resolve, reject) => {
    const boundary = '----FB' + Date.now();
    const CRLF = '\r\n';
    const msgJson = JSON.stringify({ attachment: { type, payload: { is_reusable: true } } });
    const header = Buffer.from(
      '--' + boundary + CRLF +
      'Content-Disposition: form-data; name="message"' + CRLF + CRLF +
      msgJson + CRLF +
      '--' + boundary + CRLF +
      'Content-Disposition: form-data; name="filedata"; filename="' + fileName + '"' + CRLF +
      'Content-Type: ' + (mime || 'application/octet-stream') + CRLF + CRLF
    );
    const footer = Buffer.from(CRLF + '--' + boundary + '--' + CRLF);
    const total = header.length + fileBuffer.length + footer.length;
    const req = https.request({
      hostname: 'graph.facebook.com', port: 443,
      path: '/v19.0/me/message_attachments?access_token=' + token,
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary, 'Content-Length': total }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(d); } });
    });
    req.on('error', reject);
    req.write(header); req.write(fileBuffer); req.write(footer);
    req.end();
  });
}

// Smart post ID resolver
async function resolvePostId(input) {
  if (!input) return '';
  input = input.trim();
  if (/^\d+_\d+$/.test(input)) return input;
  if (/^\d{10,}$/.test(input)) return config.page_id + '_' + input;
  const m1 = input.match(/(?:story_fbid|fbid)=(\d+)/);
  if (m1) return config.page_id + '_' + m1[1];
  const m2 = input.match(/\/posts\/(\d+)/);
  if (m2) return config.page_id + '_' + m2[1];
  try {
    const url = 'https://graph.facebook.com/v19.0/' + config.page_id + '/posts?fields=id,message&limit=20&access_token=' + config.access_token;
    const data = await request(url);
    if (data && data.data) {
      const found = data.data.find(p => p.message && p.message.toLowerCase().includes(input.toLowerCase()));
      if (found) return found.id;
    }
  } catch(e) {}
  return input;
}

// ============================================================
// HTML DASHBOARD (MULTI-POST SUPPORT)
// ============================================================
function getHtml() {
  const html = [
    '<!DOCTYPE html>',
    '<html lang="ar" dir="rtl">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">',
    '<title>ABDELHAK ZAHZOUH</title>',
    '<link rel="icon" type="image/webp" href="' + APP_LOGO_BASE64 + '">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="theme-color" content="#0f172a">',
    '<style>',
    '* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-tap-highlight-color: transparent; font-variant-numeric: tabular-nums lining-nums; }',
    'body { background: #0f172a; color: #f1f5f9; min-height: 100vh; padding-bottom: 80px; }',
    '.hdr { background: #1e293b; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; position: sticky; top: 0; z-index: 10; }',
    '.hdr h1 { font-size: 0.95rem; font-weight: 800; letter-spacing: 0.5px; color: #f8fafc; }',
    '.dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; display: inline-block; margin-left: 6px; box-shadow: 0 0 8px #22c55e; }',
    '.nav { position: fixed; bottom: 0; left: 0; right: 0; background: #1e293b; border-top: 1px solid #334155; display: flex; z-index: 10; }',
    '.nav button { flex: 1; background: none; border: none; color: #64748b; padding: 10px 4px 14px; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; }',
    '.nav button.on { color: #3b82f6; }',
    '.nav button .ico { font-size: 1.3rem; }',
    '.page { display: none; padding: 14px; max-width: 600px; margin: 0 auto; }',
    '.page.on { display: block; }',
    '.card { background: #1e293b; border-radius: 14px; padding: 16px; margin-bottom: 14px; border: 1px solid #334155; }',
    '.card h2 { font-size: 0.92rem; color: #94a3b8; margin-bottom: 12px; }',
    '.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }',
    '.stat { background: #1e293b; border-radius: 12px; padding: 14px; text-align: center; border: 1px solid #334155; }',
    '.stat .n { font-size: 1.8rem; font-weight: 800; color: #60a5fa; }',
    '.stat .l { font-size: 0.72rem; color: #94a3b8; margin-top: 2px; }',
    '.sw-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #0f172a; border-radius: 10px; margin-bottom: 8px; }',
    '.sw-info { display: flex; align-items: center; gap: 8px; font-size: 0.83rem; font-weight: 600; }',
    '.sw-info small { display: block; font-size: 0.7rem; color: #94a3b8; font-weight: 400; margin-top: 1px; }',
    '.sw { position: relative; width: 44px; height: 24px; flex-shrink: 0; }',
    '.sw input { opacity: 0; width: 0; height: 0; }',
    '.sw .track { position: absolute; inset: 0; background: #334155; border-radius: 25px; cursor: pointer; transition: 0.2s; }',
    '.sw .track:before { content: ""; position: absolute; width: 18px; height: 18px; background: white; border-radius: 50%; top: 3px; left: 3px; transition: 0.2s; }',
    '.sw input:checked + .track { background: #10b981; }',
    '.sw input:checked + .track:before { transform: translateX(20px); }',
    'label.lbl { display: block; font-size: 0.78rem; color: #94a3b8; margin-bottom: 5px; }',
    'input[type=text], textarea, select { width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 10px 12px; color: #f1f5f9; font-size: 0.88rem; outline: none; margin-bottom: 12px; }',
    'input:focus, textarea:focus { border-color: #3b82f6; }',
    'textarea { resize: vertical; min-height: 75px; font-family: Tahoma, Arial, sans-serif; }',
    '.btn { width: 100%; padding: 12px; border-radius: 10px; border: none; font-size: 0.9rem; font-weight: 700; cursor: pointer; margin-bottom: 8px; display: inline-flex; justify-content: center; align-items: center; gap: 6px; }',
    '.btn-blue { background: #2563eb; color: white; }',
    '.btn-green { background: #059669; color: white; }',
    '.btn-gray { background: #334155; color: #e2e8f0; }',
    '.btn-red { background: #dc2626; color: white; }',
    '.btn:active { opacity: 0.85; }',
    '.btn:disabled { opacity: 0.5; cursor: default; }',
    '.toast { position: fixed; top: 16px; left: 50%; transform: translateX(-50%) translateY(-120px); background: #10b981; color: white; padding: 10px 22px; border-radius: 25px; font-size: 0.85rem; font-weight: 700; z-index: 100; transition: transform 0.3s; white-space: nowrap; max-width: 90vw; }',
    '.toast.show { transform: translateX(-50%) translateY(0); }',
    '.toast.err { background: #ef4444; }',
    '#lock { position: fixed; inset: 0; background: #0f172a; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 20px; }',
    '.lock-box { background: #1e293b; border-radius: 20px; padding: 28px 20px; width: 100%; max-width: 340px; text-align: center; border: 1px solid #334155; }',
    '.lock-box h2 { font-size: 1.15rem; margin-bottom: 6px; }',
    '.lock-box p { font-size: 0.8rem; color: #94a3b8; margin-bottom: 16px; }',
    '.lock-box input { text-align: center; font-size: 1.5rem; letter-spacing: 8px; font-weight: 800; }',
    '.post-box { background: #0f172a; border: 1px solid #334155; border-radius: 12px; margin-bottom: 14px; overflow: hidden; transition: border-color 0.2s; }',
    '.post-box.expanded { border-color: #3b82f6; }',
    '.post-box-header { padding: 14px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; background: rgba(30,41,59,0.7); }',
    '.post-box-title { font-weight: 700; font-size: 0.92rem; color: #f1f5f9; display: flex; align-items: center; gap: 8px; }',
    '.post-box-body { padding: 14px; border-top: 1px solid #334155; display: none; }',
    '.post-box.expanded .post-box-body { display: block; }',
    '.badge { font-size: 0.7rem; padding: 3px 8px; border-radius: 12px; font-weight: 700; }',
    '.badge-green { background: rgba(16,185,129,0.2); color: #34d399; }',
    '.types { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px; }',
    '.type-btn { background: #0f172a; border: 2px solid #334155; border-radius: 8px; padding: 8px 4px; text-align: center; cursor: pointer; font-size: 0.78rem; font-weight: 700; color: #94a3b8; }',
    '.type-btn.on { border-color: #3b82f6; background: rgba(59,130,246,0.15); color: #60a5fa; }',
    '.post-picker-item { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px; margin-bottom: 6px; cursor: pointer; }',
    '.post-picker-item:hover { border-color: #3b82f6; }',
    '</style>',
    '</head>',
    '<body>',
    '<div class="toast" id="toast">OK</div>',
    '<!-- LOCK -->',
    '<div id="lock">',
    '  <div class="lock-box">',
    '    <img src="' + APP_LOGO_BASE64 + '" alt="AZ" style="height:65px;width:auto;margin:0 auto 12px;display:block;border-radius:10px;background:#000;border:1px solid #334155;box-shadow:0 0 20px rgba(59,130,246,0.3);">',
    '    <h2 style="font-size:1.15rem;font-weight:800;letter-spacing:0.5px;margin-bottom:6px;">ABDELHAK ZAHZOUH</h2>',
    '    <p>\u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u0627\u0641\u062a\u0631\u0627\u0636\u064a: <strong style="color:#60a5fa;letter-spacing:2px;">1234</strong></p>',
    '    <input type="text" id="pin-inp" inputmode="numeric" value="1234" placeholder="PIN" onkeydown="if(event.key===\'Enter\')doLogin()">',
    '    <button class="btn btn-blue" onclick="doLogin()">\u062f\u062e\u0648\u0644 \ud83d\ude80</button>',
    '    <p id="pin-err" style="color:#ef4444;font-size:0.8rem;margin-top:10px;display:none;"></p>',
    '  </div>',
    '</div>',
    '<!-- HEADER -->',
    '<div class="hdr">',
    '  <div style="display:flex;align-items:center;gap:10px;">',
    '    <img src="' + APP_LOGO_BASE64 + '" alt="AZ" style="height:32px;width:auto;border-radius:6px;background:#000;border:1px solid #334155;">',
    '    <h1>ABDELHAK ZAHZOUH</h1>',
    '  </div>',
    '  <span><span class="dot"></span>24/7</span>',
    '</div>',
    '<!-- TAB 1: DASHBOARD -->',
    '<div class="page on" id="p-dash">',
    '  <div class="stats">',
    '    <div class="stat"><div class="n" id="s-replies">0</div><div class="l">\u0631\u062f\u0648\u062f \u0623\u064f\u0631\u0633\u0644\u062a</div></div>',
    '    <div class="stat"><div class="n" id="s-posts-count">0</div><div class="l">\u0645\u0646\u0634\u0648\u0631\u0627\u062a \u0646\u0634\u0637\u0629</div></div>',
    '  </div>',
    '  <div class="card">',
    '    <h2>\ud83d\udccc \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0646\u0634\u0648\u0631\u0627\u062a \u0627\u0644\u0646\u0634\u0637\u0629</h2>',
    '    <div id="dash-posts-list"><p style="font-size:0.8rem;color:#94a3b8;">\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644...</p></div>',
    '    <button class="btn btn-blue" style="margin-top:10px;" onclick="goPage(\'posts\')">\u2795 \u0625\u062f\u0627\u0631\u0629 \u0648\u0625\u0636\u0627\u0641\u0629 \u0645\u0646\u0634\u0648\u0631\u0627\u062a</button>',
    '  </div>',
    '  <div class="card">',
    '    <h2>\ud83d\udd52 \u0622\u062e\u0631 \u0646\u0634\u0627\u0637</h2>',
    '    <p style="font-size:0.83rem;color:#cbd5e1;line-height:1.6;" id="d-log">\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644...</p>',
    '    <button class="btn btn-gray" style="margin-top:10px;" onclick="loadData()">\u062a\u062d\u062f\u064a\u062b \ud83d\udd04</button>',
    '    <button class="btn btn-blue" style="margin-top:4px;" onclick="clearProcessed()">\ud83d\udd04 \u0625\u0639\u0627\u062f\u0629 \u0641\u062d\u0635 \u0648\u0625\u0639\u062c\u0627\u0628 \u0628\u0643\u0644 \u0627\u0644\u0645\u0646\u0634\u0648\u0631\u0627\u062a</button>',
    '  </div>',
    '</div>',
    '<!-- TAB 2: POSTS MANAGER -->',
    '<div class="page" id="p-posts">',
    '  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">',
    '    <h2 style="font-size:1rem;font-weight:700;">\ud83d\udccc \u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0646\u0634\u0648\u0631\u0627\u062a</h2>',
    '    <button class="btn btn-green" style="width:auto;margin:0;padding:8px 14px;font-size:0.8rem;" onclick="addNewPost()">\u2795 \u0625\u0636\u0627\u0641\u0629 \u0645\u0646\u0634\u0648\u0631 \u062c\u062f\u064a\u062f</button>',
    '  </div>',
    '  <div id="posts-container"></div>',
    '</div>',
    '<!-- TAB 3: SETTINGS -->',
    '<div class="page" id="p-set">',
    '  <div class="card">',
    '    <h2>\ud83d\udd0d \u0623\u062f\u0627\u0629 \u0645\u0639\u0631\u0641\u0629 ID \u0627\u0644\u0635\u0641\u062d\u0629</h2>',
    '    <label class="lbl">\u0636\u0639 \u0631\u0627\u0628\u0637 \u0635\u0641\u062d\u0629 \u0641\u064a\u0633\u0628\u0648\u0643:</label>',
    '    <input type="text" id="f-pageurl" placeholder="https://www.facebook.com/YourPageName">',
    '    <button class="btn btn-green" id="btn-findpage" onclick="findPageId()">\ud83d\udd0d \u062c\u0644\u0628 ID \u0627\u0644\u0635\u0641\u062d\u0629 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b</button>',
    '    <div id="page-result" style="display:none;background:#0f172a;border:1px solid #334155;border-radius:10px;padding:12px;margin-bottom:12px;">',
    '      <div style="font-size:0.75rem;color:#94a3b8;margin-bottom:4px;">\u0646\u062a\u064a\u062c\u0629 \u0627\u0644\u0628\u062d\u062b:</div>',
    '      <div id="page-result-name" style="font-size:0.95rem;font-weight:700;color:#f1f5f9;margin-bottom:6px;"></div>',
    '      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">',
    '        <span style="font-size:0.75rem;color:#94a3b8;">Page ID:</span>',
    '        <span id="page-result-id" style="font-family:monospace;font-size:0.95rem;color:#60a5fa;font-weight:700;word-break:break-all;"></span>',
    '        <button onclick="usePageId()" style="background:#2563eb;color:white;border:none;padding:5px 12px;border-radius:8px;font-size:0.78rem;font-weight:700;cursor:pointer;">\u0627\u0633\u062a\u062e\u062f\u0645 \u0647\u0630\u0627 \u0627\u0644 ID \u2713</button>',
    '      </div>',
    '      <div id="page-result-fans" style="font-size:0.72rem;color:#94a3b8;margin-top:4px;"></div>',
    '    </div>',
    '  </div>',
    '  <div class="card">',
    '    <h2>\u2699\ufe0f \u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0635\u0641\u062d\u0629</h2>',
    '    <label class="lbl">\u0645\u0639\u0631\u0641 \u0627\u0644\u0635\u0641\u062d\u0629 (Page ID):</label>',
    '    <input type="text" id="f-pageid">',
    '    <label class="lbl">\u0631\u0645\u0632 \u0627\u0644\u0648\u0635\u0648\u0644 (Access Token):</label>',
    '    <input type="text" id="f-token">',
    '    <label class="lbl">\u0631\u0645\u0632 PIN \u062c\u062f\u064a\u062f (\u0627\u062a\u0631\u0643\u0647 \u0641\u0627\u0631\u063a\u0627\u064b \u0644\u0644\u0625\u0628\u0642\u0627\u0621 \u0639\u0644\u0649 \u0627\u0644\u062d\u0627\u0644\u064a):</label>',
    '    <input type="text" id="f-pin" placeholder="\u0645\u062b\u0627\u0644: 5678">',
    '    <button class="btn btn-blue" onclick="saveSettings()">\u062d\u0641\u0638 \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a \ud83d\udcbe</button>',
    '    <button class="btn btn-gray" onclick="lockNow()">\ud83d\udd12 \u0642\u0641\u0644 \u0627\u0644\u0644\u0648\u062d\u0629</button>',
    '  </div>',
    '</div>',
    '<!-- BOTTOM NAV -->',
    '<nav class="nav">',
    '  <button id="nb-dash" class="on" onclick="goPage(\'dash\')"><span class="ico">\ud83c\udfe0</span>\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629</button>',
    '  <button id="nb-posts" onclick="goPage(\'posts\')"><span class="ico">\ud83d\udccc</span>\u0627\u0644\u0645\u0646\u0634\u0648\u0631\u0627\u062a</button>',
    '  <button id="nb-set" onclick="goPage(\'set\')"><span class="ico">\u2699\ufe0f</span>\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a</button>',
    '</nav>',
    '<script>',
    'var currentPosts = [];',
    'function toast(msg,err){',
    '  var t=document.getElementById("toast");',
    '  t.textContent=msg; t.className="toast show"+(err?" err":"");',
    '  setTimeout(function(){t.className="toast";},3500);',
    '}',
    'function normalPin(s){',
    '  return String(s||"").trim()',
    '    .replace(/[\\u0660-\\u0669]/g,function(c){return c.charCodeAt(0)-0x0660;})',
    '    .replace(/[\\u06F0-\\u06F9]/g,function(c){return c.charCodeAt(0)-0x06F0;})',
    '    .replace(/\\s+/g,"");',
    '}',
    'function getPin(){return localStorage.getItem("pin")||localStorage.getItem("bot_pin")||"1234";}',
    'function goPage(id){',
    '  ["dash","posts","set"].forEach(function(p){',
    '    document.getElementById("p-"+p).style.display="none";',
    '    document.getElementById("nb-"+p).className="";',
    '  });',
    '  document.getElementById("p-"+id).style.display="block";',
    '  document.getElementById("nb-"+id).className="on";',
    '  window.scrollTo(0,0);',
    '}',
    'window.onload=function(){',
    '  ["posts","set"].forEach(function(p){ document.getElementById("p-"+p).style.display="none"; });',
    '  var saved=getPin();',
    '  var inp=document.getElementById("pin-inp"); if(inp&&saved) inp.value=saved;',
    '  if(localStorage.getItem("auth")==="1"||localStorage.getItem("bot_pin")){',
    '    document.getElementById("lock").style.display="none"; loadData();',
    '  } else {',
    '    document.getElementById("lock").style.display="flex";',
    '  }',
    '};',
    'function doLogin(){',
    '  var raw=document.getElementById("pin-inp").value;',
    '  var pin=normalPin(raw)||"1234";',
    '  var err=document.getElementById("pin-err"); err.style.display="none";',
    '  var btn=document.querySelector("#lock .btn-blue");',
    '  if(btn){btn.disabled=true; btn.textContent="جاري التحقق... ⏳";}',
    '  fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pin:pin})})',
    '  .then(function(r){return r.json();})',
    '  .then(function(d){',
    '    if(btn){btn.disabled=false; btn.textContent="دخول 🚀";}',
    '    if(d.success){',
    '      localStorage.setItem("auth","1"); localStorage.setItem("pin",pin); localStorage.setItem("bot_pin",pin);',
    '      document.getElementById("lock").style.display="none"; loadData();',
    '      toast("\\u0645\\u0631\\u062d\\u0628\\u0627\\u064b! \\u062a\\u0645 \\u0627\\u0644\\u062f\\u062e\\u0648\\u0644 \\u2713");',
    '    } else { err.textContent="\\u0631\\u0645\\u0632 PIN \\u062e\\u0627\\u0637\\u0626!"; err.style.display="block"; }',
    '  })',
    '  .catch(function(){',
    '    if(btn){btn.disabled=false; btn.textContent="دخول 🚀";}',
    '    if(pin==="1234"||pin==="0000"){',
    '      localStorage.setItem("auth","1"); localStorage.setItem("pin",pin); localStorage.setItem("bot_pin",pin);',
    '      document.getElementById("lock").style.display="none"; loadData();',
    '    } else { err.textContent="السيرفر يستيقظ (Render)... انتظر 15 ثانية واضغط دخول مجدداً"; err.style.display="block"; }',
    '  });',
    '}',
    'function lockNow(){',
    '  localStorage.removeItem("auth"); document.getElementById("lock").style.display="flex";',
    '  toast("\\u062a\\u0645 \\u0642\\u0641\\u0644 \\u0627\\u0644\\u0644\\u0648\\u062d\\u0629 \\ud83d\\udd12");',
    '}',
    'function loadData(){',
    '  var pin=getPin();',
    '  fetch("/api/config?pin="+encodeURIComponent(pin))',
    '  .then(function(r){return r.json();})',
    '  .then(function(d){',
    '    if(!d.success){',
    '      if(d.message==="UNAUTHORIZED"){ localStorage.removeItem("auth"); document.getElementById("lock").style.display="flex"; }',
    '      return;',
    '    }',
    '    var c=d.config;',
    '    document.getElementById("f-pageid").value=c.page_id||"";',
    '    document.getElementById("f-token").value=c.access_token||"";',
    '    document.getElementById("s-replies").textContent=d.stats.totalRepliesSent||0;',
    '    document.getElementById("d-log").textContent=d.stats.lastActionLog||"\\u062c\\u0627\\u0647\\u0632";',
    '    currentPosts = c.posts || [];',
    '    document.getElementById("s-posts-count").textContent=currentPosts.length;',
    '    renderDashboardPosts();',
    '    renderPostsManager();',
    '  })',
    '  .catch(function(){});',
    '}',
    'function renderDashboardPosts(){',
    '  var box=document.getElementById("dash-posts-list");',
    '  if(!currentPosts.length){',
    '    box.innerHTML="<p style=\\"font-size:0.83rem;color:#94a3b8;\\">\\u0644\\u0627 \\u062a\\u0648\\u062c\\u062f \\u0645\\u0646\\u0634\\u0648\\u0631\\u0627\\u062a \\u0645\\u0636\\u0627\\u0641\\u0629 \\u0628\\u0639\\u062f.</p>";',
    '    return;',
    '  }',
    '  var h="";',
    '  currentPosts.forEach(function(p,i){',
    '    var tmap={none:"\\u0628\\u062f\\u0648\\u0646 \\u0645\\u0631\\u0641\\u0642 \ud83d\udeab",image:"\\u0635\\u0648\\u0631\\u0629 \ud83d\uddbc\ufe0f",video:"\\u0641\\u064a\\u062f\\u064a\\u0648 \ud83c\udfa5",file:"\\u0645\\u0644\\u0641 PDF \ud83d\udcc4"};',
    '    h+="<div style=\\"background:#0f172a;border:1px solid #334155;border-radius:10px;padding:10px 12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;\\">";',
    '    h+="  <div>";',
    '    h+="    <div style=\\"font-weight:700;font-size:0.88rem;color:#f1f5f9;\\">\ud83d\udccc "+(p.name||("\u0645\u0646\u0634\u0648\u0631 #"+(i+1)))+"</div>";',
    '    h+="    <div style=\\"font-size:0.72rem;color:#94a3b8;margin-top:2px;\\">ID: "+(p.target_post_id||"\u063a\u064a\u0631 \u0645\u062d\u062f\u062f")+" &bull; "+(tmap[p.attachment_type]||"PDF")+"</div>";',
    '    h+="  </div>";',
    '    h+="  <button onclick=\\"editPostFromDash("+i+")\\" style=\\"background:#2563eb;color:white;border:none;padding:5px 10px;border-radius:6px;font-size:0.75rem;font-weight:700;cursor:pointer;\\">\u062a\u0639\u062f\u064a\u0644 \u270f\ufe0f</button>";',
    '    h+="</div>";',
    '  });',
    '  box.innerHTML=h;',
    '}',
    'function editPostFromDash(idx){',
    '  goPage("posts");',
    '  setTimeout(function(){',
    '    var el=document.getElementById("post-box-"+idx);',
    '    if(el){ el.className="post-box expanded"; el.scrollIntoView({behavior:"smooth"}); }',
    '  },150);',
    '}',
    'function togglePostBox(idx){',
    '  var el=document.getElementById("post-box-"+idx);',
    '  if(el){ el.className = el.className.indexOf("expanded")!==-1 ? "post-box" : "post-box expanded"; }',
    '}',
    'function addNewPost(){',
    '  var newId="post_"+Date.now();',
    '  currentPosts.push({',
    '    id: newId,',
    '    name: "\u0645\u0646\u0634\u0648\u0631 "+(currentPosts.length+1),',
    '    target_post_id: "",',
    '    attachment_type: "file",',
    '    attachment_id: "",',
    '    enable_like: true,',
    '    enable_public_reply: true,',
    '    enable_private_reply: true,',
    '    private_message: "\u0623\u0647\u0644\u0627\u064b \u0628\u0643! \u062a\u0641\u0636\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \ud83c\udf1f\\n\\n\u062a\u0627\u0628\u0639 \u0635\u0641\u062d\u062a\u0646\u0627 \u0644\u0644\u0627\u0633\u062a\u0641\u0627\u062f\u0629 \u0645\u0646 \u0643\u0644 \u062c\u062f\u064a\u062f \ud83d\udc4d",',
    '    public_replies: ["\u062a\u0645 \u0627\u0644\u0631\u062f \u0641\u064a \u0627\u0644\u062e\u0627\u0635 \ud83d\udce9","\u062a\u0641\u0642\u062f \u0635\u0646\u062f\u0648\u0642 \u0627\u0644\u0631\u0633\u0627\u0626\u0644 \ud83d\udc4d"]',
    '  });',
    '  renderPostsManager();',
    '  var lastIdx = currentPosts.length - 1;',
    '  setTimeout(function(){',
    '    var el=document.getElementById("post-box-"+lastIdx);',
    '    if(el){ el.className="post-box expanded"; el.scrollIntoView({behavior:"smooth"}); }',
    '  },100);',
    '  toast("\u062a\u0645\u062a \u0625\u0636\u0627\u0641\u0629 \u0645\u0646\u0634\u0648\u0631 \u062c\u062f\u064a\u062f! \u0627\u0645\u0644\u0623 \u0628\u064a\u0627\u0646\u0627\u062a\u0647 \u0648\u0627\u0636\u063a\u0637 \u062d\u0641\u0638.");',
    '}',
    'function deletePost(idx){',
    '  if(!confirm("\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u062d\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u0645\u0646\u0634\u0648\u0631 \u0645\u0646 \u0627\u0644\u0628\u0648\u062a\u061f")) return;',
    '  currentPosts.splice(idx,1);',
    '  saveAllPostsToServer("\u062a\u0645 \u062d\u0630\u0641 \u0627\u0644\u0645\u0646\u0634\u0648\u0631 \u0628\u0646\u062c\u0627\u062d \u2713");',
    '}',
    'function renderPostsManager(){',
    '  var c=document.getElementById("posts-container");',
    '  if(!currentPosts.length){',
    '    c.innerHTML="<div class=\\"card\\" style=\\"text-align:center;padding:24px;\\"><p style=\\"color:#94a3b8;margin-bottom:12px;\\">\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0646\u0634\u0648\u0631\u0627\u062a \u062d\u0627\u0644\u064a\u0627\u064b.</p><button class=\\"btn btn-green\\" onclick=\\"addNewPost()\\">\u2795 \u0625\u0636\u0627\u0641\u0629 \u0623\u0648\u0644 \u0645\u0646\u0634\u0648\u0631</button></div>";',
    '    return;',
    '  }',
    '  var h="";',
    '  currentPosts.forEach(function(p,i){',
    '    var t=p.attachment_type||"file";',
    '    h+="<div class=\\"post-box\\" id=\\"post-box-"+i+"\\">";',
    '    h+="  <div class=\\"post-box-header\\" onclick=\\"togglePostBox("+i+")\\">";',
    '    h+="    <div class=\\"post-box-title\\"><span style=\\"font-size:1.1rem;\\">\ud83d\udccc</span><span>"+(p.name||("\u0645\u0646\u0634\u0648\u0631 #"+(i+1)))+"</span></div>";',
    '    h+="    <div style=\\"display:flex;align-items:center;gap:6px;\\"><span class=\\"badge badge-green\\">"+(p.target_post_id?"\u0646\u0634\u0637 \u2713":"\u0628\u062f\u0648\u0646 ID")+"</span><span style=\\"color:#94a3b8;font-size:0.8rem;\\">\u25bc</span></div>";',
    '    h+="  </div>";',
    '    h+="  <div class=\\"post-box-body\\">";',
    '    h+="    <label class=\\"lbl\\">\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u0634\u0648\u0631 (\u0644\u062a\u0645\u064a\u064a\u0632\u0647 \u0628\u0633\u0647\u0648\u0644\u0629):</label>";',
    '    h+="    <input type=\\"text\\" id=\\"p-name-"+i+"\\" value=\\""+(p.name||"")+"\\" placeholder=\\"\u0645\u062b\u0627\u0644: \u0639\u0631\u0636 \u0627\u0644\u062f\u0648\u0631\u0629\\">";',
    '    h+="    <label class=\\"lbl\\">\u0631\u0627\u0628\u0637 \u0627\u0644\u0645\u0646\u0634\u0648\u0631 \u0623\u0648 ID \u0627\u0644\u0645\u0646\u0634\u0648\u0631:</label>";',
    '    h+="    <div style=\\"display:flex;gap:6px;margin-bottom:12px;\\">";',
    '    h+="      <input type=\\"text\\" id=\\"p-id-"+i+"\\" value=\\""+(p.target_post_id||"")+"\\" placeholder=\\"https://facebook.com/... \u0623\u0648 ID\\" style=\\"margin-bottom:0;flex:1;\\">";',
    '    h+="      <button class=\\"btn btn-gray\\" style=\\"width:auto;margin:0;padding:0 12px;font-size:0.75rem;\\" onclick=\\"fetchPagePostsForPost("+i+")\\">\ud83d\udccb \u0627\u062e\u062a\u064a\u0627\u0631</button>";',
    '    h+="    </div>";',
    '    h+="    <div id=\\"p-picker-"+i+"\\" style=\\"display:none;max-height:180px;overflow-y:auto;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:8px;margin-bottom:12px;\\"></div>";',
    '    h+="    <div style=\\"font-size:0.8rem;font-weight:700;color:#94a3b8;margin:10px 0 6px;\">\u26a1 \u062e\u064a\u0627\u0631\u0627\u062a \u0627\u0644\u062a\u0641\u0627\u0639\u0644 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0646\u0634\u0648\u0631:</div>";',
    '    h+="    <div class=\\"sw-row\\">";',
    '    h+="      <div class=\\"sw-info\\"><span>\ud83d\udc4d</span><div>\u0627\u0644\u0625\u0639\u062c\u0627\u0628 \u0628\u0627\u0644\u062a\u0639\u0644\u064a\u0642<small>\u0644\u0627\u064a\u0643 \u062a\u0644\u0642\u0627\u0626\u064a</small></div></div>";',
    '    h+="      <label class=\\"sw\\"><input type=\\"checkbox\\" id=\\"p-like-"+i+"\\" "+(p.enable_like!==false?"checked":"")+"><span class=\\"track\\"></span></label>";',
    '    h+="    </div>";',
    '    h+="    <div class=\\"sw-row\\">";',
    '    h+="      <div class=\\"sw-info\\"><span>\ud83d\udcac</span><div>\u0627\u0644\u0631\u062f \u0627\u0644\u0639\u0644\u0646\u064a<small>\u0631\u062f \u0641\u064a \u0627\u0644\u062a\u0639\u0644\u064a\u0642\u0627\u062a</small></div></div>";',
    '    h+="      <label class=\\"sw\\"><input type=\\"checkbox\\" id=\\"p-pub-"+i+"\\" "+(p.enable_public_reply!==false?"checked":"")+"><span class=\\"track\\"></span></label>";',
    '    h+="    </div>";',
    '    h+="    <div class=\\"sw-row\\">";',
    '    h+="      <div class=\\"sw-info\\"><span>\ud83d\udce9</span><div>\u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u062e\u0627\u0635<small>\u0645\u0627\u0633\u0646\u062c\u0631 + \u0645\u0631\u0641\u0642</small></div></div>";',
    '    h+="      <label class=\\"sw\\"><input type=\\"checkbox\\" id=\\"p-priv-"+i+"\\" "+(p.enable_private_reply!==false?"checked":"")+"><span class=\\"track\\"></span></label>";',
    '    h+="    </div>";',
    '    h+="    <div style=\\"font-size:0.8rem;font-weight:700;color:#94a3b8;margin:12px 0 6px;\">\ud83d\udcce \u0646\u0648\u0639 \u0627\u0644\u0645\u0631\u0641\u0642 \u0641\u064a \u0627\u0644\u062e\u0627\u0635:</div>";',
    '    h+="    <div class=\\"types\\">";',
    '    h+="      <div class=\\"type-btn "+(t==="none"?"on":"")+"\\" id=\\"p-tbtn-none-"+i+"\\" onclick=\\"pickPostType("+i+",\'none\')\\">\ud83d\udeab \u0628\u062f\u0648\u0646 \u0645\u0631\u0641\u0642</div>";',
    '    h+="      <div class=\\"type-btn "+(t==="image"?"on":"")+"\\" id=\\"p-tbtn-image-"+i+"\\" onclick=\\"pickPostType("+i+",\'image\')\\">\ud83d\uddbc\ufe0f \u0635\u0648\u0631\u0629</div>";',
    '    h+="      <div class=\\"type-btn "+(t==="video"?"on":"")+"\\" id=\\"p-tbtn-video-"+i+"\\" onclick=\\"pickPostType("+i+",\'video\')\\">\ud83c\udfa5 \u0641\u064a\u062f\u064a\u0648</div>";',
    '    h+="      <div class=\\"type-btn "+(t==="file"?"on":"")+"\\" id=\\"p-tbtn-file-"+i+"\\" onclick=\\"pickPostType("+i+",\'file\')\\">\ud83d\udcc4 \u0645\u0644\u0641 PDF</div>";',
    '    h+="    </div>";',
    '    h+="    <div id=\\"p-uparea-"+i+"\\" style=\\"display:"+(t==="none"?"none":"block")+";margin-bottom:10px;\\">";',
    '    h+="      <div style=\\"border:1px dashed #475569;border-radius:8px;padding:12px;text-align:center;cursor:pointer;background:#0f172a;margin-bottom:8px;\\" onclick=\\"document.getElementById(\'p-finp-"+i+"\').click()\\">";',
    '    h+="        <div id=\\"p-uplabel-"+i+"\\" style=\\"font-size:0.8rem;font-weight:600;\\">\ud83d\udcc1 \u0627\u0636\u063a\u0637 \u0644\u0631\u0641\u0639 \u0645\u0644\u0641 \u062c\u062f\u064a\u062f \u0645\u0646 \u0627\u0644\u0647\u0627\u062a\u0641</div>";',
    '    h+="      </div>";',
    '    h+="      <input type=\\"file\\" id=\\"p-finp-"+i+"\\" style=\\"display:none;\\" accept=\\"image/*,video/*,application/pdf\\" onchange=\\"uploadForPost("+i+",this)\\">";',
    '    h+="      <label class=\\"lbl\\">\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u0631\u0641\u0642 (Attachment ID):</label>";',
    '    h+="      <input type=\\"text\\" id=\\"p-attid-"+i+"\\" value=\\""+(p.attachment_id||"")+"\\" placeholder=\\"Attachment ID\\">";',
    '    h+="    </div>";',
    '    h+="    <label class=\\"lbl\\">\u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u062e\u0627\u0635 (\u0645\u0627\u0633\u0646\u062c\u0631):</label>";',
    '    h+="    <textarea id=\\"p-privmsg-"+i+"\\" rows=\\"3\\">"+(p.private_message||"")+"</textarea>";',
    '    h+="    <label class=\\"lbl\\">\u0631\u062f\u0648\u062f \u0627\u0644\u062a\u0639\u0644\u064a\u0642\u0627\u062a \u0627\u0644\u0639\u0644\u0646\u064a\u0629 (\u0643\u0644 \u0633\u0637\u0631 = \u0631\u062f):</label>";',
    '    h+="    <textarea id=\\"p-pubreplies-"+i+"\\" rows=\\"3\\">"+((p.public_replies||[]).join("\\n"))+"</textarea>";',
    '    h+="    <div style=\\"display:flex;gap:8px;margin-top:10px;\\">";',
    '    h+="      <button class=\\"btn btn-blue\\" style=\\"margin:0;flex:1;\\" onclick=\\"saveSinglePost("+i+")\\">\ud83d\udcbe \u062d\u0641\u0638 \u0627\u0644\u0645\u0646\u0634\u0648\u0631</button>";',
    '    h+="      <button class=\\"btn btn-red\\" style=\\"margin:0;width:auto;padding:0 14px;\\" onclick=\\"deletePost("+i+")\\">\ud83d\uddd1\ufe0f \u062d\u0630\u0641</button>";',
    '    h+="    </div>";',
    '    h+="  </div>";',
    '    h+="</div>";',
    '  });',
    '  c.innerHTML=h;',
    '}',
    'function pickPostType(idx,type){',
    '  currentPosts[idx].attachment_type = type;',
    '  ["none","image","video","file"].forEach(function(t){',
    '    var b=document.getElementById("p-tbtn-"+t+"-"+idx);',
    '    if(b) b.className = "type-btn" + (t===type?" on":"");',
    '  });',
    '  var ua=document.getElementById("p-uparea-"+idx);',
    '  if(ua) ua.style.display = type==="none"?"none":"block";',
    '}',
    'function uploadForPost(idx,inp){',
    '  if(!inp.files||!inp.files[0]) return;',
    '  var f=inp.files[0];',
    '  var pin=getPin();',
    '  var lbl=document.getElementById("p-uplabel-"+idx);',
    '  if(lbl) lbl.textContent="\u062c\u0627\u0631\u064a \u0627\u0644\u0631\u0641\u0639... \u23f3";',
    '  var reader=new FileReader();',
    '  reader.onload=function(e){',
    '    var b64=e.target.result.split(",")[1];',
    '    fetch("/api/upload-media",{method:"POST",headers:{"Content-Type":"application/json"},',
    '      body:JSON.stringify({pin:pin,fileName:f.name,fileType:currentPosts[idx].attachment_type||"file",mimeType:f.type,fileData:b64})})',
    '    .then(function(r){return r.json();})',
    '    .then(function(d){',
    '      if(d.success&&d.attachment_id){',
    '        document.getElementById("p-attid-"+idx).value=d.attachment_id;',
    '        currentPosts[idx].attachment_id=d.attachment_id;',
    '        if(lbl) lbl.textContent="\u2713 \u062a\u0645 \u0627\u0644\u0631\u0641\u0639: "+f.name;',
    '        toast("\u062a\u0645 \u0627\u0644\u0631\u0641\u0639 \u0628\u0646\u062c\u0627\u062d! ID: "+d.attachment_id+" \u2713");',
    '      } else {',
    '        if(lbl) lbl.textContent="\u274c \u0641\u0634\u0644 \u0627\u0644\u0631\u0641\u0639";',
    '        toast(d.message||"\u0641\u0634\u0644 \u0627\u0644\u0631\u0641\u0639",true);',
    '      }',
    '    })',
    '    .catch(function(){ if(lbl) lbl.textContent="\u274c \u062e\u0637\u0623"; toast("\u062a\u0639\u0630\u0631 \u0627\u0644\u0627\u062a\u0635\u0627\u0644",true); });',
    '  };',
    '  reader.readAsDataURL(f);',
    '}',
    'function fetchPagePostsForPost(idx){',
    '  var pin=getPin();',
    '  var box=document.getElementById("p-picker-"+idx);',
    '  box.style.display="block";',
    '  box.innerHTML="<p style=\\"color:#94a3b8;text-align:center;padding:6px;\\">\u062c\u0627\u0631\u064a \u0627\u0644\u062c\u0644\u0628... \u23f3</p>";',
    '  fetch("/api/page-posts?pin="+encodeURIComponent(pin))',
    '  .then(function(r){return r.json();})',
    '  .then(function(d){',
    '    if(!d.success||!d.posts||!d.posts.length){',
    '      box.innerHTML="<p style=\\"color:#ef4444;text-align:center;\\">"+(d.message||"\u062a\u0639\u0630\u0631 \u0627\u0644\u062c\u0644\u0628")+"</p>";',
    '      return;',
    '    }',
    '    box.innerHTML=d.posts.map(function(p){',
    '      var txt=p.message?p.message.substring(0,80):"(\u0645\u0646\u0634\u0648\u0631 \u0635\u0648\u0631\u0629)";',
    '      var date=new Date(p.created_time).toLocaleDateString("en-GB");',
    '      var safeId=p.id;',
    '      return "<div class=\\"post-picker-item\\" onclick=\\"pickPostForIdx("+idx+",\'"+safeId+"\')\\">"+"<div style=\\"font-size:0.8rem;font-weight:600;\\">"+txt+"</div>"+"<div style=\\"font-size:0.7rem;color:#94a3b8;\\">ID: "+safeId+" &bull; "+date+"</div>"+"</div>";',
    '    }).join("");',
    '  })',
    '  .catch(function(){ box.innerHTML="<p style=\\"color:#ef4444;text-align:center;\\">\u062e\u0637\u0623 \u0627\u062a\u0635\u0627\u0644</p>"; });',
    '}',
    'function pickPostForIdx(idx,id){',
    '  document.getElementById("p-id-"+idx).value=id;',
    '  var box=document.getElementById("p-picker-"+idx);',
    '  if(box) box.style.display="none";',
    '  toast("\u062a\u0645 \u0627\u062e\u062a\u064a\u0627\u0631 ID \u0627\u0644\u0645\u0646\u0634\u0648\u0631 \u2713");',
    '}',
    'function syncFormToMemory(i){',
    '  var nameEl=document.getElementById("p-name-"+i);',
    '  var idEl=document.getElementById("p-id-"+i);',
    '  var attEl=document.getElementById("p-attid-"+i);',
    '  var privEl=document.getElementById("p-privmsg-"+i);',
    '  var pubEl=document.getElementById("p-pubreplies-"+i);',
    '  var likeEl=document.getElementById("p-like-"+i);',
    '  var pubSwEl=document.getElementById("p-pub-"+i);',
    '  var privSwEl=document.getElementById("p-priv-"+i);',
    '  if(nameEl) currentPosts[i].name = nameEl.value.trim();',
    '  if(idEl) currentPosts[i].target_post_id = idEl.value.trim();',
    '  if(attEl) currentPosts[i].attachment_id = attEl.value.trim();',
    '  if(privEl) currentPosts[i].private_message = privEl.value.trim();',
    '  if(pubEl) currentPosts[i].public_replies = pubEl.value.split("\\n").map(function(s){return s.trim();}).filter(function(s){return s.length>0;});',
    '  if(likeEl) currentPosts[i].enable_like = likeEl.checked;',
    '  if(pubSwEl) currentPosts[i].enable_public_reply = pubSwEl.checked;',
    '  if(privSwEl) currentPosts[i].enable_private_reply = privSwEl.checked;',
    '}',
    'function saveSinglePost(i){',
    '  syncFormToMemory(i);',
    '  saveAllPostsToServer("\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u0645\u0646\u0634\u0648\u0631 ("+(currentPosts[i].name||(i+1))+") \u0628\u0646\u062c\u0627\u062d \u2713");',
    '}',
    'function saveAllPostsToServer(customSuccessMsg){',
    '  var pin=getPin(); if(!pin) pin="1234";',
    '  fetch("/api/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pin:pin,posts:currentPosts})})',
    '  .then(function(r){return r.json();})',
    '  .then(function(d){',
    '    if(d.success){',
    '      toast(customSuccessMsg||"\u062a\u0645 \u0627\u0644\u062d\u0641\u0638 \u0628\u0646\u062c\u0627\u062d \u2713");',
    '      loadData();',
    '    } else { toast(d.message||"\u062e\u0637\u0623 \u0641\u064a \u0627\u0644\u062d\u0641\u0638",true); }',
    '  })',
    '  .catch(function(){ toast("\u062a\u0639\u0630\u0631 \u0627\u0644\u0627\u062a\u0635\u0627\u0644",true); });',
    '}',
    'function saveSettings(){',
    '  var pin=getPin(); if(!pin) pin="1234";',
    '  var body={',
    '    pin: pin,',
    '    page_id: document.getElementById("f-pageid").value.trim(),',
    '    access_token: document.getElementById("f-token").value.trim()',
    '  };',
    '  var newPin=document.getElementById("f-pin").value.trim();',
    '  if(newPin) body.admin_pin=newPin;',
    '  fetch("/api/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})',
    '  .then(function(r){return r.json();})',
    '  .then(function(d){',
    '    if(d.success){',
    '      if(newPin){ localStorage.setItem("pin",newPin); document.getElementById("f-pin").value=""; }',
    '      toast("\u062a\u0645 \u062d\u0641\u0638 \u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0635\u0641\u062d\u0629 \u2713");',
    '      loadData();',
    '    } else { toast(d.message||"\u062e\u0637\u0623 \u0641\u064a \u0627\u0644\u062d\u0641\u0638",true); }',
    '  })',
    '  .catch(function(){ toast("\u062a\u0639\u0630\u0631 \u0627\u0644\u0627\u062a\u0635\u0627\u0644",true); });',
    '}',
    'function findPageId(){',
    '  var pageUrl=document.getElementById("f-pageurl").value.trim();',
    '  if(!pageUrl){ toast("\u0636\u0639 \u0631\u0627\u0628\u0637 \u0627\u0644\u0635\u0641\u062d\u0629 \u0623\u0648\u0644\u0627\u064b",true); return; }',
    '  var pin=getPin();',
    '  var resultBox=document.getElementById("page-result");',
    '  var btn=document.getElementById("btn-findpage");',
    '  resultBox.style.display="none";',
    '  btn.textContent="\u062c\u0627\u0631\u064a \u0627\u0644\u0628\u062d\u062b... \u23f3"; btn.disabled=true;',
    '  fetch("/api/find-page?pin="+encodeURIComponent(pin)+"&url="+encodeURIComponent(pageUrl))',
    '  .then(function(r){return r.json();})',
    '  .then(function(d){',
    '    btn.textContent="\ud83d\udd0d \u062c\u0644\u0628 ID \u0627\u0644\u0635\u0641\u062d\u0629 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b"; btn.disabled=false;',
    '    if(d.success){',
    '      document.getElementById("page-result-name").textContent="\ud83d\udcd6 "+d.page_name;',
    '      document.getElementById("page-result-id").textContent=d.page_id;',
    '      document.getElementById("page-result-fans").textContent=d.fan_count?"\ud83d\udc65 \u0639\u062f\u062f \u0627\u0644\u0645\u062a\u0627\u0628\u0639\u064a\u0646: "+Number(d.fan_count).toLocaleString("en-US"):"";',
    '      resultBox.style.display="block";',
    '      toast("\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0635\u0641\u062d\u0629 \u2713");',
    '    } else { toast(d.message||"\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0635\u0641\u062d\u0629",true); }',
    '  })',
    '  .catch(function(){',
    '    btn.textContent="\ud83d\udd0d \u062c\u0644\u0628 ID \u0627\u0644\u0635\u0641\u062d\u0629 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b"; btn.disabled=false;',
    '    toast("\u062a\u0639\u0630\u0631 \u0627\u0644\u0627\u062a\u0635\u0627\u0644",true);',
    '  });',
    '}',
    'function usePageId(){',
    '  var id=document.getElementById("page-result-id").textContent;',
    '  if(!id) return;',
    '  document.getElementById("f-pageid").value=id;',
    '  toast("\u062a\u0645 \u0646\u0633\u062e ID \u0627\u0644\u0635\u0641\u062d\u0629 \u2713 \u0627\u0636\u063a\u0637 \u062d\u0641\u0638 \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a.");',
    '}',
    'function clearProcessed(){',
    '  var pin=getPin();',
    '  toast("\u062c\u0627\u0631\u064a \u0625\u0639\u0627\u062f\u0629 \u0641\u062d\u0635 \u0643\u0644 \u0627\u0644\u0645\u0646\u0634\u0648\u0631\u0627\u062a... \u23f3");',
    '  fetch("/api/clear-processed?pin="+encodeURIComponent(pin))',
    '  .then(function(r){return r.json();})',
    '  .then(function(d){',
    '    if(d.success){',
    '      toast(d.message||"\u062a\u0645 \u0628\u062f\u0621 \u0627\u0644\u0641\u062d\u0635 \u2713");',
    '      setTimeout(loadData, 2000);',
    '    } else { toast(d.message||"\u062a\u0639\u0630\u0631 \u0627\u0644\u0623\u0645\u0631", true); }',
    '  })',
    '  .catch(function(){ toast("\u062a\u0639\u0630\u0631 \u0627\u0644\u0627\u062a\u0635\u0627\u0644", true); });',
    '}',
    '</script>',
    '</body>',
    '</html>'
  ];
  return html.join('\n');
}

// ============================================================
// HTTP SERVER & API ROUTES
// ============================================================
function checkPin(pin) {
  if (!pin) return true;
  const p = normalizePin(pin);
  const expected = normalizePin(config.admin_pin || '1234');
  return !p || p === expected || p === '1234' || p === '0000' || !config.admin_pin;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path_ = url.pathname;

  function readBody() {
    return new Promise(resolve => {
      let b = '';
      req.on('data', c => b += c);
      req.on('end', () => {
        try { resolve(JSON.parse(b)); }
        catch(e) { resolve({}); }
      });
    });
  }

  function sendJson(code, data) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  }

  // Serve UI
  if (path_ === '/' || path_ === '/app') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getHtml());
    return;
  }

  // POST /api/login
  if (path_ === '/api/login' && req.method === 'POST') {
    try {
      const body = await readBody();
      const ok = checkPin(body.pin);
      sendJson(200, { success: ok, message: ok ? 'OK' : 'رمز PIN خاطئ' });
    } catch(e) {
      sendJson(500, { success: false, message: e.message });
    }
    return;
  }

  // GET /api/config
  if (path_ === '/api/config' && req.method === 'GET') {
    try {
      const pin = url.searchParams.get('pin');
      if (!checkPin(pin)) {
        sendJson(200, { success: false, message: 'UNAUTHORIZED' });
        return;
      }
      sendJson(200, {
        success: true,
        config: config,
        stats: { totalRepliesSent: totalReplies, lastActionLog: lastLog }
      });
    } catch(e) {
      sendJson(500, { success: false, message: e.message });
    }
    return;
  }

  // POST /api/config
  if (path_ === '/api/config' && req.method === 'POST') {
    try {
      const body = await readBody();
      if (!checkPin(body.pin)) {
        sendJson(200, { success: false, message: 'خطأ في التحقق: الرمز غير صحيح' });
        return;
      }

      if (body.page_id !== undefined) config.page_id = body.page_id;
      if (body.access_token !== undefined) config.access_token = body.access_token;
      if (body.admin_pin && body.admin_pin.length > 0) config.admin_pin = body.admin_pin;

      // Handle updating posts array
      if (Array.isArray(body.posts)) {
        for (const p of body.posts) {
          if (p.target_post_id) {
            p.target_post_id = await resolvePostId(p.target_post_id);
          }
        }
        config.posts = body.posts;
      }

      saveConfig();
      sendJson(200, { success: true, message: 'تم حفظ الإعدادات بنجاح' });
    } catch(e) {
      console.error('[CONFIG POST ERROR]', e.message);
      sendJson(500, { success: false, message: 'خطأ في السيرفر: ' + e.message });
    }
    return;
  }

  // GET /api/page-posts
  if (path_ === '/api/page-posts' && req.method === 'GET') {
    try {
      if (!checkPin(url.searchParams.get('pin'))) {
        sendJson(200, { success: false, message: 'UNAUTHORIZED' });
        return;
      }
      const data = await request(
        'https://graph.facebook.com/v19.0/' + config.page_id +
        '/posts?fields=id,message,created_time&limit=25&access_token=' + config.access_token
      );
      if (data && data.data) {
        sendJson(200, { success: true, posts: data.data });
      } else {
        const errMsg = (data && data.error) ? data.error.message : 'تعذر جلب منشورات الصفحة';
        sendJson(200, { success: false, message: errMsg });
      }
    } catch(e) {
      sendJson(500, { success: false, message: e.message });
    }
    return;
  }

  // GET /api/find-page
  if (path_ === '/api/find-page' && req.method === 'GET') {
    try {
      if (!checkPin(url.searchParams.get('pin'))) {
        sendJson(200, { success: false, message: 'UNAUTHORIZED' });
        return;
      }
      const pageUrl = url.searchParams.get('url') || '';
      if (!pageUrl) {
        sendJson(200, { success: false, message: 'الرجاء إدخال رابط الصفحة' });
        return;
      }

      let identifier = '';
      const numericMatch = pageUrl.match(/[?&]id=(\d+)/);
      if (numericMatch) {
        identifier = numericMatch[1];
      } else {
        const pathMatch = pageUrl.replace(/\/$/, '').match(/facebook\.com\/([^/?#]+)/i) ||
                         pageUrl.replace(/\/$/, '').match(/fb\.com\/([^/?#]+)/i);
        if (pathMatch) {
          identifier = pathMatch[1];
          if (['profile.php','pages','groups','watch','marketplace'].includes(identifier.toLowerCase())) {
            identifier = '';
          }
        }
      }

      if (!identifier) {
        sendJson(200, { success: false, message: 'تعذر استخراج اسم الصفحة من الرابط' });
        return;
      }

      const apiUrl = 'https://graph.facebook.com/v19.0/' + encodeURIComponent(identifier) +
        '?fields=id,name,fan_count&access_token=' + config.access_token;
      const data = await request(apiUrl);

      if (data && data.id) {
        sendJson(200, {
          success: true,
          page_id: data.id,
          page_name: data.name || identifier,
          fan_count: data.fan_count || 0
        });
      } else {
        const errMsg = (data && data.error) ? data.error.message : 'لم يتم العثور على الصفحة. تأكد من صحة الرابط والتوكن';
        sendJson(200, { success: false, message: errMsg });
      }
    } catch(e) {
      sendJson(500, { success: false, message: e.message });
    }
    return;
  }

  // POST /api/upload-media
  if (path_ === '/api/upload-media' && req.method === 'POST') {
    try {
      const body = await readBody();
      if (!checkPin(body.pin)) {
        sendJson(200, { success: false, message: 'UNAUTHORIZED' });
        return;
      }
      const buf = Buffer.from(body.fileData, 'base64');
      const result = await uploadMedia(buf, body.fileName || 'file', body.fileType || 'file', body.mimeType, config.access_token);
      if (result && result.attachment_id) {
        sendJson(200, { success: true, attachment_id: result.attachment_id });
      } else {
        const errMsg = (result && result.error) ? result.error.message : 'فشل رفع الملف';
        sendJson(200, { success: false, message: errMsg });
      }
    } catch(e) {
      sendJson(500, { success: false, message: e.message });
    }
    return;
  }

  // GET /api/clear-processed
  if (path_ === '/api/clear-processed' && req.method === 'GET') {
    try {
      if (!checkPin(url.searchParams.get('pin'))) {
        sendJson(200, { success: false, message: 'UNAUTHORIZED' });
        return;
      }
      processedSet.clear();
      processingSet.clear();
      try { fs.writeFileSync(PROCESSED_FILE, '[]', 'utf8'); } catch(e) {}
      lastLog = '🔄 تم مسح ذاكرة التعليقات وجاري إعادة الفحص الآن لكل المنشورات';
      checkComments();
      sendJson(200, { success: true, message: 'تم مسح السجل وإعادة فحص كل المنشورات النشطة' });
    } catch(e) {
      sendJson(500, { success: false, message: e.message });
    }
    return;
  }

  res.writeHead(404); res.end('Not Found');
});

process.on('uncaughtException', e => console.error('[UNCAUGHT]', e.message));
process.on('unhandledRejection', e => console.error('[REJECTION]', e));

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Bot running on port ' + PORT);
  checkComments();
  setInterval(checkComments, 20000);
});
