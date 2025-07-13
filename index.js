const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

// Webhook endpoint
app.post('/webhook', async (req, res) => {
    try {
        // Check if there are messages in the request
        if (!req.body.messages || req.body.messages.length === 0) {
            return res.status(200).send('OK');
        }

        const message = req.body.messages[0];
        
        // Only respond to messages from users (not from the bot itself)
        if (message && !message.from_me) {
            const sender = message.from;
            const responseText = "Thank you for contacting Code for Change. How can we assist you today?";
            
            await sendMessage(sender, responseText);
        }
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('Error:', error);
        res.status(200).send('OK'); // Still respond OK to avoid webhook failures
    }
});

// Function to send WhatsApp message
async function sendMessage(recipient, text) {
    const url = 'https://whapi.cloud/v1/messages';
    
    const payload = {
        channel_id: process.env.WHAPI_CHANNEL_ID,
        messages: [{
            to: recipient,
            type: 'text',
            text: { body: text }
        }]
    };

    await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.WHAPI_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
