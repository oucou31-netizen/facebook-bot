const http = require('http');
const https = require('https');

// Configuration
const PAGE_ID = process.env.PAGE_ID || "1424795157375101";
const TARGET_POST_ID = process.env.TARGET_POST_ID || "1424795157375101_122093934621520437";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "EAAuuUwQY1zIBSwBnI317iCtBwma2NUErvoIbwfZCHtdLXhAJfi4ncjZC6pgSVTkHMhQiZCG8NZBF3eM13iVfJVBUfJvIsCZBxAVUFNC87tOxKGKawgBay6HreY4eToVpgZCvLmQIltZAlIKJuGENIr1QAU2LfIJja7vg5rRBCn6MPIGTPFfVpXVYxD9H2hj3ZBwxKjdPfOFqGhZBUncZCE3OaZBAUDJL9aNr3FvbglNnJfwdN2TLvw97bdU4YDA";
const ATTACHMENT_ID = process.env.ATTACHMENT_ID || "1145582601544384";
const REPLY_MESSAGE = process.env.REPLY_MESSAGE || "مرحباً بك! شكراً لتفاعلك معنا على الصفحة، تفضل ملف الـ PDF";

// In-memory set to prevent duplicate messages
const repliedSet = new Set();

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

// Function to send text message & PDF attachment
async function sendReply(recipientId, recipientName, uniqueKey) {
  if (repliedSet.has(uniqueKey)) return;

  console.log(`[${new Date().toISOString()}] Sending reply to ${recipientName} (${recipientId})...`);

  try {
    // 1. Send Text message
    const textPayload = {
      recipient: { id: recipientId },
      message: { text: REPLY_MESSAGE }
    };
    
    const textUrl = `https://graph.facebook.com/v19.0/me/messages?access_token=${ACCESS_TOKEN}`;
    const textRes = await makeRequest(textUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, textPayload);

    if (textRes.message_id) {
      console.log(`[OK] Text message delivered to ${recipientName}`);
      repliedSet.add(uniqueKey);

      // 2. Send PDF Attachment
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

        if (fileRes.message_id) {
          console.log(`[OK] PDF attachment delivered to ${recipientName}`);
        }
      }
    } else {
      console.warn(`[WARN] Facebook response:`, textRes);
    }
  } catch (err) {
    console.error(`[ERROR] Failed to send to ${recipientName}:`, err.message);
  }
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
          const cId = comment.id;
          const senderId = comment.from ? comment.from.id : null;
          const senderName = comment.from ? comment.from.name : 'User';

          if (senderId && !repliedSet.has(cId)) {
            await sendReply(senderId, senderName, cId);
          }
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

          if (!repliedSet.has(msgId)) {
            await sendReply(senderId, senderName, msgId);
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
  res.end('Facebook Auto Responder is running 24/7 on Render!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running and listening on port ${PORT}`);
  // Run immediately on startup
  checkAndRespond();
  // Run every 45 seconds continuously
  setInterval(checkAndRespond, 45 * 1000);
});
