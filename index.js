const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_NUMBER = '26879333878@s.whatsapp.net';

app.use(express.json());

const WEBSITE_DATA = {
  mission: "Empowering individuals, NGOs, and SMEs in Eswatini with affordable digital solutions",
  services: {
    hosting: [
      "START: E1499/year (Basic hosting)",
      "PRO: E2499/year (Enhanced resources)", 
      "PREMIUM: E3999/year (Business-grade)"
    ],
    portfolios: "Freelancer portfolios from E1399/year",
    other: [
      "Google Maps integration",
      "Custom email setup (@yourdomain.org)",
      "Domain registration (.org.sz, .co.sz)",
      "Content updates",
      "Branding & logo design"
    ]
  },
  benefits: [
    "🌍 Local hosting = faster loading for Eswatini visitors",
    "📱 Mobile-friendly designs (works on all phones)",
    "💼 Showcase your work professionally",
    "🛡️ Secure SSL certificates included",
    "🔄 Easy content updates via WhatsApp"
  ]
};

const userSessions = new Map();

function cleanupSessions() {
  const now = Date.now();
  for (const [phone, session] of userSessions) {
    if (now - session.timestamp > 10 * 60 * 1000) {
      userSessions.delete(phone);
    }
  }
}
setInterval(cleanupSessions, 60 * 1000);

app.post('/webhook', async (req, res) => {
  const message = req.body?.messages?.[0];
  res.sendStatus(200);

  if (!message || message.from_me || message.from === BOT_NUMBER) return;

  const phone = message?.from;
  const userText = message?.text?.body?.trim();
  const userName = message?.from_name || 'there';

  if (!phone || !userText) return;

  const session = userSessions.get(phone) || { history: [], timestamp: Date.now() };
  session.history.push(userText);
  session.timestamp = Date.now();
  userSessions.set(phone, session);

  let flowReply = handleFlow(session.history);
  if (!flowReply) {
    const aiResponse = await getAIReply(userText, userName);
    flowReply = aiResponse;
  }

  console.log(`📥 MESSAGE from ${userName} (${phone})`);
  console.log(`💬 Text: ${userText}`);
  console.log(`🤖 Reply: ${flowReply}`);

  await sendMessage(phone, flowReply);
});

function handleFlow(history) {
  const last = history[history.length - 1].toLowerCase();
  if (last.includes('hi') || last.includes('hello')) {
    return `Hi! 👋 Welcome to Code for Change. What can we help you with today? (Website, Hosting, Portfolio)`;
  }
  if (last.includes('website')) {
    return `What type of website do you need? (NGO, business, or portfolio)`;
  }
  if (last.includes('portfolio')) {
    return `We offer beautiful freelancer portfolios from E1399/year. Would you like us to reach out to guide you, or share our contact details?`;
  }
  if (last.includes('contact') || last.includes('reach out')) {
    return `You can reach us at 📞 +268 7933 3878 or 📧 codeforchangesz@gmail.com. Would you like us to call or WhatsApp you?`;
  }
  return null;
}

async function getAIReply(userText, userName) {
  const systemPrompt = {
    role: "system",
    content: `
# CODE FOR CHANGE ASSISTANT RULES

## CORE MISSION
${WEBSITE_DATA.mission}

## SERVICES AVAILABLE
${formatServices(WEBSITE_DATA.services)}

## KEY BENEFITS
${WEBSITE_DATA.benefits.join('\n')}

## RESPONSE GUIDELINES
- Use "we"/"our"
- Start with greeting if needed
- Ask clarifying questions
- Keep replies under 160 characters
    `
  };

  const messages = [
    systemPrompt,
    { role: 'user', content: userText }
  ];

  const aiRes = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`
    },
    body: JSON.stringify({
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
      messages,
      temperature: 0.5,
      max_tokens: 120,
      stop: ['\n\n']
    })
  });

  const aiData = await aiRes.json();
  return aiData?.choices?.[0]?.message?.content?.trim().substring(0, 160) || "Sorry, could you rephrase that?";
}

async function sendMessage(phone, text) {
  await fetch('https://gate.whapi.cloud/messages/text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.WHAPI_KEY}`
    },
    body: JSON.stringify({
      to: phone,
      body: text,
      channelId: process.env.WHAPI_CHANNEL_ID
    })
  });
}

function formatServices(services) {
  return `
🖥️ HOSTING:
${services.hosting.map(s => `• ${s}`).join('\n')}

📸 PORTFOLIOS:
• ${services.portfolios}

🔧 EXTRAS:
${services.other.map(s => `• ${s}`).join('\n')}`;
}

app.listen(PORT, () => {
  console.log(`✅ Bot running on port ${PORT}`);
  console.log('ℹ️ Using embedded website data (last manually updated)');
});
