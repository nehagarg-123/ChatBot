import dotenv from 'dotenv';
dotenv.config();

import Groq from 'groq-sdk';
import { tavily } from '@tavily/core';
import NodeCache from 'node-cache';
import fs from 'fs';
import { createRequire } from 'module';          // ✅ add this
const require = createRequire(import.meta.url);   // ✅ add this
const pdfParse = require('pdf-parse');            // ✅ change this

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
const cache = new NodeCache({ stdTTL: 60 * 60 * 24 });

// rest of the file stays the same...

// Store PDF text per user
export const userPDFContent = new Map();

export async function loadPDFForUser(userId, filePath) {
    console.log(`📄 Loading PDF for user ${userId}...`);
    const buffer = fs.readFileSync(filePath);
    const parsed = await pdfParse(buffer);
    const text = parsed.text.slice(0, 15000);
    userPDFContent.set(userId, text);
    console.log(`✅ PDF loaded: ${text.length} characters`);
    return text.length;
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
${pdfContent ? `The user has uploaded a PDF. Its content is:\n\n${pdfContent}\n\nAnswer questions about it using this content.` : ''}

If you know the answer, reply directly.
If the answer needs real-time info, use the webSearch tool.
Current date and time: ${new Date().toUTCString()}`,
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