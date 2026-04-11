import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import pdfRoutes from './routes/pdf.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => res.send('Welcome to ChatDPT!'));
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/pdf', pdfRoutes);

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB connected ✅');
        app.listen(port, () => console.log(`Server is running on port: ${port}`));
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });