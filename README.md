# PrivacyLLM

A lightweight, serverless chat interface for free-tier LLMs on [OpenRouter](https://openrouter.ai), built so the **API key never reaches the browser**.

**Live demo:** https://privacy-llm.vercel.app/

## Why this exists

Calling an LLM API straight from frontend JavaScript exposes your key to anyone who opens DevTools. PrivacyLLM puts a small Vercel serverless function between the browser and OpenRouter. The key lives only in a server-side environment variable, and the frontend talks to `/api/chat` instead of OpenRouter directly.

The proxy is also the intended home for a privacy layer (PII scrubbing, keyword filtering, audit logging). See the [Roadmap](#roadmap).

## Features

- **Secure key handling:** the OpenRouter key is read from `OPENROUTER_API_KEY` on the server and is never shipped to the client
- **Model switcher:** searchable list of 8 free models (Qwen3 Coder, DeepSeek V4 Flash, Llama 3.3 70B, GPT-OSS 120B, Gemini 2.0 Flash, Mistral 7B, Phi-4 Mini, and OpenRouter's Free Router)
- **Session token tracker:** a live progress bar against the 200K free-tier token budget, using the API's reported usage and a character-based estimate as fallback
- **Clear error handling:** friendly messages for rate limits (429), auth problems (401), credit issues (402) and server misconfiguration (500)
- **Zero build step:** plain HTML, CSS and JavaScript on the frontend, one Node.js function on the backend
- **Multi-turn context:** conversation history is sent with each request, and switching models starts a fresh chat

## Architecture

```
Browser (index.html + app.js)
        │  POST /api/chat  { model, messages }
        ▼
Vercel serverless function (api/chat.js)
        │  adds Authorization: Bearer $OPENROUTER_API_KEY
        ▼
OpenRouter  →  selected free model
```

The proxy accepts `POST` only, validates that `model` and `messages` are present, and forwards OpenRouter's status code and body back to the client unchanged.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, vanilla JavaScript, [Tabler Icons](https://tabler.io/icons) |
| Backend | Node.js on Vercel Serverless Functions |
| LLM access | OpenRouter API (free-tier models) |
| Hosting | Vercel |

## Project structure

```
privacyLLM/
├── api/
│   └── chat.js       # Serverless proxy to OpenRouter
├── app.js            # Chat UI logic, model list, token tracking
├── index.html        # App markup
├── style.css         # Styling
└── vercel.json       # API route rewrite
```

## Getting started

### Prerequisites

- An [OpenRouter](https://openrouter.ai/keys) API key (the free tier is enough)
- A [Vercel](https://vercel.com) account and the [Vercel CLI](https://vercel.com/docs/cli) for local development

### Run locally

```bash
git clone https://github.com/krishna2426/privacyLLM.git
cd privacyLLM

# Store your key in an untracked env file
echo "OPENROUTER_API_KEY=sk-or-v1-your-key-here" > .env.local

# Start the app and the serverless function together
vercel dev
```

Then open the URL printed in the terminal (usually http://localhost:3000).

> `vercel dev` is needed rather than a plain static server, because `/api/chat` is a serverless function.

### Deploy to Vercel

1. Import the repository in the [Vercel dashboard](https://vercel.com/new).
2. Go to **Settings → Environment Variables** and add `OPENROUTER_API_KEY`.
3. Deploy. No build command or output directory is required.

## Usage

1. Open the app and choose a model from the dropdown in the top bar.
2. Type a message and press **Enter** to send (**Shift+Enter** for a new line).
3. Watch the session token bar to stay within the free-tier budget.
4. Use the eraser icon to clear the chat and reset the counter.

## Free-tier limits

OpenRouter's free models are rate limited (roughly 20 requests per minute and 200 per day at the time of writing). If you hit a 429, wait for the daily reset (midnight UTC) or switch to the **Free Router** model. Limits and model availability can change, so check OpenRouter's documentation.

## Security notes

- The API key is stored only as a server-side environment variable. `.env*` files are git-ignored.
- Requests and responses still pass through Vercel and OpenRouter, and free-tier models may log or train on prompts. **Don't send sensitive personal or confidential data.** Today, the project protects your *API key*; it does not yet anonymise your *prompts*.

## Roadmap

- [ ] **Phase 2 privacy layer** in `api/chat.js`: PII detection and scrubbing, keyword filtering, and an audit log before requests are forwarded
- [ ] Streaming responses
- [ ] Safe rendering of model output (sanitised Markdown and code blocks)
- [ ] Rate limiting on the proxy to protect the shared key
- [ ] Persistent chat history

## Author

**Krishna Sharma**: [GitHub](https://github.com/krishna2426) · [LinkedIn](https://linkedin.com/in/krishna-sharma-112366215) · [Portfolio](https://krishna2426.github.io/portfolio/)
