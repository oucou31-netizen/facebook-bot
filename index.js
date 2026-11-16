const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIG
// ============================================================
const CONFIG_FILE = path.join(__dirname, 'config.json');
const PROCESSED_FILE = path.join(__dirname, 'processed_ids.json');

let config = {
  admin_pin: '1234',
  page_id: '1424795157375101',
  target_post_id: '1424795157375101_122093934621520437',
  access_token: 'EAAuuUwQY1zIBSzNNc26whvNxX61CvFdkhhKqbH0Fei8kUZAoFxusKEW0akCUS3iJqypk5YhlZByirvRI6ADKMnAK7D6QOwehHAFXsAHDWtpE4dwpv2YqEf6QZC13CYZCFyMiuTlZBnasbbrUItZBVzD6GcZAUK6buZAwZC0RBkBnKabePcTyXDPXf5piKZCzBYZAKFqETSv57YQIXZCtZCJ2Al5qxGDl4',
  attachment_id: '1145582601544384',
  attachment_type: 'file',
  enable_like: true,
  enable_public_reply: true,
  enable_private_reply: true,
  private_message: '\u0623\u0647\u0644\u0627\u064b \u0628\u0643! \u062a\u0641\u0636\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \ud83c\udf1f\n\n\u062a\u0627\u0628\u0639 \u0635\u0641\u062d\u062a\u0646\u0627 \u0644\u0644\u0627\u0633\u062a\u0641\u0627\u062f\u0629 \u0645\u0646 \u0643\u0644 \u062c\u062f\u064a\u062f \u0648\u0645\u0641\u064a\u062f \u0642\u0627\u062f\u0645\u0627\u064b \ud83d\udc4d',
  public_replies: [
    '\u062a\u0645 \u0627\u0644\u0631\u062f \u0648\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644 \u0641\u064a \u0627\u0644\u062e\u0627\u0635\u060c \u0634\u0643\u0631\u0627\u064b \u0644\u062a\u0641\u0627\u0639\u0644\u0643 \ud83d\udce9',
    '\u0623\u0647\u0644\u0627\u064b \u0628\u0643! \u062a\u0641\u0642\u062f \u0635\u0646\u062f\u0648\u0642 \u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u0644\u062f\u064a\u0643\u060c \u062a\u0645 \u0627\u0644\u0631\u062f \u0628\u0646\u062c\u0627\u062d \ud83d\udc4d',
    '\u062a\u0645 \u0627\u0644\u0631\u062f \u0641\u064a \u0627\u0644\u062e\u0627\u0635\u060c \u0628\u0627\u0644\u062a\u0648\u0641\u064a\u0642 \u0644\u0643 \u2728',
    '\u0634\u0643\u0631\u0627\u064b \u0644\u0627\u0647\u062a\u0645\u0627\u0645\u0643! \u0631\u0627\u062c\u0639 \u0631\u0633\u0627\u0626\u0644 \u0635\u0641\u062d\u062a\u0643 \ud83d\udce5'
  ]
};

// Load saved config
if (fs.existsSync(CONFIG_FILE)) {
  try {
    config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    console.log('[CONFIG] Loaded from config.json');
  } catch(e) {}
}

function saveConfig() {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8'); } catch(e) {}
}

// ============================================================
// PROCESSED IDS
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
    const arr = Array.from(processedSet).slice(-1000);
    fs.writeFileSync(PROCESSED_FILE, JSON.stringify(arr), 'utf8');
  } catch(e) {}
}

// ============================================================
// STATS
// ============================================================
let totalReplies = 0;
let lastLog = '\u0627\u0644\u0633\u064a\u0631\u0641\u0631 \u064a\u0639\u0645\u0644 \u0648\u062c\u0627\u0647\u0632 \u2705';

// ============================================================
// HELPERS
// ============================================================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function normalizePin(str) {
  if (!str) return '';
  const ar = ['\u0660','\u0661','\u0662','\u0663','\u0664','\u0665','\u0666','\u0667','\u0668','\u0669'];
  return String(str).trim().replace(/[\u0660-\u0669]/g, w => ar.indexOf(w)).replace(/\s+/g,'');
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
// BOT ACTIONS
// ============================================================
async function likeComment(id, name) {
  try {
    const res = await request('https://graph.facebook.com/v19.0/' + id + '/likes?access_token=' + config.access_token, { method: 'POST' });
    if (res && res.error) {
      console.error('[LIKE ERROR] ' + id + ':', res.error.message);
      lastLog = '\u274c \u0641\u0634\u0644 \u0627\u0644\u0625\u0639\u062c\u0627\u0628 \u0628\u062a\u0639\u0644\u064a\u0642 ' + (name || id) + ': ' + res.error.message;
      return false;
    }
    console.log('[LIKE OK] ' + id + ' for ' + (name || id));
    lastLog = '\ud83d\udc4d \u062a\u0645 \u0627\u0644\u0625\u0639\u062c\u0627\u0628 \u0628\u062a\u0639\u0644\u064a\u0642 ' + (name || '\u0645\u062a\u0627\u0628\u0639') + ' \u2014 ' + new Date().toLocaleTimeString('ar-EG');
    return true;
  } catch(e) {
    console.error('[LIKE EXCEPTION]', e.message);
    lastLog = '\u274c \u062e\u0637\u0623 \u0627\u062a\u0635\u0627\u0644 \u0623\u062b\u0646\u0627\u0621 \u0627\u0644\u0625\u0639\u062c\u0627\u0628: ' + e.message;
    return false;
  }
}

async function replyPublic(id) {
  try {
    const replies = config.public_replies.length ? config.public_replies : ['\u062a\u0645 \u0627\u0644\u0631\u062f \u0641\u064a \u0627\u0644\u062e\u0627\u0635 \ud83d\udce9'];
    const text = replies[Math.floor(Math.random() * replies.length)];
    await request('https://graph.facebook.com/v19.0/' + id + '/comments?access_token=' + config.access_token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }
    }, { message: text });
    console.log('[PUBLIC] ' + text);
  } catch(e) {}
}

async function sendPrivate(commentId, senderId, name) {
  const delay = rand(10000, 20000);
  console.log('[DELAY] ' + Math.round(delay/1000) + 's before DM to ' + name);
  await sleep(delay);
  try {
    const textPayload = {
      recipient: commentId ? { comment_id: commentId } : { id: senderId },
      message: { text: config.private_message }
    };
    const url = 'https://graph.facebook.com/v19.0/me/messages?access_token=' + config.access_token;
    const textRes = await request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, textPayload);
    let recipientId = senderId;
    if (textRes && textRes.recipient_id) recipientId = textRes.recipient_id;
    if (textRes && textRes.message_id) console.log('[DM] Text sent to ' + name);

    const aType = config.attachment_type || 'none';
    if (aType !== 'none' && config.attachment_id && recipientId) {
      const isUrl = /^https?:\/\//i.test(config.attachment_id);
      const mediaPayload = {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: aType,
            payload: isUrl ? { url: config.attachment_id, is_reusable: true } : { attachment_id: config.attachment_id }
          }
        }
      };
      const mediaRes = await request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, mediaPayload);
      if (mediaRes && mediaRes.message_id) console.log('[DM] Media sent to ' + name);
    }
    totalReplies++;
    const tLabel = aType === 'none' ? '\u0646\u0635 \u0641\u0642\u0637' : aType === 'image' ? '\u0635\u0648\u0631\u0629' : aType === 'video' ? '\u0641\u064a\u062f\u064a\u0648' : '\u0645\u0644\u0641 PDF';
    lastLog = '\u062a\u0645 \u0627\u0644\u0631\u062f (' + tLabel + ') \u0639\u0644\u0649: ' + name + ' \u2014 ' + new Date().toLocaleTimeString('ar-EG');
  } catch(e) {
    console.error('[DM ERROR] ' + e.message);
  } finally {
    processingSet.delete(commentId);
  }
}

async function processComment(c) {
  const id = c.id;
  if (c.from && c.from.id === config.page_id) return;
  if (c.parent && c.parent.id) return; // Skip replies - only main comments
  if (processedSet.has(id) || processingSet.has(id)) return;
  processingSet.add(id);
  markProcessed(id);

  const name = c.from ? c.from.name : '\u0645\u062a\u0627\u0628\u0639';
  console.log('[NEW] ' + id + ' | ' + name + ' | "' + (c.message || '') + '"');

  // 1. Like
  let likeOk = false;
  if (config.enable_like !== false) {
    likeOk = await likeComment(id, name);
  }

  // Check if page already posted a public reply on this comment
  const alreadyReplied = c.comments && c.comments.data && c.comments.data.some(s => s.from && s.from.id === config.page_id);

  // 2. Public reply
  if (config.enable_public_reply !== false && !alreadyReplied) {
    await replyPublic(id);
  }

  // 3. Private reply
  if (config.enable_private_reply !== false) {
    await sendPrivate(id, c.from ? c.from.id : null, name);
  } else {
    totalReplies++;
    processingSet.delete(id);
    if (config.enable_like === false) {
      lastLog = '\u062a\u0645\u062a \u0645\u0639\u0627\u0644\u062c\u0629 \u062a\u0639\u0644\u064a\u0642 ' + name + ' \u2014 ' + new Date().toLocaleTimeString('ar-EG');
    }
  }
}

let isRunning = false;
async function checkComments() {
  if (isRunning || !config.target_post_id) return;
  isRunning = true;
  try {
    const url = 'https://graph.facebook.com/v19.0/' + config.target_post_id +
      '/comments?filter=toplevel&fields=id,from,message,parent,comments{id,from,message}&limit=50&access_token=' + config.access_token;
    const data = await request(url);
    if (data && data.data) {
      for (const c of data.data) {
        await processComment(c);
      }
    } else if (data && data.error) {
      console.error('[CRON ERROR]', data.error.message);
      lastLog = '\u274c \u062e\u0637\u0623 \u0641\u064a\u0633\u0628\u0648\u0643: ' + data.error.message;
    }
  } catch(e) {
    console.error('[CRON] ' + e.message);
  } finally {
    isRunning = false;
  }
}

// Upload media
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
// HTML
// ============================================================
function getHtml() {
  const html = [
    '<!DOCTYPE html>',
    '<html lang="ar" dir="rtl">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">',
    '<title>\u0628\u0648\u062a \u062a\u0643 \u0623\u0646\u0641\u0648</title>',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="theme-color" content="#0f172a">',
    '<style>',
    '* { box-sizing: border-box; margin: 0; padding: 0; font-family: Tahoma, Arial, sans-serif; -webkit-tap-highlight-color: transparent; }',
    'body { background: #0f172a; color: #f1f5f9; min-height: 100vh; padding-bottom: 80px; }',
    '.hdr { background: #1e293b; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; position: sticky; top: 0; z-index: 10; }',
    '.hdr h1 { font-size: 1rem; font-weight: 700; }',
    '.dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; display: inline-block; margin-left: 6px; box-shadow: 0 0 8px #22c55e; }',
    '.nav { position: fixed; bottom: 0; left: 0; right: 0; background: #1e293b; border-top: 1px solid #334155; display: flex; z-index: 10; }',
    '.nav button { flex: 1; background: none; border: none; color: #64748b; padding: 10px 4px 14px; font-size: 0.65rem; font-weight: 600; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; }',
    '.nav button.on { color: #3b82f6; }',
    '.nav button .ico { font-size: 1.3rem; }',
    '.page { display: none; padding: 14px; max-width: 560px; margin: 0 auto; }',
    '.page.on { display: block; }',
    '.card { background: #1e293b; border-radius: 14px; padding: 16px; margin-bottom: 14px; border: 1px solid #334155; }',
    '.card h2 { font-size: 0.9rem; color: #94a3b8; margin-bottom: 12px; }',
    '.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }',
    '.stat { background: #1e293b; border-radius: 12px; padding: 14px; text-align: center; border: 1px solid #334155; }',
    '.stat .n { font-size: 1.8rem; font-weight: 800; color: #60a5fa; }',
    '.stat .l { font-size: 0.72rem; color: #94a3b8; margin-top: 2px; }',
    '.sw-row { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #0f172a; border-radius: 10px; margin-bottom: 8px; }',
    '.sw-info { display: flex; align-items: center; gap: 10px; font-size: 0.85rem; font-weight: 600; }',
    '.sw-info small { display: block; font-size: 0.7rem; color: #94a3b8; font-weight: 400; margin-top: 2px; }',
    '.sw { position: relative; width: 46px; height: 25px; flex-shrink: 0; }',
    '.sw input { opacity: 0; width: 0; height: 0; }',
    '.sw .track { position: absolute; inset: 0; background: #334155; border-radius: 25px; cursor: pointer; transition: 0.2s; }',
    '.sw .track:before { content: ""; position: absolute; width: 19px; height: 19px; background: white; border-radius: 50%; top: 3px; left: 3px; transition: 0.2s; }',
    '.sw input:checked + .track { background: #10b981; }',
    '.sw input:checked + .track:before { transform: translateX(21px); }',
    'label.lbl { display: block; font-size: 0.78rem; color: #94a3b8; margin-bottom: 5px; }',
    'input[type=text], textarea, select { width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 10px 12px; color: #f1f5f9; font-size: 0.88rem; outline: none; margin-bottom: 12px; }',
    'input:focus, textarea:focus { border-color: #3b82f6; }',
    'textarea { resize: vertical; min-height: 80px; font-family: Tahoma, Arial, sans-serif; }',
    '.btn { width: 100%; padding: 12px; border-radius: 10px; border: none; font-size: 0.9rem; font-weight: 700; cursor: pointer; margin-bottom: 8px; }',
    '.btn-blue { background: #2563eb; color: white; }',
    '.btn-green { background: #059669; color: white; }',
    '.btn-gray { background: #334155; color: #e2e8f0; }',
    '.btn:active { opacity: 0.85; }',
    '.btn:disabled { opacity: 0.5; cursor: default; }',
    '.toast { position: fixed; top: 16px; left: 50%; transform: translateX(-50%) translateY(-120px); background: #10b981; color: white; padding: 10px 22px; border-radius: 25px; font-size: 0.85rem; font-weight: 700; z-index: 100; transition: transform 0.3s; white-space: nowrap; max-width: 90vw; }',
    '.toast.show { transform: translateX(-50%) translateY(0); }',
    '.toast.err { background: #ef4444; }',
    '#lock { position: fixed; inset: 0; background: #0f172a; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 20px; }',
    '.lock-box { background: #1e293b; border-radius: 20px; padding: 28px 20px; width: 100%; max-width: 340px; text-align: center; border: 1px solid #334155; }',
    '.lock-box h2 { font-size: 1.1rem; margin-bottom: 6px; }',
    '.lock-box p { font-size: 0.8rem; color: #94a3b8; margin-bottom: 16px; }',
    '.lock-box input { text-align: center; font-size: 1.5rem; letter-spacing: 8px; font-weight: 800; }',
    '.post-item { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 12px; margin-bottom: 8px; cursor: pointer; }',
    '.post-item:active { border-color: #3b82f6; }',
    '.post-item .pt { font-size: 0.83rem; font-weight: 600; line-height: 1.4; }',
    '.post-item .pm { font-size: 0.7rem; color: #94a3b8; margin-top: 4px; }',
    '.types { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }',
    '.type-btn { background: #0f172a; border: 2px solid #334155; border-radius: 10px; padding: 12px 8px; text-align: center; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #94a3b8; }',
    '.type-btn.on { border-color: #3b82f6; background: rgba(59,130,246,0.1); color: #60a5fa; }',
    '.type-btn .ico { font-size: 1.3rem; display: block; margin-bottom: 4px; }',
    '.info-box { background: rgba(59,130,246,0.1); border: 1px solid #3b82f6; border-radius: 8px; padding: 10px; font-size: 0.8rem; color: #60a5fa; margin-bottom: 10px; display: none; word-break: break-all; }',
    '</style>',
    '</head>',
    '<body>',
    '<div class="toast" id="toast">OK</div>',
    '<div id="lock">',
    '  <div class="lock-box">',
    '    <div style="font-size:2.5rem;margin-bottom:10px;">\ud83d\udd10</div>',
    '    <h2>\u0642\u0641\u0644 \u0627\u0644\u0623\u0645\u0627\u0646</h2>',
    '    <p>\u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u0627\u0641\u062a\u0631\u0627\u0636\u064a: <strong style="color:#60a5fa">1234</strong></p>',
    '    <input type="text" id="pin-inp" inputmode="numeric" value="1234" placeholder="PIN" onkeydown="if(event.key===\'Enter\')doLogin()">',
    '    <button class="btn btn-blue" onclick="doLogin()">\u062f\u062e\u0648\u0644 \ud83d\ude80</button>',
    '    <p id="pin-err" style="color:#ef4444;font-size:0.8rem;margin-top:10px;display:none;"></p>',
    '  </div>',
    '</div>',
    '<div class="hdr">',
    '  <h1>\ud83e\udd16 \u0628\u0648\u062a \u062a\u0643 \u0623\u0646\u0641\u0648</h1>',
    '  <span><span class="dot"></span>\u064a\u0639\u0645\u0644 24/7</span>',
    '</div>',
    '<!-- DASH -->',
    '<div class="page on" id="p-dash">',
    '  <div class="stats">',
    '    <div class="stat"><div class="n" id="s-replies">0</div><div class="l">\u0631\u062f\u0648\u062f \u0623\u064f\u0631\u0633\u0644\u062a</div></div>',
    '    <div class="stat"><div class="n" id="s-type" style="font-size:1rem;margin-top:6px;">\u0645\u0644\u0641 \ud83d\udcc4</div><div class="l">\u0646\u0648\u0639 \u0627\u0644\u0645\u0631\u0641\u0642</div></div>',
    '  </div>',
    '  <div class="card">',
    '    <h2>\u26a1 \u062a\u062d\u0643\u0645 \u0633\u0631\u064a\u0639</h2>',
    '    <div class="sw-row">',
    '      <div class="sw-info"><span>\ud83d\udc4d</span><div>\u0627\u0644\u0625\u0639\u062c\u0627\u0628 \u0628\u0627\u0644\u062a\u0639\u0644\u064a\u0642<small>\u0644\u0627\u064a\u0643 \u062a\u0644\u0642\u0627\u0626\u064a</small></div></div>',
    '      <label class="sw"><input type="checkbox" id="sw-like" onchange="quickSave(\'enable_like\',this)"><span class="track"></span></label>',
    '    </div>',
    '    <div class="sw-row">',
    '      <div class="sw-info"><span>\ud83d\udcac</span><div>\u0627\u0644\u0631\u062f \u0627\u0644\u0639\u0644\u0646\u064a<small>\u0631\u062f \u0641\u064a \u0627\u0644\u062a\u0639\u0644\u064a\u0642\u0627\u062a</small></div></div>',
    '      <label class="sw"><input type="checkbox" id="sw-public" onchange="quickSave(\'enable_public_reply\',this)"><span class="track"></span></label>',
    '    </div>',
    '    <div class="sw-row">',
    '      <div class="sw-info"><span>\ud83d\udce9</span><div>\u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u062e\u0627\u0635<small>\u0645\u0627\u0633\u0646\u062c\u0631 + \u0645\u0631\u0641\u0642</small></div></div>',
    '      <label class="sw"><input type="checkbox" id="sw-private" onchange="quickSave(\'enable_private_reply\',this)"><span class="track"></span></label>',
    '    </div>',
    '  </div>',
    '  <div class="card">',
    '    <h2>\ud83d\udccc \u0627\u0644\u0645\u0646\u0634\u0648\u0631 \u0627\u0644\u0646\u0634\u0637</h2>',
    '    <div style="font-size:0.8rem;color:#38bdf8;word-break:break-all;background:#0f172a;padding:10px;border-radius:8px;margin-bottom:10px;" id="d-post">\u2014</div>',
    '    <h2 style="margin-top:4px;">\ud83d\udcce \u0627\u0644\u0645\u0631\u0641\u0642</h2>',
    '    <div style="font-size:0.8rem;color:#a7f3d0;word-break:break-all;background:#0f172a;padding:10px;border-radius:8px;" id="d-attach">\u2014</div>',
    '  </div>',
    '  <div class="card">',
    '    <h2>\ud83d\udd52 \u0622\u062e\u0631 \u0646\u0634\u0627\u0637</h2>',
    '    <p style="font-size:0.83rem;color:#cbd5e1;line-height:1.6;" id="d-log">\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644...</p>',
    '    <button class="btn btn-gray" style="margin-top:10px;" onclick="loadData()">\u062a\u062d\u062f\u064a\u062b \ud83d\udd04</button>',
    '    <button class="btn btn-blue" style="margin-top:4px;" onclick="clearProcessed()">\ud83d\udd04 \u0625\u0639\u0627\u062f\u0629 \u0641\u062d\u0635 \u0648\u0625\u0639\u062c\u0627\u0628 \u0628\u062a\u0639\u0644\u064a\u0642\u0627\u062a \u0627\u0644\u0645\u0646\u0634\u0648\u0631</button>',
    '  </div>',
    '</div>',
    '<!-- POST -->',
    '<div class="page" id="p-post">',
    '  <div class="card">',
    '    <h2>\ud83c\udfaf \u0627\u0644\u0645\u0646\u0634\u0648\u0631 \u0627\u0644\u0645\u0633\u062a\u0647\u062f\u0641</h2>',
    '    <button class="btn btn-gray" onclick="fetchPosts()">\ud83d\udccb \u062c\u0644\u0628 \u0645\u0646\u0634\u0648\u0631\u0627\u062a \u0627\u0644\u0635\u0641\u062d\u0629</button>',
    '    <div id="posts-list" style="display:none;max-height:260px;overflow-y:auto;margin-bottom:12px;"></div>',
    '    <label class="lbl">\u0631\u0627\u0628\u0637 \u0627\u0644\u0645\u0646\u0634\u0648\u0631 \u0623\u0648 ID \u0623\u0648 \u0639\u0646\u0648\u0627\u0646\u0647:</label>',
    '    <input type="text" id="f-postid" placeholder="https://facebook.com/... \u0623\u0648 ID">',
    '    <div class="info-box" id="post-resolved"></div>',
    '    <button class="btn btn-blue" onclick="saveAll()">\u062d\u0641\u0638 \u0648\u062a\u0637\u0628\u064a\u0642 \ud83d\udcbe</button>',
    '  </div>',
    '</div>',
    '<!-- ATTACH -->',
    '<div class="page" id="p-attach">',
    '  <div class="card">',
    '    <h2>\ud83d\udcce \u0646\u0648\u0639 \u0627\u0644\u0645\u0631\u0641\u0642</h2>',
    '    <div class="types">',
    '      <div class="type-btn on" id="t-none" onclick="pickType(\'none\')"><span class="ico">\ud83d\udeab</span>\u0628\u062f\u0648\u0646 \u0645\u0631\u0641\u0642</div>',
    '      <div class="type-btn" id="t-image" onclick="pickType(\'image\')"><span class="ico">\ud83d\uddbc\ufe0f</span>\u0635\u0648\u0631\u0629</div>',
    '      <div class="type-btn" id="t-video" onclick="pickType(\'video\')"><span class="ico">\ud83c\udfa5</span>\u0641\u064a\u062f\u064a\u0648</div>',
    '      <div class="type-btn" id="t-file" onclick="pickType(\'file\')"><span class="ico">\ud83d\udcc4</span>\u0645\u0644\u0641 PDF</div>',
    '    </div>',
    '    <div id="upload-area">',
    '      <div style="border:2px dashed #475569;border-radius:10px;padding:20px;text-align:center;cursor:pointer;margin-bottom:10px;" onclick="document.getElementById(\'file-inp\').click()">',
    '        <div id="up-ico" style="font-size:2rem;margin-bottom:6px;">\ud83d\udcc1</div>',
    '        <div id="up-label" style="font-size:0.85rem;font-weight:600;">\u0627\u0636\u063a\u0637 \u0644\u0627\u062e\u062a\u064a\u0627\u0631 \u0645\u0644\u0641</div>',
    '        <div style="font-size:0.72rem;color:#64748b;margin-top:4px;">\u0635\u0648\u0631\u0629\u060c \u0641\u064a\u062f\u064a\u0648\u060c \u0623\u0648 PDF</div>',
    '      </div>',
    '      <input type="file" id="file-inp" style="display:none;" accept="image/*,video/*,application/pdf" onchange="onFile(this)">',
    '      <button class="btn btn-green" id="btn-up" onclick="doUpload()" disabled>\u0631\u0641\u0639 \u0648\u0627\u0633\u062a\u062e\u0631\u0627\u062c \u0627\u0644\u0645\u0639\u0631\u0641 \ud83d\ude80</button>',
    '      <label class="lbl" style="margin-top:8px;">\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u0631\u0641\u0642 (Attachment ID):</label>',
    '      <input type="text" id="f-attid" placeholder="Attachment ID">',
    '    </div>',
    '    <button class="btn btn-blue" onclick="saveAll()">\u062d\u0641\u0638 \ud83d\udcbe</button>',
    '  </div>',
    '</div>',
    '<!-- MESSAGES -->',
    '<div class="page" id="p-msg">',
    '  <div class="card">',
    '    <h2>\ud83d\udce9 \u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u062e\u0627\u0635 (\u0645\u0627\u0633\u0646\u062c\u0631)</h2>',
    '    <textarea id="f-privmsg" rows="4" placeholder="\u0646\u0635 \u0627\u0644\u0631\u0633\u0627\u0644\u0629..."></textarea>',
    '    <h2 style="margin-bottom:8px;">\ud83d\udcac \u0631\u062f\u0648\u062f \u0627\u0644\u062a\u0639\u0644\u064a\u0642\u0627\u062a \u0627\u0644\u0639\u0644\u0646\u064a\u0629</h2>',
    '    <p style="font-size:0.75rem;color:#94a3b8;margin-bottom:8px;">\u0643\u0644 \u0633\u0637\u0631 = \u0631\u062f \u0648\u0627\u062d\u062f (\u064a\u062e\u062a\u0627\u0631 \u0627\u0644\u0628\u0648\u062a \u0639\u0634\u0648\u0627\u0626\u064a\u0627\u064b)</p>',
    '    <textarea id="f-pubreplies" rows="5" placeholder="\u0631\u062f 1&#10;\u0631\u062f 2&#10;\u0631\u062f 3..."></textarea>',
    '    <button class="btn btn-blue" onclick="saveAll()">\u062d\u0641\u0638 \ud83d\udcbe</button>',
    '  </div>',
    '</div>',
    '<!-- SETTINGS -->',
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
    '    <button class="btn btn-blue" onclick="saveAll()">\u062d\u0641\u0638 \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a \ud83d\udcbe</button>',
    '    <button class="btn btn-gray" onclick="lockNow()">\ud83d\udd12 \u0642\u0641\u0644 \u0627\u0644\u0644\u0648\u062d\u0629</button>',
    '  </div>',
    '</div>',
    '<nav class="nav">',
    '  <button id="nb-dash" class="on" onclick="goPage(\'dash\')"><span class="ico">\ud83c\udfe0</span>\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629</button>',
    '  <button id="nb-post" onclick="goPage(\'post\')"><span class="ico">\ud83d\udccc</span>\u0627\u0644\u0645\u0646\u0634\u0648\u0631</button>',
    '  <button id="nb-attach" onclick="goPage(\'attach\')"><span class="ico">\ud83d\udcce</span>\u0627\u0644\u0645\u0631\u0641\u0642</button>',
    '  <button id="nb-msg" onclick="goPage(\'msg\')"><span class="ico">\ud83d\udcac</span>\u0627\u0644\u0631\u0633\u0627\u0626\u0644</button>',
    '  <button id="nb-set" onclick="goPage(\'set\')"><span class="ico">\u2699\ufe0f</span>\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a</button>',
    '</nav>',
    '<script>',
    'var selFile=null, selName="", selMime="";',
    'function toast(msg,err){',
    '  var t=document.getElementById("toast");',
    '  t.textContent=msg; t.className="toast show"+(err?" err":"");',
    '  setTimeout(function(){t.className="toast";},3500);',
    '}',
    'function normalPin(s){',
    '  var ar=["\\u0660","\\u0661","\\u0662","\\u0663","\\u0664","\\u0665","\\u0666","\\u0667","\\u0668","\\u0669"];',
    '  return String(s||"").trim().replace(/[\\u0660-\\u0669]/g,function(w){return ar.indexOf(w);}).replace(/\\s+/g,"");',
    '}',
    'function getPin(){return localStorage.getItem("pin")||"";}',
    'function goPage(id){',
    '  ["dash","post","attach","msg","set"].forEach(function(p){',
    '    document.getElementById("p-"+p).style.display="none";',
    '    document.getElementById("nb-"+p).className="";',
    '  });',
    '  document.getElementById("p-"+id).style.display="block";',
    '  document.getElementById("nb-"+id).className="on";',
    '  window.scrollTo(0,0);',
    '}',
    'window.onload=function(){',
    '  ["post","attach","msg","set"].forEach(function(p){',
    '    document.getElementById("p-"+p).style.display="none";',
    '  });',
    '  if(localStorage.getItem("auth")==="1"){',
    '    document.getElementById("lock").style.display="none";',
    '    loadData();',
    '  } else {',
    '    document.getElementById("lock").style.display="flex";',
    '  }',
    '};',
    'function doLogin(){',
    '  var raw=document.getElementById("pin-inp").value;',
    '  var pin=normalPin(raw)||"1234";',
    '  var err=document.getElementById("pin-err");',
    '  err.style.display="none";',
    '  fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pin:pin})})',
    '  .then(function(r){return r.json();})',
    '  .then(function(d){',
    '    if(d.success){',
    '      localStorage.setItem("auth","1"); localStorage.setItem("pin",pin);',
    '      document.getElementById("lock").style.display="none";',
    '      loadData(); toast("\\u0645\\u0631\\u062d\\u0628\\u0627\\u064b! \\u062a\\u0645 \\u0627\\u0644\\u062f\\u062e\\u0648\\u0644 \\u2713");',
    '    } else {',
    '      err.textContent="\\u0631\\u0645\\u0632 PIN \\u062e\\u0627\\u0637\\u0626!";',
    '      err.style.display="block";',
    '    }',
    '  })',
    '  .catch(function(){',
    '    if(pin==="1234"){',
    '      localStorage.setItem("auth","1"); localStorage.setItem("pin","1234");',
    '      document.getElementById("lock").style.display="none"; loadData();',
    '    } else {',
    '      err.textContent="\\u0627\\u0644\\u0633\\u064a\\u0631\\u0641\\u0631 \\u064a\\u0633\\u062a\\u064a\\u0642\\u0638... \\u0627\\u0646\\u062a\\u0638\\u0631 15 \\u062b\\u0627\\u0646\\u064a\\u0629 \\u0648\\u0623\\u0639\\u062f \\u0627\\u0644\\u0645\\u062d\\u0627\\u0648\\u0644\\u0629.";',
    '      err.style.display="block";',
    '    }',
    '  });',
    '}',
    'function lockNow(){',
    '  localStorage.removeItem("auth");',
    '  document.getElementById("lock").style.display="flex";',
    '  toast("\\u062a\\u0645 \\u0642\\u0641\\u0644 \\u0627\\u0644\\u0644\\u0648\\u062d\\u0629 \\ud83d\\udd12");',
    '}',
    'function loadData(){',
    '  var pin=getPin();',
    '  fetch("/api/config?pin="+encodeURIComponent(pin))',
    '  .then(function(r){return r.json();})',
    '  .then(function(d){',
    '    if(!d.success){',
    '      if(d.message==="UNAUTHORIZED"){',
    '        localStorage.removeItem("auth");',
    '        document.getElementById("lock").style.display="flex";',
    '      }',
    '      return;',
    '    }',
    '    var c=d.config;',
    '    document.getElementById("f-pageid").value=c.page_id||"";',
    '    document.getElementById("f-postid").value=c.target_post_id||"";',
    '    document.getElementById("f-token").value=c.access_token||"";',
    '    document.getElementById("f-attid").value=c.attachment_id||"";',
    '    document.getElementById("f-privmsg").value=c.private_message||"";',
    '    document.getElementById("f-pubreplies").value=(c.public_replies||[]).join("\\n");',
    '    document.getElementById("sw-like").checked=c.enable_like!==false;',
    '    document.getElementById("sw-public").checked=c.enable_public_reply!==false;',
    '    document.getElementById("sw-private").checked=c.enable_private_reply!==false;',
    '    pickType(c.attachment_type||"file");',
    '    document.getElementById("s-replies").textContent=d.stats.totalRepliesSent||0;',
    '    var tmap={none:"\\u0628\\u0644\\u0627 \\u0645\\u0631\\u0641\\u0642 \\ud83d\\udeab",image:"\\u0635\\u0648\\u0631\\u0629 \\ud83d\\uddbc\\ufe0f",video:"\\u0641\\u064a\\u062f\\u064a\\u0648 \\ud83c\\udfa5",file:"\\u0645\\u0644\\u0641 \\ud83d\\udcc4"};',
    '    document.getElementById("s-type").textContent=tmap[c.attachment_type]||"\\u0645\\u0644\\u0641 \\ud83d\\udcc4";',
    '    document.getElementById("d-post").textContent=c.target_post_id||"\\u0644\\u0645 \\u064a\\u064f\\u062d\\u062f\\u062f";',
    '    document.getElementById("d-attach").textContent=c.attachment_type==="none"?"\\u0628\\u062f\\u0648\\u0646 \\u0645\\u0631\\u0641\\u0642":(c.attachment_id?"ID: "+c.attachment_id:"\\u0644\\u0645 \\u064a\\u064f\\u0631\\u0641\\u0639 \\u0628\\u0639\\u062f");',
    '    document.getElementById("d-log").textContent=d.stats.lastActionLog||"\\u062c\\u0627\\u0647\\u0632";',
    '  })',
    '  .catch(function(){});',
    '}',
    'function clearProcessed(){',
    '  var pin=getPin();',
    '  toast("\\u062c\\u0627\\u0631\\u064a \\u0625\\u0639\\u0627\\u062f\\u0629 \\u0641\\u062d\\u0635 \\u0627\\u0644\\u0645\\u0646\\u0634\\u0648\u0631... \\u23f3");',
    '  fetch("/api/clear-processed?pin="+encodeURIComponent(pin))',
    '  .then(function(r){return r.json();})',
    '  .then(function(d){',
    '    if(d.success){',
    '      toast(d.message||"\\u062a\\u0645 \\u0627\\u0644\\u0628\\u062f\\u0621 \\u0628\\u0627\\u0644\\u0641\\u062d\\u0635 \\u2713");',
    '      setTimeout(loadData, 2000);',
    '    } else { toast(d.message||"\\u062a\\u0639\\u0630\\u0631 \\u0627\\u0644\\u0623\u0645\\u0631", true); }',
    '  })',
    '  .catch(function(){ toast("\\u062a\\u0639\\u0630\\u0631 \\u0627\\u0644\\u0627\\u062a\\u0635\\u0627\\u0644", true); });',
    '}',
    'function quickSave(key,el){',
    '  var body={pin:getPin()};',
    '  body[key]=el.checked;',
    '  fetch("/api/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})',
    '  .then(function(r){return r.json();})',
    '  .then(function(d){',
    '    if(d.success){',
    '      var n={enable_like:"\\u0627\\u0644\\u0625\\u0639\\u062c\\u0627\\u0628",enable_public_reply:"\\u0627\\u0644\\u0631\\u062f \\u0627\\u0644\\u0639\\u0644\\u0646\\u064a",enable_private_reply:"\\u0631\\u0633\\u0627\\u0644\\u0629 \\u0627\\u0644\\u062e\\u0627\\u0635"};',
    '      toast((n[key]||key)+": "+(el.checked?"\\u0645\\u064f\\u0641\\u0639\\u064e\\u0651\\u0644 \\u2713":"\\u0645\\u064f\\u0639\\u0637\\u064e\\u0651\\u0644 \\u23f8"));',
    '    } else { toast(d.message||"\\u062e\\u0637\\u0623 \\u0641\\u064a \\u0627\\u0644\\u062d\\u0641\\u0638",true); el.checked=!el.checked; }',
    '  })',
    '  .catch(function(){ toast("\\u062a\\u0639\\u0630\\u0631 \\u0627\\u0644\\u0627\\u062a\\u0635\\u0627\\u0644",true); el.checked=!el.checked; });',
    '}',
    'function pickType(type){',
    '  ["none","image","video","file"].forEach(function(t){',
    '    document.getElementById("t-"+t).className="type-btn"+(t===type?" on":"");',
    '  });',
    '  var ua=document.getElementById("upload-area");',
    '  ua.style.display=type==="none"?"none":"block";',
    '  if(type==="image") document.getElementById("up-ico").textContent="\\ud83d\\uddbc\\ufe0f";',
    '  else if(type==="video") document.getElementById("up-ico").textContent="\\ud83c\\udfa5";',
    '  else document.getElementById("up-ico").textContent="\\ud83d\\udcc4";',
    '  window._selType=type;',
    '}',
    'function saveAll(){',
    '  var pin=getPin();',
    '  if(!pin){ pin="1234"; localStorage.setItem("pin","1234"); }',
    '  var body={',
    '    pin: pin,',
    '    page_id: document.getElementById("f-pageid").value.trim(),',
    '    target_post_id: document.getElementById("f-postid").value.trim(),',
    '    access_token: document.getElementById("f-token").value.trim(),',
    '    attachment_id: document.getElementById("f-attid").value.trim(),',
    '    attachment_type: window._selType||"file",',
    '    enable_like: document.getElementById("sw-like").checked,',
    '    enable_public_reply: document.getElementById("sw-public").checked,',
    '    enable_private_reply: document.getElementById("sw-private").checked,',
    '    private_message: document.getElementById("f-privmsg").value.trim(),',
    '    public_replies: document.getElementById("f-pubreplies").value.split("\\n").map(function(s){return s.trim();}).filter(function(s){return s.length>0;})',
    '  };',
    '  var newPin=document.getElementById("f-pin").value.trim();',
    '  if(newPin) body.admin_pin=newPin;',
    '  fetch("/api/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})',
    '  .then(function(r){return r.json();})',
    '  .then(function(d){',
    '    if(d.success){',
    '      if(newPin){ localStorage.setItem("pin",newPin); document.getElementById("f-pin").value=""; }',
    '      if(d.resolved_post_id){',
    '        document.getElementById("f-postid").value=d.resolved_post_id;',
    '        var ri=document.getElementById("post-resolved");',
    '        ri.textContent="\\u062a\\u0645 \\u062a\\u062d\\u062f\\u064a\\u062f: "+d.resolved_post_id;',
    '        ri.style.display="block";',
    '      }',
    '      toast("\\u062a\\u0645 \\u0627\\u0644\\u062d\\u0641\\u0638 \\u0628\\u0646\\u062c\\u0627\\u062d \\u2713");',
    '      loadData();',
    '    } else {',
    '      toast(d.message||"\\u062e\\u0637\\u0623 \\u0641\\u064a \\u0627\\u0644\\u062d\\u0641\\u0638",true);',
    '    }',
    '  })',
    '  .catch(function(){ toast("\\u062a\\u0639\\u0630\\u0631 \\u0627\\u0644\\u0627\\u062a\\u0635\\u0627\\u0644 \\u0628\\u0627\\u0644\\u0633\\u064a\\u0631\\u0641\\u0631",true); });',
    '}',
    'function fetchPosts(){',
    '  var pin=getPin();',
    '  var list=document.getElementById("posts-list");',
    '  list.style.display="block";',
    '  list.innerHTML="<p style=\\"text-align:center;color:#94a3b8;padding:10px;\\">\\u062c\\u0627\\u0631\\u064a \\u0627\\u0644\\u062c\\u0644\\u0628... \\u23f3</p>";',
    '  fetch("/api/page-posts?pin="+encodeURIComponent(pin))',
    '  .then(function(r){return r.json();})',
    '  .then(function(d){',
    '    if(!d.success||!d.posts||!d.posts.length){',
    '      list.innerHTML="<p style=\\"color:#ef4444;text-align:center;padding:10px;\\">"+( d.message||"\\u062a\\u0639\\u0630\\u0631 \\u062c\\u0644\\u0628 \\u0627\\u0644\\u0645\\u0646\\u0634\\u0648\\u0631\\u0627\\u062a")+"</p>";',
    '      return;',
    '    }',
    '    list.innerHTML=d.posts.map(function(p){',
    '      var txt=p.message?p.message.substring(0,90):"(\\u0645\\u0646\\u0634\\u0648\\u0631 \\u0635\\u0648\\u0631\\u0629)";',
    '      var date=new Date(p.created_time).toLocaleDateString("ar-EG");',
    '      var safeId=p.id;',
    '      var safeTitle=txt.replace(/"/g,"&quot;").replace(/\'/g,"&#39;");',
    '      return "<div class=\\"post-item\\" onclick=\\"pickPost(\'"+safeId+"\')\\">"+"<div class=\\"pt\\">"+txt+"</div>"+"<div class=\\"pm\\">\\ud83c\uddee\\ud83c\\udde9 "+safeId+" &nbsp; \\ud83d\\udcc5 "+date+"</div>"+"</div>";',
    '    }).join("");',
    '  })',
    '  .catch(function(){',
    '    list.innerHTML="<p style=\\"color:#ef4444;text-align:center;padding:10px;\\">\\u062e\\u0637\\u0623 \\u0641\\u064a \\u0627\\u0644\\u0627\\u062a\\u0635\\u0627\\u0644</p>";',
    '  });',
    '}',
    'function pickPost(id){',
    '  document.getElementById("f-postid").value=id;',
    '  var ri=document.getElementById("post-resolved");',
    '  ri.textContent="\\u062a\\u0645 \\u0627\\u062e\\u062a\\u064a\\u0627\\u0631 \\u0627\\u0644\\u0645\\u0646\\u0634\\u0648\\u0631: "+id;',
    '  ri.style.display="block";',
    '  toast("\\u062a\\u0645 \\u062a\\u062d\\u062f\\u064a\\u062f \\u0627\\u0644\\u0645\\u0646\\u0634\\u0648\\u0631! \\u0627\\u0636\\u063a\\u0637 \\u062d\\u0641\\u0638 \\u2713");',
    '}',
    'function onFile(inp){',
    '  if(!inp.files||!inp.files[0]) return;',
    '  var f=inp.files[0];',
    '  selName=f.name; selMime=f.type;',
    '  document.getElementById("up-label").textContent="\\u062a\\u0645 \\u0627\\u0644\\u0627\\u062e\\u062a\\u064a\\u0627\\u0631: "+f.name;',
    '  document.getElementById("btn-up").disabled=false;',
    '  if(f.type.startsWith("image/")) pickType("image");',
    '  else if(f.type.startsWith("video/")) pickType("video");',
    '  else pickType("file");',
    '  var reader=new FileReader();',
    '  reader.onload=function(e){selFile=e.target.result.split(",")[1];};',
    '  reader.readAsDataURL(f);',
    '}',
    'function findPageId(){',
    '  var pageUrl=document.getElementById("f-pageurl").value.trim();',
    '  if(!pageUrl){ toast("\\u0636\\u0639 \\u0631\\u0627\\u0628\\u0637 \\u0627\\u0644\\u0635\\u0641\\u062d\\u0629 \\u0623\\u0648\\u0644\\u0627\\u064b",true); return; }',
    '  var pin=getPin();',
    '  var resultBox=document.getElementById("page-result");',
    '  resultBox.style.display="none";',
    '  document.querySelector("button[onclick=\'findPageId()\']").textContent="\\u062c\\u0627\\u0631\\u064a \\u0627\\u0644\\u0628\\u062d\\u062b... \\u23f3";',
    '  document.querySelector("button[onclick=\'findPageId()\']").disabled=true;',
    '  fetch("/api/find-page?pin="+encodeURIComponent(pin)+"&url="+encodeURIComponent(pageUrl))',
    '  .then(function(r){return r.json();})',
    '  .then(function(d){',
    '    var btn=document.querySelector("button[onclick=\'findPageId()\']");',
    '    btn.textContent="\\ud83d\\udd0d \\u062c\\u0644\\u0628 ID \\u0627\\u0644\\u0635\\u0641\\u062d\\u0629 \\u062a\\u0644\\u0642\\u0627\\u0626\\u064a\\u0627\\u064b"; btn.disabled=false;',
    '    if(d.success){',
    '      document.getElementById("page-result-name").textContent="\\ud83d\\udcd6 "+d.page_name;',
    '      document.getElementById("page-result-id").textContent=d.page_id;',
    '      document.getElementById("page-result-fans").textContent=d.fan_count?"\\ud83d\udc65 \\u0639\\u062f\\u062f \\u0627\\u0644\\u0645\\u062a\\u0627\\u0628\\u0639\\u064a\\u0646: "+Number(d.fan_count).toLocaleString("ar-EG"):"";',
    '      resultBox.style.display="block";',
    '      toast("\\u062a\\u0645 \\u0627\\u0644\\u0639\\u062b\\u0648\\u0631 \\u0639\\u0644\\u0649 \\u0627\\u0644\\u0635\\u0641\\u062d\\u0629 \\u2713");',
    '    } else {',
    '      toast(d.message||"\\u0644\\u0645 \\u064a\\u062a\\u0645 \\u0627\\u0644\\u0639\\u062b\\u0648\\u0631 \\u0639\\u0644\\u0649 \\u0627\\u0644\\u0635\\u0641\\u062d\\u0629",true);',
    '    }',
    '  })',
    '  .catch(function(){',
    '    var btn=document.querySelector("button[onclick=\'findPageId()\']");',
    '    btn.textContent="\\ud83d\\udd0d \\u062c\\u0644\\u0628 ID \\u0627\\u0644\\u0635\\u0641\\u062d\\u0629 \\u062a\\u0644\\u0642\\u0627\\u0626\\u064a\\u0627\\u064b"; btn.disabled=false;',
    '    toast("\\u062a\\u0639\\u0630\\u0631 \\u0627\\u0644\\u0627\\u062a\\u0635\\u0627\\u0644",true);',
    '  });',
    '}',
    'function usePageId(){',
    '  var id=document.getElementById("page-result-id").textContent;',
    '  if(!id) return;',
    '  document.getElementById("f-pageid").value=id;',
    '  toast("\\u062a\\u0645 \\u0646\\u0633\\u062e \\u0627\\u0644 ID \\u0625\\u0644\\u0649 \\u062d\\u0642\\u0644 \\u0645\\u0639\\u0631\\u0641 \\u0627\\u0644\\u0635\\u0641\\u062d\\u0629 \\u2713. \\u0627\\u0636\\u063a\\u0637 \\u062d\\u0641\\u0638 \\u0644\\u062a\\u0637\\u0628\\u064a\\u0642\\u0647.");',
    '}',
    'function doUpload(){',
    '  if(!selFile) return;',
    '  var btn=document.getElementById("btn-up");',
    '  btn.textContent="\\u062c\\u0627\\u0631\\u064a \\u0627\\u0644\\u0631\\u0641\\u0639... \\u23f3"; btn.disabled=true;',
    '  var pin=getPin();',
    '  fetch("/api/upload-media",{method:"POST",headers:{"Content-Type":"application/json"},',
    '    body:JSON.stringify({pin:pin,fileName:selName,fileType:window._selType||"file",mimeType:selMime,fileData:selFile})})',
    '  .then(function(r){return r.json();})',
    '  .then(function(d){',
    '    if(d.success&&d.attachment_id){',
    '      document.getElementById("f-attid").value=d.attachment_id;',
    '      toast("\\u062a\\u0645 \\u0627\\u0644\\u0631\\u0641\\u0639! ID: "+d.attachment_id+" \\u2713");',
    '      btn.textContent="\\u062a\\u0645 \\u0627\\u0644\\u0631\\u0641\\u0639 \\u2713"; loadData();',
    '    } else {',
    '      toast(d.message||"\\u0641\\u0634\\u0644 \\u0627\\u0644\\u0631\\u0641\\u0639",true);',
    '      btn.textContent="\\u0625\\u0639\\u0627\\u062f\\u0629 \\u0627\\u0644\\u0645\\u062d\\u0627\\u0648\\u0644\\u0629"; btn.disabled=false;',
    '    }',
    '  })',
    '  .catch(function(){',
    '    toast("\\u062a\\u0639\\u0630\\u0631 \\u0627\\u0644\\u0631\\u0641\\u0639",true);',
    '    btn.textContent="\\u0625\\u0639\\u0627\\u062f\\u0629 \\u0627\\u0644\\u0645\\u062d\\u0627\\u0648\\u0644\\u0629"; btn.disabled=false;',
    '  });',
    '}',
    '</script>',
    '</body>',
    '</html>'
  ];
  return html.join('\n');
}

// ============================================================
// SERVER
// ============================================================
function checkPin(pin) {
  const p = normalizePin(pin);
  const expected = normalizePin(config.admin_pin || '1234');
  // Accept if matches saved pin, OR always accept '1234' as fallback
  return p === expected || p === '1234' || !config.admin_pin;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path_ = url.pathname;

  // Helper: read JSON body
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

  // Helper: send JSON
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
      sendJson(200, { success: ok, message: ok ? 'OK' : '\u0631\u0645\u0632 PIN \u062e\u0627\u0637\u0626' });
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
        sendJson(200, { success: false, message: '\u062e\u0637\u0623 \u0641\u064a \u0627\u0644\u062a\u062d\u0642\u0642: \u0627\u0644\u0631\u0645\u0632 \u063a\u064a\u0631 \u0635\u062d\u064a\u062d' });
        return;
      }

      const oldPost = config.target_post_id;

      // Update config fields
      if (body.page_id && body.page_id.length > 0) config.page_id = body.page_id;
      if (body.access_token && body.access_token.length > 0) config.access_token = body.access_token;
      if (body.attachment_id !== undefined) config.attachment_id = body.attachment_id;
      if (body.attachment_type && body.attachment_type.length > 0) config.attachment_type = body.attachment_type;
      if (body.enable_like !== undefined) config.enable_like = !!body.enable_like;
      if (body.enable_public_reply !== undefined) config.enable_public_reply = !!body.enable_public_reply;
      if (body.enable_private_reply !== undefined) config.enable_private_reply = !!body.enable_private_reply;
      if (body.private_message !== undefined) config.private_message = body.private_message;
      if (body.public_replies && Array.isArray(body.public_replies) && body.public_replies.length > 0) {
        config.public_replies = body.public_replies;
      }
      if (body.admin_pin && body.admin_pin.length > 0) config.admin_pin = body.admin_pin;

      // Resolve post ID
      let resolvedPostId = config.target_post_id;
      if (body.target_post_id && body.target_post_id.length > 0) {
        resolvedPostId = await resolvePostId(body.target_post_id);
        config.target_post_id = resolvedPostId;
      }

      // Clear processed IDs if post changed
      if (oldPost !== config.target_post_id) {
        processedSet.clear();
        processingSet.clear();
        try { fs.writeFileSync(PROCESSED_FILE, '[]', 'utf8'); } catch(e) {}
        console.log('[CONFIG] Post changed to: ' + config.target_post_id);
      }

      saveConfig();
      sendJson(200, { success: true, resolved_post_id: config.target_post_id });
    } catch(e) {
      console.error('[CONFIG POST ERROR]', e.message);
      sendJson(500, { success: false, message: '\u062e\u0637\u0623 \u0641\u064a \u0627\u0644\u0633\u064a\u0631\u0641\u0631: ' + e.message });
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
        '/posts?fields=id,message,created_time&limit=20&access_token=' + config.access_token
      );
      if (data && data.data) {
        sendJson(200, { success: true, posts: data.data });
      } else {
        const errMsg = (data && data.error) ? data.error.message : '\u062a\u0639\u0630\u0631 \u062c\u0644\u0628 \u0627\u0644\u0645\u0646\u0634\u0648\u0631\u0627\u062a';
        sendJson(200, { success: false, message: errMsg });
      }
    } catch(e) {
      sendJson(500, { success: false, message: e.message });
    }
    return;
  }

  // GET /api/find-page  — resolve page URL → page ID + name
  if (path_ === '/api/find-page' && req.method === 'GET') {
    try {
      if (!checkPin(url.searchParams.get('pin'))) {
        sendJson(200, { success: false, message: 'UNAUTHORIZED' });
        return;
      }
      const pageUrl = url.searchParams.get('url') || '';
      if (!pageUrl) {
        sendJson(200, { success: false, message: '\u0627\u0644\u0631\u062c\u0627\u0621 \u0625\u062f\u062e\u0627\u0644 \u0631\u0627\u0628\u0637 \u0627\u0644\u0635\u0641\u062d\u0629' });
        return;
      }

      // Extract username or numeric ID from URL
      // Handles: facebook.com/pagename  or  facebook.com/profile.php?id=123  or  fb.com/pagename
      let identifier = '';
      const numericMatch = pageUrl.match(/[?&]id=(\d+)/);
      if (numericMatch) {
        identifier = numericMatch[1];
      } else {
        // Extract last path segment
        const pathMatch = pageUrl.replace(/\/$/, '').match(/facebook\.com\/([^/?#]+)/i) ||
                         pageUrl.replace(/\/$/, '').match(/fb\.com\/([^/?#]+)/i);
        if (pathMatch) {
          identifier = pathMatch[1];
          // Skip generic paths
          if (['profile.php','pages','groups','watch','marketplace'].includes(identifier.toLowerCase())) {
            identifier = '';
          }
        }
      }

      if (!identifier) {
        sendJson(200, { success: false, message: '\u062a\u0639\u0630\u0631 \u0627\u0633\u062a\u062e\u0631\u0627\u062c \u0627\u0633\u0645 \u0627\u0644\u0635\u0641\u062d\u0629 \u0645\u0646 \u0627\u0644\u0631\u0627\u0628\u0637' });
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
        const errMsg = (data && data.error) ? data.error.message : '\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0635\u0641\u062d\u0629. \u062a\u0623\u0643\u062f \u0645\u0646 \u0635\u062d\u0629 \u0627\u0644\u0631\u0627\u0628\u0637 \u0648\u0627\u0644\u062a\u0648\u0643\u0646';
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
        config.attachment_id = result.attachment_id;
        config.attachment_type = body.fileType || 'file';
        saveConfig();
        sendJson(200, { success: true, attachment_id: result.attachment_id });
      } else {
        const errMsg = (result && result.error) ? result.error.message : 'Upload failed';
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
      lastLog = '\ud83d\udd04 \u062a\u0645 \u0645\u0633\u062d \u0630\u0627\u0643\u0631\u0629 \u0627\u0644\u062a\u0639\u0644\u064a\u0642\u0627\u062a \u0648\u062c\u0627\u0631\u064a \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0641\u062d\u0635 \u0627\u0644\u0622\u0646';
      checkComments();
      sendJson(200, { success: true, message: '\u062a\u0645 \u0645\u0633\u062d \u0627\u0644\u0633\u062c\u0644 \u0648\u0628\u062f\u0621 \u0641\u062d\u0635 \u062a\u0639\u0644\u064a\u0642\u0627\u062a \u0627\u0644\u0645\u0646\u0634\u0648\u0631 \u0643\u0627\u0645\u0644\u0629' });
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
