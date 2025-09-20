import express from "express";
import path from "path";
import DodoPayments from "dodopayments";
import dotenv from "dotenv";
import crypto from "crypto";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration from environment variables
const dodoApiKey = process.env.DODO_PAYMENTS_API_KEY;
const dodoEnvironment = process.env.DODO_PAYMENTS_ENVIRONMENT || "test_mode";
const productId = process.env.PRODUCT_ID;

console.log("Server starting with configuration:");
console.log("API Key present:", !!dodoApiKey);
console.log("Environment:", dodoEnvironment);
console.log("Product ID:", productId);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Add request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Initialize Dodo Payments client
let dodoClient: DodoPayments | null = null;

try {
  if (dodoApiKey) {
    dodoClient = new DodoPayments({
      bearerToken: dodoApiKey,
      environment: dodoEnvironment as "test_mode" | "live_mode",
    });
    console.log("Dodo Payments client initialized successfully");
  } else {
    console.error("Dodo Payments API key not provided");
  }
} catch (error) {
  console.error("Failed to initialize Dodo Payments client:", error);
}

// Serve the HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API endpoint to create checkout session
app.post("/api/create-payment", async (req, res) => {
  try {
    console.log("Checkout session creation request received");

    if (!dodoClient) {
      console.error("Dodo Payments client not initialized");
      return res.status(500).json({
        success: false,
        error: "Payment system not available",
      });
    }

    if (!dodoApiKey) {
      console.error("Dodo Payments API key not configured");
      return res.status(500).json({
        success: false,
        error: "Payment system not configured",
      });
    }

    if (!productId) {
      console.error("Product ID not configured");
      return res.status(500).json({
        success: false,
        error: "Product not configured",
      });
    }

    console.log("Creating checkout session for product:", productId);

    // Prepare checkout session data
    const checkoutData = {
      product_cart: [
        {
          product_id: productId,
          quantity: 1,
        },
      ],
      return_url: `${req.protocol}://${req.get("host")}/success`,
      metadata: {
        source: "web_checkout",
        timestamp: new Date().toISOString(),
      },
    };

    console.log(
      "Sending checkout session data:",
      JSON.stringify(checkoutData, null, 2)
    );

    // Create checkout session
    const checkoutSession = await dodoClient.checkoutSessions.create(
      checkoutData
    );

    console.log("Checkout session response received:");
    console.log("Session ID:", checkoutSession.session_id);
    console.log("Checkout URL:", checkoutSession.checkout_url);

    res.json({
      success: true,
      sessionId: checkoutSession.session_id,
      paymentLink: checkoutSession.checkout_url,
    });
  } catch (error) {
    console.error("Checkout session creation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create checkout session",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Success page endpoint
app.get("/success", (req, res) => {
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
            <h1 class="success">Payment Successful!</h1>
            <p>Thank you for your payment.</p>
            ${
              payment_id
                ? `<p><strong>Payment ID:</strong> ${payment_id}</p>`
                : ""
            }
            ${status ? `<p><strong>Status:</strong> ${status}</p>` : ""}
            <a href="/" class="back-link">Back to Home</a>
        </div>
    </body>
    </html>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Product ID: ${productId}`);
});

export default app;
