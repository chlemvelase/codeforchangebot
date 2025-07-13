const express = require('express');
const axios = require('axios');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const NodeCache = require('node-cache');

const app = express();
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3000;
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
const WHAPI_KEY = process.env.WHAPI_KEY;
const WHAPI_CHANNEL_ID = process.env.WHAPI_CHANNEL_ID;

// Free Together.ai models with fallback order
const FREE_MODELS = [
  "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",  // Primary (6 req/min)
  "togethercomputer/llama-2-7b-chat",                // Fallback 1
  "togethercomputer/RedPajama-INCITE-7B-Chat"        // Fallback 2
];

// Cache setup (5 minute TTL)
const responseCache = new NodeCache({ stdTTL: 300 });

// Rate limiter per user
const userRateLimiter = new RateLimiterMemory({
  points: 5,      // 5 requests
  duration: 60    // per minute
});

// Model-specific rate limit tracker
const modelRateLimits = new Map();

// Send WhatsApp message with retries
async function sendWhatsAppMessage(chatId, text) {
  try {
    await axios.post('https://gate.whapi.cloud/messages', {
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
  } catch (error) {
    console.error('WhatsApp Error:', error.response?.data || error.message);
    throw error;
  }
}

// Get AI response with model fallback
async function getAIResponse(prompt, attempt = 0) {
  if (attempt >= FREE_MODELS.length) {
    return "⚠️ All AI services are busy. Please try again later.";
  }

  const model = FREE_MODELS[attempt];
  try {
    // Check model-specific rate limit
    if (modelRateLimits.get(model)?.blocked) {
      throw new Error(`Model ${model} rate limited`);
    }

    const response = await axios.post(
      'https://api.together.xyz/v1/chat/completions',
      {
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400
      },
      {
        headers: { Authorization: `Bearer ${TOGETHER_API_KEY}` },
        timeout: 10000
      }
    );

    return response.data.choices[0].message.content;

  } catch (error) {
    console.error(`Attempt ${attempt + 1} failed (${model}):`, error.response?.data || error.message);
    
    // Mark model as rate limited if applicable
    if (error.response?.data?.error?.type === 'model_rate_limit') {
      modelRateLimits.set(model, { blocked: true });
      setTimeout(() => modelRateLimits.delete(model), 60000); // Unblock after 1 min
    }

    // Try next model
    return getAIResponse(prompt, attempt + 1);
  }
}

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages?.length) return res.status(400).send('No messages');

    const { from: chatId, text } = messages[0];
    const userText = text?.body?.trim();
    if (!userText) return res.status(400).send('Empty message');

    console.log(`Received from ${chatId}: ${userText}`);

    // Check user rate limit
    try {
      await userRateLimiter.consume(chatId);
    } catch {
      await sendWhatsAppMessage(chatId, "⏳ Please wait a minute before sending more messages.");
      return res.status(429).send('Rate limited');
    }

    // Check cache
    const cachedResponse = responseCache.get(userText);
    if (cachedResponse) {
      await sendWhatsAppMessage(chatId, cachedResponse);
      return res.send('OK (cached)');
    }

    // Get AI response
    const aiResponse = await getAIResponse(userText);
    await sendWhatsAppMessage(chatId, aiResponse);
    
    // Cache response
    responseCache.set(userText, aiResponse);
    res.send('OK');

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal error');
  }
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    models: FREE_MODELS.map(model => ({
      name: model,
      blocked: !!modelRateLimits.get(model)?.blocked
    })),
    cacheSize: responseCache.keys().length
  });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
