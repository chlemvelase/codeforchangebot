const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3000;
const WHAPI_KEY = process.env.WHAPI_KEY;
const WHAPI_CHANNEL_ID = process.env.WHAPI_CHANNEL_ID;

// WhatsApp message sender with ultra-reliable delivery
async function sendWhatsAppMessage(chatId, text) {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 3000, 5000]; // Progressive backoff
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Try direct WHAPI first
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
          timeout: 5000 // Shorter timeout
        }
      );
      
      if (response.data?.status === 'sent') {
        return true;
      }
    } catch (error) {
      console.log(`Attempt ${attempt + 1} failed:`, error.message);
      
      // Special case: If 404, no point retrying
      if (error.response?.status === 404) {
        console.error('Permanent failure - invalid endpoint');
        break;
      }
      
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
      }
    }
  }
  
  // Fallback: Try alternative WhatsApp API endpoints
  try {
    await axios.post(
      'https://api.whapi.com/v1/messages',
      { 
        phone: chatId,
        body: text 
      },
      { 
        headers: { 'Authorization': WHAPI_KEY },
        timeout: 3000 
      }
    );
    return true;
  } catch (fallbackError) {
    console.error('Fallback API also failed:', fallbackError.message);
    return false;
  }
}

// Webhook with bulletproof response handling
app.post('/webhook', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages?.length) return res.status(400).send('No messages');

    const { from: chatId, text } = messages[0];
    const userText = text?.body?.trim();
    
    console.log(`Received from ${chatId}: ${userText || '<no text>'}`);
    
    // IMMEDIATE response to prevent timeouts
    res.status(200).send('OK');
    
    // Process message in background
    setTimeout(async () => {
      try {
        // Phase 1: Send acknowledgement
        const ackSent = await sendWhatsAppMessage(
          chatId, 
          "✓ Got your message! Processing..."
        );
        
        if (!ackSent) {
          console.error("Failed to send initial acknowledgement");
        }
        
        // Phase 2: Process and send actual response
        const finalResponse = "Here's your answer!"; // Replace with AI logic
        
        await sendWhatsAppMessage(chatId, finalResponse);
        
      } catch (error) {
        console.error('Background processing failed:', error);
      }
    }, 100); // Small delay to ensure HTTP response completes
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal error');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('WHAPI Channel:', WHAPI_CHANNEL_ID);
});
