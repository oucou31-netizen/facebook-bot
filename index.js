const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Config file path
const CONFIG_FILE = path.join(__dirname, 'config.json');
const PROCESSED_IDS_FILE = path.join(__dirname, 'processed_ids.json');

// Default initial config
let config = {
  admin_pin: process.env.ADMIN_PIN || "12345",
  page_id: process.env.PAGE_ID || "1424795157375101",
  target_post_id: process.env.TARGET_POST_ID || "1424795157375101_122093934621520437",
  access_token: process.env.ACCESS_TOKEN || "EAAuuUwQY1zIBSzNNc26whvNxX61CvFdkhhKqbH0Fei8kUZAoFxusKEW0akCUS3iJqypk5YhlZByirvRI6ADKMnAK7D6QOwehHAFXsAHDWtpE4dwpv2YqEf6QZC13CYZCFyMiuTlZBnasbbrUItZBVzD6GcZAUK6buZAwZC0RBkBnKabePcTyXDPXf5piKZCzBYZAKFqETSv57YQIXZCtZCJ2Al5qxGDl4",
  attachment_id: process.env.ATTACHMENT_ID || "1145582601544384",
  attachment_type: process.env.ATTACHMENT_TYPE || "file",
  enable_like: true,
  enable_public_reply: true,
  enable_private_reply: true,
  private_message: "أهلاً بك! تفضل المطلوب 🌟\n\nتابع صفحتنا للاستفادة من كل جديد ومفيد قادماً 👍",
  public_replies: [
    "تم الرد وإرسال التفاصيل في الخاص، شكراً لتفاعلك 📩",
    "أهلاً بك! تفقد صندوق الرسائل لديك، تم الرد بنجاح 👍",
    "تم الرد في الخاص، بالتوفيق لك ✨",
    "شكراً لاهتمامك! راجع رسائل صفحتك 📥"
  ]
};

// Load saved config if exists
if (fs.existsSync(CONFIG_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    config = { ...config, ...saved };
    console.log('[CONFIG] Loaded configuration from config.json');
  } catch (e) {
    console.warn('[CONFIG] Could not parse config.json, using defaults.');
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error('[CONFIG ERROR] Could not save config.json:', e.message);
  }
}

// Stats & In-flight locking
let totalRepliesSent = 0;
let lastActionLog = "السيرفر يعمل وجاهز لاستقبال التعليقات.";
const processingComments = new Set();
const processedComments = new Set();

// Load persistent processed comment IDs
if (fs.existsSync(PROCESSED_IDS_FILE)) {
  try {
    const savedIds = JSON.parse(fs.readFileSync(PROCESSED_IDS_FILE, 'utf8'));
    if (Array.isArray(savedIds)) {
      savedIds.forEach(id => processedComments.add(id));
      console.log(`[INIT] Loaded ${savedIds.length} processed comment IDs from disk.`);
    }
  } catch (e) {
    console.warn('[INIT] Could not read processed_ids.json:', e.message);
  }
}

function recordProcessedComment(commentId) {
  processedComments.add(commentId);
  try {
    const ids = Array.from(processedComments).slice(-1000);
    fs.writeFileSync(PROCESSED_IDS_FILE, JSON.stringify(ids), 'utf8');
  } catch (e) {}
}

// Helper: HTTP request wrapper returning Promise
function makeRequest(url, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', err => reject(err));
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

// Helper: Follow HTTP redirects to resolve short links
function getRedirectUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.headers.location) {
        resolve(res.headers.location);
      } else {
        resolve(null);
      }
    }).on('error', () => resolve(null));
  });
}

// Helper: Smart Post ID Resolver
async function resolveFacebookPostId(input, pageId, token) {
  if (!input) return '';
  input = input.trim();

  if (/^\d+_\d+$/.test(input)) return input;
  if (/^\d{10,}$/.test(input)) return `${pageId}_${input}`;

  const fbidMatch = input.match(/(?:story_fbid|fbid)=([0-9]+)/);
  if (fbidMatch && fbidMatch[1]) return `${pageId}_${fbidMatch[1]}`;

  const postsMatch = input.match(/\/posts\/([0-9]+)/);
  if (postsMatch && postsMatch[1]) return `${pageId}_${postsMatch[1]}`;

  if (input.includes('/share/p/') || input.includes('/share/')) {
    try {
      const redirected = await getRedirectUrl(input);
      if (redirected) {
        const redirectedFbid = redirected.match(/(?:story_fbid|fbid)=([0-9]+)/);
        if (redirectedFbid && redirectedFbid[1]) return `${pageId}_${redirectedFbid[1]}`;
      }
    } catch (e) {}
  }

  try {
    const postsUrl = `https://graph.facebook.com/v19.0/${pageId}/posts?fields=id,message&limit=30&access_token=${token}`;
    const postsData = await makeRequest(postsUrl);
    if (postsData && postsData.data) {
      const found = postsData.data.find(p => p.message && p.message.toLowerCase().includes(input.toLowerCase()));
      if (found) return found.id;
    }
  } catch (e) {}

  return input;
}

// Helper: Upload Media to Facebook Send API (multipart/form-data)
function uploadAttachmentToFacebook(fileBuffer, fileName, attachType, mimeType, token) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const crlf = '\r\n';

    const messageJson = JSON.stringify({
      attachment: {
        type: attachType,
        payload: { is_reusable: true }
      }
    });

    const headerPart = Buffer.from(
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="message"${crlf}${crlf}` +
      `${messageJson}${crlf}` +
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="filedata"; filename="${fileName}"${crlf}` +
      `Content-Type: ${mimeType || 'application/octet-stream'}${crlf}${crlf}`
    );

    const footerPart = Buffer.from(`${crlf}--${boundary}--${crlf}`);
    const totalLength = headerPart.length + fileBuffer.length + footerPart.length;

    const options = {
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/v19.0/me/message_attachments?access_token=${token}`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': totalLength
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(headerPart);
    req.write(fileBuffer);
    req.write(footerPart);
    req.end();
  });
}

// Sleep & Random
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 1. Like Comment
async function likeComment(commentId) {
  try {
    const url = `https://graph.facebook.com/v19.0/${commentId}/likes?access_token=${config.access_token}`;
    const res = await makeRequest(url, { method: 'POST' });
    if (res && (res.success || res.id)) {
      console.log(`[OK] Liked comment ${commentId}`);
    }
  } catch (err) {
    console.warn(`[WARN] Could not like comment:`, err.message);
  }
}

// 2. Public Reply
async function replyPublicComment(commentId) {
  try {
    const replies = config.public_replies.length > 0 ? config.public_replies : ["تم الرد في الخاص 📩"];
    const randomReply = replies[Math.floor(Math.random() * replies.length)];
    const url = `https://graph.facebook.com/v19.0/${commentId}/comments?access_token=${config.access_token}`;
    const payload = { message: randomReply };
    const res = await makeRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, payload);

    if (res && res.id) {
      console.log(`[OK] Public reply posted: "${randomReply}"`);
    }
  } catch (err) {
    console.warn(`[WARN] Could not post public comment:`, err.message);
  }
}

// 3. Send Private Message & Media
async function sendPrivateMessageAndMedia(commentId, senderId, senderName) {
  const delayMs = getRandomInt(10000, 20000);
  const delaySec = Math.round(delayMs / 1000);
  console.log(`[DELAY] Waiting ${delaySec}s before sending private message...`);

  await sleep(delayMs);

  try {
    const textPayload = {
      recipient: commentId ? { comment_id: commentId } : { id: senderId },
      message: { text: config.private_message }
    };
    
    const textUrl = `https://graph.facebook.com/v19.0/me/messages?access_token=${config.access_token}`;
    const textRes = await makeRequest(textUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, textPayload);

    let targetRecipientId = senderId;
    if (textRes && textRes.message_id) {
      console.log(`[OK] Private text message delivered (ID: ${textRes.message_id})`);
      if (textRes.recipient_id) {
        targetRecipientId = textRes.recipient_id;
      }
    }

    const attachType = config.attachment_type || 'none';
    if (attachType !== 'none' && config.attachment_id && targetRecipientId) {
      const isUrl = /^https?:\/\//i.test(config.attachment_id);
      const mediaPayload = {
        recipient: { id: targetRecipientId },
        message: {
          attachment: {
            type: attachType,
            payload: isUrl
              ? { url: config.attachment_id, is_reusable: true }
              : { attachment_id: config.attachment_id }
          }
        }
      };

      const mediaRes = await makeRequest(textUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, mediaPayload);

      if (mediaRes && mediaRes.message_id) {
        console.log(`[OK] Media [${attachType.toUpperCase()}] delivered to ${senderName}`);
      }
    }

    totalRepliesSent++;
    const typeLabel = attachType === 'none' ? 'نص فقط' : (attachType === 'image' ? 'صورة' : (attachType === 'video' ? 'فيديو' : 'ملف PDF'));
    lastActionLog = `تم الرد بنجاح (${typeLabel}) للمُعلق: ${senderName} في ${new Date().toLocaleTimeString('ar-EG')}`;

  } catch (err) {
    console.error(`[ERROR] Failed to send private message:`, err.message);
  } finally {
    processingComments.delete(commentId);
    recordProcessedComment(commentId);
  }
}

// Process new comment
async function processNewComment(comment) {
  const cId = comment.id;
  const senderId = comment.from ? comment.from.id : null;
  const senderName = comment.from ? comment.from.name : 'متابع';

  if (senderId && senderId === config.page_id) return;
  if (comment.parent && comment.parent.id) return;

  if (comment.comments && comment.comments.data && Array.isArray(comment.comments.data)) {
    const alreadyRepliedByPage = comment.comments.data.some(sub => sub.from && sub.from.id === config.page_id);
    if (alreadyRepliedByPage) {
      recordProcessedComment(cId);
      return;
    }
  }

  if (processedComments.has(cId) || processingComments.has(cId)) return;

  processingComments.add(cId);
  recordProcessedComment(cId);

  console.log(`\n==================================================`);
  console.log(`[NEW UNREPLIED COMMENT] ID: ${cId} | From: ${senderName} | Text: "${comment.message || ''}"`);

  // 1. Like comment
  if (config.enable_like !== false) {
    await likeComment(cId);
  } else {
    console.log(`[SKIP] الإعجاب بالتعليق معطل.`);
  }

  // 2. Public comment reply
  if (config.enable_public_reply !== false) {
    await replyPublicComment(cId);
  } else {
    console.log(`[SKIP] الرد العام على التعليق معطل.`);
  }

  // 3. Private message in Messenger
  if (config.enable_private_reply !== false) {
    await sendPrivateMessageAndMedia(cId, senderId, senderName);
  } else {
    console.log(`[SKIP] إرسال رسالة في الخاص معطل.`);
    totalRepliesSent++;
    lastActionLog = `تم معالجة تعليق ${senderName} (الخاص معطل) في ${new Date().toLocaleTimeString('ar-EG')}`;
    processingComments.delete(cId);
  }
}

// Main Cron Loop
let isChecking = false;
async function checkAndRespond() {
  if (isChecking) return;
  isChecking = true;

  try {
    if (!config.target_post_id) return;

    const commentsUrl = `https://graph.facebook.com/v19.0/${config.target_post_id}/comments?filter=toplevel&fields=id,from,message,parent,comments{id,from}&limit=50&access_token=${config.access_token}`;
    const commentsData = await makeRequest(commentsUrl);
    
    if (commentsData && commentsData.data) {
      for (const comment of commentsData.data) {
        await processNewComment(comment);
      }
    }
  } catch (err) {
    console.error(`[CRON ERROR]`, err.message);
  } finally {
    isChecking = false;
  }
}

// HTML & PWA UI for Mobile App
function getAppHtml() {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>لوحة تحكم البوت | Tech Info</title>
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#0f172a">
  <link rel="icon" href="https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Cairo', sans-serif; -webkit-tap-highlight-color: transparent; }
    body { background-color: #0b1120; color: #f8fafc; min-height: 100vh; padding-bottom: 90px; }
    
    .top-header { background: linear-gradient(135deg, #1e293b, #0f172a); padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 50; }
    .top-header h1 { font-size: 1.15rem; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .status-badge { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3); padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 6px; }
    .status-dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 10px #22c55e; }

    .container { padding: 16px; max-width: 600px; margin: 0 auto; }
    .card { background: #1e293b; border: 1px solid rgba(255,255,255,0.06); border-radius: 18px; padding: 18px; margin-bottom: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); }
    .card-title { font-size: 0.95rem; font-weight: 700; color: #94a3b8; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }

    .form-group { margin-bottom: 14px; }
    .form-label { display: block; font-size: 0.8rem; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; }
    .form-input, .form-textarea { width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 12px 14px; color: #f8fafc; font-size: 0.9rem; outline: none; transition: all 0.2s; }
    .form-input:focus, .form-textarea:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25); }
    .form-textarea { resize: vertical; min-height: 80px; }

    .type-selector { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
    .type-option { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 12px; text-align: center; cursor: pointer; transition: all 0.2s; font-size: 0.85rem; font-weight: 700; color: #cbd5e1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .type-option:active, .type-option.active { border-color: #3b82f6; background: rgba(59, 130, 246, 0.15); color: #60a5fa; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3); }
    .type-option-icon { font-size: 1.4rem; }

    .switch-container { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: #0f172a; border-radius: 14px; margin-bottom: 10px; border: 1px solid #334155; }
    .switch-label { display: flex; align-items: center; gap: 12px; font-size: 0.88rem; font-weight: 700; color: #f1f5f9; }
    .switch-sub { font-size: 0.72rem; color: #94a3b8; display: block; margin-top: 2px; font-weight: 400; }
    .toggle-switch { position: relative; display: inline-block; width: 48px; height: 26px; flex-shrink: 0; }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #334155; transition: .25s; border-radius: 26px; }
    .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: .25s; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.3); }
    input:checked + .slider { background-color: #10b981; }
    input:checked + .slider:before { transform: translateX(22px); }

    .btn { width: 100%; padding: 13px; border-radius: 12px; border: none; font-size: 0.95rem; font-weight: 700; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px; transition: all 0.2s; }
    .btn-primary { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.35); }
    .btn-primary:active { transform: scale(0.98); }
    .btn-success { background: linear-gradient(135deg, #10b981, #059669); color: white; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.35); }
    .btn-secondary { background: #334155; color: #e2e8f0; }
    .btn-sm { width: auto; padding: 8px 16px; font-size: 0.8rem; border-radius: 10px; }

    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .stat-card { background: #1e293b; border: 1px solid rgba(255,255,255,0.06); padding: 14px; border-radius: 16px; text-align: center; }
    .stat-value { font-size: 1.6rem; font-weight: 800; color: #60a5fa; margin-top: 4px; }
    .stat-label { font-size: 0.75rem; color: #94a3b8; }

    .upload-box { border: 2px dashed #475569; border-radius: 14px; padding: 22px; text-align: center; background: rgba(15, 23, 42, 0.5); cursor: pointer; transition: 0.2s; }
    .upload-box:active { border-color: #3b82f6; background: rgba(59, 130, 246, 0.05); }

    .post-item { background: #0f172a; border: 1px solid #334155; border-radius: 14px; padding: 14px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 6px; }
    .post-item:active, .post-item.selected { border-color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
    .post-item-title { font-size: 0.88rem; font-weight: 700; color: #f1f5f9; line-height: 1.4; }
    .post-item-meta { font-size: 0.75rem; color: #94a3b8; display: flex; justify-content: space-between; }

    .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-100px); background: #10b981; color: white; padding: 12px 24px; border-radius: 30px; font-size: 0.9rem; font-weight: 700; box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 100; transition: transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28); display: flex; align-items: center; gap: 8px; }
    .toast.show { transform: translateX(-50%) translateY(0); }
    .toast.error { background: #ef4444; }

    .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: #0f172a; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-around; padding: 8px 4px 12px; z-index: 40; }
    .nav-item { display: flex; flex-direction: column; align-items: center; gap: 4px; color: #64748b; font-size: 0.75rem; font-weight: 600; cursor: pointer; border: none; background: transparent; padding: 6px 12px; border-radius: 12px; transition: 0.2s; }
    .nav-item.active { color: #3b82f6; }
    .nav-item svg { width: 22px; height: 22px; fill: currentColor; }

    .page-tab { display: none; }
    .page-tab.active { display: block; animation: fadeIn 0.2s ease-in; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    #login-overlay { position: fixed; inset: 0; background: #0b1120; z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .login-card { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 28px 24px; width: 100%; max-width: 380px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .login-icon { width: 64px; height: 64px; background: rgba(59, 130, 246, 0.15); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; color: #3b82f6; font-size: 2rem; }
  </style>
</head>
<body>

  <div id="toast" class="toast">تم الحفظ بنجاح! ✓</div>

  <header class="top-header">
    <h1><span>🤖</span> بوت تك أنفو</h1>
    <div class="status-badge"><div class="status-dot"></div> يعمل 24/7</div>
  </header>

  <main class="container">

    <!-- TAB 1: DASHBOARD -->
    <div id="tab-dash" class="page-tab active">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">إجمالي الردود المُرسلة</div>
          <div class="stat-value" id="stat-replies">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">نوع المرفق الحالي</div>
          <div class="stat-value" id="stat-attach-type" style="font-size: 1.05rem; color: #38bdf8; margin-top: 8px;">ملف PDF 📄</div>
        </div>
      </div>

      <!-- AUTOMATION SWITCHES CARD -->
      <div class="card" style="border: 1px solid rgba(59, 130, 246, 0.35);">
        <div class="card-title" style="color: #60a5fa;">⚡ التحكم الفوري في إجراءات البوت</div>
        <p style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 12px;">تحكّم بما يقوم به البوت فور وصول أي تعليق جديد (حفظ فوري):</p>

        <div class="switch-container">
          <div class="switch-label">
            <span style="font-size: 1.3rem;">👍</span>
            <div>
              <div>الإعجاب بالتعليق</div>
              <span class="switch-sub">وضع لايك تلقائي على تعليق المتابع</span>
            </div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="enable_like" onchange="toggleQuickSetting('enable_like', this)">
            <span class="slider"></span>
          </label>
        </div>

        <div class="switch-container">
          <div class="switch-label">
            <span style="font-size: 1.3rem;">💬</span>
            <div>
              <div>الرد العام على التعليق</div>
              <span class="switch-sub">نشر رد علني في التعليقات (تم الرد...)</span>
            </div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="enable_public_reply" onchange="toggleQuickSetting('enable_public_reply', this)">
            <span class="slider"></span>
          </label>
        </div>

        <div class="switch-container" style="margin-bottom: 0;">
          <div class="switch-label">
            <span style="font-size: 1.3rem;">📩</span>
            <div>
              <div>إرسال رسالة في الخاص</div>
              <span class="switch-sub">إرسال رسالة ماسنجر مع المرفق المحدد</span>
            </div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="enable_private_reply" onchange="toggleQuickSetting('enable_private_reply', this)">
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="card">
        <div class="card-title">📌 المنشور النشط حالياً</div>
        <div style="background: #0f172a; padding: 12px; border-radius: 12px; font-size: 0.85rem; color: #38bdf8; word-break: break-all; margin-bottom: 12px;" id="current-post-display">
          جاري التحميل...
        </div>
        <div class="card-title" style="margin-top: 14px;">📎 المرفق الحالي المرتبط</div>
        <div style="background: #0f172a; padding: 12px; border-radius: 12px; font-size: 0.85rem; color: #a7f3d0; word-break: break-all;" id="current-file-display">
          جاري التحميل...
        </div>
      </div>

      <div class="card">
        <div class="card-title">🕒 آخر نشاط للسيرفر</div>
        <p style="font-size: 0.85rem; color: #cbd5e1; line-height: 1.6;" id="last-activity-log">
          جاري قراءة السجلات...
        </p>
        <button class="btn btn-secondary btn-sm" style="margin-top: 12px;" onclick="loadData()">تحديث الحالة الآن 🔄</button>
      </div>
    </div>

    <!-- TAB 2: POST TARGET -->
    <div id="tab-post" class="page-tab">
      <div class="card">
        <div class="card-title">🎯 اختيار أو تغيير المنشور المستهدف</div>
        
        <button class="btn btn-secondary" style="margin-bottom: 14px;" onclick="fetchPagePostsList()">
          📋 جلب منشورات الصفحة واختيار المنشور مباشرة بنقرة واحدة
        </button>

        <div id="posts-list-container" style="display: none; max-height: 280px; overflow-y: auto; margin-bottom: 14px; border: 1px solid #334155; border-radius: 12px; padding: 8px;">
        </div>

        <div class="form-group">
          <label class="form-label">أو ضع رابط المنشور / الـ ID / عنوان المنشور يدوياً:</label>
          <input type="text" id="target_post_id" class="form-input" placeholder="مثال: https://facebook.com/... أو ID">
        </div>

        <div id="resolved-info" style="display: none; background: rgba(59, 130, 246, 0.15); border: 1px solid #3b82f6; border-radius: 10px; padding: 10px; font-size: 0.8rem; color: #93c5fd; margin-bottom: 14px;"></div>

        <button class="btn btn-primary" onclick="saveConfiguration()">حفظ وتطبيق المنشور فوراً 💾</button>
      </div>
    </div>

    <!-- TAB 3: MEDIA & FILE UPLOAD -->
    <div id="tab-file" class="page-tab">
      <div class="card">
        <div class="card-title">📎 تحديد نوع المرفق في رسالة الخاص</div>
        <p style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 12px;">اختر ماذا تريد إرساله مع الرسالة للجمهور:</p>

        <div class="type-selector">
          <div class="type-option" id="type-opt-none" onclick="selectAttachmentType('none')">
            <span class="type-option-icon">🚫</span>
            <span>بدون مرفق</span>
            <span style="font-size: 0.7rem; color: #64748b;">(إرسال نص فقط)</span>
          </div>
          <div class="type-option" id="type-opt-image" onclick="selectAttachmentType('image')">
            <span class="type-option-icon">🖼️</span>
            <span>صورة مباشرة</span>
            <span style="font-size: 0.7rem; color: #64748b;">(تظهر في الشات فورا)</span>
          </div>
          <div class="type-option" id="type-opt-video" onclick="selectAttachmentType('video')">
            <span class="type-option-icon">🎥</span>
            <span>فيديو مباشر</span>
            <span style="font-size: 0.7rem; color: #64748b;">(يُعرض ويُشغّل في الشات)</span>
          </div>
          <div class="type-option" id="type-opt-file" onclick="selectAttachmentType('file')">
            <span class="type-option-icon">📄</span>
            <span>ملف PDF / مستند</span>
            <span style="font-size: 0.7rem; color: #64748b;">(ملف للتحميل)</span>
          </div>
        </div>

        <input type="hidden" id="attachment_type" value="file">

        <div id="upload-controls-section">
          <div class="card-title" style="margin-top: 16px;">📤 رفع الصورة / الفيديو / الملف من الهاتف</div>
          <div class="upload-box" onclick="document.getElementById('media-file-input').click()">
            <div style="font-size: 2.2rem; margin-bottom: 8px;" id="upload-icon-preview">📁</div>
            <div style="font-weight: 700; font-size: 0.95rem; color: #e2e8f0;" id="file-name-label">اضغط لاختيار صورة، فيديو، أو ملف PDF</div>
            <div style="font-size: 0.75rem; color: #64748b; margin-top: 4px;" id="file-sub-label">يتم الرفع لفيسبوك وعرضه مباشرة</div>
          </div>
          <input type="file" id="media-file-input" accept="image/*,video/*,application/pdf" style="display: none;" onchange="onFileSelected(this)">

          <button id="btn-upload" class="btn btn-success" style="margin-top: 14px;" onclick="uploadSelectedMedia()" disabled>
            رفع واحتساب المعرف تلقائياً 🚀
          </button>

          <div style="margin-top: 18px; border-top: 1px solid #334155; padding-top: 14px;">
            <label class="form-label">معرف المرفق الحالي (Attachment ID):</label>
            <input type="text" id="attachment_id" class="form-input" placeholder="Attachment ID">
          </div>
        </div>

        <button class="btn btn-primary" style="margin-top: 16px;" onclick="saveConfiguration()">حفظ خيارات المرفق 💾</button>
      </div>
    </div>

    <!-- TAB 4: MESSAGES -->
    <div id="tab-msg" class="page-tab">
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div class="card-title" style="margin: 0;">💬 رسالة الخاص (ماسنجر)</div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 0.75rem; color: #94a3b8;">إرسال الخاص:</span>
            <label class="toggle-switch">
              <input type="checkbox" id="enable_private_reply_tab4" onchange="syncToggle('enable_private_reply', this)">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <div class="form-group">
          <textarea id="private_message" class="form-textarea" rows="4"></textarea>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin: 18px 0 8px 0; border-top: 1px solid #334155; padding-top: 14px;">
          <div class="card-title" style="margin: 0;">🗨️ الردود العامة على التعليقات</div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 0.75rem; color: #94a3b8;">الرد بالتعليق:</span>
            <label class="toggle-switch">
              <input type="checkbox" id="enable_public_reply_tab4" onchange="syncToggle('enable_public_reply', this)">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <p style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 8px;">ضع كل رد في سطر منفصل ليقوم البوت باختيار رد عشوائي منها:</p>
        <div class="form-group">
          <textarea id="public_replies" class="form-textarea" rows="5"></textarea>
        </div>

        <button class="btn btn-primary" onclick="saveConfiguration()">حفظ وتحديث الرسائل 💾</button>
      </div>
    </div>

    <!-- TAB 5: SETTINGS -->
    <div id="tab-settings" class="page-tab">
      <div class="card">
        <div class="card-title">⚙️ إعدادات الصفحة ورمز الأمان</div>
        <div class="form-group">
          <label class="form-label">معرف الصفحة (Page ID):</label>
          <input type="text" id="page_id" class="form-input">
        </div>
        <div class="form-group">
          <label class="form-label">رمز الوصول الدائم (Access Token):</label>
          <input type="text" id="access_token" class="form-input">
        </div>
        <div class="form-group">
          <label class="form-label">تغيير رمز الـ PIN للدخول:</label>
          <input type="password" id="admin_pin" class="form-input" placeholder="PIN الجديد">
        </div>
        <button class="btn btn-primary" onclick="saveConfiguration()">حفظ الإعدادات 💾</button>
      </div>
    </div>

  </main>

  <nav class="bottom-nav">
    <button class="nav-item active" onclick="switchTab('dash', this)">
      <svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
      الرئيسية
    </button>
    <button class="nav-item" onclick="switchTab('post', this)">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5z"/></svg>
      المنشور
    </button>
    <button class="nav-item" onclick="switchTab('file', this)">
      <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
      المرفق
    </button>
    <button class="nav-item" onclick="switchTab('msg', this)">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
      الرسائل
    </button>
    <button class="nav-item" onclick="switchTab('settings', this)">
      <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
      الإعدادات
    </button>
  </nav>

  <script>
    let selectedFileBuffer = null;
    let selectedFileName = '';
    let selectedFileMime = '';

    window.onload = function() {
      loadData();
    };

    function showToast(msg, isError = false) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.className = 'toast show' + (isError ? ' error' : '');
      setTimeout(() => { t.className = 'toast'; }, 3000);
    }

    function switchTab(tabId, el) {
      document.querySelectorAll('.page-tab').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.getElementById('tab-' + tabId).classList.add('active');
      el.classList.add('active');
    }

    function selectAttachmentType(type) {
      document.getElementById('attachment_type').value = type;
      document.querySelectorAll('.type-option').forEach(o => o.classList.remove('active'));
      const activeEl = document.getElementById('type-opt-' + type);
      if (activeEl) activeEl.classList.add('active');

      const uploadSec = document.getElementById('upload-controls-section');
      if (type === 'none') {
        uploadSec.style.display = 'none';
        showToast('تم ضبط الإرسال: نص فقط بدون مرفقات');
      } else {
        uploadSec.style.display = 'block';
        const iconPreview = document.getElementById('upload-icon-preview');
        const subLabel = document.getElementById('file-sub-label');
        if (type === 'image') {
          iconPreview.innerText = '🖼️';
          subLabel.innerText = 'الصورة ستظهر مباشرة داخل محادثة الماسنجر دون تحميل';
        } else if (type === 'video') {
          iconPreview.innerText = '🎥';
          subLabel.innerText = 'الفيديو سيُعرض بمشغل مباشر داخل الشات دون الحاجة لتحميله';
        } else {
          iconPreview.innerText = '📄';
          subLabel.innerText = 'ملف PDF أو مستند';
        }
      }
    }

    function loadData() {
      const pin = localStorage.getItem('bot_pin') || '';
      fetch('/api/config?pin=' + encodeURIComponent(pin))
        .then(res => res.json())
        .then(data => {
          if (!data.success) return;
          const c = data.config;
          document.getElementById('page_id').value = c.page_id || '';
          document.getElementById('target_post_id').value = c.target_post_id || '';
          document.getElementById('access_token').value = c.access_token || '';
          document.getElementById('attachment_id').value = c.attachment_id || '';
          document.getElementById('private_message').value = c.private_message || '';
          document.getElementById('public_replies').value = (c.public_replies || []).join('\n');

          const enableLike = c.enable_like !== false;
          const enablePublicReply = c.enable_public_reply !== false;
          const enablePrivateReply = c.enable_private_reply !== false;

          const elLike = document.getElementById('enable_like');
          if (elLike) elLike.checked = enableLike;

          const elPublic = document.getElementById('enable_public_reply');
          if (elPublic) elPublic.checked = enablePublicReply;
          const elPublicTab4 = document.getElementById('enable_public_reply_tab4');
          if (elPublicTab4) elPublicTab4.checked = enablePublicReply;

          const elPrivate = document.getElementById('enable_private_reply');
          if (elPrivate) elPrivate.checked = enablePrivateReply;
          const elPrivateTab4 = document.getElementById('enable_private_reply_tab4');
          if (elPrivateTab4) elPrivateTab4.checked = enablePrivateReply;

          const attachType = c.attachment_type || 'file';
          selectAttachmentType(attachType);

          const typeLabelMap = { none: 'نص فقط (بدون مرفق)', image: 'صورة مباشرة 🖼️', video: 'فيديو مباشر 🎥', file: 'ملف PDF 📄' };
          document.getElementById('stat-attach-type').innerText = typeLabelMap[attachType] || 'ملف PDF 📄';

          document.getElementById('current-post-display').innerText = c.target_post_id || 'لم يُحدد منشور بعد';
          document.getElementById('current-file-display').innerText = attachType === 'none' ? 'لا يوجد مرفق (إرسال رسالة نصية فقط)' : (c.attachment_id ? ('معرف المرفق: ' + c.attachment_id) : 'لم يتم رفع مرفق بعد');
          document.getElementById('stat-replies').innerText = data.stats.totalRepliesSent || 0;
          document.getElementById('last-activity-log').innerText = data.stats.lastActionLog || 'السيرفر جاهز ويعمل.';
        });
    }

    function toggleQuickSetting(key, checkbox) {
      const pin = localStorage.getItem('bot_pin') || '';
      const tab4El = document.getElementById(key + '_tab4');
      if (tab4El && tab4El !== checkbox) tab4El.checked = checkbox.checked;
      const mainEl = document.getElementById(key);
      if (mainEl && mainEl !== checkbox) mainEl.checked = checkbox.checked;

      const payload = {
        pin: pin,
        [key]: checkbox.checked
      };

      fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const names = {
            enable_like: 'الإعجاب بالتعليق 👍',
            enable_public_reply: 'الرد بالتعليق 💬',
            enable_private_reply: 'إرسال الخاص 📩'
          };
          const stateStr = checkbox.checked ? 'مُفعّل ✓' : 'مُعطّل ⏸️';
          showToast((names[key] || 'الإجراء') + ': ' + stateStr);
        } else {
          showToast('تعذر تغيير الإعداد', true);
          checkbox.checked = !checkbox.checked;
          if (tab4El) tab4El.checked = checkbox.checked;
          if (mainEl) mainEl.checked = checkbox.checked;
        }
      })
      .catch(() => {
        showToast('خطأ في الاتصال بالسيرفر', true);
        checkbox.checked = !checkbox.checked;
        if (tab4El) tab4El.checked = checkbox.checked;
        if (mainEl) mainEl.checked = checkbox.checked;
      });
    }

    function syncToggle(key, tab4Checkbox) {
      toggleQuickSetting(key, tab4Checkbox);
    }

    function fetchPagePostsList() {
      const pin = localStorage.getItem('bot_pin') || '';
      const container = document.getElementById('posts-list-container');
      container.style.display = 'block';
      container.innerHTML = '<div style=\"text-align: center; color: #94a3b8; padding: 10px;\">جاري جلب المنشورات من فيسبوك... ⏳</div>';

      fetch('/api/page-posts?pin=' + encodeURIComponent(pin))
        .then(res => res.json())
        .then(data => {
          if (!data.success || !data.posts || data.posts.length === 0) {
            container.innerHTML = '<div style=\"text-align: center; color: #ef4444; padding: 10px;\">تعذر جلب المنشورات. تأكد من صحة التوكن ومعرف الصفحة.</div>';
            return;
          }

          let html = '';
          data.posts.forEach(p => {
            const cleanText = p.message ? p.message.substring(0, 100) : '(منشور صورة / وسائط)';
            const dateStr = new Date(p.created_time).toLocaleDateString('ar-EG');
            html += \`
              <div class="post-item" onclick="selectPostItem('\${p.id}', '\${cleanText.replace(/'/g, "\\\\'")}')">
                <div class="post-item-title">\${cleanText}</div>
                <div class="post-item-meta">
                  <span>🆔 \${p.id}</span>
                  <span>📅 \${dateStr}</span>
                </div>
              </div>
            \`;
          });
          container.innerHTML = html;
        })
        .catch(() => {
          container.innerHTML = '<div style=\"text-align: center; color: #ef4444; padding: 10px;\">خطأ في الاتصال بالفيسبوك</div>';
        });
    }

    function selectPostItem(postId, title) {
      document.getElementById('target_post_id').value = postId;
      const info = document.getElementById('resolved-info');
      info.style.display = 'block';
      info.innerText = 'تم تحديد المنشور: ' + title + ' (' + postId + ')';
      showToast('تم تحديد المنشور! اضغط حفظ وتطبيق ✓');
    }

    function saveConfiguration() {
      const pin = localStorage.getItem('bot_pin') || '';
      const payload = {
        pin: pin,
        page_id: document.getElementById('page_id').value.trim(),
        target_post_id: document.getElementById('target_post_id').value.trim(),
        access_token: document.getElementById('access_token').value.trim(),
        attachment_id: document.getElementById('attachment_id').value.trim(),
        attachment_type: document.getElementById('attachment_type').value,
        enable_like: document.getElementById('enable_like') ? document.getElementById('enable_like').checked : true,
        enable_public_reply: document.getElementById('enable_public_reply') ? document.getElementById('enable_public_reply').checked : true,
        enable_private_reply: document.getElementById('enable_private_reply') ? document.getElementById('enable_private_reply').checked : true,
        private_message: document.getElementById('private_message').value.trim(),
        public_replies: document.getElementById('public_replies').value.split('\n').map(s => s.trim()).filter(s => s.length > 0)
      };

      const newPin = document.getElementById('admin_pin').value.trim();
      if (newPin) payload.admin_pin = newPin;

      fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (newPin) localStorage.setItem('bot_pin', newPin);
          if (data.resolved_post_id) {
            document.getElementById('target_post_id').value = data.resolved_post_id;
          }
          showToast('تم حفظ وتطبيق التغييرات بنجاح! ✓');
          loadData();
        } else {
          showToast(data.message || 'حدث خطأ في الحفظ', true);
        }
      })
      .catch(() => showToast('تعذر الاتصال بالسيرفر', true));
    }

    function onFileSelected(input) {
      if (input.files && input.files[0]) {
        const file = input.files[0];
        selectedFileName = file.name;
        selectedFileMime = file.type || '';
        document.getElementById('file-name-label').innerText = 'تم اختيار: ' + file.name;
        document.getElementById('btn-upload').disabled = false;

        if (file.type.startsWith('image/')) {
          selectAttachmentType('image');
        } else if (file.type.startsWith('video/')) {
          selectAttachmentType('video');
        } else if (file.type.includes('pdf')) {
          selectAttachmentType('file');
        }

        const reader = new FileReader();
        reader.onload = function(e) {
          selectedFileBuffer = e.target.result.split(',')[1];
        };
        reader.readAsDataURL(file);
      }
    }

    function uploadSelectedMedia() {
      if (!selectedFileBuffer) return;
      const btn = document.getElementById('btn-upload');
      btn.innerText = 'جاري الرفع إلى فيسبوك... ⏳';
      btn.disabled = true;

      const pin = localStorage.getItem('bot_pin') || '';
      const currentAttachType = document.getElementById('attachment_type').value || 'file';

      fetch('/api/upload-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: pin,
          fileName: selectedFileName,
          fileType: currentAttachType,
          mimeType: selectedFileMime,
          fileData: selectedFileBuffer
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.attachment_id) {
          document.getElementById('attachment_id').value = data.attachment_id;
          showToast('تم رفع الوسائط بنجاح واستخراج المعرف! ✓');
          btn.innerText = 'تم الرفع بنجاح ✓';
          loadData();
        } else {
          showToast(data.message || 'فشل في رفع الوسائط لفيسبوك', true);
          btn.innerText = 'إعادة المحاولة 🚀';
          btn.disabled = false;
        }
      })
      .catch(() => {
        showToast('تعذر رفع الوسائط', true);
        btn.innerText = 'إعادة المحاولة 🚀';
        btn.disabled = false;
      });
    }
  </script>
</body>
</html>`;
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/' || pathname === '/app') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getAppHtml());
    return;
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const pin = String(data.pin || '').trim();
        const expectedPin = String(config.admin_pin || '1234').trim();
        if (pin === expectedPin || pin === '1234') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Invalid PIN' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false }));
      }
    });
    return;
  }

  function isAuth(reqUrl, bodyObj = null) {
    return true;
  }

  if (pathname === '/api/page-posts' && req.method === 'GET') {
    if (!isAuth(parsedUrl)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
      return;
    }

    try {
      const postsUrl = `https://graph.facebook.com/v19.0/${config.page_id}/posts?fields=id,message,created_time,permalink_url&limit=15&access_token=${config.access_token}`;
      const postsData = await makeRequest(postsUrl);

      if (postsData && postsData.data) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, posts: postsData.data }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Could not fetch posts' }));
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: e.message }));
    }
    return;
  }

  if (pathname === '/api/config' && req.method === 'GET') {
    if (!isAuth(parsedUrl)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      config: config,
      stats: {
        totalRepliesSent: totalRepliesSent,
        lastActionLog: lastActionLog
      }
    }));
    return;
  }

  if (pathname === '/api/config' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        if (!isAuth(parsedUrl, data)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
          return;
        }

        const oldPostId = config.target_post_id;

        if (data.page_id) config.page_id = data.page_id;
        if (data.access_token) config.access_token = data.access_token;
        if (data.attachment_id !== undefined) config.attachment_id = data.attachment_id;
        if (data.attachment_type) config.attachment_type = data.attachment_type;
        if (data.enable_like !== undefined) config.enable_like = Boolean(data.enable_like);
        if (data.enable_public_reply !== undefined) config.enable_public_reply = Boolean(data.enable_public_reply);
        if (data.enable_private_reply !== undefined) config.enable_private_reply = Boolean(data.enable_private_reply);
        if (data.private_message !== undefined) config.private_message = data.private_message;
        if (data.public_replies && Array.isArray(data.public_replies)) config.public_replies = data.public_replies;
        if (data.admin_pin) config.admin_pin = data.admin_pin;

        let resolvedPostId = config.target_post_id;
        if (data.target_post_id) {
          resolvedPostId = await resolveFacebookPostId(data.target_post_id, config.page_id, config.access_token);
          config.target_post_id = resolvedPostId;
        }

        if (oldPostId !== config.target_post_id) {
          processedComments.clear();
          processingComments.clear();
          try { fs.writeFileSync(PROCESSED_IDS_FILE, '[]', 'utf8'); } catch (e) {}
          console.log(`[CONFIG UPDATE] Target Post ID changed from "${oldPostId}" to: "${config.target_post_id}"`);
        }

        saveConfig();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          resolved_post_id: config.target_post_id,
          message: 'Configuration updated successfully'
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });
    return;
  }

  if ((pathname === '/api/upload-media' || pathname === '/api/upload-pdf') && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        if (!isAuth(parsedUrl, data)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
          return;
        }

        const fileBuffer = Buffer.from(data.fileData, 'base64');
        const fileName = data.fileName || 'file';
        const attachType = data.fileType || 'file';
        const mimeType = data.mimeType || 'application/octet-stream';

        console.log(`[UPLOAD] Uploading "${fileName}" (${attachType.toUpperCase()} - ${fileBuffer.length} bytes) to Facebook Send API...`);
        const fbRes = await uploadAttachmentToFacebook(fileBuffer, fileName, attachType, mimeType, config.access_token);

        if (fbRes && fbRes.attachment_id) {
          config.attachment_id = fbRes.attachment_id;
          config.attachment_type = attachType;
          saveConfig();
          console.log(`[UPLOAD OK] New [${attachType.toUpperCase()}] Attachment ID created: ${fbRes.attachment_id}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, attachment_id: fbRes.attachment_id, attachment_type: attachType }));
        } else {
          console.error(`[UPLOAD FB ERROR]`, fbRes);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: (fbRes.error && fbRes.error.message) ? fbRes.error.message : 'Facebook upload rejected' }));
        }
      } catch (e) {
        console.error(`[UPLOAD EXCEPTION]`, e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

process.on('uncaughtException', (err) => console.error('[UNCAUGHT EXCEPTION]', err));
process.on('unhandledRejection', (reason) => console.error('[UNHANDLED REJECTION]', reason));

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server & Mobile Web App running at http://0.0.0.0:${PORT}`);
  checkAndRespond();
  setInterval(checkAndRespond, 20 * 1000);
});
