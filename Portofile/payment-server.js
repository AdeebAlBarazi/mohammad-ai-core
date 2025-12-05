// Payment Server - Backend for PayPal & Stripe Integration
// خادم الدفع - الواجهة الخلفية لتكامل PayPal و Stripe

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ============================================
// PayPal SDK Setup
// ============================================
const paypal = require('@paypal/checkout-server-sdk');

function paypalEnvironment() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    
    if (process.env.PAYPAL_MODE === 'production') {
        return new paypal.core.LiveEnvironment(clientId, clientSecret);
    } else {
        return new paypal.core.SandboxEnvironment(clientId, clientSecret);
    }
}

const paypalClient = new paypal.core.PayPalHttpClient(paypalEnvironment());

// ============================================
// Stripe SDK Setup
// ============================================
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ============================================
// PayPal Routes
// ============================================

// Create PayPal Order
app.post('/api/paypal/create-order', async (req, res) => {
    try {
        const { amount, description, orderId } = req.body;

        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer("return=representation");
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: orderId,
                description: description,
                amount: {
                    currency_code: 'USD',
                    value: amount.toFixed(2)
                }
            }],
            application_context: {
                brand_name: 'Dr. Mohammad Consulting',
                landing_page: 'NO_PREFERENCE',
                user_action: 'PAY_NOW',
                return_url: `${process.env.BASE_URL}/payment-success.html`,
                cancel_url: `${process.env.BASE_URL}/payment.html`
            }
        });

        const order = await paypalClient.execute(request);
        
        console.log('✅ PayPal Order Created:', order.result.id);
        
        res.json({
            success: true,
            orderId: order.result.id,
            links: order.result.links
        });

    } catch (error) {
        console.error('❌ PayPal Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Capture PayPal Order
app.post('/api/paypal/capture-order', async (req, res) => {
    try {
        const { orderId } = req.body;

        const request = new paypal.orders.OrdersCaptureRequest(orderId);
        request.requestBody({});

        const capture = await paypalClient.execute(request);
        
        console.log('✅ PayPal Payment Captured:', capture.result.id);
        
        // Here you can save the payment to your database
        const paymentData = {
            orderId: capture.result.id,
            status: capture.result.status,
            amount: capture.result.purchase_units[0].amount.value,
            payer: capture.result.payer,
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            payment: paymentData
        });

    } catch (error) {
        console.error('❌ PayPal Capture Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// Stripe Routes
// ============================================

// Create Stripe Checkout Session
app.post('/api/stripe/create-checkout', async (req, res) => {
    try {
        const { amount, description, orderId, customerEmail } = req.body;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'Dr. Mohammad Consulting',
                        description: description,
                    },
                    unit_amount: Math.round(amount * 100), // Convert to cents
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${process.env.BASE_URL}/payment-success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.BASE_URL}/payment.html`,
            customer_email: customerEmail,
            client_reference_id: orderId,
            metadata: {
                orderId: orderId
            }
        });

        console.log('✅ Stripe Session Created:', session.id);

        res.json({
            success: true,
            sessionId: session.id,
            url: session.url
        });

    } catch (error) {
        console.error('❌ Stripe Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Verify Stripe Payment
app.post('/api/stripe/verify-payment', async (req, res) => {
    try {
        const { sessionId } = req.body;

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        console.log('✅ Stripe Payment Verified:', session.id);

        const paymentData = {
            sessionId: session.id,
            status: session.payment_status,
            amount: session.amount_total / 100,
            customerEmail: session.customer_email,
            orderId: session.client_reference_id,
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            payment: paymentData
        });

    } catch (error) {
        console.error('❌ Stripe Verification Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// Webhook Handlers
// ============================================

// PayPal Webhook
app.post('/api/paypal/webhook', async (req, res) => {
    try {
        const event = req.body;
        
        console.log('📧 PayPal Webhook Event:', event.event_type);

        // Handle different event types
        switch (event.event_type) {
            case 'PAYMENT.CAPTURE.COMPLETED':
                // Payment completed successfully
                console.log('✅ Payment Completed:', event.resource.id);
                // Save to database, send email, etc.
                break;
            
            case 'PAYMENT.CAPTURE.DENIED':
                // Payment denied
                console.log('❌ Payment Denied:', event.resource.id);
                break;
            
            case 'PAYMENT.CAPTURE.REFUNDED':
                // Payment refunded
                console.log('💰 Payment Refunded:', event.resource.id);
                break;
        }

        res.status(200).send('OK');

    } catch (error) {
        console.error('❌ PayPal Webhook Error:', error);
        res.status(500).send('Error');
    }
});

// Stripe Webhook
app.post('/api/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        let event;
        
        try {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err) {
            console.error('❌ Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        console.log('📧 Stripe Webhook Event:', event.type);

        // Handle different event types
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object;
                console.log('✅ Payment Completed:', session.id);
                // Save to database, send email, etc.
                break;
            
            case 'payment_intent.succeeded':
                console.log('✅ Payment Intent Succeeded');
                break;
            
            case 'charge.refunded':
                console.log('💰 Charge Refunded');
                break;
        }

        res.status(200).send('OK');

    } catch (error) {
        console.error('❌ Stripe Webhook Error:', error);
        res.status(500).send('Error');
    }
});

// ============================================
// Health Check
// ============================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        paypal: process.env.PAYPAL_CLIENT_ID ? 'Configured' : 'Not Configured',
        stripe: process.env.STRIPE_SECRET_KEY ? 'Configured' : 'Not Configured'
    });
});

// ============================================
// Start Server
// ============================================
app.listen(PORT, () => {
    console.log('');
    console.log('🚀 Payment Server Started!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log(`🔵 PayPal: ${process.env.PAYPAL_CLIENT_ID ? '✅ Configured' : '❌ Not Configured'}`);
    console.log(`🟣 Stripe: ${process.env.STRIPE_SECRET_KEY ? '✅ Configured' : '❌ Not Configured'}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📋 Available Endpoints:');
    console.log('   POST /api/paypal/create-order');
    console.log('   POST /api/paypal/capture-order');
    console.log('   POST /api/stripe/create-checkout');
    console.log('   POST /api/stripe/verify-payment');
    console.log('   GET  /api/health');
    console.log('');
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
    console.log('⚠️ SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('✅ HTTP server closed');
    });
});

module.exports = app;
