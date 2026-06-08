import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ChatRequest, ChatResponse } from './types';

const SYSTEM_PROMPT =
  'You are a helpful coding tutor built into the Praxly IDE. ' +
  'Praxly supports Praxis pseudocode, Python, Java, and CSP (a pseudocode used in AP CS Principles). ' +
  'The student is working on code in the editor and their code is included with each question. ' +
  'Give clear, concise answers aimed at K-12 students learning to code. ' +
  'Guide the student to understand rather than just dumping the full answer.';

export async function callGemini(req: ChatRequest): Promise<ChatResponse> {
  const apiKey = process.env.GEMINI_API_KEY;

  // Stub mode when no key is configured — lets the UI be tested without a key.
  if (!apiKey) {
    return {
      reply: `[stub — no GEMINI_API_KEY set] You asked: "${req.message}" (language: ${req.language})`,
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
  });

  const userMessage = req.code.trim()
    ? `The student is working in ${req.language}. Here is their code:\n\`\`\`\n${req.code}\n\`\`\`\n\nQuestion: ${req.message}`
    : req.message;

  const result = await model.generateContent(userMessage);
  return { reply: result.response.text() };
}
