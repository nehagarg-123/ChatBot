import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { generate } from '../ragbot.js';
import Thread from '../models/Thread.js';
import User from '../models/User.js';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.use(authMiddleware);

async function updateUserMemory(userId, userMessage, assistantReply, currentMemory) {
    try {
        const extraction = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            temperature: 0,
            messages: [
                {
                    role: 'system',
                    content: `You extract personal facts about the user from conversations.
                    Only extract clear, explicit facts like name, age, location, job, preferences etc.
                    If there is nothing new to remember, reply with exactly: NOTHING
                    If there is something new, reply with a short fact like: "User's name is John."
                    Do not repeat facts already in memory.
                    Current memory: ${currentMemory || 'empty'}`,
                },
                {
                    role: 'user',
                    content: `User said: "${userMessage}"\nAssistant replied: "${assistantReply}"`,
                },
            ],
        });

        const extracted = extraction.choices[0].message.content.trim();
        if (extracted !== 'NOTHING' && extracted.length > 0) {
            const newMemory = currentMemory ? `${currentMemory}\n${extracted}` : extracted;
            await User.findByIdAndUpdate(userId, { memory: newMemory });
            return newMemory;
        }
        return currentMemory;
    } catch {
        return currentMemory;
    }
}

router.post('/', async (req, res) => {
    try {
        if (!req.body) return res.status(400).json({ message: 'Request body is missing.' });

        const message = req.body?.message;
        const threadId = req.body?.threadId;
        const userId = req.userId;

        if (!message || !threadId) {
            return res.status(400).json({ message: 'message and threadId are required.' });
        }

        const user = await User.findById(userId).select('name memory');
        const result = await generate(message, threadId, user.name, user.memory, userId);

        updateUserMemory(userId, message, result, user.memory);

        await Thread.findOneAndUpdate(
            { threadId, userId },
            {
                $push: {
                    messages: {
                        $each: [
                            { role: 'user', content: message },
                            { role: 'assistant', content: result },
                        ],
                    },
                },
                $setOnInsert: { title: message.slice(0, 60) },
            },
            { upsert: true, new: true }
        );

        res.json({ message: result });
    } catch (err) {
        console.error('❌ Chat error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

router.get('/threads', async (req, res) => {
    try {
        const threads = await Thread.find({ userId: req.userId })
            .select('threadId title updatedAt')
            .sort({ updatedAt: -1 });
        res.json({ threads });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

router.get('/threads/:threadId', async (req, res) => {
    try {
        const thread = await Thread.findOne({
            threadId: req.params.threadId,
            userId: req.userId,
        });
        if (!thread) return res.status(404).json({ message: 'Thread not found.' });
        res.json({ thread });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

router.delete('/threads/:threadId', async (req, res) => {
    try {
        await Thread.findOneAndDelete({ threadId: req.params.threadId, userId: req.userId });
        res.json({ message: 'Thread deleted.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

export default router;