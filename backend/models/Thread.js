import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

const threadSchema = new mongoose.Schema(
    {
        threadId: { type: String, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        title: { type: String, default: 'New Chat' },
        messages: [messageSchema],
    },
    { timestamps: true }
);

// Compound index: one threadId per user
threadSchema.index({ threadId: 1, userId: 1 }, { unique: true });

export default mongoose.model('Thread', threadSchema);