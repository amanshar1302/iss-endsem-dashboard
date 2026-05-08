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
}

bootstrap();
