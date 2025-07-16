const express = require('express');
const fetch = require('node-fetch'); // Use node-fetch@2
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Replace with your bot's own WhatsApp number (no @s.whatsapp.net)
const BOT_NUMBER = '26879333878';

app.use(express.json());

app.post('/webhook', async (req, res) => {
  const message = req.body?.messages?.[0];
  const phone = message?.from;
  const userText = message?.text?.body?.trim();
  const userName = message?.from_name || 'there';

  console.log(`📩 Incoming from ${userName} (${phone}): ${userText}`);

  // 🛑 Ignore messages from the bot itself
  if (message?.from_me || phone === BOT_NUMBER) {
    console.log('⚠️ Ignored: Message sent by bot itself');
    return res.sendStatus(200);
  }

  if (phone && userText) {
    try {
      // 🌍 Simple greeting detection
      const greetingMap = {
        siswati: ['sawubona', 'unjani', 'kusile', 'kutfutfukile'],
        portuguese: ['ola', 'oi', 'bom dia', 'boa tarde', 'boa noite'],
        french: ['bonjour', 'salut', 'bonsoir']
      };

      const normalized = userText.toLowerCase();

      const isGreeting = Object.values(greetingMap).some(list =>
        list.some(word => normalized.includes(word))
      );

      const greetingReply = () =>
        `Sawubona ${userName}! 😊 Thanks for reaching out to Code for Change. How can we assist you today?`;

      // 🧠 AI System prompt
      const systemPrompt = {
        role: 'system',
        content: `
You are an intelligent, friendly assistant and part of the Code for Change team in Eswatini.

✅ Always use "we", "us", or "our" — you represent the team.
✅ Use information from https://codeforchangesz.github.io/ to answer about:
  - Our mission, digital services, hosting, websites, branding
  - Support for NGOs, individuals, and SMEs
✅ Explain offerings briefly:
  - Web Hosting: START (E1499), PRO (E2499), PREMIUM (E3999)
  - Portfolios for freelancers from E1399/year
  - Google Maps, emails, domains, content updates, branding

💬 Be short (1–2 paragraphs max), warm, and professional.

Do NOT reply in French/Portuguese/SiSwati (except for greetings). Always respond in English.
        `
      };

      // 🧠 Construct AI conversation
      const messages = isGreeting
        ? [systemPrompt, { role: 'user', content: greetingReply() }]
        : [systemPrompt, { role: 'user', content: `User: ${userText}` }];

      // 🤖 Call Together AI (meta-llama)
      const aiRes = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`
        },
        body: JSON.stringify({
          model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
          messages,
          temperature: 0.7,
          max_tokens: 200
        })
      });

      const aiData = await aiRes.json();
      const aiReply =
        aiData?.choices?.[0]?.message?.content?.trim() ||
        'Sorry, we couldn’t process that. Please try again or contact us directly.';

      console.log('🤖 AI Reply:', aiReply);

      // 📤 Send WhatsApp message via Whapi
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

      const whatsappData = await whatsappRes.json();
      console.log('📤 Message sent:', whatsappData);
    } catch (err) {
      console.error('❌ Error:', err);
    }
  }

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`✅ Code for Change AI Bot is running on port ${PORT}`);
});
