const http = require('http');
const https = require('https');

// Configuration
const PAGE_ID = process.env.PAGE_ID || "1424795157375101";
const TARGET_POST_ID = process.env.TARGET_POST_ID || "1424795157375101_122093934621520437";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "EAAuuUwQY1zIBSzNNc26whvNxX61CvFdkhhKqbH0Fei8kUZAoFxusKEW0akCUS3iJqypk5YhlZByirvRI6ADKMnAK7D6QOwehHAFXsAHDWtpE4dwpv2YqEf6QZC13CYZCFyMiuTlZBnasbbrUItZBVzD6GcZAUK6buZAwZC0RBkBnKabePcTyXDPXf5piKZCzBYZAKFqETSv57YQIXZCtZCJ2Al5qxGDl4";
const ATTACHMENT_ID = process.env.ATTACHMENT_ID || "1145582601544384";
const PRIVATE_MESSAGE = process.env.REPLY_MESSAGE || "مرحباً بك! شكراً لتفاعلك معنا على الصفحة، تفضل ملف الـ PDF";

// Random Public Comment Replies List
const PUBLIC_COMMENT_REPLIES = [
  "أهلاً بك! تفقد صندوق الرسائل لديك، تم إرسال الملف لك بنجاح 📩",
  "مرحباً بك أخي الكريم! لقد أرسلت لك ملف الـ PDF في الخاص، بالتوفيق لك ✨",
  "تم الرد وإرسال الملف إلى بريدك في الخاص، شكراً لتفاعلك معنا 📄",
  "شكراً لاهتمامك وتفاعلك! تم إرسال ملف الـ PDF المطلوب في رسائل صفحتك 📥",
  "أهلاً وسهلاً بك! راجع رسائلك على ماسنجر، الملف جاهز لديك الآن 👍",
  "تم إرسال الملف المطلوب في الخاص، نتمنى لك الاستفادة الكاملة منه 🚀",
  "مرحباً! تفضل بمراجعة رسائلك في ماسنجر، أرسلنا لك ملف الـ PDF المطلوب 🌟"
];

// Tracking sets to prevent duplicate actions
const repliedSet = new Set();
const processingSet = new Set();

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

// Helper: Sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Random number between min and max (inclusive)
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 1. Like a comment
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

// 2. Publicly reply to a comment with a random varied message
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

// 3. Send Private Message & PDF after randomized delay (15s to 150s)
async function sendPrivateMessageWithDelay(recipientId, recipientName, uniqueKey) {
  // Random delay between 15 seconds (15,000 ms) and 150 seconds (2.5 minutes = 150,000 ms)
  const delayMs = getRandomInt(15000, 150000);
  const delaySec = Math.round(delayMs / 1000);
  console.log(`[DELAY] Waiting ${delaySec} seconds before sending private Messenger message to ${recipientName}...`);

  await sleep(delayMs);

  console.log(`[${new Date().toISOString()}] Sending private message to ${recipientName} (${recipientId})...`);

  try {
    // A. Send Text message
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
      console.log(`[OK] Private text message delivered to ${recipientName}`);
      repliedSet.add(uniqueKey);

      // B. Send PDF Attachment
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
          console.log(`[OK] PDF attachment delivered to ${recipientName}`);
        }
      }
    } else {
      console.warn(`[WARN] Facebook response:`, textRes);
    }
  } catch (err) {
    console.error(`[ERROR] Failed to send private message to ${recipientName}:`, err.message);
  } finally {
    processingSet.delete(uniqueKey);
  }
}

// Core processing for a new comment
async function processNewComment(comment) {
  const cId = comment.id;
  const senderId = comment.from ? comment.from.id : null;
  const senderName = comment.from ? comment.from.name : 'User';

  if (!senderId || repliedSet.has(cId) || processingSet.has(cId)) return;
  processingSet.add(cId);

  console.log(`\n==================================================`);
  console.log(`[NEW COMMENT DETECTED] From: ${senderName} | Text: "${comment.message}"`);

  // Step 1: Like the comment
  await likeComment(cId);

  // Step 2: Random public reply on the comment
  await replyPublicComment(cId, senderName);

  // Step 3: Send private message & PDF after randomized delay (15s to 2.5m)
  sendPrivateMessageWithDelay(senderId, senderName, cId);
}

// Core loop: Check comments and conversations
async function checkAndRespond() {
  try {
    // 1. Check comments on target post
    if (TARGET_POST_ID) {
      const commentsUrl = `https://graph.facebook.com/v19.0/${TARGET_POST_ID}/comments?limit=50&access_token=${ACCESS_TOKEN}`;
      const commentsData = await makeRequest(commentsUrl);
      
      if (commentsData && commentsData.data) {
        for (const comment of commentsData.data) {
          await processNewComment(comment);
        }
      }
    }

    // 2. Check active Messenger conversations
    const convUrl = `https://graph.facebook.com/v19.0/${PAGE_ID}/conversations?fields=id,updated_time,participants,messages.limit(1){message,created_time,from}&access_token=${ACCESS_TOKEN}`;
    const convData = await makeRequest(convUrl);

    if (convData && convData.data) {
      for (const conv of convData.data) {
        const lastMsg = conv.messages && conv.messages.data ? conv.messages.data[0] : null;
        if (lastMsg && lastMsg.from && lastMsg.from.id !== PAGE_ID) {
          const senderId = lastMsg.from.id;
          const senderName = lastMsg.from.name;
          const msgId = lastMsg.id;

          if (!repliedSet.has(msgId) && !processingSet.has(msgId)) {
            processingSet.add(msgId);
            sendPrivateMessageWithDelay(senderId, senderName, msgId);
          }
        }
      }
    }
  } catch (err) {
    console.error(`[CRON ERROR]`, err.message);
  }
}

// Simple HTTP server for Render Health Check
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Facebook Smart Auto Responder is running 24/7 on Render!\n');
});

// Prevent process from crashing on unexpected network errors
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running and listening on 0.0.0.0:${PORT}`);
  // Run immediately on startup
  checkAndRespond();
  // Run every 30 seconds continuously
  setInterval(checkAndRespond, 30 * 1000);
});
