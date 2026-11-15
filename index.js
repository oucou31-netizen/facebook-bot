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
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running and listening on port ${PORT}`);
  // Run immediately on startup
  checkAndRespond();
  // Run every 30 seconds continuously
  setInterval(checkAndRespond, 30 * 1000);
});
