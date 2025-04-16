require("dotenv").config();
const redis = require("redis");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const bcrypt = require('bcryptjs');
const { query } = require('../db/index'); // Mengimpor fungsi query dari db

// Initialize Redis client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

redisClient.on("connect", () => {
  console.log("Connected to Redis!");
});

redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});

// Ensure the Redis client connects before handling any requests
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error("Error connecting to Redis:", err);
  }
})();

// Helper function to generate random OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString(); // Generates a 6-digit OTP
};

// Validate email format
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Configure NodeMailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail", // You can replace this with other services like Yahoo or Outlook
  auth: {
    user: process.env.GMAIL_USER,       // Your Gmail address
    pass: process.env.GMAIL_PASS,         // App password (not your Gmail password)
  },
});


exports.sendNotificationtoAdmin = async (id_survey,nama_lengkap,kompensasi,nama_bank,email,nomor_rekening) => {
  try {
    // Validasi input
    if (!nama_lengkap || !kompensasi || !nama_bank || !id_survey || !email||!nomor_rekening) {
      throw new Error("Semua data transaksi harus diisi!");
    }

    // Konfigurasi email
    const mailOptions = {
      from: `"Survey Scout" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Konfirmasi Transaksi Survey",
      html: `
      <p>Tenaga Kerja Atas Nama:<strong>${nama_lengkap}</strong>, telah menyelesaikan projek dengan ID <strong>${id_survey}</strong>.</p>
      <p>dengan kompensasi sebesar <strong>Rp${kompensasi}</strong> </p>
      <p>nomor rekening penerima: <strong>${nomor_rekening}-${nama_bank}</strong>.</p>
      <br>
      <p>Mohon untuk segera melakukan Transfer ke Rekening Tersebut</p>
    `,
    };

    // Kirim email
    const info = await transporter.sendMail(mailOptions);
    
    return { success: true, message: "Email berhasil dikirim", info };
  } catch (error) {
    return { success: false, message: error.message };
  }
};


// Controller: Generate OTP
exports.generateOTP = (email,req,res) => {
  if (!email || !validateEmail(email)) {
    return res.status(400).json({ error: "Invalid email address!" });
  }

  const otp = generateOTP();
  const expirationTime = 900; // 15 minutes

  // Save OTP in Redis
  redisClient
    .set(email, otp, { EX: expirationTime }) // Save OTP against the email in Redis
    .then(() => {
      // Send OTP via email using NodeMailer
      const mailOptions = {
        from: `"Survey Scout" <${process.env.GMAIL_USER}>`, // Sender's name and email
        to: email,                                     // Recipient's email
        subject: "Your OTP Code",
        text: `Your OTP code is: ${otp}`,              // OTP in plain text
      };

      return transporter.sendMail(mailOptions);
    })
    .then(() => {
      if (process.env.NODE_ENV === "development") {
        console.log(`OTP sent successfully to ${email}: ${otp}`);
      }
      res.status(200).json({
        message: "OTP sent successfully to your email!",
      });
    })
    .catch((err) => {
      console.error("Error sending OTP via email:", err);
      res.status(500).json({ error: "Internal Server Error" });
    });
};



exports.getStoredOTP = async (email,req, res) => {
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ error: "Invalid email address!" });
    }
  
    try {
      const otp = await redisClient.get(email);
      if (otp) {
        return res.status(200).json({ email, otp });
      } else {
        return res.status(404).json({ message: "OTP not found or expired!" });
      }
    } catch (err) {
      console.error("Error fetching OTP from Redis:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };
  

//verify OTP
exports.verifyOTP = async (email, otp,req, res) => {
    // Validate input
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required!" });
    }
  
    try {
      // Retrieve OTP from Redis
      const storedOtp = await redisClient.get(email);
  
      if (!storedOtp) {
        return res.status(400).json({ error: "OTP expired or not found!" });
      }
  
      if (storedOtp === otp) {
        await redisClient.del(email);
        // Generate a password reset token (e.g., JWT)
        const resetToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '15m' });
  
        return res.status(200).json({
          message: "OTP verified successfully!",
          resetToken, // Send this token to the client
        });
      } else {
        return res.status(400).json({ error: "Invalid OTP!" });
      }
    } catch (err) {
      console.error("Error verifying OTP:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };

  // Controller: Reset Password
exports.resetPassword = async (req, res) => {
    const { resetToken,newPassword } = req.body;
  
    // Validate input
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: "Reset token and new password are required!" });
    }
  
    try {
      // Verify the reset token
      const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
      const email = decoded.email;
  
      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
  
      // Update the user's password in the database
      const result = await query(
        'UPDATE user_table SET password = $1 WHERE email = $2 RETURNING *',
        [hashedPassword, email]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found!" });
      }
  
      res.status(200).json({ message: "Password updated successfully!" });
    } catch (err) {
      console.error("Error resetting password:", err);
      if (err.name === 'TokenExpiredError') {
        return res.status(400).json({ error: "Reset token expired!" });
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  };
  
  