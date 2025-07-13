const express = require('express');
const axios = require('axios');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const app = express();
app.use(express.json());

// API Configs
const TOGETHER_API_URL = 'https://api.together.xyz/v1/chat/completions';
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY; // Set in Render
const WHAPI_URL = 'https://gate.whapi.cloud/messages'; // Whapi endpoint
const WHAPI_KEY = process.env.WHAPI_KEY; // Set in Render

// Rate limiter: 5 requests/minute (to stay under Together AI's 6)
const rateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60,
});

// Send WhatsApp message via Whapi.cloud
async function sendWhatsAppMessage(chatId, text) {
  try {
    await axios.post(WHAPI_URL, {
      to: chatId,
      body: text,
    }, {
      headers: {
        'Authorization': `Bearer ${WHAPI_KEY}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('WhatsApp API Error:', error.response?.data || error.message);
  }
}

// Webhook for incoming messages
app.post('/webhook', async (req, res) => {
  try {
    const messages = req.body.messages;
    if (!messages || messages.length === 0) {
      return res.status(400).send('No messages found');
    }

    const incomingMsg = messages[0];
    const userText = incomingMsg.text?.body;
    const chatId = incomingMsg.from; // Whapi uses 'from' instead of 'chat_id'

    console.log(`Received from ${chatId}: ${userText}`);

    // Check rate limit
    try {
      await rateLimiter.consume(chatId); // Deduct 1 request
    } catch (rateLimitErr) {
      await sendWhatsAppMessage(chatId, "⚠️ Too many requests. Please wait...");
      return res.status(429).send('Rate limited');
    }

    // Call Together AI
    const togetherResponse = await axios.post(
      TOGETHER_API_URL,
      {
        model: "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
        messages: [{ role: "user", content: userText }],
      },
      {
        headers: {
          'Authorization': `Bearer ${TOGETHER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const aiReply = togetherResponse.data?.choices?.[0]?.message?.content || "Sorry, I couldn’t generate a response.";

    // Send reply via Whapi
    await sendWhatsAppMessage(chatId, aiReply);
    res.status(200).send('OK');

  } catch (error) {
    console.error('Webhook error:', error.response?.data || error.message);
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
