import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../middleware/auth.js';
import { loadPDFForUser, clearPDFForUser } from '../ragbot.js';  // ✅ fixed import

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads';
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${req.userId}_${Date.now()}${path.extname(file.originalname)}`);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Only PDF files are allowed'), false);
    },
    limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/upload', authMiddleware, upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No PDF file uploaded.' });
        const chunkCount = await loadPDFForUser(req.userId, req.file.path);
        res.json({
            message: `PDF uploaded successfully! (${chunkCount} characters indexed)`,
            filename: req.file.originalname,
            chunkCount,
        });
    } catch (err) {
        console.error('PDF upload error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

router.delete('/clear', authMiddleware, (req, res) => {
    clearPDFForUser(req.userId);   // ✅ fixed — no more require()
    res.json({ message: 'PDF cleared.' });
});

export default router;
