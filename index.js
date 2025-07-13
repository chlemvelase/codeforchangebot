const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const CHANNEL_ID = process.env.CHANNEL_ID || 'AQUAMN-KGY95';
const WHAPI_API_KEY = process.env.WHAPI_API_KEY; // Your WhatsApp API key
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY; // Your Together AI API key

// Together AI API details
const TOGETHER_API_URL = 'https://api.together.ai/v1/chat/completions';

app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;
    console.log('Received webhook:', JSON.stringify(data, null, 2));

    const messages = data.messages || [];
    if (messages.length === 0) return res.sendStatus(200);

    const message = messages[0];
    const incomingText = message.text?.body || '';
    const chatId = message.chat_id;

    console.log(`Message from ${chatId}: ${incomingText}`);

    // Call Together AI API to get reply
    const togetherResponse = await axios.post(
      TOGETHER_API_URL,
      {
        model: "gpt-4o-mini", // or your chosen model
        messages: [{ role: "user", content: incomingText }],
      },
      {
        headers: {
          Authorization: `Bearer ${TOGETHER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const aiReply = togetherResponse.data.choices[0].message.content;
    console.log('Together AI reply:', aiReply);

    // Prepare WhatsApp reply payload
    const payload = {
      messages: [
        {
          type: 'text',
          chat_id: chatId,
          text: { body: aiReply },
        },
      ],
      channel_id: CHANNEL_ID,
    };

    // Send reply message via WhatsApp API
    await axios.post('https://api.whapi.cloud/1mt2xet1/messages', payload, {
      headers: { Authorization: `Bearer ${WHAPI_API_KEY}` },
    });

    res.sendStatus(200);
  } catch (error) {
    console.error('Error in webhook:', error.response?.data || error.message);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`Bot running on port ${PORT}`);
});
