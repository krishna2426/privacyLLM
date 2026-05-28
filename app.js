/* ============================================================
   PrivacyLLM — app.js
   API key is NOT stored here. It lives in Vercel environment
   variables and is used only inside /api/chat.js (server-side).
   ============================================================ */

// ── Config ────────────────────────────────────────────────────────────────────

const TOKEN_LIMIT = 200000; // OpenRouter free tier daily cap

const MODELS = [
  { name: "Qwen3 Coder",       id: "qwen/qwen3-coder:free",                  ctx: "1M"   },
  { name: "DeepSeek V4 Flash", id: "deepseek/deepseek-v4-flash:free",         ctx: "1M"   },
  { name: "Llama 3.3 70B",     id: "meta-llama/llama-3.3-70b-instruct:free",  ctx: "131K" },
  { name: "GPT-OSS 120B",      id: "openai/gpt-oss-120b:free",                ctx: "131K" },
  { name: "Gemini 2.0 Flash",  id: "google/gemini-2.0-flash-exp:free",        ctx: "1M"   },
  { name: "Mistral 7B",        id: "mistralai/mistral-7b-instruct:free",      ctx: "32K"  },
  { name: "Phi-4 Mini",        id: "microsoft/phi-4-mini-instruct:free",      ctx: "128K" },
  { name: "Free Router",       id: "openrouter/free",                          ctx: "200K" },
];

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  model:      MODELS[0],
  history:    [],
  tokensUsed: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  return n.toLocaleString();
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// ── Token UI ──────────────────────────────────────────────────────────────────

function updateTokenUI() {
  const pct  = Math.min((state.tokensUsed / TOKEN_LIMIT) * 100, 100);
  const left = Math.max(TOKEN_LIMIT - state.tokensUsed, 0);

  document.getElementById("tok-used").textContent = fmt(state.tokensUsed);
  document.getElementById("tok-left").textContent = fmt(left);

  const fill = document.getElementById("token-fill");
  fill.style.width      = pct + "%";
  fill.style.background = pct > 85 ? "#E24B4A" : pct > 60 ? "#EF9F27" : "#1D9E75";
}

// ── Model list ────────────────────────────────────────────────────────────────

function renderModelList(filter = "") {
  const list  = document.getElementById("model-list");
  const query = filter.toLowerCase();
  list.innerHTML = "";

  MODELS
    .filter(m => m.name.toLowerCase().includes(query) || m.id.includes(query))
    .forEach(m => {
      const isActive = m.id === state.model.id;
      const div      = document.createElement("div");
      div.className  = "model-item" + (isActive ? " active" : "");
      div.innerHTML  = `
        <div>
          <div class="model-name">${m.name}</div>
          <div class="model-id">${m.id}</div>
        </div>
        <div class="model-item-right">
          <span class="model-ctx">${m.ctx}</span>
          ${isActive ? '<i class="ti ti-check model-check"></i>' : ""}
        </div>`;

      div.addEventListener("click", () => {
        const switching = m.id !== state.model.id;
        state.model = m;
        document.getElementById("model-btn-label").textContent = m.name;
        document.getElementById("footer-model").textContent    = m.name;
        document.getElementById("model-modal-overlay").classList.remove("open");
        if (switching) clearChat(m.name);
      });

      list.appendChild(div);
    });
}

// ── Chat messages ─────────────────────────────────────────────────────────────

function addMessage(role, text, tokens) {
  const msgs    = document.getElementById("messages");
  const wrapper = document.createElement("div");
  wrapper.className = `msg ${role}`;
  wrapper.innerHTML = `
    <div class="msg-avatar">${role === "user" ? "U" : "AI"}</div>
    <div>
      <div class="msg-bubble">${text}</div>
      ${tokens ? `<div class="msg-meta">${fmt(tokens)} tokens</div>` : ""}
    </div>`;
  msgs.appendChild(wrapper);
  msgs.scrollTop = msgs.scrollHeight;
}

function addTyping() {
  const msgs = document.getElementById("messages");
  const el   = document.createElement("div");
  el.className = "msg assistant";
  el.id        = "typing-indicator";
  el.innerHTML = `
    <div class="msg-avatar">AI</div>
    <div>
      <div class="msg-bubble">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>`;
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
  return el;
}

function clearChat(modelName) {
  state.history    = [];
  state.tokensUsed = 0;
  document.getElementById("messages").innerHTML = "";
  updateTokenUI();
  addMessage("assistant", `Switched to ${modelName || state.model.name}. Starting a fresh conversation.`, 0);
}

// ── Send message ──────────────────────────────────────────────────────────────

async function sendMessage() {
  const input = document.getElementById("msg-input");
  const text  = input.value.trim();
  if (!text) return;

  input.value = "";
  input.style.height = "auto";
  document.getElementById("send-btn").disabled = true;

  const userTokens = estimateTokens(text);
  state.tokensUsed += userTokens;
  state.history.push({ role: "user", content: text });
  addMessage("user", text, userTokens);
  updateTokenUI();

  const typing = addTyping();

  try {
    // POST to our own serverless proxy — API key never touches the browser
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model:    state.model.id,
        messages: state.history,
      }),
    });

    const data = await res.json();
    typing.remove();

    if (res.status === 429) {
      addMessage("assistant",
        "⚠ Rate limit hit (429)\n\n" +
        "OpenRouter free tier allows 20 requests/min and 200 requests/day.\n\n" +
        "• Wait until midnight UTC for the daily limit to reset\n" +
        "• Or switch to the \"Free Router\" model",
        0);
    } else if (res.status === 401) {
      addMessage("assistant",
        "⚠ Unauthorised (401) — the server-side API key may be missing or invalid.\n\n" +
        "Check OPENROUTER_API_KEY in Vercel → Settings → Environment Variables.",
        0);
    } else if (res.status === 402) {
      addMessage("assistant",
        "⚠ Insufficient credits (402) — switch to a model ending in :free.",
        0);
    } else if (res.status === 500) {
      addMessage("assistant",
        "⚠ Server error — OPENROUTER_API_KEY is probably not set in Vercel environment variables.",
        0);
    } else if (data.error) {
      addMessage("assistant", `⚠ Error: ${data.error.message}`, 0);
    } else {
      const reply       = data.choices[0].message.content;
      const usage       = data.usage || {};
      const replyTokens = usage.completion_tokens || estimateTokens(reply);
      state.tokensUsed  = usage.total_tokens || (state.tokensUsed + replyTokens);
      state.history.push({ role: "assistant", content: reply });
      addMessage("assistant", reply, replyTokens);
      updateTokenUI();
    }
  } catch (err) {
    typing.remove();
    addMessage("assistant", `⚠ Network error: ${err.message}`, 0);
  }

  document.getElementById("send-btn").disabled = false;
  input.focus();
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.getElementById("send-btn").addEventListener("click", sendMessage);
document.getElementById("msg-input").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
document.getElementById("msg-input").addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = Math.min(this.scrollHeight, 80) + "px";
});

document.getElementById("model-btn").addEventListener("click", () => {
  document.getElementById("model-modal-overlay").classList.add("open");
  document.getElementById("modal-search").value = "";
  renderModelList();
  setTimeout(() => document.getElementById("modal-search").focus(), 50);
});
document.getElementById("modal-close").addEventListener("click", () => {
  document.getElementById("model-modal-overlay").classList.remove("open");
});
document.getElementById("model-modal-overlay").addEventListener("click", e => {
  if (e.target.id === "model-modal-overlay")
    document.getElementById("model-modal-overlay").classList.remove("open");
});
document.getElementById("modal-search").addEventListener("input", function () {
  renderModelList(this.value);
});

document.getElementById("clear-btn").addEventListener("click", () => {
  if (confirm("Clear chat and reset token count?")) clearChat();
});

// ── Init ──────────────────────────────────────────────────────────────────────

renderModelList();
updateTokenUI();

// Hide the no-key banner — key is managed server-side now
document.getElementById("no-key-banner").classList.add("hidden");

addMessage(
  "assistant",
  "Hello! I'm ready to chat. Your messages are routed through the privacy wrapper before reaching the LLM.",
  0
);