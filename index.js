require('dotenv').config(); // Optional if using local .env
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Config
const PORT = process.env.PORT || 3000;
const WHAPI_KEY = process.env.WHAPI_KEY;
const WHAPI_CHANNEL_ID = process.env.WHAPI_CHANNEL_ID;

// Sanity check
if (!WHAPI_KEY || !WHAPI_CHANNEL_ID) {
  console.warn('⚠️ WARNING: WHAPI_KEY or WHAPI_CHANNEL_ID is missing!');
}

// WhatsApp Message Sender with verbose error logging
async function sendWhatsAppMessage(chatId, text) {
  console.log(`📤 [OUTGOING] to ${chatId}: ${text}`);

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
          Authorization: `Bearer ${WHAPI_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // increased timeout for slow responses
      }
    );

    console.log('✅ Delivery confirmed:', response.data);
    return true;

  } catch (error) {
    if (error.response) {
      console.error('❌ Response error:', {
        status: error.response.status,
        data: error.response.data
      });
    } else if (error.request) {
      console.error('❌ No response received:', error.request);
    } else {
      console.error('❌ Request setup error:', error.message);
    }
    return false;
  }
}

// Webhook with full logging
app.post('/webhook', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages?.length) {
      console.log('⚠️ Empty message received');
      return res.status(400).send('No messages');
    }

    const { from: chatId, text } = messages[0];
    const userText = text?.body?.trim() || '<no text>';

    console.log(`📥 [INCOMING] from ${chatId}: ${userText}`);

    res.status(200).send('OK'); // immediate ACK

    // Background response
    const ackText = `✓ Received: "${userText.substring(0, 15)}${userText.length > 15 ? '...' : ''}"`;
    await sendWhatsAppMessage(chatId, ackText);

  } catch (error) {
    console.error('🔥 Webhook error:', error.message);
    res.status(500).send('Internal server error');
  }
});

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    port: PORT,
    WHAPI_KEY: WHAPI_KEY ? '✅ set' : '❌ missing',
    WHAPI_CHANNEL_ID: WHAPI_CHANNEL_ID ? '✅ set' : '❌ missing'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 WhatsApp Channel: ${WHAPI_CHANNEL_ID || 'Not Set'}\n`);
});
