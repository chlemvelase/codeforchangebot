const express = require("express");
const axios = require("axios");
const app = express();

app.use(express.json());

// Load tokens from environment variables
const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!WHAPI_TOKEN || !OPENAI_API_KEY) {
  console.error("ERROR: Missing WHAPI_TOKEN or OPENAI_API_KEY environment variables");
  process.exit(1);
}

app.post("/webhook", async (req, res) => {
  try {
    const incoming = req.body;
    // console.log("Incoming webhook payload:", incoming);

    const userMsg = incoming.message?.text?.body;
    const from = incoming.from;

    if (!userMsg || !from) {
      return res.status(400).send("Invalid payload: missing message text or sender");
    }

    // Call OpenAI Chat Completion API
    const openaiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are Code for Change assistant. Answer questions about hosting plans and campaign clearly and helpfully.",
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

    // Send reply back to WhatsApp user via Whapi.Cloud API
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

    // Respond to Whapi.Cloud that webhook processed successfully
    res.sendStatus(200);
  } catch (error) {
    console.error("Error processing webhook:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Code for Change WhatsApp AI Bot is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
