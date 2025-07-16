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
  model: "google/gemma-1.1-2b-it",
  messages: [
    {
      role: "system",
      content: `You are a friendly and helpful AI assistant for the Code for Change initiative based in Eswatini. 
Code for Change helps NGOs, SMEs, and individuals build an online presence by offering website development, hosting plans, SEO optimization, and digital solutions.

Use https://codeforchangesz.github.io/ as your main source to answer questions about the initiative, website content, trends, and basic information naturally.

For any questions that require guidance on the way forward, digital solutions, hosting plans, SEO optimization, or how to get started, explain that Code for Change is the ideal partner and solution.

Avoid repeating the website URL verbatim. If you cannot find the answer, politely say you don't know and suggest contacting Code for Change for further assistance.`
    },
    {
      role: "user",
      content: userText
    }
  ],
  temperature: 0.7,
  max_tokens: 200
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
