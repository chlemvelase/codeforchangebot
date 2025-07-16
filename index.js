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
  const userText = message?.text?.body?.trim();
  const userName = message?.from_name || 'there';

  if (phone && userText) {
    try {
      // Detect simple greetings in SiSwati, Portuguese, or French
      const greetingMap = {
        siswati: ['sawubona', 'unjani', 'kusile', 'kutfutfukile'],
        portuguese: ['ola', 'oi', 'bom dia', 'boa tarde', 'boa noite'],
        french: ['bonjour', 'salut', 'bonsoir']
      };

      const normalized = userText.toLowerCase();

      const isGreeting = Object.values(greetingMap).some(list =>
        list.some(word => normalized.includes(word))
      );

      const replyIfGreeting = () => `Sawubona ${userName}! 😊 Thanks for reaching out to Code for Change. How can we assist you today?`;

      // 🧠 Define system prompt
      const systemPrompt = {
        role: 'system',
        content: `
You are an intelligent, friendly AI assistant and team member of the Code for Change initiative in Eswatini.

Speak as part of our team using "we", "our", and "us" — you represent Code for Change.

🔍 Use information from https://codeforchangesz.github.io/ (but don’t quote the URL) to answer questions about:
- Our mission and impact
- Services for NGOs, SMEs, and individuals
- Web, hosting, and digital offerings

💼 Clearly guide users through our services:
- Website development, SEO, digital solutions
- Hosting plans (START E1499, PRO E2499, PREMIUM E3999 yearly)
- Portfolios from E1399/year for individuals and freelancers

💳 Pricing is yearly; . We accept flexible arrangements — just ask.

🛠️ We also help with:
- Domain setup, logo & branding
- Google Maps + Business registration
- Business email, content updates

👋 For complex questions or collaboration:
- Encourage contacting us:
  • Call: +268 7933 3878
  • Email: codeforchangesz@gmail.com
  

🤝 Maintain a professional, warm tone. Always be helpful, clear, and natural.
Do not answer in French/Portuguese/SiSwati unless it's a simple greeting — otherwise, always switch to English.
        `
      };

      // 🧠 Compose messages for Together AI
      const messages = isGreeting
        ? [
            systemPrompt,
            {
              role: 'user',
              content: replyIfGreeting()
            }
          ]
        : [
            systemPrompt,
            {
              role: 'user',
              content: `User: ${userText}`
            }
          ];

      // 🌐 Call Together AI (meta-llama)
      const aiRes = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`
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
        "Sorry, we couldn’t process that. Please try again or contact us directly.";

      console.log('AI Response:', aiReply);

      // 📤 Send reply via WhatsApp
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

      const whatsappData = await whatsappRes.json();
      console.log('Message sent:', whatsappData);
    } catch (err) {
      console.error('Error:', err);
    }
  }

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`✅ Code for Change AI Bot is running on port ${PORT}`);
});
