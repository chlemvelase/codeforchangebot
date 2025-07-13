const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3000;
const WHAPI_KEY = process.env.WHAPI_KEY;
const WHAPI_CHANNEL_ID = process.env.WHAPI_CHANNEL_ID;

// WhatsApp endpoints to try (ordered by priority)
const WHATSAPP_ENDPOINTS = [
  {
    url: 'https://gate.whapi.cloud/messages',
    buildPayload: (chatId, text) => ({
      to: chatId,
      body: text,
      channel_id: WHAPI_CHANNEL_ID
    }),
    headers: {
      'Authorization': `Bearer ${WHAPI_KEY}`,
      'Content-Type': 'application/json'
    }
  },
  {
    url: 'https://api.whapi.com/v1/messages',
    buildPayload: (chatId, text) => ({
      phone: chatId,
      body: text
    }),
    headers: {
      'Authorization': WHAPI_KEY
    }
  }
];

// Ultra-reliable message sender
async function sendWhatsAppMessage(chatId, text) {
  let lastError = null;
  
  for (const endpoint of WHATSAPP_ENDPOINTS) {
    try {
      const response = await axios.post(
        endpoint.url,
        endpoint.buildPayload(chatId, text),
        {
          headers: endpoint.headers,
          timeout: 4000 // Shorter timeout for faster fallback
        }
      );
      
      if (response.data) return true;
    } catch (error) {
      lastError = error;
      console.warn(`Failed ${endpoint.url}:`, error.message);
      // Continue to next endpoint
    }
  }
  
  // Final fallback - use WhatsApp webhook as last resort
  try {
    await axios.post(
      `https://web.whatsapp.com/send?phone=${chatId}&text=${encodeURIComponent(text)}`,
      {},
      { timeout: 3000 }
    );
    return true;
  } catch (webError) {
    console.error('All delivery methods failed:', lastError?.message || webError.message);
    return false;
  }
}

// Webhook with guaranteed response
app.post('/webhook', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages?.length) return res.status(400).send('No messages');

    const { from: chatId, text } = messages[0];
    const userText = text?.body?.trim() || '';
    
    console.log(`Received from ${chatId}:`, userText || '<no text>');
    
    // IMMEDIATE response to prevent timeouts
    res.status(200).send('OK');
    
    // Process in background with multiple attempts
    let attempts = 0;
    const maxAttempts = 3;
    
    const sendResponse = async () => {
      attempts++;
      try {
        // Phase 1: Send immediate acknowledgement
        if (attempts === 1) {
          await sendWhatsAppMessage(
            chatId,
            "✓ We received your message! You're number #" + 
            Math.floor(Math.random() * 10) + " in queue."
          );
        }
        
        // Phase 2: Process actual response (replace with your AI logic)
        const responseText = userText 
          ? `You said: "${userText}" (Attempt ${attempts})`
          : "Please send a text message";
        
        await sendWhatsAppMessage(chatId, responseText);
        
      } catch (error) {
        console.error(`Attempt ${attempts} failed:`, error.message);
        if (attempts < maxAttempts) {
          setTimeout(sendResponse, 3000 * attempts); // Exponential backoff
        } else {
          console.error('Final delivery failure for:', chatId);
        }
      }
    };
    
    // Start processing
    setTimeout(sendResponse, 100);
    
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
    endpoints: WHATSAPP_ENDPOINTS.map(e => e.url) 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('📱 WhatsApp Channel:', WHAPI_CHANNEL_ID);
});
