const express = require('express');
const fetch = require('node-fetch'); // Make sure to use node-fetch v2
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' })); // Prevent "PayloadTooLargeError"

app.post('/webhook', async (req, res) => {
  const message = req.body?.messages?.[0];
  const phone = message?.from;
  const userText = message?.text?.body?.trim();
  const userName = message?.from_name || 'there';
  const messageId = message?.id;

  console.log(`📩 Incoming from ${userName} (${phone}): ${userText}`);

  // Exit if invalid
  if (!phone || !userText || !messageId) {
    console.log('⚠️ Missing data. Ignoring.');
    return res.sendStatus(200);
  }

  // 1️⃣ Greeting detection
  const greetingMap = {
    siswati: ['sawubona', 'unjani', 'kusile', 'kutfutfukile'],
    portuguese: ['ola', 'oi', 'bom dia', 'boa tarde', 'boa noite'],
    french: ['bonjour', 'salut', 'bonsoir']
  };

  const normalized = userText.toLowerCase();
  const isGreeting = Object.values(greetingMap).some(list =>
    list.some(word => normalized.includes(word))
  );

  const greetingReply = `Sawubona ${userName}! 😊 Thanks for reaching out to Code for Change. How can we assist you today?`;

  // 2️⃣ Prepare system prompt
  const systemPrompt = {
    role: 'system',
    content: `
You are a smart, friendly assistant representing Code for Change in Eswatini.
Speak as "we" or "our team". Always be brief, warm, and helpful.

We offer:
- Hosting (START E1499, PRO E2499, PREMIUM E3999 per year)
- Portfolios for E1399/year
- Website development, branding, domain setup, Google Business, emails

💳 Yearly pricing; flexible plans allowed with at least 50% upfront.

📞 Contact:
• Call: +268 7933 3878
• Email: codeforchangesz@gmail.com

🌍 Languages:
• If greeted in SiSwati, Portuguese, or French: respond with a short greeting
• Always continue in English

Keep replies short and clear. Always aim to help convert interest into action.
    `
  };

  const messages = isGreeting
    ? [systemPrompt, { role: 'user', content: greetingReply }]
    : [systemPrompt, { role: 'user', content: userText }];

  // 3️⃣ AI reply from Together
  let aiReply = '';
  try {
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
    aiReply =
      aiData?.choices?.[0]?.message?.content?.trim() ||
      "We’re having trouble replying now — please contact us directly.";
    console.log('🤖 AI Reply:', aiReply);
  } catch (err) {
    console.error('AI error:', err);
    aiReply =
      "We couldn’t process your request right now — please try again or reach out directly.";
  }

  // 4️⃣ Send message to WhatsApp via WHAPI
  try {
    const sendRes = await fetch('https://gate.whapi.cloud/messages/text', {
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

    const sendData = await sendRes.json();
    console.log('📤 Message sent:', sendData);
  } catch (err) {
    console.error('WhatsApp error:', err);
  }

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`✅ Code for Change AI Bot is running on port ${PORT}`);
});
