const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; // From OpenRouter

app.post("/webhook", async (req, res) => {
  try {
    const incoming = req.body;
    const userMsg = incoming.message?.text?.body;
    const from = incoming.from;

    console.log("Received message from", from + ":", userMsg);

    if (!userMsg || !from) {
      return res.status(400).send("Invalid payload");
    }

    // Step 1: Call DeepSeek via OpenRouter
    const aiResponse = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "deepseek-chat", // or "deepseek-coder"
        messages: [
          {
            role: "system",
            content:
              "You are Code for Change's helpful assistant. Answer questions about hosting, websites, or getting started with the campaign.",
          },
          { role: "user", content: userMsg },
        ],
        temperature: 0.7,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://codeforchange.org", // Replace with your domain
          "Content-Type": "application/json",
        },
      }
    );

    const reply = aiResponse.data.choices[0].message.content;

    // Step 2: Send reply to WhatsApp user
    await axios.post(
      "https://gate.whapi.cloud/messages/text",
      {
        to: from,
        text: reply,
      },
      {
        headers: {
          Authorization: `Bearer ${WHAPI_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error("Error in webhook:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Code for Change bot running on port ${PORT}`)
);
