// index.js
const express = require("express");
const axios = require("axios");
const app = express();

// Parse incoming JSON payloads
app.use(express.json());

// Load tokens from environment variables
const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.post("/webhook", async (req, res) => {
  try {
    const incoming = req.body;

    // Check if message payload exists
    const message = incoming.messages && incoming.messages[0];
    if (!message || !message.text || !message.text.body || !message.from) {
      return res.status(400).send("Invalid payload");
    }

    const userMsg = message.text.body;
    const from = message.from;

    console.log(`Received message from ${from}: ${userMsg}`);

    // Call OpenAI API for response
    const openaiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are Code for Change assistant. Answer questions about hosting plans and campaign.",
          },
          { role: "user", content: userMsg },
        ],
        max_tokens: 500,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const botReply = openaiResponse.data.choices[0].message.content;
    console.log(`OpenAI reply: ${botReply}`);

    // Send reply back via Whapi.Cloud API
    await axios.post(
      "https://gate.whapi.cloud/messages/text",
      {
        to: from,
        text: botReply,
      },
      {
        headers: {
          Authorization: `Bearer ${WHAPI_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Respond OK to webhook request
    res.sendStatus(200);
  } catch (error) {
    console.error("Error in webhook:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

// Health check route
app.get("/", (req, res) => {
  res.send("Code for Change WhatsApp AI Bot is running.");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
});
