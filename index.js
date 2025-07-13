const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TOGETHER_API_URL = 'https://api.together.ai/v0/chat/completions';
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY; // Set this in Render environment variables

const WHATSAPP_POST_URL = 'https://api.whatsapp.com/v1/messages'; // Replace with your actual WhatsApp API endpoint if different
const WHATSAPP_CHANNEL_ID = 'AQUAMN-KGY95'; // Your channel id

// Handle incoming webhook POST from WhatsApp
app.post('/webhook', async (req, res) => {
  try {
    const messages = req.body.messages;
    if (!messages || messages.length === 0) {
      return res.status(400).send('No messages found');
    }

    const incomingMessage = messages[0];
    const userText = incomingMessage.text.body;
    const chatId = incomingMessage.chat_id;

    console.log(`Message from ${chatId}: ${userText}`);

    // Prepare payload for Together AI
    const togetherPayload = {
      model: "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
      messages: [
        {
          role: "user",
          content: userText
        }
      ]
    };

    // Call Together AI API
    const togetherResponse = await axios.post(TOGETHER_API_URL, togetherPayload, {
      headers: {
        'Authorization': `Bearer ${TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const aiReply = togetherResponse.data.choices[0].message.content;

    // Prepare WhatsApp reply payload
    const whatsappPayload = {
      messages: [
        {
          id: `response_${Date.now()}`,
          from_me: true,
          type: "text",
          chat_id: chatId,
          timestamp: Math.floor(Date.now() / 1000),
          text: { body: aiReply }
        }
      ],
      channel_id: WHATSAPP_CHANNEL_ID
    };

    // Send reply message to WhatsApp API
    await axios.post(WHATSAPP_POST_URL, whatsappPayload);

    res.status(200).send('Message processed');

  } catch (error) {
    console.error('Error in webhook:', error.response ? error.response.data : error.message);
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
