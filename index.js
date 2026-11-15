const http = require('http');
const https = require('https');

// Configuration
const PAGE_ID = process.env.PAGE_ID || "1424795157375101";
const TARGET_POST_ID = process.env.TARGET_POST_ID || "1424795157375101_122093934621520437";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "EAAuuUwQY1zIBSzNNc26whvNxX61CvFdkhhKqbH0Fei8kUZAoFxusKEW0akCUS3iJqypk5YhlZByirvRI6ADKMnAK7D6QOwehHAFXsAHDWtpE4dwpv2YqEf6QZC13CYZCFyMiuTlZBnasbbrUItZBVzD6GcZAUK6buZAwZC0RBkBnKabePcTyXDPXf5piKZCzBYZAKFqETSv57YQIXZCtZCJ2Al5qxGDl4";
const ATTACHMENT_ID = process.env.ATTACHMENT_ID || "1145582601544384";

// Condition and Delivery Messages
const INITIAL_PRIVATE_MESSAGE = 
`مرحباً بك! يسعدنا اهتمامك 🌟

شرط استلام ملف الـ PDF هو أن تكون من متابعي صفحة (تك أنفو - Tech info) تقديراً لدعمك لنا 👍

1️⃣ تفضل بزيارة الصفحة وتأكد من الضغط على زر "متابعة":
https://www.facebook.com/1424795157375101

2️⃣ بعد المتابعة، اكتب هنا في الرسائل كلمة "تم" وسيصلك ملف الـ PDF فوراً 📥`;

const PDF_DELIVERY_MESSAGE = "شكراً جزيلاً لدعمك ومتابعتك لصفحة تك أنفو! تفضل ملف الـ PDF المطلوب 📄✨";

// Random Public Comment Replies List
const PUBLIC_COMMENT_REPLIES = [
  "أهلاً بك! راجع رسائلك في الخاص، مطلوب تأكيد المتابعة لاستلام ملف الـ PDF فوراً 📩",
  "مرحباً! تفضل بمراجعة صندوق الرسائل لديك في الخاص للاطلاع على شروط الاستلام 📄",
  "أهلاً وسهلاً بك! تم إرسال تفاصيل المتابعة واستلام الملف إلى بريدك في الخاص 👍",
  "شكراً لاهتمامك! تفقد رسائل الخاص لديك لتأكيد المتابعة واستلام ملف الـ PDF 📥",
  "مرحباً بك! لقد أرسلنا لك خطوات استلام الملف في الخاص، بالتوفيق لك 🌟"
];

// In-flight locking sets
const processingComments = new Set();
const processedComments = new Set();
const deliveringConversations = new Set();

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

// 2. Publicly reply to a comment with a random varied message
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

// 3. Send initial private message with condition (NO PDF yet)
async function sendInitialConditionMessage(commentId, senderId) {
  const delayMs = getRandomInt(10000, 20000);
  const delaySec = Math.round(delayMs / 1000);
  console.log(`[DELAY] Waiting ${delaySec} seconds before sending condition message for comment ${commentId}...`);

  await sleep(delayMs);

  console.log(`[${new Date().toISOString()}] Sending follow-condition message for comment ${commentId}...`);

  try {
    const textPayload = {
      recipient: commentId ? { comment_id: commentId } : { id: senderId },
      message: { text: INITIAL_PRIVATE_MESSAGE }
    };
    
    const textUrl = `https://graph.facebook.com/v19.0/me/messages?access_token=${ACCESS_TOKEN}`;
    const textRes = await makeRequest(textUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, textPayload);

    if (textRes && textRes.message_id) {
      console.log(`[OK] Condition message delivered to Messenger (ID: ${textRes.message_id})`);
    } else {
      console.warn(`[WARN] Condition message response:`, textRes);
    }
  } catch (err) {
    console.error(`[ERROR] Failed to send condition message for comment ${commentId}:`, err.message);
  } finally {
    processingComments.delete(commentId);
    processedComments.add(commentId);
  }
}

// 4. Process new comments on the post
async function processNewComment(comment) {
  const cId = comment.id;
  const senderId = comment.from ? comment.from.id : null;
  const senderName = comment.from ? comment.from.name : 'متابع';

  if (senderId && senderId === PAGE_ID) return;
  if (comment.parent && comment.parent.id) return;

  // Check if our Page already replied to this comment on Facebook
  if (comment.comments && comment.comments.data && Array.isArray(comment.comments.data)) {
    const alreadyRepliedByPage = comment.comments.data.some(sub => sub.from && sub.from.id === PAGE_ID);
    if (alreadyRepliedByPage) {
      processedComments.add(cId);
      return;
    }
  }

  if (processedComments.has(cId) || processingComments.has(cId)) return;

  processingComments.add(cId);
  processedComments.add(cId);

  console.log(`\n==================================================`);
  console.log(`[NEW UNREPLIED COMMENT] ID: ${cId} | From: ${senderName} | Text: "${comment.message || ''}"`);

  await likeComment(cId);
  await replyPublicComment(cId);
  await sendInitialConditionMessage(cId, senderId);
}

// 5. Monitor Inbox: When user replies (e.g. "تم"), deliver PDF
async function checkInboxAndDeliverPdf() {
  try {
    const convUrl = `https://graph.facebook.com/v19.0/${PAGE_ID}/conversations?fields=id,updated_time,participants,messages.limit(5){id,from,message,attachments,created_time}&limit=20&access_token=${ACCESS_TOKEN}`;
    const convData = await makeRequest(convUrl);

    if (!convData || !convData.data) return;

    for (const conv of convData.data) {
      const convId = conv.id;
      if (deliveringConversations.has(convId)) continue;

      const user = conv.participants && conv.participants.data 
        ? conv.participants.data.find(p => p.id !== PAGE_ID) 
        : null;

      if (!user || !user.id) continue;

      const messages = conv.messages && conv.messages.data ? conv.messages.data : [];
      if (messages.length === 0) continue;

      // Check if PDF has ALREADY been delivered in this conversation
      const hasPdf = messages.some(m => {
        if (m.attachments && m.attachments.data) {
          return m.attachments.data.some(att => att.id === ATTACHMENT_ID || (att.name && att.name.includes('ASU4')));
        }
        return false;
      });

      if (hasPdf) continue;

      // Check if the latest message was sent by the USER (confirming they replied / followed)
      const latestMsg = messages[0];
      if (latestMsg && latestMsg.from && latestMsg.from.id !== PAGE_ID) {
        deliveringConversations.add(convId);

        console.log(`\n==================================================`);
        console.log(`[USER CONFIRMED IN MESSENGER] User: ${user.name} (${user.id}) | Message: "${latestMsg.message}"`);
        console.log(`Delivering PDF to ${user.name}...`);

        try {
          const sendUrl = `https://graph.facebook.com/v19.0/me/messages?access_token=${ACCESS_TOKEN}`;

          // A. Send confirmation & thank you message
          const textPayload = {
            recipient: { id: user.id },
            message: { text: PDF_DELIVERY_MESSAGE }
          };
          await makeRequest(sendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          }, textPayload);

          // B. Send PDF file attachment
          if (ATTACHMENT_ID) {
            const filePayload = {
              recipient: { id: user.id },
              message: {
                attachment: {
                  type: 'file',
                  payload: { attachment_id: ATTACHMENT_ID }
                }
              }
            };
            const fileRes = await makeRequest(sendUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            }, filePayload);

            if (fileRes && fileRes.message_id) {
              console.log(`[OK] PDF successfully delivered to ${user.name} (ID: ${fileRes.message_id})`);
            }
          }
        } catch (err) {
          console.error(`[ERROR] Delivering PDF to ${user.name}:`, err.message);
        } finally {
          deliveringConversations.delete(convId);
        }
      }
    }
  } catch (err) {
    console.error(`[INBOX ERROR]`, err.message);
  }
}

// Core loop
let isChecking = false;
async function checkAndRespond() {
  if (isChecking) return;
  isChecking = true;

  try {
    if (TARGET_POST_ID) {
      const commentsUrl = `https://graph.facebook.com/v19.0/${TARGET_POST_ID}/comments?filter=toplevel&fields=id,from,message,parent,comments{id,from}&limit=50&access_token=${ACCESS_TOKEN}`;
      const commentsData = await makeRequest(commentsUrl);
      
      if (commentsData && commentsData.data) {
        for (const comment of commentsData.data) {
          await processNewComment(comment);
        }
      }
    }

    await checkInboxAndDeliverPdf();

  } catch (err) {
    console.error(`[CRON ERROR]`, err.message);
  } finally {
    isChecking = false;
  }
}

// Simple HTTP server for Render Health Check
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Facebook Smart Follow-Condition Auto Responder is running 24/7 on Render!\n');
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
