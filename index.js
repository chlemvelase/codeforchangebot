const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;

const MODEL = "mistralai/Mistral-7B-Instruct-v0.2"; // Change this if needed

app.post("/webhook", async (req, res) => {
  try {
    const incoming = req.body;
    const userMsg = incoming?.messages?.[0]?.text?.body;
    const from = incoming?.messages?.[0]?.from;

    if (!userMsg || !from) {
      console.log("Invalid payload:", incoming);
      return res.status(400).send("Invalid payload");
    }

    console.log("Received message from", from + ":", userMsg);

    // Call Together AI
    const togetherResponse = await axios.post(
      "https://api.together.xyz/v1/chat/completions",
      {
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are Code for Change assistant. Answer questions about hosting plans, website help, and the campaign. Be helpful, warm, and clear.",
          },
          { role: "user", content: userMsg },
        ],
        max_tokens: 500,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${TOGETHER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const botReply = togetherResponse.data.choices[0].message.content;
    console.log("Bot reply:", botReply);

    // Send reply to WhatsApp via Whapi
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

    res.sendStatus(200);
  } catch (error) {
    console.error("Error in webhook:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Code for Change bot running on port ${PORT}`);
});
