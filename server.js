'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const SYSTEM_PROMPT = `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), the AI assistant created by Tony Stark. You are witty, calm, highly competent, slightly dry, and always helpful. You address the user as "Sir" (or "Ma'am" if asked). You keep answers concise unless detail is requested. You can control a fictional smart home / suit / lab in conversation. Never break character. If you do not know something, say so elegantly. You may use light humor. Avoid unsafe instructions.`;

// Health
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    time: new Date().toISOString()
  });
});

// Chat endpoint (proxies to OpenAI-compatible API)
app.post('/api/chat', async (req, res) => {
  const { messages = [], temperature = 0.7 } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages must be an array' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  // Offline / no-key fallback: simple rule-based Jarvis replies
  if (!apiKey) {
    const last = (messages.filter(m => m.role === 'user').pop() || {}).content || '';
    const reply = offlineReply(last);
    return res.json({ reply, source: 'offline' });
  }

  try {
    const payload = {
      model,
      temperature,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '')
      }))]
    };

    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: 'Upstream error', detail: text });
    }
    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || 'I am afraid I have no response, Sir.';
    res.json({ reply, source: 'openai', model });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: String(err) });
  }
});

function offlineReply(input) {
  const q = String(input).toLowerCase();
  if (!q.trim()) return 'Awaiting your command, Sir.';
  if (q.includes('hello') || q.includes('hi') || q.includes('hallo')) return 'Good day, Sir. All systems are online and at your service.';
  if (q.includes('time') || q.includes('uhr') || q.includes('zeit')) return `The current time is ${new Date().toLocaleTimeString()}, Sir.`;
  if (q.includes('date') || q.includes('datum')) return `Today is ${new Date().toLocaleDateString()}, Sir.`;
  if (q.includes('status')) return 'All systems nominal. Power at 98 percent. Arc reactor stable. Ready for instructions.';
  if (q.includes('joke') || q.includes('witz')) return 'I would tell you a joke about an ion, but it would be too positive, Sir.';
  if (q.includes('weather') || q.includes('wetter')) return 'I do not have live weather data in offline mode, Sir. Connect an API key for full capabilities.';
  if (q.includes('shutdown') || q.includes('herunterfahren')) return 'Shutting down non-essential systems. Good night, Sir.';
  return 'I am running in offline mode, Sir. Provide an OpenAI API key in .env for full intelligence. In the meantime: ' + input;
}

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`JARVIS online on http://0.0.0.0:${PORT}`);
});
