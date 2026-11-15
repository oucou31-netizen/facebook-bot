const http = require('http');
const https = require('https');

// ==========================================
// 1. إعدادات الصفحة والمنشور والتوكن الدائم
// ==========================================
const PAGE_ID = process.env.PAGE_ID || "1424795157375101";
const TARGET_POST_ID = process.env.TARGET_POST_ID || "1424795157375101_122093934621520437";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "EAAuuUwQY1zIBSzNNc26whvNxX61CvFdkhhKqbH0Fei8kUZAoFxusKEW0akCUS3iJqypk5YhlZByirvRI6ADKMnAK7D6QOwehHAFXsAHDWtpE4dwpv2YqEf6QZC13CYZCFyMiuTlZBnasbbrUItZBVzD6GcZAUK6buZAwZC0RBkBnKabePcTyXDPXf5piKZCzBYZAKFqETSv57YQIXZCtZCJ2Al5qxGDl4";
const ATTACHMENT_ID = process.env.ATTACHMENT_ID || "1145582601544384";
const PRIVATE_MESSAGE = process.env.REPLY_MESSAGE || "مرحباً بك! شكراً لتفاعلك معنا على الصفحة، تفضل ملف الـ PDF";

// قائمة الردود العامة العشوائية المتنوعة
const PUBLIC_COMMENT_REPLIES = [
  "أهلاً بك! تفقد صندوق الرسائل لديك، تم إرسال الملف لك بنجاح 📩",
  "مرحباً بك أخي الكريم! لقد أرسلت لك ملف الـ PDF في الخاص، بالتوفيق لك ✨",
  "تم الرد وإرسال الملف إلى بريدك في الخاص، شكراً لتفاعلك معنا 📄",
  "شكراً لاهتمامك وتفاعلك! تم إرسال ملف الـ PDF المطلوب في رسائل صفحتك 📥",
  "أهلاً وسهلاً بك! راجع رسائلك على ماسنجر، الملف جاهز لديك الآن 👍",
  "تم إرسال الملف المطلوب في الخاص، نتمنى لك الاستفادة الكاملة منه 🚀",
  "مرحباً! تفضل بمراجعة رسائلك في ماسنجر، أرسلنا لك ملف الـ PDF المطلوب 🌟"
];

// سجلات تتبع معرّفات التعليقات لمنع التكرار على نفس التعليق
const processedComments = new Set();
const processingComments = new Set();

// دالة مساعدة لطلبات HTTP
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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 1. الإعجاب بالتعليق
async function likeComment(commentId) {
  try {
    const url = `https://graph.facebook.com/v19.0/${commentId}/likes?access_token=${ACCESS_TOKEN}`;
    const res = await makeRequest(url, { method: 'POST' });
    if (res && (res.success || res.id)) {
      console.log(`[OK] Liked comment ${commentId}`);
    } else {
      console.log(`[LIKE INFO] Comment like status:`, res.error ? res.error.message : res);
    }
  } catch (err) {
    console.warn(`[WARN] Could not like comment ${commentId}:`, err.message);
  }
}

// 2. الرد بتعليق عام عشوائي
async function replyPublicComment(commentId, recipientName) {
  try {
    const randomReply = PUBLIC_COMMENT_REPLIES[Math.floor(Math.random() * PUBLIC_COMMENT_REPLIES.length)];
    const url = `https://graph.facebook.com/v19.0/${commentId}/comments?access_token=${ACCESS_TOKEN}`;
    const payload = { message: randomReply };
    const res = await makeRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, payload);

    if (res && res.id) {
      console.log(`[OK] Public comment reply posted to ${recipientName}: "${randomReply}"`);
    } else {
      console.log(`[COMMENT INFO] Public reply status:`, res.error ? res.error.message : res);
    }
  } catch (err) {
    console.warn(`[WARN] Could not post public comment to ${recipientName}:`, err.message);
  }
}

// 3. إرسال الرسالة الخاصة وملف الـ PDF بعد تأخير زمني
async function sendPrivateMessageWithDelay(recipientId, recipientName, uniqueKey) {
  // وقت تأخير طبيعي (بين 10 و 25 ثانية)
  const delayMs = getRandomInt(10000, 25000);
  const delaySec = Math.round(delayMs / 1000);
  console.log(`[DELAY] Waiting ${delaySec} seconds before sending private Messenger message & PDF to ${recipientName}...`);

  await sleep(delayMs);

  console.log(`[${new Date().toISOString()}] Sending private message & PDF to ${recipientName} (${recipientId})...`);

  try {
    // أ. إرسال الرسالة النصية في الخاص
    const textPayload = {
      recipient: { id: recipientId },
      message: { text: PRIVATE_MESSAGE }
    };
    
    const textUrl = `https://graph.facebook.com/v19.0/me/messages?access_token=${ACCESS_TOKEN}`;
    const textRes = await makeRequest(textUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, textPayload);

    if (textRes && textRes.message_id) {
      console.log(`[OK] Private text message delivered to ${recipientName} (ID: ${textRes.message_id})`);
    } else {
      console.warn(`[WARN] Private message response:`, textRes);
    }

    // ب. إرسال ملف الـ PDF في الخاص
    if (ATTACHMENT_ID) {
      const filePayload = {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: 'file',
            payload: { attachment_id: ATTACHMENT_ID }
          }
        }
      };

      const fileRes = await makeRequest(textUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, filePayload);

      if (fileRes && fileRes.message_id) {
        console.log(`[OK] PDF attachment delivered to ${recipientName} (ID: ${fileRes.message_id})`);
      } else {
        console.warn(`[WARN] PDF attachment response:`, fileRes);
      }
    }
  } catch (err) {
    console.error(`[ERROR] Failed to send private message to ${recipientName}:`, err.message);
  } finally {
    processingComments.delete(uniqueKey);
    processedComments.add(uniqueKey);
  }
}

// معالجة كل تعليق رئيسي جديد بشكل مستقل
async function processNewComment(comment) {
  const cId = comment.id;
  const senderId = comment.from ? comment.from.id : null;
  const senderName = comment.from ? comment.from.name : 'User';

  // 1. تجاهل تعليقات الصفحة نفسها
  if (!senderId || senderId === PAGE_ID) {
    return;
  }

  // 2. تجاهل الردود المتداخلة والفرعية تماماً
  if (comment.parent && comment.parent.id) {
    return;
  }

  // 3. تخطي هذا التعليق فقط إذا تم التعامل معه سابقاً
  if (processedComments.has(cId) || processingComments.has(cId)) {
    return;
  }

  // قفل معرّف التعليق لمنع التكرار عليه
  processedComments.add(cId);
  processingComments.add(cId);

  console.log(`\n==================================================`);
  console.log(`[NEW COMMENT ON POST] Comment ID: ${cId} | From: ${senderName} | Text: "${comment.message}"`);

  // الخطوة 1: الإعجاب بالتعليق
  await likeComment(cId);

  // الخطوة 2: الرد العام العشوائي
  await replyPublicComment(cId, senderName);

  // الخطوة 3: إرسال الرسالة الخاصة والـ PDF بعد التأخير
  sendPrivateMessageWithDelay(senderId, senderName, cId);
}

// الحلقة الأساسية لفحص التعليقات الرئيسية فقط
async function checkAndRespond() {
  try {
    if (!TARGET_POST_ID) return;

    // جلب التعليقات الرئيسية فقط عبر filter=toplevel
    const commentsUrl = `https://graph.facebook.com/v19.0/${TARGET_POST_ID}/comments?filter=toplevel&fields=id,from,message,parent&limit=50&access_token=${ACCESS_TOKEN}`;
    const commentsData = await makeRequest(commentsUrl);
    
    if (commentsData && commentsData.data) {
      for (const comment of commentsData.data) {
        await processNewComment(comment);
      }
    }
  } catch (err) {
    console.error(`[CRON ERROR]`, err.message);
  }
}

// خادم HTTP مخصص لمنصة Render للبقاء متصلاً 24/7
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Facebook Smart Auto Responder is running 24/7 on Render (Per-Comment Dispatch)!\n');
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

// الاستماع على منفذ Render العام 0.0.0.0
const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running and listening on 0.0.0.0:${PORT}`);
  checkAndRespond();
  // تكرار الفحص التلقائي كل 20 ثانية
  setInterval(checkAndRespond, 20 * 1000);
});
