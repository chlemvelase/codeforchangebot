const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Environment variables from Render dashboard
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
const WHAPI_TOKEN = process.env.WHAPI_TOKEN;  // Your Whapi.Cloud token

// Your Whapi.Cloud API base URL
const WHAPI_API_URL = 'https://gate.whapi.cloud';

// Helper function to send WhatsApp message via Whapi API
async function sendWhatsAppMessage(to, message) {
  try {
    const res = await axios.post(
      `${WHAPI_API_URL}/messages/text`,
      {
        to,
        text: message
      },
      {
        headers: {
          Authorization: `Bearer ${WHAPI_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Message sent:', res.data);
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error.message);
  }
}

// Helper function to get AI response from Together.ai
async function getAIResponse(prompt) {
  try {
    const res = await axios.post(
      'https://api.together.ai/api/generate',
      {
        model: 'gpt-4o-mini',
        prompt,
        max_tokens: 150
      },
      {
        headers: {
          'x-api-key': TOGETHER_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    if (res.data && res.data.choices && res.data.choices[0]) {
      return res.data.choices[0].text.trim();
    }
    return "Sorry, I couldn't generate a response.";
  } catch (error) {
    console.error('Error from Together.ai:', error.response?.data || error.message);
    return "Sorry, something went wrong with AI service.";
  }
}

// Webhook endpoint for WhatsApp messages
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    // Extract messages array, and handle first message if present
    if (!body.messages || !body.messages.length) {
      return res.status(200).send('No messages to process');
    }

    const message = body.messages[0];
    const from = message.from; // phone number, e.g., '2687xxxxxxx'
    const text = message.text?.body || '';

    console.log(`Received message from ${from}: ${text}`);

    // Get AI response from Together.ai
    const aiReply = await getAIResponse(text);

    // Send AI reply back on WhatsApp
    await sendWhatsAppMessage(from, aiReply);

    res.status(200).send('Message processed');
  } catch (error) {
    console.error('Error in webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/', (req, res) => {
  res.send('Code for Change WhatsApp AI Bot is running.');
});

app.listen(PORT, () => {
  console.log(`🚀 Code for Change bot running on port ${PORT}`);
});
