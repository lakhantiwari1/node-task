const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
require("../table/userTable");

const app = express();
app.use(express.json());

// Signup API
app.post("/api/signup", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  // Check if email is already registered
  const [existingUser] = await connection
    .promise()
    .query("SELECT * FROM users WHERE email = ?", [email]);
  if (existingUser.length > 0) {
    return res.status(400).json({ error: "Email already exists" });
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Insert user into database
  await connection
    .promise()
    .query(
      "INSERT INTO users (firstName, lastName, email, password) VALUES (?, ?, ?, ?)",
      [firstName, lastName, email, hashedPassword]
    );

  res.status(201).json({ message: "User created successfully" });
});

// Login API
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  // Check if user exists
  const [user] = await connection
    .promise()
    .query("SELECT * FROM users WHERE email = ?", [email]);
  if (user.length === 0) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Verify password
  const passwordMatch = await bcrypt.compare(password, user[0].password);
  if (!passwordMatch) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Generate JWT token
  const token = jwt.sign({ email: user[0].email }, "your_secret_key", {
    expiresIn: "1h",
  });
  res.json({ token });
});

// Get User Details API
app.get("/api/user", authenticateToken, async (req, res) => {
  const email = req.user.email;
  const [user] = await connection
    .promise()
    .query("SELECT firstName, lastName, email FROM users WHERE email = ?", [
      email,
    ]);
  res.json(user[0]);
});

// Forget Password API
app.post("/api/forget-password", async (req, res) => {
  const { email } = req.body;

  // Generate reset token
  const token = Math.random().toString(36).substr(2, 15);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

  // Store token in database
  await connection
    .promise()
    .query(
      "REPLACE INTO passwordReset (email, token, expiresAt) VALUES (?, ?, ?)",
      [email, token, expiresAt]
    );

  // Send email with reset link
  const transporter = nodemailer.createTransport({
    // Configure your email provider
    service: "gmail",
    auth: {
      user: "lakhantiwari@gmail.com",
      pass: "123456",
    },
  });

  const mailOptions = {
    from: "lakhantiwari@gmail.com",
    to: email,
    subject: "Password Reset",
    text: `Click the following link to reset your password: http://localhost:3000/reset-password?token=${token}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
      return res.status(500).json({ error: "Error sending email" });
    }
    console.log("Email sent:", info.response);
    res.json({ message: "Reset password link sent to your email" });
  });
});

// Reset Password API
app.post("/api/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  // Check if token is valid and not expired
  const [resetInfo] = await connection
    .promise()
    .query(
      "SELECT * FROM passwordReset WHERE token = ? AND expiresAt > NOW()",
      [token]
    );
  if (resetInfo.length === 0) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }

  // Update password in the database
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await connection
    .promise()
    .query("UPDATE users SET password = ? WHERE email = ?", [
      hashedPassword,
      resetInfo[0].email,
    ]);

  res.json({ message: "Password reset successfully" });
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  jwt.verify(token, "API_TEST", (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.user = user;
    next();
  });
}

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
