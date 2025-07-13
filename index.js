const express = require('express');
const axios = require('axios');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const app = express();
app.use(express.json());

// Configuration - set these in Render.com environment variables
const PORT = process.env.PORT || 3000;
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
const WHAPI_KEY = process.env.WHAPI_KEY;
const WHAPI_CHANNEL_ID = process.env.WHAPI_CHANNEL_ID || 'AQUAMN-KGY95'; // Your channel ID

// API endpoints
const TOGETHER_API_URL = 'https://api.together.xyz/v1/chat/completions';
const WHAPI_URL = 'https://gate.whapi.cloud/messages';

// Rate limiter: 5 requests per minute per user
const rateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60,
  blockDuration: 120
});

// Simple response cache
const responseCache = new Map();
const CACHE_TTL = 300000; // 5 minutes

// Send WhatsApp message with retries
async function sendWhatsAppMessage(chatId, text, retries = 2) {
  try {
    const response = await axios.post(WHAPI_URL, {
      to: chatId,
      body: text,
      channel_id: WHAPI_CHANNEL_ID
    }, {
      headers: {
        'Authorization': `Bearer ${WHAPI_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    return response.data;
  } catch (error) {
    console.error('WhatsApp Error:', error.response?.data || error.message);
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return sendWhatsAppMessage(chatId, text, retries - 1);
    }
    throw error;
  }
}

// Generate AI response
async function getAIResponse(prompt) {
  try {
    const response = await axios.post(TOGETHER_API_URL, {
      model: "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500
    }, {
      headers: {
        'Authorization': `Bearer ${TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    return response.data?.choices?.[0]?.message?.content || "I couldn't generate a response.";
  } catch (error) {
    console.error('AI Error:', error.response?.data || error.message);
    return error.response?.data?.error?.type === 'model_rate_limit' 
      ? "⚠️ Too many requests. Please wait a minute." 
      : "⚠️ Service unavailable. Please try again later.";
  }
}

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    const message = req.body.messages?.[0];
    if (!message) return res.status(400).send('Invalid message format');

    const chatId = message.from;
    const userText = message.text?.body?.trim();
    if (!userText) return res.status(400).send('Empty message');

    console.log(`Received from ${chatId}: ${userText}`);

    // Check rate limit
    try {
      await rateLimiter.consume(chatId);
    } catch {
      await sendWhatsAppMessage(chatId, "⏳ Please wait before sending more messages.");
      return res.status(429).send('Rate limited');
    }

    // Check cache
    const cached = responseCache.get(userText);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      await sendWhatsAppMessage(chatId, cached.response);
      return res.send('OK (cached)');
    }

    // Get and send response
    const aiResponse = await getAIResponse(userText);
    await sendWhatsAppMessage(chatId, aiResponse);
    
    // Cache response
    responseCache.set(userText, {
      response: aiResponse,
      timestamp: Date.now()
    });

    res.send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal error');
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    time: new Date().toISOString(),
    cacheSize: responseCache.size
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Using WhatsApp channel: ${WHAPI_CHANNEL_ID}`);
});
