import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { callGemini } from './providers/gemini';
import type { ChatRequest } from './providers/types';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const { message, language, code } = req.body as ChatRequest;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  try {
    const result = await callGemini({
      message,
      language: language ?? 'praxis',
      code: code ?? '',
    });
    res.json(result);
  } catch (err) {
    console.error('Gemini error:', err);
    res.status(500).json({ error: 'AI request failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Praxly AI server running on http://localhost:${PORT}`);
});
