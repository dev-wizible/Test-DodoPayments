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
// const dodoWebhookSecret = process.env.DODO_WEBHOOK_SECRET;
const dodoEnvironment = process.env.DODO_PAYMENTS_ENVIRONMENT || "test_mode";
const productId = process.env.PRODUCT_ID;

console.log("Server starting with configuration:");
console.log("API Key present:", !!dodoApiKey);
// console.log("Webhook Secret present:", !!dodoWebhookSecret);
console.log("Environment:", dodoEnvironment);
console.log("Product ID:", productId);

// Webhook endpoint (must be before express.json() middleware)
// app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
//   try {
//     if (!dodoWebhookSecret) {
//       console.error("Webhook secret not configured");
//       return res.status(500).json({ error: "Webhook not configured" });
//     }

//     const signature = req.headers["dodo-signature"] || req.headers["x-dodo-signature"];
//     const payload = req.body;

//     console.log("Webhook received:", {
//       signature: signature ? "present" : "missing",
//       payloadSize: payload.length
//     });

//     // Verify webhook signature
//     if (signature && dodoWebhookSecret) {
//       const expectedSignature = crypto
//         .createHmac("sha256", dodoWebhookSecret)
//         .update(payload)
//         .digest("hex");
      
//       const providedSignature = (signature as string).replace("sha256=", "");
      
//       if (expectedSignature !== providedSignature) {
//         console.error("Webhook signature verification failed");
//         return res.status(401).json({ error: "Invalid signature" });
//       }
//     }

//     // Parse the payload
//     let event;
//     try {
//       event = JSON.parse(payload.toString());
//     } catch (parseError) {
//       console.error("Failed to parse webhook payload:", parseError);
//       return res.status(400).json({ error: "Invalid JSON payload" });
//     }

//     console.log("Webhook event:", event.type, "for payment:", event.data?.id);

//     // Handle different webhook events
//     switch (event.type) {
//       case "payment.succeeded":
//       case "payment.completed":
//         console.log("Payment successful:", event.data?.id);
//         // Add your business logic here (e.g., fulfill order, send confirmation email)
//         break;
//       case "payment.failed":
//         console.log("Payment failed:", event.data?.id);
//         // Add your business logic here (e.g., notify customer, retry logic)
//         break;
//       case "subscription.created":
//         console.log("Subscription created:", event.data?.id);
//         break;
//       case "subscription.cancelled":
//         console.log("Subscription cancelled:", event.data?.id);
//         break;
//       default:
//         console.log("Unhandled webhook event type:", event.type);
//     }

//     res.status(200).json({ received: true });

//   } catch (error) {
//     console.error("Webhook processing error:", error);
//     res.status(500).json({ error: "Webhook processing failed" });
//   }
// });

// Regular middleware (after webhook endpoint)
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
      }
    };

    console.log("Sending checkout session data:", JSON.stringify(checkoutData, null, 2));

    // Create checkout session
    const checkoutSession = await dodoClient.checkoutSessions.create(checkoutData);

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
            ${payment_id ? `<p><strong>Payment ID:</strong> ${payment_id}</p>` : ""}
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