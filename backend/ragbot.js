import dotenv from 'dotenv';
dotenv.config();

import Groq from 'groq-sdk';
import { tavily } from '@tavily/core';
import NodeCache from 'node-cache';
import fs from 'fs';
import path from 'path';
import User from './models/User.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
const cache = new NodeCache({ stdTTL: 60 * 60 * 24 });

export const userPDFContent = new Map();

export async function loadPDFForUser(userId, filePath) {
    console.log(`📄 Loading PDF for user ${userId}...`);

    try {
        // ✅ pdfjs-dist fully supports ES modules
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

        const buffer = fs.readFileSync(filePath);
        const uint8Array = new Uint8Array(buffer);

        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const pdf = await loadingTask.promise;

        console.log(`📖 PDF has ${pdf.numPages} pages`);

        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map((item) => item.str).join(' ');
            text += pageText + '\n';
        }

        text = text.slice(0, 15000);
        userPDFContent.set(userId, text);
        await User.findByIdAndUpdate(userId, { pdfText: text });
        console.log('✅ PDF saved to MongoDB');
        console.log(`✅ PDF loaded: ${text.length} characters`);
        return text.length;
    } catch (err) {
        console.error('❌ PDF parse error:', err.message);
        throw new Error('PDF parsing failed: ' + err.message);
    }
}

export function clearPDFForUser(userId) {
    userPDFContent.delete(userId);
}

export async function generate(userMessage, threadId, userName = '', userMemory = '', userId = '') {
    const pdfContent = userId ? userPDFContent.get(userId) : null;

    const baseMessages = [
        {
            role: 'system',
            content: `You are a smart personal assistant.
${userName ? `The user's name is: ${userName}.` : ''}
${userMemory ? `Things you know about this user:\n${userMemory}` : ''}
${pdfContent ? `The user has uploaded a PDF document. Here is its content:\n\n${pdfContent}\n\nUse this content to answer questions about the document.` : ''}

If you know the answer, reply directly.
If the answer needs real-time or current info, use the webSearch tool.
If the user asks about their uploaded document, use the PDF content above.
Do not mention tools unless necessary.
Current date and time: ${(() => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.toISOString().replace('T', ' ').replace('Z', '') + ' IST';
})()}`,
        },
    ];

    const messages = cache.get(threadId) ?? baseMessages;
    messages.push({ role: 'user', content: userMessage });

    const MAX_RETRIES = 10;
    let count = 0;

    while (true) {
        if (count > MAX_RETRIES) return 'I could not find the result, please try again.';
        count++;

        const completions = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            temperature: 0,
            messages,
            tools: [
                {
                    type: 'function',
                    function: {
                        name: 'webSearch',
                        description: 'Search the internet for current or real-time information.',
                        parameters: {
                            type: 'object',
                            properties: {
                                query: { type: 'string', description: 'The search query.' },
                            },
                            required: ['query'],
                        },
                    },
                },
            ],
            tool_choice: 'auto',
        });

        messages.push(completions.choices[0].message);
        const toolCalls = completions.choices[0].message.tool_calls;

        if (!toolCalls) {
            cache.set(threadId, messages);
            return completions.choices[0].message.content;
        }

        for (const tool of toolCalls) {
            if (tool.function.name === 'webSearch') {
                const args = JSON.parse(tool.function.arguments);
                console.log('🔍 Web search:', args.query);
                const response = await tvly.search(args.query);
                const result = response.results.map((r) => r.content).join('\n\n');
                messages.push({
                    tool_call_id: tool.id,
                    role: 'tool',
                    name: 'webSearch',
                    content: result,
                });
            }
        }
    }
}
