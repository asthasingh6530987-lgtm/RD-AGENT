import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import admin from "firebase-admin";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();



async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Firebase Admin
  // Prefer environment variables for flexibility
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://gen-lang-client-0200046760-default-rtdb.asia-southeast1.firebasedatabase.app"
      });
      console.log("Firebase Admin initialized with service account");
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT", e);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
     admin.initializeApp({
       credential: admin.credential.applicationDefault(),
       databaseURL: "https://gen-lang-client-0200046760-default-rtdb.asia-southeast1.firebasedatabase.app"
     });
     console.log("Firebase Admin initialized with default credentials");
  } else {
    console.warn("Firebase Admin NOT initialized. Push notifications will not work.");
  }

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/send-email", async (req, res) => {
    try {
      const { name, email, phone, message } = req.body;
      
      const gmailUser = process.env.GMAIL_USER;
      const gmailPass = process.env.GMAIL_PASS;

      if (!gmailUser || !gmailPass) {
        // If not configured, we just simulate success (or log it)
        console.warn("Gmail credentials not configured. Email not sent.");
        return res.status(200).json({ success: true, warning: 'Email not sent (credentials missing)' });
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPass
        }
      });

      const mailOptions = {
        from: gmailUser, // sender address
        to: gmailUser, // admin's email address
        subject: `New Contact Message from ${name}`, // Subject line
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background-color: #f8fafc;
                margin: 0;
                padding: 0;
              }
              .container {
                max-width: 600px;
                margin: 40px auto;
                background: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
              }
              .header {
                background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                padding: 30px;
                text-align: center;
              }
              .header h1 {
                color: #ffffff;
                margin: 0;
                font-size: 24px;
                font-weight: 600;
                letter-spacing: -0.5px;
              }
              .content {
                padding: 40px 30px;
              }
              .field {
                margin-bottom: 24px;
                background: #f1f5f9;
                padding: 16px;
                border-radius: 8px;
                border-left: 4px solid #3b82f6;
              }
              .field-label {
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #64748b;
                font-weight: 700;
                margin-bottom: 6px;
                display: block;
              }
              .field-value {
                font-size: 16px;
                color: #334155;
                margin: 0;
                line-height: 1.5;
              }
              .message-box {
                margin-top: 30px;
              }
              .message-box .field-label {
                border-left: 4px solid #6366f1;
                padding-left: 12px;
                color: #4f46e5;
              }
              .message-content {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                padding: 20px;
                border-radius: 8px;
                font-size: 15px;
                color: #475569;
                line-height: 1.6;
                white-space: pre-wrap;
                margin-top: 10px;
              }
              .footer {
                padding: 24px 30px;
                background: #f8fafc;
                text-align: center;
                border-top: 1px solid #e2e8f0;
              }
              .footer p {
                color: #94a3b8;
                font-size: 13px;
                margin: 0;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>New Contact Enquiry</h1>
              </div>
              <div class="content">
                <div class="field">
                  <span class="field-label">Full Name</span>
                  <p class="field-value">${name}</p>
                </div>
                
                <div class="field">
                  <span class="field-label">Email Address</span>
                  <p class="field-value"><a href="mailto:${email}" style="color: #3b82f6; text-decoration: none;">${email}</a></p>
                </div>

                <div class="field">
                  <span class="field-label">Phone Number</span>
                  <p class="field-value"><a href="tel:${phone}" style="color: #3b82f6; text-decoration: none;">${phone || 'Not provided'}</a></p>
                </div>

                <div class="message-box">
                  <span class="field-label">Message Content</span>
                  <div class="message-content">${message}</div>
                </div>
              </div>
              <div class="footer">
                <p>This email was sent via the Applet Contact Form.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `You have received a new contact message.\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\n\nMessage:\n${message}`
      };

      await transporter.sendMail(mailOptions);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ success: false, error: 'Failed to send email' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
