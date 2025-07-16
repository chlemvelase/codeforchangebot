const express = require('express');
const fetch = require('node-fetch'); // Already in your original setup
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_NUMBER = '26879333878@s.whatsapp.net';
const processedMessages = new Set();

// Hardcoded data extracted from https://codeforchangesz.github.io/
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

app.use(express.json());

app.post('/webhook', async (req, res) => {
  const message = req.body?.messages?.[0];
  res.sendStatus(200);

  if (!message) return;

  const messageId = message.id;
  const phone = message?.from;
  const userText = message?.text?.body?.trim();
  const userName = message?.from_name || 'there';

  if (processedMessages.has(messageId) || message?.from_me || phone === BOT_NUMBER) {
    console.log(processedMessages.has(messageId) ? '⏭️ Skipped duplicate' : '⚠️ Ignored bot message');
    return;
  }
  processedMessages.add(messageId);

  console.log(`📩 From ${userName} (${phone}): ${userText}`);

  if (phone && userText) {
    try {
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
1. ALWAYS use "we"/"our" (you're part of the team)
2. Start with greeting if new conversation
3. Ask clarifying questions:
   - For websites: "Is this for an NGO, business, or portfolio?"
   - For hosting: "Do you need basic (START) or advanced (PRO/PREMIUM)?"
4. Reveal pricing ONLY when asked directly
5. Keep messages under 2 sentences (max 160 chars)

## EXAMPLE FLOWS
User: Hi
You: Hi ${userName}! 😊 How can we help today?

User: Need website
You: Great! What type? (NGO/business/portfolio)

User: NGO
You: We love supporting NGOs! What does your organization do?
        `
      };

      const messages = [
        systemPrompt,
        { role: "user", content: userText }
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
      let reply = aiData?.choices?.[0]?.message?.content?.trim() || 
        "Apologies, could you repeat that?";

      // Enforce WhatsApp message limits
      reply = reply.split('. ')[0].substring(0, 160);
      console.log('🤖 Reply:', reply);

      await fetch('https://gate.whapi.cloud/messages/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.WHAPI_KEY}`
        },
        body: JSON.stringify({
          to: phone,
          body: reply,
          channelId: process.env.WHAPI_CHANNEL_ID
        })
      });

    } catch (err) {
      console.error('❌ Error:', err);
    }
  }
});

// Helper function to format services
function formatServices(services) {
  let text = "🖥️ WEB HOSTING:\n";
  text += services.hosting.map(s => `• ${s}`).join('\n');
  
  text += "\n\n🎨 PORTFOLIOS:\n";
  text += `• ${services.portfolios}`;
  
  text += "\n\n🔧 OTHER SERVICES:\n";
  text += services.other.map(s => `• ${s}`).join('\n');
  
  return text;
}

app.listen(PORT, () => {
  console.log(`✅ Bot running on port ${PORT}`);
  console.log('ℹ️ Using embedded website data (last manually updated)');
});
