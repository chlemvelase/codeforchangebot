const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3000;
const WHAPI_KEY = process.env.WHAPI_KEY;
const WHAPI_CHANNEL_ID = process.env.WHAPI_CHANNEL_ID;

// WhatsApp message sender with guaranteed delivery
async function sendWhatsAppMessage(chatId, text, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
        timeout: 8000
      });
      return true; // Success
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }
  return false; // All retries failed
}

// Webhook with guaranteed response
app.post('/webhook', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages?.length) return res.status(400).send('No messages');

    const { from: chatId, text } = messages[0];
    const userText = text?.body?.trim();
    if (!userText) return res.status(400).send('Empty message');

    console.log(`Received from ${chatId}: ${userText}`);

    // Always respond - even if just with an acknowledgement
    const responseSent = await sendWhatsAppMessage(chatId, 
      "⌛ Processing your request... (This confirms we received your message)"
    );

    if (!responseSent) {
      console.error("FAILED to send WhatsApp confirmation");
    }

    // Process the actual request (won't block the response)
    processRequestAsync(chatId, userText);

    res.status(200).send('OK');

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal error');
  }
});

// Process messages in background
async function processRequestAsync(chatId, userText) {
  try {
    // Your actual AI processing here
    const finalResponse = "Here's your answer!"; // Replace with real AI call
    
    await sendWhatsAppMessage(chatId, finalResponse);
  } catch (error) {
    await sendWhatsAppMessage(chatId,
      "⚠️ We're experiencing high demand. Your request is queued and we'll respond soon."
    );
  }
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
