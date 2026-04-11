const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',  // ✅ this must be set
        ...options.headers,
    };

    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers,  // ✅ headers must come AFTER ...options spread
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Something went wrong');
    return data;
}

export const api = {
    register: (body) =>
        request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),

    login: (body) =>
        request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),

    sendMessage: (token, body) =>
        request('/api/chat', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        }),

    getThreads: (token) =>
        request('/api/chat/threads', {
            headers: { Authorization: `Bearer ${token}` },
        }),

    getThread: (token, threadId) =>
        request(`/api/chat/threads/${threadId}`, {
            headers: { Authorization: `Bearer ${token}` },
        }),

    deleteThread: (token, threadId) =>
        request(`/api/chat/threads/${threadId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        }),
};