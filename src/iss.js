// iss.js — ISS Live Tracking Module
import { showToast } from './toast.js';
import { updateSpeedChart } from './charts.js';

const ISS_API = '/issapi/iss-now.json';
const ISS_API_FALLBACK = 'https://api.wheretheiss.at/v1/satellites/25544';
const ASTROS_API = '/issapi/astros.json';
const NOMINATIM = '/nominatim?format=json';

const TRAIL_MAX = 15;
const POLL_INTERVAL = 15000;
const INITIAL_QUICK_POLL = 3000;

let map = null;
let issMarker = null;
let trail = [];
let trailPolyline = null;
let pollTimer = null;
let autoRefresh = true;
let prevPosition = null;
let prevTimestamp = null;
let trackedCount = 0;

// ── Haversine formula ──────────────────────────────────────
function calculateSpeed(pos1, pos2, timeDiffSeconds) {
  const R = 6371;
  const toRad = d => d * (Math.PI / 180);
  const dLat = toRad(pos2.lat - pos1.lat);
  const dLon = toRad(pos2.lng - pos1.lng);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(pos1.lat)) * Math.cos(toRad(pos2.lat)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c / timeDiffSeconds) * 3600;
}

// ── Custom ISS marker icon ─────────────────────────────────
function makeISSIcon() {
  return L.divIcon({
    html: `<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">🛸</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

// ── Reverse geocode via Nominatim ──────────────────────────
async function getLocationName(lat, lon) {
  try {
    const r = await fetch(
      `${NOMINATIM}&lat=${lat}&lon=${lon}`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!r.ok) throw new Error();
    const data = await r.json();
    const addr = data.address || {};
    return addr.city || addr.town || addr.village || addr.county ||
           addr.state || addr.country || 'Over ocean / remote area';
  } catch {
    return 'Over ocean / remote area';
  }
}

// ── Fetch ISS position ─────────────────────────────────────
async function fetchISS() {
  try {
    const r = await fetch(ISS_API);
    if (!r.ok) throw new Error('Primary API fail');
    const data = await r.json();
    return {
      lat: parseFloat(data.iss_position.latitude),
      lon: parseFloat(data.iss_position.longitude),
      timestamp: data.timestamp * 1000
    };
  } catch (err) {
    console.warn('Primary ISS API failed, trying fallback...', err);
    const r = await fetch(ISS_API_FALLBACK);
    if (!r.ok) throw new Error('Both ISS APIs failed');
    const data = await r.json();
    return {
      lat: parseFloat(data.latitude),
      lon: parseFloat(data.longitude),
      timestamp: data.timestamp * 1000
    };
  }
}

// ── Fetch astronauts ───────────────────────────────────────
export async function fetchPeopleInSpace() {
  try {
    const r = await fetch(ASTROS_API);
    const data = await r.json();
    const countEl = document.getElementById('people-count');
    const listEl = document.getElementById('people-list');
    if (countEl) countEl.textContent = data.number;
    if (listEl) {
      listEl.innerHTML = data.people
        .map(p => `<span class="person-tag">${p.name}</span>`)
        .join('');
    }
  } catch {
    const countEl = document.getElementById('people-count');
    if (countEl) countEl.textContent = '?';
  }
}

// ── Update DOM stats ───────────────────────────────────────
function updateStats({ lat, lon, speedKmh, locationName }) {
  const coordsEl = document.getElementById('iss-coords');
  const speedEl = document.getElementById('iss-speed');
  const locEl = document.getElementById('iss-location');
  const trackedEl = document.getElementById('iss-tracked');
  if (coordsEl) coordsEl.textContent = `${parseFloat(lat).toFixed(3)}, ${parseFloat(lon).toFixed(3)}`;
  if (speedEl) speedEl.textContent = speedKmh ? `${speedKmh.toFixed(2)} km/h` : '--- km/h';
  if (locEl) locEl.textContent = locationName || 'Locating…';
  if (trackedEl) trackedEl.textContent = trackedCount;
}

// ── Update map marker & trail ──────────────────────────────
function updateMap(lat, lon) {
  const latlng = [lat, lon];
  if (!issMarker) {
    issMarker = L.marker(latlng, { icon: makeISSIcon() })
      .addTo(map)
      .bindTooltip(`ISS: ${lat.toFixed(3)}, ${lon.toFixed(3)}`, { permanent: false });
  } else {
    issMarker.setLatLng(latlng);
    issMarker.setTooltipContent(`ISS: ${lat.toFixed(3)}, ${lon.toFixed(3)}`);
  }
  map.panTo(latlng, { animate: true, duration: 1.2 });

  trail.push(latlng);
  if (trail.length > TRAIL_MAX) trail.shift();

  if (trailPolyline) map.removeLayer(trailPolyline);
  trailPolyline = L.polyline(trail, {
    color: '#c0392b', weight: 2.5, opacity: 0.7, dashArray: '4 6'
  }).addTo(map);
}

// ── Main update tick ───────────────────────────────────────
async function tick() {
  try {
    const { lat, lon, timestamp: ts } = await fetchISS();

    trackedCount++;

    let speedKmh = null;
    if (prevPosition && prevTimestamp) {
      const timeDiff = (ts - prevTimestamp) / 1000;
      if (timeDiff > 0) {
        speedKmh = calculateSpeed(prevPosition, { lat, lng: lon }, timeDiff);
        updateSpeedChart(speedKmh, ts);
      }
    }

    prevPosition = { lat, lng: lon };
    prevTimestamp = ts;

    updateMap(lat, lon);
    const locationName = await getLocationName(lat, lon);
    updateStats({ lat, lon, speedKmh, locationName });

    // Expose ISS data globally for chatbot context
    window.__issData = { lat, lon, speedKmh, locationName, trackedCount, timestamp: new Date(ts).toLocaleTimeString() };
  } catch (err) {
    showToast('Failed to fetch ISS data. Retrying…', 'error');
  }
}

// ── Init Leaflet map ───────────────────────────────────────
export function initMap() {
  map = L.map('iss-map', { zoomControl: true, attributionControl: true }).setView([0, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
    maxZoom: 8,
  }).addTo(map);
}

// ── Start polling ──────────────────────────────────────────
export async function startISSTracking() {
  await tick(); // Load immediately
  await fetchPeopleInSpace();
  
  // Quick poll after 3s to calculate speed faster
  setTimeout(tick, INITIAL_QUICK_POLL);
  
  // Regular interval
  pollTimer = setInterval(tick, POLL_INTERVAL);
}

// ── Toggle auto-refresh ────────────────────────────────────
export function toggleAutoRefresh() {
  autoRefresh = !autoRefresh;
  const btn = document.getElementById('iss-auto-btn');
  if (autoRefresh) {
    pollTimer = setInterval(tick, POLL_INTERVAL);
    if (btn) { btn.textContent = 'Auto-Refresh: ON'; btn.classList.add('active'); }
    showToast('Auto-refresh enabled', 'success');
  } else {
    clearInterval(pollTimer);
    if (btn) { btn.textContent = 'Auto-Refresh: OFF'; btn.classList.remove('active'); }
    showToast('Auto-refresh paused', 'info');
  }
}

// ── Manual refresh ─────────────────────────────────────────
export async function manualRefresh() {
  showToast('Refreshing ISS data…', 'info', 1500);
  await tick();
}
