import dotenv from 'dotenv';
dotenv.config();

import Groq from 'groq-sdk';
import { tavily } from '@tavily/core';
import NodeCache from 'node-cache';
import fs from 'fs';
import { pipeline } from '@xenova/transformers';
import User from './models/User.js';
import { ChromaClient } from 'chromadb';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
const cache = new NodeCache({ stdTTL: 60 * 60 * 24 });


const chromaClient = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8000' });

let collectionPromise = null;
function getCollection() {
    if (!collectionPromise) {
        collectionPromise = chromaClient.getOrCreateCollection({ name: 'pdf_chunks' });
    }
    return collectionPromise;
}

const CHUNK_SIZE = 800;      // characters per chunk
const CHUNK_OVERLAP = 150;   // overlap between consecutive chunks
const TOP_K = 4;             // chunks retrieved per question


let embedderPromise = null;
function getEmbedder() {
    if (!embedderPromise) {
        embedderPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return embedderPromise;
}

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + size, text.length);
        const chunk = text.slice(start, end).trim();
        if (chunk.length > 0) chunks.push(chunk);
        start += size - overlap;
    }
    return chunks;
}



export async function loadPDFForUser(userId, filePath) {
    console.log(`📄 Loading PDF for user ${userId}...`);

    try {
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

        // Keep a copy in Mongo for reference (raised cap since we no longer
        // rely on this being short enough to stuff into a prompt directly).
        await User.findByIdAndUpdate(userId, { pdfText: text.slice(0, 200000) });

        // Real RAG indexing: chunk the full document, embed every chunk.
                // Real RAG indexing: chunk the full document, embed every chunk, store in Chroma.
        const chunks = chunkText(text);
        const embedder = await getEmbedder();
        const collection = await getCollection();

        await collection.delete({ where: { userId } }).catch(() => {});

        const ids = [];
        const embeddings = [];
        const documents = [];
        const metadatas = [];

        for (let i = 0; i < chunks.length; i++) {
            const output = await embedder(chunks[i], { pooling: 'mean', normalize: true });
            ids.push(`${userId}_${i}`);
            embeddings.push(Array.from(output.data));
            documents.push(chunks[i]);
            metadatas.push({ userId, chunkIndex: i });
        }

        if (ids.length > 0) {
            await collection.add({ ids, embeddings, documents, metadatas });
        }

        console.log(`✅ PDF indexed: ${ids.length} chunks`);
        return ids.length;
    } catch (err) {
        console.error('❌ PDF parse error:', err.message);
        throw new Error('PDF parsing failed: ' + err.message);
    }
}

export async function clearPDFForUser(userId) {
    const collection = await getCollection();
    await collection.delete({ where: { userId } }).catch(() => {});
}

async function retrieveRelevantChunks(userId, query, topK = TOP_K) {
    const collection = await getCollection();
    const embedder = await getEmbedder();
    const output = await embedder(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(output.data);

    const result = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
        where: { userId },
    });

    const docs = result.documents?.[0] || [];
    if (docs.length === 0) return null;
    return docs.join('\n\n---\n\n');
}

function buildSystemPrompt(userName, userMemory, relevantPdfContent) {
    return `You are a smart personal assistant.
${userName ? `The user's name is: ${userName}.` : ''}
${userMemory ? `Things you know about this user:\n${userMemory}` : ''}
${relevantPdfContent ? `The user has uploaded a PDF document. Here are the most relevant excerpts for this specific question:\n\n${relevantPdfContent}\n\nUse these excerpts to answer questions about the document. If they don't contain the answer, say so honestly.` : ''}

If you know the answer, reply directly.
If the answer needs real-time or current info, use the webSearch tool.
Do not mention tools unless necessary.
Current date and time: ${(() => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.toISOString().replace('T', ' ').replace('Z', '') + ' IST';
})()}`;
}

export async function generate(userMessage, threadId, userName = '', userMemory = '', userId = '') {
    const relevantPdfContent = userId ? await retrieveRelevantChunks(userId, userMessage) : null;

    // Pull existing thread history, but rebuild the system message fresh
    // every turn so retrieval reflects THIS question, not just the first one.
    const messages = cache.get(threadId) ?? [];
    const systemMessage = {
        role: 'system',
        content: buildSystemPrompt(userName, userMemory, relevantPdfContent),
    };

    if (messages.length > 0 && messages[0].role === 'system') {
        messages[0] = systemMessage;
    } else {
        messages.unshift(systemMessage);
    }

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
