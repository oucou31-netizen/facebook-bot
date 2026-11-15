const http = require('http');
const https = require('https');

// Configuration
const PAGE_ID = process.env.PAGE_ID || "1424795157375101";
const TARGET_POST_ID = process.env.TARGET_POST_ID || "1424795157375101_122093934621520437";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "EAAuuUwQY1zIBSzNNc26whvNxX61CvFdkhhKqbH0Fei8kUZAoFxusKEW0akCUS3iJqypk5YhlZByirvRI6ADKMnAK7D6QOwehHAFXsAHDWtpE4dwpv2YqEf6QZC13CYZCFyMiuTlZBnasbbrUItZBVzD6GcZAUK6buZAwZC0RBkBnKabePcTyXDPXf5piKZCzBYZAKFqETSv57YQIXZCtZCJ2Al5qxGDl4";
const ATTACHMENT_ID = process.env.ATTACHMENT_ID || "1145582601544384";

// Short & Friendly Private Message
const PRIVATE_MESSAGE = `أهلاً بك! تفضل ملف الـ PDF المطلوب 📄

تابع صفحتنا للاستفادة من كل جديد ومفيد قادماً 🌟`;

// Short Public Comment Replies List
const PUBLIC_COMMENT_REPLIES = [
  "تم إرسال الملف في الخاص، شكراً لتفاعلك 📩",
  "أهلاً بك! تفقد صندوق الرسائل لديك، تم إرسال الملف 👍",
  "تم الرد وإرسال الملف المطلوب في الخاص، بالتوفيق ✨",
  "شكراً لاهتمامك! الملف جاهز في رسائل صفحتك 📥"
];

// In-flight locking sets to prevent duplicates
const processingComments = new Set();
const processedComments = new Set();

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
    }
  } catch (err) {
    console.warn(`[WARN] Could not like comment ${commentId}:`, err.message);
  }
}

// 2. Publicly reply to a comment with a random short message
async function replyPublicComment(commentId) {
  try {
    const randomReply = PUBLIC_COMMENT_REPLIES[Math.floor(Math.random() * PUBLIC_COMMENT_REPLIES.length)];
    const url = `https://graph.facebook.com/v19.0/${commentId}/comments?access_token=${ACCESS_TOKEN}`;
    const payload = { message: randomReply };
    const res = await makeRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, payload);

    if (res && res.id) {
      console.log(`[OK] Public comment reply posted: "${randomReply}"`);
    }
  } catch (err) {
    console.warn(`[WARN] Could not post public comment:`, err.message);
  }
}

// 3. Send Private Message & PDF directly after natural delay
async function sendPrivateMessageAndPdf(commentId, senderId) {
  const delayMs = getRandomInt(10000, 20000);
  const delaySec = Math.round(delayMs / 1000);
  console.log(`[DELAY] Waiting ${delaySec} seconds before sending private message & PDF for comment ${commentId}...`);

  await sleep(delayMs);

  console.log(`[${new Date().toISOString()}] Sending private message & PDF for comment ${commentId}...`);

  try {
    // A. Send Text message via Send API using recipient.comment_id
    const textPayload = {
      recipient: commentId ? { comment_id: commentId } : { id: senderId },
      message: { text: PRIVATE_MESSAGE }
    };
    
    const textUrl = `https://graph.facebook.com/v19.0/me/messages?access_token=${ACCESS_TOKEN}`;
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
    } else {
      console.warn(`[WARN] Private message response:`, textRes);
    }

    // B. Send PDF Attachment to the resolved recipient
    if (ATTACHMENT_ID && targetRecipientId) {
      const filePayload = {
        recipient: { id: targetRecipientId },
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
        console.log(`[OK] PDF attachment delivered (ID: ${fileRes.message_id})`);
      } else {
        console.warn(`[WARN] PDF attachment response:`, fileRes);
      }
    }
  } catch (err) {
    console.error(`[ERROR] Failed to send private message for comment ${commentId}:`, err.message);
  } finally {
    processingComments.delete(commentId);
    processedComments.add(commentId);
  }
}

// Core processing: Process each comment strictly once
async function processNewComment(comment) {
  const cId = comment.id;
  const senderId = comment.from ? comment.from.id : null;
  const senderName = comment.from ? comment.from.name : 'متابع';

  // 1. Skip comments made by the Page itself
  if (senderId && senderId === PAGE_ID) {
    return;
  }

  // 2. Skip nested replies (sub-comments / replies to comments)
  if (comment.parent && comment.parent.id) {
    return;
  }

  // 3. ROCK-SOLID CHECK ON FACEBOOK: Does this comment ALREADY have a reply from our Page?
  if (comment.comments && comment.comments.data && Array.isArray(comment.comments.data)) {
    const alreadyRepliedByPage = comment.comments.data.some(sub => sub.from && sub.from.id === PAGE_ID);
    if (alreadyRepliedByPage) {
      processedComments.add(cId);
      return;
    }
  }

  // 4. Memory lock: Skip if already processed or in-flight right now
  if (processedComments.has(cId) || processingComments.has(cId)) {
    return;
  }

  // Lock this comment immediately
  processingComments.add(cId);
  processedComments.add(cId);

  console.log(`\n==================================================`);
  console.log(`[NEW UNREPLIED COMMENT] ID: ${cId} | From: ${senderName} | Text: "${comment.message || ''}"`);

  // Step 1: Like this comment
  await likeComment(cId);

  // Step 2: Random short public reply
  await replyPublicComment(cId);

  // Step 3: Send private message & PDF directly
  await sendPrivateMessageAndPdf(cId, senderId);
}

// Core loop: Check ONLY comments on the target post
let isChecking = false;
async function checkAndRespond() {
  if (isChecking) return;
  isChecking = true;

  try {
    if (!TARGET_POST_ID) return;

    const commentsUrl = `https://graph.facebook.com/v19.0/${TARGET_POST_ID}/comments?filter=toplevel&fields=id,from,message,parent,comments{id,from}&limit=50&access_token=${ACCESS_TOKEN}`;
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

// Simple HTTP server for Render Health Check
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Facebook Auto Responder is running 24/7 on Render!\n');
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running and listening on 0.0.0.0:${PORT}`);
  checkAndRespond();
  setInterval(checkAndRespond, 20 * 1000);
});
