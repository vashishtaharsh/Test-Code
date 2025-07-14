// whatsapp_webhook_server.js

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const Joi = require('joi');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();

// Middleware: Security Headers
app.use(helmet());

// Middleware: Rate Limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, try again later.'
});
app.use('/webhook', limiter);

// Middleware: Verify Webhook Signature
function verifySignature(req, res, buf, encoding) {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
        throw new Error('Missing signature.');
    }
    const expectedSignature = 'sha256=' + crypto.createHmac('sha256', process.env.META_APP_SECRET).update(buf).digest('hex');
    if (signature !== expectedSignature) {
        throw new Error('Invalid signature.');
    }
}

// Body parser with raw buffer for signature validation
app.use(bodyParser.json({ verify: verifySignature }));

// Webhook verification (GET)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        console.log('Webhook verified.');
        res.status(200).send(challenge);
    } else {
        console.warn('Webhook verification failed.');
        res.sendStatus(403);
    }
});

// Webhook event listener (POST)
app.post('/webhook', (req, res) => {
    const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    console.log('Received webhook event:', message);

    if (message) {
        const from = message.from;
        const messageType = message.type;
        console.log(`[${new Date().toISOString()}] Received ${messageType} from ${from}`);

        if (messageType === 'text') {
            const body = message.text?.body;
            console.log(`Text message: ${body}`);
        }
    } else {
        console.log('No message content found.');
    }
    res.sendStatus(200);
});

// Message send endpoint with validation
app.post('/send-whatsapp-message', async (req, res) => {
    const schema = Joi.object({
        to: Joi.string().pattern(/^\d+$/).required(),
        body: Joi.string().min(1).max(4096).required()
    });

    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    const { to, body } = req.body;
    try {
        const response = await axios.post(
            `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to,
                type: 'text',
                text: { body, preview_url: true }
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        res.status(200).json({ message: 'Message sent.', data: response.data });
    } catch (err) {
        console.error('Send error:', err.response?.data || err.message);
        res.status(500).json({
            error: 'Sending failed',
            details: err.response ? err.response.data : err.message
        });
    }
});

// Default route
app.get('/', (req, res) => {
    res.send('WhatsApp Webhook is running securely.');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));