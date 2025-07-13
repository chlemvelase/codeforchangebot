const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

// Webhook endpoint
app.post('/webhook', async (req, res) => {
    try {
        const message = req.body.messages[0];
        
        if (message && !message.from_me) {
            // Extract sender info
            const sender = message.from;
            const senderName = message.from_name;
            
            // Default response
            const responseMessage = "Thank you for contacting Code for Change. How can we assist you today?";
            
            // Send response
            await sendMessage(sender, responseMessage);
        }
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
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
            text: {
                body: text
            }
        }]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.WHAPI_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
    }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
