// index.ts (Backend)
import express from 'express';
import path from 'path';
import DodoPayments from 'dodopayments';
import 'dotenv/config';
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Add request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Initialize Dodo Payments client
const dodoClient = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY || 'your-api-key-here',
});

// Configuration from environment variables
const PRODUCT_ID = process.env.PRODUCT_ID || 'your-product-id';
const PRODUCT_QUANTITY = parseInt(process.env.PRODUCT_QUANTITY || '1');
const CUSTOMER_NAME = process.env.CUSTOMER_NAME || '';
const CUSTOMER_EMAIL = process.env.CUSTOMER_EMAIL || '';

console.log('Server starting with configuration:');
console.log('Product ID:', PRODUCT_ID);
console.log('API Key configured:', process.env.DODO_PAYMENTS_API_KEY ? 'Yes' : 'No');

// Serve the HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to create checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    console.log('Creating checkout session with config:');
    console.log('Product ID:', PRODUCT_ID);
    console.log('Quantity:', PRODUCT_QUANTITY);
    console.log('Customer Name:', CUSTOMER_NAME);
    console.log('Customer Email:', CUSTOMER_EMAIL);

    // Validate required configuration
    if (!PRODUCT_ID || PRODUCT_ID === 'your-product-id') {
      return res.status(400).json({ 
        error: 'Product ID not configured. Please set PRODUCT_ID in your .env file' 
      });
    }

    if (!process.env.DODO_PAYMENTS_API_KEY || process.env.DODO_PAYMENTS_API_KEY === 'your-api-key-here') {
      return res.status(400).json({ 
        error: 'API key not configured. Please set DODO_PAYMENTS_API_KEY in your .env file' 
      });
    }

    // Create checkout session with predefined configuration
    const checkoutSession = await dodoClient.checkoutSessions.create({
      product_cart: [
        {
          product_id: PRODUCT_ID,
          quantity: PRODUCT_QUANTITY
        }
      ],
      // Customer data is optional - if not provided, checkout will collect it
      customer: CUSTOMER_EMAIL && CUSTOMER_NAME ? {
        email: CUSTOMER_EMAIL,
        name: CUSTOMER_NAME
      } : undefined,
      return_url: `${req.protocol}://${req.get('host')}/success`,
      metadata: {
        source: 'web_checkout',
        timestamp: new Date().toISOString(),
        product_id: PRODUCT_ID,
        quantity: PRODUCT_QUANTITY.toString()
      }
    });

    console.log('Checkout session created successfully:', checkoutSession.session_id);

    res.json({
      session_id: checkoutSession.session_id,
      checkout_url: checkoutSession.checkout_url
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    
    // Ensure we always return JSON
    res.status(500).json({
      error: 'Failed to create checkout session',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Success page endpoint
app.get('/success', (req, res) => {
  const { payment_id, status } = req.query;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Payment Success</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 50px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .container { 
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                max-width: 500px;
            }
            .success { color: #28a745; }
            .back-link { 
                display: inline-block;
                margin-top: 20px;
                padding: 10px 20px;
                background: #667eea;
                color: white;
                text-decoration: none;
                border-radius: 6px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1 class="success">✅ Payment Successful!</h1>
            <p>Thank you for your payment.</p>
            ${payment_id ? `<p><strong>Payment ID:</strong> ${payment_id}</p>` : ''}
            ${status ? `<p><strong>Status:</strong> ${status}</p>` : ''}
            <a href="/" class="back-link">← Back to Home</a>
        </div>
    </body>
    </html>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Product ID: ${PRODUCT_ID}`);
  console.log(`Quantity: ${PRODUCT_QUANTITY}`);
});

export default app;