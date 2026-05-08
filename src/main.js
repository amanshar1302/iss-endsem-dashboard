// main.js — App entry point
import './style.css';
import { initMap, startISSTracking, toggleAutoRefresh, manualRefresh } from './iss.js';
import { initNews } from './news.js';
import { initChatbot } from './chatbot.js';
import { initSpeedChart, updateChartTheme } from './charts.js';
import { showToast } from './toast.js';

// ── Theme ──────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  setTheme(saved);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? 'Switch to Light' : 'Switch to Dark';
  updateChartTheme();
}

// ── System Status Helper ───────────────────────────────────
export function updateStatus(id, status) {
  const dot = document.getElementById(`status-${id}`);
  if (dot) {
    // Online: Green, Offline: Red, Warning/Fallback: Orange
    let color = '#2ecc71';
    let shadow = 'rgba(46, 204, 113, 0.4)';
    
    if (status === 'offline') {
      color = '#e74c3c';
      shadow = 'rgba(231, 76, 60, 0.4)';
    } else if (status === 'warning' || status === 'fallback') {
      color = '#f39c12';
      shadow = 'rgba(243, 156, 18, 0.4)';
    }

    dot.style.background = color;
    dot.style.boxShadow = `0 0 8px ${shadow}`;
  }
}

async function checkSystemStatus() {
  // Check ISS
  try {
    const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
    updateStatus('iss', r.ok ? 'online' : 'offline');
  } catch { updateStatus('iss', 'offline'); }

  // Check News (always online because of RSS fallback)
  updateStatus('news', 'online');

  // Check Chatbot
  const hfToken = import.meta.env.VITE_HF_TOKEN;
  updateStatus('chat', hfToken ? 'online' : 'offline');
}

// ── ISS control buttons ────────────────────────────────────
function initISSControls() {
  document.getElementById('iss-refresh-btn')?.addEventListener('click', () => {
    manualRefresh();
  });
  document.getElementById('iss-auto-btn')?.addEventListener('click', () => {
    toggleAutoRefresh();
  });
}

// ── Bootstrap ──────────────────────────────────────────────
async function bootstrap() {
  initTheme();

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    setTheme(next);
    showToast(`Switched to ${next} mode`, 'info', 2000);
  });

  // Init speed chart first (before ISS starts pushing data)
  initSpeedChart();

  // Init Leaflet map
  initMap();

  // Wire ISS manual controls
  initISSControls();

  // Debug button
  document.getElementById('debug-btn')?.addEventListener('click', async () => {
    let report = "--- SYSTEM DIAGNOSTICS ---\n\n";
    
    // Test ISS
    try {
      const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
      report += `ISS API: ${r.status} ${r.statusText}\n`;
      if (r.ok) {
        const d = await r.json();
        report += `  > Lat: ${d.latitude}, Lon: ${d.longitude}\n`;
      }
    } catch (e) { report += `ISS API: Error (${e.message})\n`; }

    // Test News
    try {
      const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffeeds.bbci.co.uk%2Fnews%2Frss.xml`);
      report += `News API (RSS): ${r.status} ${r.statusText}\n`;
    } catch (e) { report += `News API: Error (${e.message})\n`; }

    // Test Chatbot
    try {
      const token = import.meta.env.VITE_HF_TOKEN;
      report += `HF Token: ${token ? 'Found (starts with ' + token.substring(0,4) + ')' : 'MISSING'}\n`;
      const r = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ model: 'google/gemma-3-27b-it', messages: [{role:'user', content:'hi'}], max_tokens: 5 })
      });
      report += `HF API: ${r.status} ${r.statusText}\n`;
      const d = await r.json();
      if (d.error) report += `  > HF Error: ${d.error.message || d.error}\n`;
    } catch (e) { report += `HF API: Error (${e.message})\n`; }

    alert(report);
  });

  // Start ISS tracking (polls every 15s)
  try {
    await startISSTracking();
    showToast('ISS tracking started ✓', 'success', 2500);
  } catch (e) {
    showToast('ISS tracking failed to start', 'error');
  }

  // Init news dashboard
  try {
    await initNews();
  } catch (e) {
    showToast('News failed to load', 'error');
  }

  // Init AI chatbot
  initChatbot();

  // Initial systems check
  checkSystemStatus();
  setInterval(checkSystemStatus, 60000); 
}

bootstrap();
