const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Optional: Log all incoming requests
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

// Root route
app.get("/", (req, res) => {
  res.send('Simple WhatsApp Webhook tester<br>There is no front-end, see server.js for implementation!');
});

// Webhook verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified successfully.');
    res.status(200).send(challenge);
  } else {
    console.warn('Webhook verification failed.');
    res.sendStatus(403);
  }
});

// Webhook listener
app.post("/webhook", (req, res) => {
  const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  console.log(req.body);
  

  if (message) {
    const messageType = message.type;
    const from = message.from;
    console.log(`Received ${messageType} message from ${from}:`, message);

    if (messageType === 'text') {
      const body = message.text?.body || '';
      console.log(`Message body: ${body}`);
      // Further processing can be done here
    }

    // You can also handle other message types (image, audio, etc.) here
  } else {
    console.log('No message content found in webhook payload.');
  }

  res.sendStatus(200);
});

// Send WhatsApp message
const sendWhatsAppTemplateMessage = async (req, res) => {
  try {
    const { to, body } = req.body;

    if (!to || !body) {
      return res.status(400).json({ message: 'Missing required fields: to or body' });
    }

    const response = await axios({
      method: 'POST',
      url: `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: {
          preview_url: true,
          body
        }
      }
    });

    res.status(200).json({ message: 'Message sent', data: response.data });
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error.message);
    res.status(500).json({
      message: 'Error sending message',
      error: error.response ? error.response.data : error.message
    });
  }
};

app.post('/send-whatsapp-message', sendWhatsAppTemplateMessage);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Your app is listening on port ${PORT}`);
});
