// news.js — News Dashboard Module
import { showToast } from './toast.js';
import { initNewsChart } from './charts.js';

const NEWS_KEY = import.meta.env.VITE_NEWS_API_KEY || '';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const CATEGORIES = {
  breaking:    { endpoint: '/newsapi/v2/top-headlines', params: { country: 'us', pageSize: 10 } },
  technology:  { endpoint: '/newsapi/v2/top-headlines', params: { country: 'us', category: 'technology', pageSize: 10 } },
  science:     { endpoint: '/newsapi/v2/top-headlines', params: { country: 'us', category: 'science', pageSize: 10 } },
  business:    { endpoint: '/newsapi/v2/top-headlines', params: { country: 'us', category: 'business', pageSize: 10 } },
  health:      { endpoint: '/newsapi/v2/top-headlines', params: { country: 'us', category: 'health', pageSize: 10 } },
};

let allArticles = {};       // { category: [articles] }
let activeCategory = 'breaking';
let searchQuery = '';
let sortMode = 'date';
let expandedIndex = null;

// ── LocalStorage cache helpers ─────────────────────────────
function cacheKey(cat) { return `news_cache_${cat}`; }

function readCache(cat) {
  try {
    const raw = localStorage.getItem(cacheKey(cat));
    if (!raw) return null;
    const { ts, articles } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(cacheKey(cat)); return null; }
    return articles;
  } catch { return null; }
}

function writeCache(cat, articles) {
  try {
    localStorage.setItem(cacheKey(cat), JSON.stringify({ ts: Date.now(), articles }));
  } catch {}
}

// ── Fetch articles ─────────────────────────────────────────
async function fetchArticles(cat, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = readCache(cat);
    if (cached) return cached;
  }

  const isDefaultKey = !NEWS_KEY || NEWS_KEY.startsWith('pub_your');

  // If no valid key, use live RSS fallbacks (BBC News) for each category
  if (isDefaultKey) {
    console.warn(`No NewsAPI key found, using live BBC News fallback for category: ${cat}`);
    const rssFeeds = {
      breaking:   'https://feeds.bbci.co.uk/news/rss.xml',
      technology: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
      science:    'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
      business:   'https://feeds.bbci.co.uk/news/business/rss.xml',
      health:     'https://feeds.bbci.co.uk/news/health/rss.xml'
    };

    try {
      const feedUrl = rssFeeds[cat] || rssFeeds.breaking;
      const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&_ts=${Date.now()}`);
      const data = await r.json();
      if (data.status === 'ok') {
        const articles = data.items.map(item => ({
          title: item.title,
          description: item.description,
          url: item.link,
          urlToImage: item.enclosure?.link || item.thumbnail || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=1000',
          publishedAt: item.pubDate,
          source: { name: 'BBC News' },
          author: item.author || 'BBC'
        }));
        writeCache(cat, articles);
        return articles;
      }
    } catch (err) {
      console.error('RSS fallback failed', err);
    }
    return getMockArticles(cat);
  }

  const { endpoint, params } = CATEGORIES[cat];
  const url = new URL(endpoint, window.location.origin);
  url.searchParams.set('apiKey', NEWS_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`NewsAPI error ${r.status}`);
  const data = await r.json();
  if (data.status !== 'ok') throw new Error(data.message || 'NewsAPI failed');

  const articles = (data.articles || []).filter(a => a.title && a.title !== '[Removed]');
  writeCache(cat, articles);
  return articles;
}

// ── Mock articles fallback (no key) ──────────────────────
function getMockArticles(cat) {
  const titles = {
    breaking: [
      'Breaking: World Leaders Meet for Emergency Climate Summit',
      'Stock Markets Surge Amid Economic Recovery Signs',
      'Scientists Discover New Deep-Sea Species Near Pacific Trench',
      'Major Cybersecurity Breach Affects Millions of Users',
      'Record-Breaking Heat Wave Sweeps Across Southern Europe',
    ],
    technology: [
      'AI Models Reach New Benchmark in Reasoning Tasks',
      'Quantum Computing Startup Raises $500M in Series B',
      'Apple Announces Next-Generation Mixed Reality Headset',
      'Open-Source LLM Outperforms Proprietary Models on Key Tests',
      'Self-Driving Trucks Begin Commercial Freight Runs in Texas',
    ],
    science: [
      'NASA Confirms Water Ice Deposits in Lunar South Pole',
      'CERN Physicists Observe Rare Particle Decay Event',
      'New Gene Therapy Shows Promise Against Inherited Blindness',
      'Astronomers Map Largest-Ever 3D View of the Universe',
      'Fusion Reactor Achieves Net Energy Gain for Second Time',
    ],
    business: [
      'Tesla Reports Record Deliveries in Q1 2026',
      'Global Chip Shortage Expected to Ease by Mid-Year',
      'Amazon Expands Same-Day Delivery to 50 New Cities',
      'IMF Raises Global Growth Forecast to 3.4%',
      'Warren Buffett Reveals New Position in Emerging Markets Fund',
    ],
    health: [
      'WHO Declares Progress on Malaria Eradication Efforts',
      'New mRNA Vaccine Shows 94% Efficacy Against Flu Variants',
      'Study Links Ultra-Processed Foods to Cognitive Decline',
      'FDA Approves First Oral Treatment for Postpartum Depression',
      'Longevity Research: Scientists Identify Key Aging Biomarker',
    ],
  };

  const catTitles = titles[cat] || titles.breaking;
  const sources = ['Reuters', 'BBC News', 'AP News', 'The Guardian', 'Bloomberg'];

  return catTitles.map((title, i) => ({
    title,
    source: { name: sources[i % sources.length] },
    author: ['John Smith', 'Jane Doe', 'Alex Chen', 'Maria Silva', 'Raj Patel'][i % 5],
    publishedAt: new Date(Date.now() - i * 3600000).toISOString(),
    description: `This is a summary of the article "${title}". Full details available on the source website. This content is shown as a demo because no NewsAPI key is configured.`,
    urlToImage: null,
    url: '#',
  }));
}

// ── Sort articles ──────────────────────────────────────────
function sortArticles(articles) {
  return [...articles].sort((a, b) => {
    if (sortMode === 'date') return new Date(b.publishedAt) - new Date(a.publishedAt);
    if (sortMode === 'source') return (a.source?.name || '').localeCompare(b.source?.name || '');
    return 0;
  });
}

// ── Filter by search ───────────────────────────────────────
function filterArticles(articles) {
  if (!searchQuery) return articles;
  const q = searchQuery.toLowerCase();
  return articles.filter(a =>
    (a.title || '').toLowerCase().includes(q) ||
    (a.source?.name || '').toLowerCase().includes(q) ||
    (a.author || '').toLowerCase().includes(q)
  );
}

// ── Render news list ───────────────────────────────────────
function renderNewsList() {
  const list = document.getElementById('news-list');
  if (!list) return;

  const raw = allArticles[activeCategory] || [];
  const articles = filterArticles(sortArticles(raw));

  if (articles.length === 0) {
    list.innerHTML = `<div class="error-state"><p style="color:var(--text-muted);font-size:0.85rem">No articles found.</p></div>`;
    return;
  }

  list.innerHTML = articles.map((a, i) => {
    const date = a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const imgHtml = a.urlToImage
      ? `<img class="news-item-img" src="${a.urlToImage}" alt="" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="news-item-img-placeholder">📰</div>`;

    return `
      <div class="news-item" data-idx="${i}">
        ${imgHtml}
        <div class="news-item-body">
          <div class="news-item-title">${escHtml(a.title || '')}</div>
          <div class="news-item-meta">
            <span class="source">${escHtml(a.source?.name || '')}</span>
            ${a.author ? `<span>· ${escHtml(a.author)}</span>` : ''}
            ${date ? `<span>· ${date}</span>` : ''}
          </div>
        </div>
        <button class="news-item-expand" data-idx="${i}" aria-label="Expand article">▾</button>
      </div>
      ${expandedIndex === i ? renderDetail(a) : ''}
    `;
  }).join('');

  // Bind expand toggles
  list.querySelectorAll('.news-item-expand').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      expandedIndex = expandedIndex === idx ? null : idx;
      renderNewsList();
    });
  });

  // Expose news for chatbot
  window.__newsData = { category: activeCategory, articles: articles.slice(0, 5) };
}

function renderDetail(a) {
  const imgHtml = a.urlToImage
    ? `<img class="news-detail-img" src="${a.urlToImage}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : '';
  return `
    <div class="news-detail">
      ${imgHtml}
      <p class="news-detail-desc">${escHtml(a.description || 'No description available.')}</p>
      <a href="${a.url || '#'}" target="_blank" rel="noopener" class="news-read-more">Read More →</a>
    </div>
  `;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Skeleton loader ────────────────────────────────────────
function showSkeleton() {
  const list = document.getElementById('news-list');
  if (!list) return;
  list.innerHTML = Array(5).fill(`<div class="skeleton skeleton-row"></div>`).join('');
}

// ── Load category ──────────────────────────────────────────
async function loadCategory(cat, force = false) {
  activeCategory = cat;
  expandedIndex = null;
  showSkeleton();
  try {
    const articles = await fetchArticles(cat, force);
    allArticles[cat] = articles;
    renderNewsList();
    refreshNewsChart();
  } catch (err) {
    const list = document.getElementById('news-list');
    if (list) {
      list.innerHTML = `
        <div class="error-state">
          <p class="error-msg">⚠ ${err.message}</p>
          <button class="retry-btn" id="news-retry-btn">Retry</button>
        </div>`;
      document.getElementById('news-retry-btn')?.addEventListener('click', () => loadCategory(cat, true));
    }
    showToast(`News error: ${err.message}`, 'error');
  }
}

// ── Update news doughnut chart ─────────────────────────────
function refreshNewsChart() {
  const counts = {};
  Object.entries(allArticles).forEach(([cat, arts]) => {
    counts[cat] = arts.length;
  });
  if (Object.keys(counts).length > 0) {
    initNewsChart(counts, (cat) => {
      setActiveTab(cat);
      loadCategory(cat);
    });
  }
}

// ── Set active tab ─────────────────────────────────────────
function setActiveTab(cat) {
  document.querySelectorAll('.news-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.cat === cat);
  });
  activeCategory = cat;
}

// ── Init News Module ───────────────────────────────────────
export async function initNews() {
  // Tabs
  document.querySelectorAll('.news-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      setActiveTab(tab.dataset.cat);
      loadCategory(tab.dataset.cat);
    });
  });

  // Search
  const searchEl = document.getElementById('news-search');
  if (searchEl) {
    searchEl.addEventListener('input', e => {
      searchQuery = e.target.value;
      expandedIndex = null;
      renderNewsList();
    });
  }

  // Sort
  const sortEl = document.getElementById('news-sort');
  if (sortEl) {
    sortEl.addEventListener('change', e => {
      sortMode = e.target.value;
      expandedIndex = null;
      renderNewsList();
    });
  }

  // Refresh button
  const refreshBtn = document.getElementById('news-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      localStorage.removeItem(cacheKey(activeCategory));
      showToast('Refreshing news…', 'info', 1500);
      loadCategory(activeCategory, true);
    });
  }

  // Load initial category + pre-fetch others quietly
  await loadCategory('breaking');
  for (const cat of ['technology', 'science', 'business', 'health']) {
    try {
      const articles = await fetchArticles(cat);
      allArticles[cat] = articles;
    } catch {}
  }
  refreshNewsChart();
}

// ── Expose news summary for chatbot ───────────────────────
export function getNewsSummary() {
  const arts = allArticles[activeCategory] || [];
  return arts.slice(0, 5).map((a, i) =>
    `${i + 1}. [${a.source?.name}] ${a.title}`
  ).join('\n');
}
