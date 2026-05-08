// chatbot.js — AI Chatbot using HF Mistral-7B-Instruct
import { showToast } from './toast.js';
import { getNewsSummary } from './news.js';
import { updateStatus } from './main.js';

const HF_TOKEN = import.meta.env.VITE_HF_TOKEN;
const HF_MODEL = 'google/gemma-3-27b-it';
const HF_URL = 'https://router.huggingface.co/v1/chat/completions';
const STORAGE_KEY = 'chatbot_messages';
const MAX_HISTORY = 30;

let messages = [];    // { role: 'user'|'bot', text: string }
let isTyping = false;

// ── Persist messages ───────────────────────────────────────
function saveMessages() {
  try {
    const trimmed = messages.slice(-MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

function loadMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) messages = JSON.parse(raw);
  } catch { messages = []; }
}

// ── Build dashboard context ────────────────────────────────
function buildContext() {
  const iss = window.__issData || {};
  const newsSum = getNewsSummary();

  return `[DASHBOARD DATA — USE ONLY THIS]
ISS Position: Latitude ${iss.lat?.toFixed(3) ?? 'N/A'}, Longitude ${iss.lon?.toFixed(3) ?? 'N/A'}
ISS Speed: ${iss.speedKmh ? iss.speedKmh.toFixed(2) + ' km/h' : 'Calculating...'}
ISS Location: ${iss.locationName ?? 'Unknown'}
Tracked Positions: ${iss.trackedCount ?? 0}
Last Updated: ${iss.timestamp ?? 'N/A'}

Top News Headlines (${window.__newsData?.category || 'breaking'}):
${newsSum || 'No news loaded yet.'}

[STRICT RULE] You are an assistant for this dashboard only. Answer ONLY using the above data. If the user asks anything outside this data, reply: "I can only answer questions about the current ISS tracking data and news articles shown on this dashboard."`;
}

// ── Build prompt for Mistral Instruct ─────────────────────
function buildPrompt(userText) {
  const ctx = buildContext();
  return `${ctx}\n\nUser: ${userText}`;
}

// ── Call HF Inference API ──────────────────────────────────
async function callHF(userText) {
  if (!HF_TOKEN) {
    throw new Error('Hugging Face Token is missing! Please add VITE_HF_TOKEN to your .env file.');
  }

  const ctx = buildContext();
  const history = messages.slice(-10).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.text
  }));

  const r = await fetch(HF_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: HF_MODEL,
      messages: [
        { role: 'system', content: ctx },
        ...history,
        { role: 'user', content: userText }
      ],
      max_tokens: 256,
      temperature: 0.4,
    }),
  });

  if (!r.ok) {
    const errData = await r.json().catch(() => ({}));
    if (r.status === 503) throw new Error('Model is loading, please try again in 30s');
    throw new Error(errData.error?.message || `HF API error ${r.status}`);
  }

  const data = await r.json();
  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content.trim();
  }
  throw new Error('Unexpected response from AI');
}

// ── Render messages ────────────────────────────────────────
function renderMessages() {
  const container = document.getElementById('chatbot-messages');
  if (!container) return;
  container.innerHTML = messages.map(m => `
    <div class="chat-msg ${m.role === 'user' ? 'user' : 'bot'}">${escHtml(m.text)}</div>
  `).join('');
  container.scrollTop = container.scrollHeight;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Set typing indicator ───────────────────────────────────
function setTyping(on) {
  isTyping = on;
  const el = document.getElementById('chatbot-typing');
  const btn = document.getElementById('chatbot-send-btn');
  if (el) el.classList.toggle('hidden', !on);
  if (btn) btn.disabled = on;
}

// ── Predictable Fallbacks (Offline Mode) ───────────────────
function getFallbackResponse(userText) {
  const text = userText.toLowerCase();
  const iss = window.__issData || {};
  const newsSum = getNewsSummary();

  if (text === 'hi' || text === 'hello' || text === 'hey') {
    return "Hello! I'm your Mission Control assistant. I can help you with ISS tracking data, orbital speed, or the latest news headlines. What would you like to know?";
  }

  if (text.includes('where') || text.includes('location') || text.includes('position') || text.includes('coord')) {
    return `The International Space Station is currently at Latitude ${iss.lat?.toFixed(3) ?? 'N/A'} and Longitude ${iss.lon?.toFixed(3) ?? 'N/A'}. It's currently flying over: ${iss.locationName ?? 'Unknown area'}.`;
  }
  
  if (text.includes('speed') || text.includes('fast') || text.includes('velocity')) {
    return `The ISS is orbiting the Earth at a speed of approximately ${iss.speedKmh ? iss.speedKmh.toFixed(2) + ' km/h' : 'calculating speed...'}.`;
  }
  
  if (text.includes('news') || text.includes('headline') || text.includes('happening')) {
    if (!newsSum) return "I don't have any news headlines loaded at the moment. Please wait a second for the feed to refresh.";
    return `Here are the top headlines for ${window.__newsData?.category || 'general'} news:\n${newsSum}`;
  }

  if (text.includes('thank')) {
    return "You're very welcome! Is there anything else I can help you find on the dashboard?";
  }

  if (text.includes('how are you')) {
    return "I'm operating at peak efficiency! Ready to provide you with real-time ISS and news intelligence. How about you?";
  }

  if (text.includes('astronaut') || text.includes('people') || text.includes('who is in space')) {
    const people = window.__peopleData;
    if (people && people.number) {
      return `There are currently ${people.number} people in space. Some of them include: ${people.people.slice(0, 3).map(p => p.name).join(', ')}... You can see the full list on the dashboard!`;
    }
    return "I'm not sure exactly how many people are in space right now, but you can check the 'People in Space' section on the dashboard for the latest count.";
  }

  if (text.includes('time') || text.includes('updated')) {
    return `The latest ISS data was received at ${iss.timestamp || 'N/A'}. The dashboard polls for updates every 15 seconds.`;
  }
  
  if (text.includes('help') || text.includes('what') || text.includes('can') || text.includes('purpose') || text.includes('who are you')) {
    return "I am the Mission Control AI Assistant. I specialize in interpreting the data on this dashboard, including ISS tracking, orbital metrics, and global news feeds. Try asking: 'Where is the ISS?' or 'What's the news?'";
  }

  // Generic fallback if no keywords match but API is down
  return "I understand you're asking something specific, but my AI core is currently at its API limit. However, I can still provide any dashboard data (ISS position, speed, or news) if you ask about those!";
}

// ── Send message ───────────────────────────────────────────
async function sendMessage(text) {
  if (!text.trim() || isTyping) return;
  messages.push({ role: 'user', text: text.trim() });
  saveMessages();
  renderMessages();
  setTyping(true);

  try {
    const reply = await callHF(text.trim());
    messages.push({ role: 'bot', text: reply });
    updateStatus('chat', 'online');
  } catch (err) {
    console.warn('Chatbot API error, using fallback:', err.message);
    
    // Simulate network delay for a more realistic "mock" feel
    await new Promise(r => setTimeout(r, 600)); 

    const fallback = getFallbackResponse(text.trim());
    messages.push({ role: 'bot', text: fallback });
    showToast('AI Offline: Using local fallback', 'info', 2000);
    updateStatus('chat', 'fallback');
  }

  setTyping(false);
  saveMessages();
  renderMessages();
}

// ── Toggle panel visibility ────────────────────────────────
function togglePanel(open) {
  const panel = document.getElementById('chatbot-panel');
  if (!panel) return;
  panel.classList.toggle('chatbot-hidden', !open);
  if (open) {
    renderMessages();
    document.getElementById('chatbot-input')?.focus();
  }
}

// ── Init chatbot ───────────────────────────────────────────
export function initChatbot() {
  loadMessages();

  // Add welcome message if empty
  if (messages.length === 0) {
    messages.push({ role: 'bot', text: 'Hello! I can answer questions about the ISS location, speed, and current news headlines shown on this dashboard. How can I help?' });
    saveMessages();
  }

  const fab = document.getElementById('chatbot-fab');
  const closeBtn = document.getElementById('chatbot-close-btn');
  const clearBtn = document.getElementById('chatbot-clear-btn');
  const sendBtn = document.getElementById('chatbot-send-btn');
  const input = document.getElementById('chatbot-input');

  fab?.addEventListener('click', () => togglePanel(true));
  closeBtn?.addEventListener('click', () => togglePanel(false));

  clearBtn?.addEventListener('click', () => {
    messages = [{ role: 'bot', text: 'Chat cleared! Ask me anything about ISS tracking or news headlines.' }];
    saveMessages();
    renderMessages();
    showToast('Chat cleared', 'info');
  });

  sendBtn?.addEventListener('click', () => {
    const val = input?.value?.trim();
    if (val) { input.value = ''; sendMessage(val); }
  });

  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const val = input.value.trim();
      if (val) { input.value = ''; sendMessage(val); }
    }
  });
}
