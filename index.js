const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/webhook', async (req, res) => {
  console.log('Incoming message:', JSON.stringify(req.body, null, 2));

  const phone = req.body?.messages?.[0]?.from;

  if (phone) {
    try {
      const response = await fetch('https://gate.whapi.cloud/messages/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.WHAPI_KEY}`
        },
        body: JSON.stringify({
          to: phone,
          body: 'Thank you. Our sales team will be in touch soon.',
          channelId: process.env.WHAPI_CHANNEL_ID
        })
      });

      const data = await response.json();
      console.log('Message sent:', data);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
