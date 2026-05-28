// ============================================================
//  PrivacyLLM — api/chat.js
//  Vercel serverless proxy for OpenRouter API
//
//  The API key never reaches the browser.
//  Set OPENROUTER_API_KEY in Vercel → Settings → Environment Variables.
//
//  This function is also the right place to plug in Phase 2
//  privacy logic (PII scrubbing, keyword filtering, audit log)
//  before the request is forwarded to the LLM.
// ============================================================

export default async function handler(req, res) {

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured on server." });
  }

  const { model, messages } = req.body;

  if (!model || !messages) {
    return res.status(400).json({ error: "Missing model or messages in request body." });
  }

  // ── Phase 2: Privacy layer goes here ─────────────────────────────────────
  // const sanitisedMessages = privacyWrapper(messages);
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer":  "https://privacyllm.vercel.app",
        "X-Title":       "PrivacyLLM",
      },
      body: JSON.stringify({ model, messages }),
    });

    const data = await upstream.json();

    // Forward the exact status code from OpenRouter (429, 401, etc.)
    return res.status(upstream.status).json(data);

  } catch (err) {
    return res.status(502).json({ error: `Proxy error: ${err.message}` });
  }
}