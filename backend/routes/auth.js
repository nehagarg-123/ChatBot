import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import User from '../models/User.js';

const router = express.Router();

function signToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(409).json({ message: 'Email already in use.' });
        }

        const user = await User.create({ name, email, password });
        const token = signToken(user._id);

        res.status(201).json({
            token,
            user: { id: user._id, name: user.name, email: user.email },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const token = signToken(user._id);

        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required.' });
        }

        const user = await User.findOne({ email });

        // Always respond with the same message to prevent email enumeration
        if (!user) {
            return res.json({ message: 'If that email exists, a reset link has been sent.' });
        }

        // Generate a secure random token
        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        user.resetPasswordToken   = hashedToken;
        user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

        // Create transporter inside the route so .env vars are always loaded
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // Verify credentials before sending — throws a clear error if wrong
        await transporter.verify();

        const mailOptions = {
            from: `"ChatGPT Clone" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Password Reset Request',
            html: `
                <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 32px; background: #0a0a0a; color: #e5e5e5; border-radius: 12px;">
                    <h2 style="color: #ffffff; margin-bottom: 8px;">Reset your password</h2>
                    <p style="color: #a3a3a3; margin-bottom: 24px;">
                        We received a request to reset the password for your account.
                        Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.
                    </p>
                    <a href="${resetUrl}"
                       style="display: inline-block; background: #ffffff; color: #0a0a0a; font-weight: 600;
                              padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 14px;">
                        Reset Password
                    </a>
                    <p style="color: #525252; font-size: 12px; margin-top: 28px;">
                        If you didn't request this, you can safely ignore this email.
                        Your password will not change.
                    </p>
                    <hr style="border-color: #262626; margin-top: 32px;" />
                    <p style="color: #404040; font-size: 11px;">
                        Or copy this link into your browser:<br/>
                        <span style="color: #737373;">${resetUrl}</span>
                    </p>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);

        res.json({ message: 'If that email exists, a reset link has been sent.' });
    } catch (err) {
        console.error('Forgot-password error:', err);
        await User.updateOne(
            { email: req.body.email },
            { resetPasswordToken: null, resetPasswordExpires: null }
        );
        // Return the actual error message so you can see what's wrong
        res.status(500).json({ message: `Failed to send reset email: ${err.message}` });
    }
});

// POST /api/auth/reset-password/:token
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password || password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters.' });
        }

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken:   hashedToken,
            resetPasswordExpires: { $gt: new Date() },
        });

        if (!user) {
            return res.status(400).json({ message: 'Reset link is invalid or has expired.' });
        }

        user.password             = password;
        user.resetPasswordToken   = null;
        user.resetPasswordExpires = null;
        await user.save();

        res.json({ message: 'Password reset successful. You can now sign in.' });
    } catch (err) {
        console.error('Reset-password error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

export default router;
