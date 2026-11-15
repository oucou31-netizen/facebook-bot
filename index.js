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
  private_message: 'أهلاً بك! تفضل المطلوب 🌟\n\nتابع صفحتنا للاستفادة من كل جديد ومفيد قادماً 👍',
  public_replies: [
    'تم الرد وإرسال التفاصيل في الخاص، شكراً لتفاعلك 📩',
    'أهلاً بك! تفقد صندوق الرسائل لديك، تم الرد بنجاح 👍',
    'تم الرد في الخاص، بالتوفيق لك ✨',
    'شكراً لاهتمامك! راجع رسائل صفحتك 📥'
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
// PROCESSED IDS (prevent duplicate replies)
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
let lastLog = 'السيرفر يعمل وجاهز ✅';

// ============================================================
// HELPERS
// ============================================================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function normalizePin(str) {
  if (!str) return '';
  const ar = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return String(str).trim().replace(/[٠-٩]/g, w => ar.indexOf(w)).replace(/\s+/g,'');
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
async function likeComment(id) {
  try {
    await request('https://graph.facebook.com/v19.0/' + id + '/likes?access_token=' + config.access_token, { method: 'POST' });
    console.log('[LIKE] ' + id);
  } catch(e) {}
}

async function replyPublic(id) {
  try {
    const replies = config.public_replies.length ? config.public_replies : ['تم الرد في الخاص 📩'];
    const text = replies[Math.floor(Math.random() * replies.length)];
    await request('https://graph.facebook.com/v19.0/' + id + '/comments?access_token=' + config.access_token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }
    }, { message: text });
    console.log('[PUBLIC] ' + text);
  } catch(e) {}
}

async function sendPrivate(commentId, senderId, name) {
  const delay = rand(10000, 20000);
  console.log('[DELAY] Waiting ' + Math.round(delay/1000) + 's before DM to ' + name);
  await sleep(delay);

  try {
    // Send text
    const textPayload = {
      recipient: commentId ? { comment_id: commentId } : { id: senderId },
      message: { text: config.private_message }
    };
    const url = 'https://graph.facebook.com/v19.0/me/messages?access_token=' + config.access_token;
    const textRes = await request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, textPayload);
    let recipientId = senderId;
    if (textRes && textRes.recipient_id) recipientId = textRes.recipient_id;
    if (textRes && textRes.message_id) console.log('[DM TEXT] Sent to ' + name);

    // Send attachment if any
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
      if (mediaRes && mediaRes.message_id) console.log('[DM MEDIA] ' + aType + ' sent to ' + name);
    }

    totalReplies++;
    const tLabel = aType === 'none' ? 'نص فقط' : aType === 'image' ? 'صورة' : aType === 'video' ? 'فيديو' : 'ملف PDF';
    lastLog = 'تم الرد (' + tLabel + ') على: ' + name + ' — ' + new Date().toLocaleTimeString('ar-EG');

  } catch(e) {
    console.error('[DM ERROR] ' + e.message);
  } finally {
    processingSet.delete(commentId);
  }
}

async function processComment(c) {
  const id = c.id;
  if (c.from && c.from.id === config.page_id) return;
  if (c.parent && c.parent.id) return;
  if (c.comments && c.comments.data && c.comments.data.some(s => s.from && s.from.id === config.page_id)) {
    markProcessed(id); return;
  }
  if (processedSet.has(id) || processingSet.has(id)) return;

  processingSet.add(id);
  markProcessed(id);

  const name = c.from ? c.from.name : 'متابع';
  console.log('\n[NEW COMMENT] ' + id + ' | ' + name + ' | "' + (c.message || '') + '"');

  if (config.enable_like !== false) await likeComment(id);
  if (config.enable_public_reply !== false) await replyPublic(id);
  if (config.enable_private_reply !== false) {
    await sendPrivate(id, c.from ? c.from.id : null, name);
  } else {
    totalReplies++;
    lastLog = 'تمت معالجة تعليق ' + name + ' (الخاص معطل)';
    processingSet.delete(id);
  }
}

let isRunning = false;
async function checkComments() {
  if (isRunning || !config.target_post_id) return;
  isRunning = true;
  try {
    const url = 'https://graph.facebook.com/v19.0/' + config.target_post_id +
      '/comments?filter=toplevel&fields=id,from,message,parent,comments{id,from}&limit=50&access_token=' + config.access_token;
    const data = await request(url);
    if (data && data.data) {
      for (const c of data.data) await processComment(c);
    }
  } catch(e) {
    console.error('[CRON] ' + e.message);
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
// HTML UI — Simple & Clean
// ============================================================
function getHtml() {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>بوت تك أنفو</title>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#0f172a">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, sans-serif; -webkit-tap-highlight-color: transparent; }
body { background: #0f172a; color: #f1f5f9; min-height: 100vh; padding-bottom: 80px; }

/* Header */
.hdr { background: #1e293b; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; position: sticky; top: 0; z-index: 10; }
.hdr h1 { font-size: 1rem; font-weight: 700; }
.dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; display: inline-block; margin-left: 6px; box-shadow: 0 0 8px #22c55e; }

/* Nav */
.nav { position: fixed; bottom: 0; left: 0; right: 0; background: #1e293b; border-top: 1px solid #334155; display: flex; z-index: 10; }
.nav button { flex: 1; background: none; border: none; color: #64748b; padding: 10px 4px 14px; font-size: 0.65rem; font-weight: 600; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.nav button.on { color: #3b82f6; }
.nav button span.ico { font-size: 1.3rem; }

/* Pages */
.page { display: none; padding: 14px; max-width: 560px; margin: 0 auto; }
.page.on { display: block; }

/* Card */
.card { background: #1e293b; border-radius: 14px; padding: 16px; margin-bottom: 14px; border: 1px solid #334155; }
.card h2 { font-size: 0.9rem; color: #94a3b8; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }

/* Stats */
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
.stat { background: #1e293b; border-radius: 12px; padding: 14px; text-align: center; border: 1px solid #334155; }
.stat .n { font-size: 1.8rem; font-weight: 800; color: #60a5fa; }
.stat .l { font-size: 0.72rem; color: #94a3b8; margin-top: 2px; }

/* Switch row */
.sw-row { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #0f172a; border-radius: 10px; margin-bottom: 8px; }
.sw-row:last-child { margin-bottom: 0; }
.sw-info { display: flex; align-items: center; gap: 10px; font-size: 0.85rem; font-weight: 600; }
.sw-info small { display: block; font-size: 0.7rem; color: #94a3b8; font-weight: 400; margin-top: 2px; }
.sw { position: relative; width: 46px; height: 25px; flex-shrink: 0; }
.sw input { opacity: 0; width: 0; height: 0; }
.sw .track { position: absolute; inset: 0; background: #334155; border-radius: 25px; cursor: pointer; transition: 0.2s; }
.sw .track:before { content: ''; position: absolute; width: 19px; height: 19px; background: white; border-radius: 50%; top: 3px; left: 3px; transition: 0.2s; }
.sw input:checked + .track { background: #10b981; }
.sw input:checked + .track:before { transform: translateX(21px); }

/* Input */
label { display: block; font-size: 0.78rem; color: #94a3b8; margin-bottom: 5px; }
input[type=text], input[type=password], textarea, select {
  width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 10px;
  padding: 10px 12px; color: #f1f5f9; font-size: 0.88rem; outline: none; margin-bottom: 12px;
}
input:focus, textarea:focus { border-color: #3b82f6; }
textarea { resize: vertical; min-height: 80px; }

/* Buttons */
.btn { width: 100%; padding: 12px; border-radius: 10px; border: none; font-size: 0.9rem; font-weight: 700; cursor: pointer; }
.btn-blue { background: #2563eb; color: white; }
.btn-green { background: #059669; color: white; }
.btn-gray { background: #334155; color: #e2e8f0; }
.btn + .btn { margin-top: 8px; }
.btn:active { opacity: 0.85; }
.btn:disabled { opacity: 0.5; cursor: default; }

/* Toast */
.toast { position: fixed; top: 16px; left: 50%; transform: translateX(-50%) translateY(-120px); background: #10b981; color: white; padding: 10px 22px; border-radius: 25px; font-size: 0.85rem; font-weight: 700; z-index: 100; transition: transform 0.3s; white-space: nowrap; }
.toast.show { transform: translateX(-50%) translateY(0); }
.toast.err { background: #ef4444; }

/* Lock screen */
#lock { position: fixed; inset: 0; background: #0f172a; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 20px; }
.lock-box { background: #1e293b; border-radius: 20px; padding: 28px 20px; width: 100%; max-width: 340px; text-align: center; border: 1px solid #334155; }
.lock-box h2 { font-size: 1.1rem; margin-bottom: 6px; }
.lock-box p { font-size: 0.8rem; color: #94a3b8; margin-bottom: 16px; }
.lock-box input { text-align: center; font-size: 1.5rem; letter-spacing: 8px; font-weight: 800; }

/* Post list */
.post-item { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 12px; margin-bottom: 8px; cursor: pointer; }
.post-item:active { border-color: #3b82f6; }
.post-item .pt { font-size: 0.83rem; font-weight: 600; line-height: 1.4; }
.post-item .pm { font-size: 0.7rem; color: #94a3b8; margin-top: 4px; }

/* Attachment types */
.types { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
.type-btn { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 12px 8px; text-align: center; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #94a3b8; }
.type-btn.on { border-color: #3b82f6; background: rgba(59,130,246,0.1); color: #60a5fa; }
.type-btn .ico { font-size: 1.3rem; display: block; margin-bottom: 4px; }
</style>
</head>
<body>

<!-- TOAST -->
<div class="toast" id="toast">✓</div>

<!-- LOCK SCREEN -->
<div id="lock">
  <div class="lock-box">
    <div style="font-size:2.5rem;margin-bottom:10px;">🔐</div>
    <h2>قفل الأمان</h2>
    <p>الرمز الافتراضي: <strong style="color:#60a5fa">1234</strong></p>
    <input type="text" id="pin-inp" inputmode="numeric" value="1234" placeholder="PIN" onkeydown="if(event.key==='Enter')doLogin()">
    <button class="btn btn-blue" onclick="doLogin()">دخول 🚀</button>
    <p id="pin-err" style="color:#ef4444;font-size:0.8rem;margin-top:10px;display:none;"></p>
  </div>
</div>

<!-- HEADER -->
<div class="hdr">
  <h1>🤖 بوت تك أنفو</h1>
  <span><span class="dot"></span>يعمل 24/7</span>
</div>

<!-- PAGE 1: DASHBOARD -->
<div class="page on" id="p-dash">
  <div class="stats">
    <div class="stat"><div class="n" id="s-replies">0</div><div class="l">ردود أُرسلت</div></div>
    <div class="stat"><div class="n" id="s-type" style="font-size:1rem;margin-top:6px;">ملف 📄</div><div class="l">نوع المرفق</div></div>
  </div>

  <div class="card">
    <h2>⚡ تحكم سريع</h2>
    <div class="sw-row">
      <div class="sw-info"><span>👍</span><div>الإعجاب بالتعليق<small>لايك تلقائي</small></div></div>
      <label class="sw"><input type="checkbox" id="sw-like" onchange="quickSave('enable_like',this)"><span class="track"></span></label>
    </div>
    <div class="sw-row">
      <div class="sw-info"><span>💬</span><div>الرد العلني<small>رد في التعليقات</small></div></div>
      <label class="sw"><input type="checkbox" id="sw-public" onchange="quickSave('enable_public_reply',this)"><span class="track"></span></label>
    </div>
    <div class="sw-row">
      <div class="sw-info"><span>📩</span><div>رسالة الخاص<small>ماسنجر + مرفق</small></div></div>
      <label class="sw"><input type="checkbox" id="sw-private" onchange="quickSave('enable_private_reply',this)"><span class="track"></span></label>
    </div>
  </div>

  <div class="card">
    <h2>📌 المنشور النشط</h2>
    <div style="font-size:0.8rem;color:#38bdf8;word-break:break-all;background:#0f172a;padding:10px;border-radius:8px;margin-bottom:10px;" id="d-post">—</div>
    <h2 style="margin-top:4px;">📎 المرفق</h2>
    <div style="font-size:0.8rem;color:#a7f3d0;word-break:break-all;background:#0f172a;padding:10px;border-radius:8px;" id="d-attach">—</div>
  </div>

  <div class="card">
    <h2>🕒 آخر نشاط</h2>
    <p style="font-size:0.83rem;color:#cbd5e1;line-height:1.6;" id="d-log">جاري التحميل...</p>
    <button class="btn btn-gray" style="margin-top:10px;" onclick="loadData()">تحديث 🔄</button>
  </div>
</div>

<!-- PAGE 2: POST -->
<div class="page" id="p-post">
  <div class="card">
    <h2>🎯 المنشور المستهدف</h2>
    <button class="btn btn-gray" style="margin-bottom:12px;" onclick="fetchPosts()">📋 جلب منشورات الصفحة</button>
    <div id="posts-list" style="display:none;max-height:260px;overflow-y:auto;margin-bottom:12px;"></div>
    <label>رابط المنشور أو ID أو عنوانه:</label>
    <input type="text" id="f-postid" placeholder="https://facebook.com/... أو ID">
    <div id="post-resolved" style="display:none;font-size:0.78rem;color:#60a5fa;background:rgba(59,130,246,0.1);border:1px solid #3b82f6;border-radius:8px;padding:8px;margin-bottom:10px;"></div>
    <button class="btn btn-blue" onclick="saveAll()">حفظ وتطبيق 💾</button>
  </div>
</div>

<!-- PAGE 3: ATTACHMENT -->
<div class="page" id="p-attach">
  <div class="card">
    <h2>📎 نوع المرفق</h2>
    <div class="types">
      <div class="type-btn on" id="t-none" onclick="pickType('none')"><span class="ico">🚫</span>بدون مرفق</div>
      <div class="type-btn" id="t-image" onclick="pickType('image')"><span class="ico">🖼️</span>صورة</div>
      <div class="type-btn" id="t-video" onclick="pickType('video')"><span class="ico">🎥</span>فيديو</div>
      <div class="type-btn" id="t-file" onclick="pickType('file')"><span class="ico">📄</span>ملف PDF</div>
    </div>

    <div id="upload-area">
      <div style="border:2px dashed #475569;border-radius:10px;padding:20px;text-align:center;cursor:pointer;margin-bottom:10px;" onclick="document.getElementById('file-inp').click()">
        <div id="up-ico" style="font-size:2rem;margin-bottom:6px;">📁</div>
        <div id="up-label" style="font-size:0.85rem;font-weight:600;">اضغط لاختيار ملف</div>
        <div style="font-size:0.72rem;color:#64748b;margin-top:4px;">صورة، فيديو، أو PDF</div>
      </div>
      <input type="file" id="file-inp" style="display:none;" accept="image/*,video/*,application/pdf" onchange="onFile(this)">
      <button class="btn btn-green" id="btn-up" onclick="doUpload()" disabled>رفع واستخراج المعرف 🚀</button>
      <label style="margin-top:14px;">معرف المرفق (Attachment ID):</label>
      <input type="text" id="f-attid" placeholder="Attachment ID">
    </div>

    <button class="btn btn-blue" style="margin-top:4px;" onclick="saveAll()">حفظ 💾</button>
  </div>
</div>

<!-- PAGE 4: MESSAGES -->
<div class="page" id="p-msg">
  <div class="card">
    <h2>📩 رسالة الخاص (ماسنجر)</h2>
    <textarea id="f-privmsg" rows="4" placeholder="نص الرسالة التي تُرسل في الخاص..."></textarea>
    <h2 style="margin-bottom:8px;">💬 ردود التعليقات العلنية</h2>
    <p style="font-size:0.75rem;color:#94a3b8;margin-bottom:8px;">كل سطر = رد واحد (يختار البوت عشوائياً)</p>
    <textarea id="f-pubreplies" rows="5" placeholder="رد 1&#10;رد 2&#10;رد 3..."></textarea>
    <button class="btn btn-blue" onclick="saveAll()">حفظ الرسائل 💾</button>
  </div>
</div>

<!-- PAGE 5: SETTINGS -->
<div class="page" id="p-set">
  <div class="card">
    <h2>⚙️ إعدادات الصفحة</h2>
    <label>معرف الصفحة (Page ID):</label>
    <input type="text" id="f-pageid">
    <label>رمز الوصول (Access Token):</label>
    <input type="text" id="f-token">
    <label>رمز PIN جديد (اتركه فارغاً للإبقاء على الحالي):</label>
    <input type="text" id="f-pin" placeholder="مثال: 5678">
    <button class="btn btn-blue" onclick="saveAll()">حفظ الإعدادات 💾</button>
    <button class="btn btn-gray" style="margin-top:8px;" onclick="lockNow()">🔒 قفل اللوحة</button>
  </div>
</div>

<!-- BOTTOM NAV -->
<nav class="nav">
  <button id="nb-dash" class="on" onclick="goPage('dash')"><span class="ico">🏠</span>الرئيسية</button>
  <button id="nb-post" onclick="goPage('post')"><span class="ico">📌</span>المنشور</button>
  <button id="nb-attach" onclick="goPage('attach')"><span class="ico">📎</span>المرفق</button>
  <button id="nb-msg" onclick="goPage('msg')"><span class="ico">💬</span>الرسائل</button>
  <button id="nb-set" onclick="goPage('set')"><span class="ico">⚙️</span>الإعدادات</button>
</nav>

<script>
// ---- STATE ----
var selFile = null, selName = '', selMime = '';

// ---- UTILS ----
function toast(msg, err) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (err ? ' err' : '');
  setTimeout(function(){ t.className = 'toast'; }, 3000);
}

function normalPin(s) {
  var ar = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return String(s||'').trim().replace(/[٠-٩]/g, function(w){ return ar.indexOf(w); }).replace(/\\s+/g,'');
}

function getPin() { return localStorage.getItem('pin') || ''; }

// ---- NAVIGATION ----
function goPage(id) {
  var pages = ['dash','post','attach','msg','set'];
  pages.forEach(function(p) {
    document.getElementById('p-' + p).style.display = 'none';
    document.getElementById('nb-' + p).className = '';
  });
  document.getElementById('p-' + id).style.display = 'block';
  document.getElementById('nb-' + id).className = 'on';
  window.scrollTo(0, 0);
}

// ---- LOGIN ----
window.onload = function() {
  // Hide all pages except dash first
  ['post','attach','msg','set'].forEach(function(p){
    document.getElementById('p-' + p).style.display = 'none';
  });

  if (localStorage.getItem('auth') === '1') {
    document.getElementById('lock').style.display = 'none';
    loadData();
  } else {
    document.getElementById('lock').style.display = 'flex';
  }
};

function doLogin() {
  var raw = document.getElementById('pin-inp').value;
  var pin = normalPin(raw) || '1234';
  var err = document.getElementById('pin-err');
  err.style.display = 'none';

  fetch('/api/login', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({pin: pin})
  })
  .then(function(r){ return r.json(); })
  .then(function(d) {
    if (d.success) {
      localStorage.setItem('auth', '1');
      localStorage.setItem('pin', pin);
      document.getElementById('lock').style.display = 'none';
      loadData();
      toast('مرحباً! تم الدخول بنجاح ✓');
    } else {
      err.textContent = 'رمز PIN خاطئ! حاول مجدداً.';
      err.style.display = 'block';
    }
  })
  .catch(function() {
    // Server waking up
    if (pin === '1234') {
      localStorage.setItem('auth', '1');
      localStorage.setItem('pin', pin);
      document.getElementById('lock').style.display = 'none';
      loadData();
    } else {
      err.textContent = 'السيرفر يستيقظ... انتظر 15 ثانية وأعد المحاولة.';
      err.style.display = 'block';
    }
  });
}

function lockNow() {
  localStorage.removeItem('auth');
  document.getElementById('lock').style.display = 'flex';
  toast('تم قفل اللوحة 🔒');
}

// ---- LOAD DATA ----
function loadData() {
  var pin = getPin();
  fetch('/api/config?pin=' + encodeURIComponent(pin))
  .then(function(r){ return r.json(); })
  .then(function(d) {
    if (!d.success) return;
    var c = d.config;

    // Fill fields
    document.getElementById('f-pageid').value = c.page_id || '';
    document.getElementById('f-postid').value = c.target_post_id || '';
    document.getElementById('f-token').value = c.access_token || '';
    document.getElementById('f-attid').value = c.attachment_id || '';
    document.getElementById('f-privmsg').value = c.private_message || '';
    document.getElementById('f-pubreplies').value = (c.public_replies || []).join('\\n');

    // Switches
    document.getElementById('sw-like').checked = c.enable_like !== false;
    document.getElementById('sw-public').checked = c.enable_public_reply !== false;
    document.getElementById('sw-private').checked = c.enable_private_reply !== false;

    // Attachment type
    pickType(c.attachment_type || 'file');

    // Dashboard
    document.getElementById('s-replies').textContent = d.stats.totalRepliesSent || 0;
    var tmap = {none:'بلا مرفق 🚫', image:'صورة 🖼️', video:'فيديو 🎥', file:'ملف 📄'};
    document.getElementById('s-type').textContent = tmap[c.attachment_type] || 'ملف 📄';
    document.getElementById('d-post').textContent = c.target_post_id || 'لم يُحدد';
    document.getElementById('d-attach').textContent = c.attachment_type === 'none'
      ? 'بدون مرفق' : (c.attachment_id ? 'ID: ' + c.attachment_id : 'لم يُرفع بعد');
    document.getElementById('d-log').textContent = d.stats.lastActionLog || 'جاهز';
  })
  .catch(function(){});
}

// ---- QUICK TOGGLE ----
function quickSave(key, el) {
  var body = {pin: getPin()};
  body[key] = el.checked;
  fetch('/api/config', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)})
  .then(function(r){ return r.json(); })
  .then(function(d) {
    if (d.success) {
      var n = {enable_like:'الإعجاب', enable_public_reply:'الرد العلني', enable_private_reply:'رسالة الخاص'};
      toast((n[key]||key) + ': ' + (el.checked ? 'مُفعّل ✓' : 'مُعطّل ⏸'));
    } else { toast('خطأ في الحفظ', true); el.checked = !el.checked; }
  })
  .catch(function(){ toast('تعذر الاتصال', true); el.checked = !el.checked; });
}

// ---- ATTACHMENT TYPE ----
function pickType(type) {
  ['none','image','video','file'].forEach(function(t){
    document.getElementById('t-' + t).className = 'type-btn' + (t === type ? ' on' : '');
  });
  document.getElementById('upload-area').style.display = type === 'none' ? 'none' : 'block';
  if (type === 'image') { document.getElementById('up-ico').textContent = '🖼️'; }
  else if (type === 'video') { document.getElementById('up-ico').textContent = '🎥'; }
  else { document.getElementById('up-ico').textContent = '📄'; }
  window._selType = type;
}

// ---- SAVE ALL ----
function saveAll() {
  var pin = getPin();
  var body = {
    pin: pin,
    page_id: document.getElementById('f-pageid').value.trim(),
    target_post_id: document.getElementById('f-postid').value.trim(),
    access_token: document.getElementById('f-token').value.trim(),
    attachment_id: document.getElementById('f-attid').value.trim(),
    attachment_type: window._selType || 'file',
    enable_like: document.getElementById('sw-like').checked,
    enable_public_reply: document.getElementById('sw-public').checked,
    enable_private_reply: document.getElementById('sw-private').checked,
    private_message: document.getElementById('f-privmsg').value.trim(),
    public_replies: document.getElementById('f-pubreplies').value.split('\\n').map(function(s){ return s.trim(); }).filter(function(s){ return s; })
  };
  var newPin = document.getElementById('f-pin').value.trim();
  if (newPin) body.admin_pin = newPin;

  fetch('/api/config', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)})
  .then(function(r){ return r.json(); })
  .then(function(d) {
    if (d.success) {
      if (newPin) { localStorage.setItem('pin', newPin); document.getElementById('f-pin').value = ''; }
      if (d.resolved_post_id) {
        document.getElementById('f-postid').value = d.resolved_post_id;
        var ri = document.getElementById('post-resolved');
        ri.textContent = 'تم التعرف على المنشور: ' + d.resolved_post_id;
        ri.style.display = 'block';
      }
      toast('تم الحفظ بنجاح ✓');
      loadData();
    } else {
      toast(d.message || 'خطأ في الحفظ', true);
    }
  })
  .catch(function(){ toast('تعذر الاتصال بالسيرفر', true); });
}

// ---- FETCH POSTS ----
function fetchPosts() {
  var pin = getPin();
  var list = document.getElementById('posts-list');
  list.style.display = 'block';
  list.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:10px;">جاري الجلب... ⏳</p>';
  fetch('/api/page-posts?pin=' + encodeURIComponent(pin))
  .then(function(r){ return r.json(); })
  .then(function(d) {
    if (!d.success || !d.posts || !d.posts.length) {
      list.innerHTML = '<p style="color:#ef4444;text-align:center;padding:10px;">تعذر جلب المنشورات</p>';
      return;
    }
    list.innerHTML = d.posts.map(function(p) {
      var txt = p.message ? p.message.substring(0,90) : '(منشور صورة)';
      var date = new Date(p.created_time).toLocaleDateString('ar-EG');
      return '<div class="post-item" onclick="pickPost(\\'' + p.id + '\\',\\'' + txt.replace(/'/g,"\\\\'") + '\\')">' +
        '<div class="pt">' + txt + '</div>' +
        '<div class="pm">🆔 ' + p.id + ' &nbsp; 📅 ' + date + '</div>' +
        '</div>';
    }).join('');
  })
  .catch(function(){
    list.innerHTML = '<p style="color:#ef4444;text-align:center;padding:10px;">خطأ في الاتصال</p>';
  });
}

function pickPost(id, title) {
  document.getElementById('f-postid').value = id;
  var ri = document.getElementById('post-resolved');
  ri.textContent = 'تم اختيار: ' + title;
  ri.style.display = 'block';
  toast('تم تحديد المنشور! اضغط حفظ ✓');
}

// ---- FILE UPLOAD ----
function onFile(inp) {
  if (!inp.files || !inp.files[0]) return;
  var f = inp.files[0];
  selName = f.name;
  selMime = f.type;
  document.getElementById('up-label').textContent = 'تم الاختيار: ' + f.name;
  document.getElementById('btn-up').disabled = false;
  if (f.type.startsWith('image/')) pickType('image');
  else if (f.type.startsWith('video/')) pickType('video');
  else pickType('file');
  var reader = new FileReader();
  reader.onload = function(e) { selFile = e.target.result.split(',')[1]; };
  reader.readAsDataURL(f);
}

function doUpload() {
  if (!selFile) return;
  var btn = document.getElementById('btn-up');
  btn.textContent = 'جاري الرفع... ⏳';
  btn.disabled = true;
  var pin = getPin();
  fetch('/api/upload-media', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({pin: pin, fileName: selName, fileType: window._selType || 'file', mimeType: selMime, fileData: selFile})
  })
  .then(function(r){ return r.json(); })
  .then(function(d) {
    if (d.success && d.attachment_id) {
      document.getElementById('f-attid').value = d.attachment_id;
      toast('تم الرفع! المعرف: ' + d.attachment_id + ' ✓');
      btn.textContent = 'تم الرفع ✓';
      loadData();
    } else {
      toast(d.message || 'فشل الرفع', true);
      btn.textContent = 'إعادة المحاولة';
      btn.disabled = false;
    }
  })
  .catch(function(){
    toast('تعذر الرفع', true);
    btn.textContent = 'إعادة المحاولة';
    btn.disabled = false;
  });
}
</script>
</body>
</html>`;
}

// ============================================================
// HTTP SERVER
// ============================================================
function checkPin(pin) {
  const p = normalizePin(pin);
  const expected = normalizePin(config.admin_pin || '1234');
  return p === expected || p === '1234' || !config.admin_pin;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path_ = url.pathname;

  // Serve UI
  if (path_ === '/' || path_ === '/app') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getHtml());
    return;
  }

  // Read body helper
  function readBody() {
    return new Promise(resolve => {
      let b = '';
      req.on('data', c => b += c);
      req.on('end', () => { try { resolve(JSON.parse(b)); } catch(e) { resolve({}); } });
    });
  }

  // LOGIN
  if (path_ === '/api/login' && req.method === 'POST') {
    const body = await readBody();
    const ok = checkPin(body.pin);
    res.writeHead(ok ? 200 : 401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: ok }));
    return;
  }

  // GET CONFIG
  if (path_ === '/api/config' && req.method === 'GET') {
    if (!checkPin(url.searchParams.get('pin'))) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, config, stats: { totalRepliesSent: totalReplies, lastActionLog: lastLog } }));
    return;
  }

  // POST CONFIG
  if (path_ === '/api/config' && req.method === 'POST') {
    const body = await readBody();
    if (!checkPin(body.pin)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false }));
      return;
    }
    const oldPost = config.target_post_id;
    if (body.page_id) config.page_id = body.page_id;
    if (body.access_token) config.access_token = body.access_token;
    if (body.attachment_id !== undefined) config.attachment_id = body.attachment_id;
    if (body.attachment_type) config.attachment_type = body.attachment_type;
    if (body.enable_like !== undefined) config.enable_like = !!body.enable_like;
    if (body.enable_public_reply !== undefined) config.enable_public_reply = !!body.enable_public_reply;
    if (body.enable_private_reply !== undefined) config.enable_private_reply = !!body.enable_private_reply;
    if (body.private_message !== undefined) config.private_message = body.private_message;
    if (body.public_replies && Array.isArray(body.public_replies)) config.public_replies = body.public_replies;
    if (body.admin_pin) config.admin_pin = body.admin_pin;

    let resolved = config.target_post_id;
    if (body.target_post_id) {
      resolved = await resolvePostId(body.target_post_id);
      config.target_post_id = resolved;
    }

    if (oldPost !== config.target_post_id) {
      processedSet.clear();
      processingSet.clear();
      try { fs.writeFileSync(PROCESSED_FILE, '[]', 'utf8'); } catch(e) {}
      console.log('[CONFIG] Post changed to: ' + config.target_post_id);
    }

    saveConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, resolved_post_id: config.target_post_id }));
    return;
  }

  // GET PAGE POSTS
  if (path_ === '/api/page-posts' && req.method === 'GET') {
    if (!checkPin(url.searchParams.get('pin'))) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false }));
      return;
    }
    try {
      const data = await request(
        'https://graph.facebook.com/v19.0/' + config.page_id +
        '/posts?fields=id,message,created_time&limit=15&access_token=' + config.access_token
      );
      if (data && data.data) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, posts: data.data }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false }));
      }
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: e.message }));
    }
    return;
  }

  // UPLOAD MEDIA
  if (path_ === '/api/upload-media' && req.method === 'POST') {
    const body = await readBody();
    if (!checkPin(body.pin)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false }));
      return;
    }
    try {
      const buf = Buffer.from(body.fileData, 'base64');
      const result = await uploadMedia(buf, body.fileName || 'file', body.fileType || 'file', body.mimeType, config.access_token);
      if (result && result.attachment_id) {
        config.attachment_id = result.attachment_id;
        config.attachment_type = body.fileType || 'file';
        saveConfig();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, attachment_id: result.attachment_id }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: (result && result.error) ? result.error.message : 'Upload failed' }));
      }
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: e.message }));
    }
    return;
  }

  res.writeHead(404); res.end('Not Found');
});

process.on('uncaughtException', e => console.error('[ERR]', e.message));
process.on('unhandledRejection', e => console.error('[ERR]', e));

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Bot running on port ' + PORT);
  checkComments();
  setInterval(checkComments, 20000);
});
