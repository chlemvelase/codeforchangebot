const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Config
const PORT = process.env.PORT || 3000;
const WHAPI_KEY = process.env.WHAPI_KEY;
const WHAPI_CHANNEL_ID = process.env.WHAPI_CHANNEL_ID;

// WhatsApp Message Sender (with logging)
async function sendWhatsAppMessage(chatId, text) {
  console.log(`📤 [OUTGOING] to ${chatId}: ${text}`); // Log outgoing message
  
  try {
    const response = await axios.post(
      'https://gate.whapi.cloud/messages',
      {
        to: chatId,
        body: text,
        channel_id: WHAPI_CHANNEL_ID
      },
      {
        headers: {
          'Authorization': `Bearer ${WHAPI_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }
    );
    console.log('✅ Delivery confirmed');
    return true;
  } catch (error) {
    console.log('❌ Failed to send:', error.message);
    return false;
  }
}

// Webhook with Full Logging
app.post('/webhook', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages?.length) {
      console.log('⚠️ Empty message received');
      return res.status(400).send('No messages');
    }

    const { from: chatId, text } = messages[0];
    const userText = text?.body?.trim() || '<no text>';
    
    // Log incoming message
    console.log(`📥 [INCOMING] from ${chatId}: ${userText}`); 

    // Immediate response
    res.status(200).send('OK');

    // Send acknowledgement (background)
    setTimeout(async () => {
      const ackText = `✓ Received: "${userText.substring(0, 15)}${userText.length > 15 ? '...' : ''}"`;
      await sendWhatsAppMessage(chatId, ackText);
    }, 100);

  } catch (error) {
    console.log('🔥 Webhook error:', error.message);
    res.status(500).send('Internal error');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📱 WhatsApp Channel: ${WHAPI_CHANNEL_ID}\n`);
});
