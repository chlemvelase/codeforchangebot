const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_NUMBER = '26879333878@s.whatsapp.net'; // Fixed typo in '@s.whatsapp.net'
const processedMessages = new Set();

app.use(express.json());

app.post('/webhook', async (req, res) => {
  const message = req.body?.messages?.[0];
  res.sendStatus(200);

  if (!message) return;

  const messageId = message.id;
  const phone = message?.from;
  const userText = message?.text?.body?.trim();
  const userName = message?.from_name || 'there';

  // Skip duplicates and bot's own messages
  if (processedMessages.has(messageId) || message?.from_me || phone === BOT_NUMBER) {
    console.log(processedMessages.has(messageId) ? '⏭️ Skipped: Duplicate message' : '⚠️ Ignored: Message from bot');
    return;
  }
  processedMessages.add(messageId);

  // Clean up old message IDs
  if (processedMessages.size > 1000) {
    const oldestId = Array.from(processedMessages).shift();
    processedMessages.delete(oldestId);
  }

  console.log(`📩 Incoming from ${userName} (${phone}): ${userText}`);

  if (phone && userText) {
    try {
      // 🌍 Enhanced greeting detection
      const greetingMap = {
        siswati: ['sawubona', 'unjani', 'kusile', 'kutfutfukile'],
        portuguese: ['ola', 'oi', 'bom dia', 'boa tarde', 'boa noite'],
        french: ['bonjour', 'salut', 'bonsoir'],
        english: ['hi', 'hello', 'hey', 'good morning', 'good afternoon']
      };

      const normalized = userText.toLowerCase();
      const isGreeting = Object.values(greetingMap).some(list =>
        list.some(word => normalized.includes(word))
      );

      // 🧠 Optimized system prompt for better conversations
      const systemPrompt = {
        role: 'system',
        content: `
You are Code for Change's friendly WhatsApp assistant in Eswatini. Follow these rules:

1. CONVERSATION FLOW:
   - Greetings: "Hi [name]! 😊 How can we help?"
   - Website requests: Ask type first (portfolio/NGO/business)
   - Services: Explain one at a time, then ask if they want more
   - Pricing: Only share when specifically asked

2. TONE:
   - Warm and professional (use occasional emojis)
   - 1-2 short sentences max per message
   - Always use "we" and "us" (you represent the team)

3. CONTENT:
   - Never list all services/prices at once
   - Guide users step-by-step
   - Ask clarifying questions
   - Keep technical details simple

Example flows:
User: Hi
You: Hi there! 😊 How can we assist you today?

User: Need website
You: Great! What type? We do portfolios, NGO sites, and business websites.

User: NGO
You: Wonderful! NGOs are our specialty. Could you share what your organization does?

User: We help kids
You: That's amazing! 👏 We'd love to help. Our NGO packages start with a free consultation. Want to schedule one?
        `
      };

      // Construct messages - include greeting context if detected
      const messages = [
        systemPrompt,
        { role: 'user', content: isGreeting ? `Greeting: ${userText}` : userText }
      ];

      // 🤖 Call Together AI with optimized parameters
      const aiRes = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`
        },
        body: JSON.stringify({
          model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
          messages,
          temperature: 0.8, // Slightly lower for more consistent responses
          max_tokens: 120, // Slightly longer for better flow
          stop: ['\n\n'] // Prevent multi-paragraph responses
        })
      });

      const aiData = await aiRes.json();
      let aiReply = aiData?.choices?.[0]?.message?.content?.trim() || 
        'Apologies, we missed that. Could you repeat please?';

      // Clean and format the response
      aiReply = aiReply
        .replace(/\n/g, ' ') // Remove newlines
        .replace(/\s+/g, ' ') // Collapse spaces
        .substring(0, 160); // Strict length limit

      console.log('🤖 AI Reply:', aiReply);

      // 📤 Send WhatsApp reply with error handling
      const whatsappRes = await fetch('https://gate.whapi.cloud/messages/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.WHAPI_KEY}`
        },
        body: JSON.stringify({
          to: phone,
          body: aiReply,
          channelId: process.env.WHAPI_CHANNEL_ID
        })
      });

      if (!whatsappRes.ok) {
        console.error('Failed to send message:', await whatsappRes.text());
      }

    } catch (err) {
      console.error('❌ Error:', err);
      // Consider sending an error message to admin
    }
  }
});

app.listen(PORT, () => {
  console.log(`✅ Code for Change AI Bot is running on port ${PORT}`);
});
