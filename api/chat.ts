// Vercel Serverless Function (Node runtime): POST /api/chat
// Body: { prompt: string; model?: string }
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { prompt, model } = (req.body ?? {}) as { prompt?: string; model?: string };
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Missing prompt' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
      return;
    }

    // Validate/normalize model; fallback to gemini-2.5-flash if unknown
    let geminiModel = typeof model === 'string' && model ? model : 'gemini-2.5-flash';
    if (!geminiModel.startsWith('gemini-')) geminiModel = 'gemini-2.5-flash';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      res.status(502).json({ error: 'Gemini error', status: resp.status, body: text });
      return;
    }

    const data = await resp.json();
    const text = tryExtractText(data) ?? '';
    res.status(200).json({ text });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}

function tryExtractText(json: any): string | null {
  try {
    const cands = json?.candidates;
    if (!Array.isArray(cands) || !cands.length) return null;
    const parts = cands[0]?.content?.parts;
    if (!Array.isArray(parts)) return null;
    const textParts = parts.map((p: any) => p?.text).filter(Boolean);
    return textParts.length ? String(textParts.join('\n')) : null;
  } catch {
    return null;
  }
}

// CORS utilities were used for the Fetch API variant; not needed with same-origin calls


