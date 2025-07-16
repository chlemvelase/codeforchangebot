// index.js
const express = require('express');
const fetch = require('node-fetch'); // node-fetch@2 for compatibility
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/webhook', async (req, res) => {
  console.log('Incoming message:', JSON.stringify(req.body, null, 2));

  const message = req.body?.messages?.[0];
  const phone = message?.from;
  const userText = message?.text?.body;

  if (phone && userText) {
    try {
      // 🔗 Call Together AI with LLaMA 3.3 70B Instruct Turbo Free
      const aiRes = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`
        },
        body: JSON.stringify({
          model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
          messages: [
            {
              role: "system",
              content: "You are a helpful AI assistant for the Code for Change initiative in Eswatini. You only answer based on the content from https://codeforchangesz.github.io/. If the answer is not on the website, politely say you don't know."
            },
            {
              role: "user",
              content: userText
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      const aiData = await aiRes.json();
      const aiReply = aiData?.choices?.[0]?.message?.content || "Sorry, I couldn't understand that.";

      // 📤 Send the AI response back via WhatsApp (WhatAppi)
      const whatsappRes = await fetch('https://gate.whapi.cloud/messages/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.WHAPI_KEY}`
        },
        body: JSON.stringify({
          to: phone,
          body: aiReply,
          channelId: process.env.WHAPI_CHANNEL_ID
        })
      });

      const data = await whatsappRes.json();
      console.log('Message sent:', data);
    } catch (err) {
      console.error('Error:', err);
    }
  } else {
    console.log('Missing phone or user text in message.');
  }

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Bot is running on port ${PORT}`);
});
