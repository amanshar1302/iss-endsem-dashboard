# 🛰️ Mission Control Dashboard

A premium, real-time dashboard for space enthusiasts. Track the International Space Station (ISS) live, stay updated with the latest news, and interact with a context-aware AI Mission Assistant.

![Dashboard Preview](https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1200)

## 🚀 Key Features

### 1. ISS Live Tracking
- **Real-Time Mapping**: Interactive Leaflet.js map with a custom UFO marker and trailing trajectory path.
- **Dynamic Stats**: Instant display of coordinates, altitude, and live speed (calculated via Haversine formula).
- **Reverse Geocoding**: Automatically identifies the nearest city or territory (or "Over Ocean") using Nominatim.
- **Crew Status**: Live list of all astronauts currently aboard the ISS.

### 2. Intelligent News Dashboard
- **Category Switching**: Seamlessly toggle between Breaking, Technology, Science, Business, and Health.
- **Live Fallback**: Robust RSS-to-JSON fallback (BBC News) ensures you see real news even without a NewsAPI key.
- **Search & Sort**: Filter by title/source and sort by date to find exactly what you're looking for.
- **Smart Caching**: LocalStorage integration with 15-minute TTL to optimize API performance.

### 3. AI Mission Assistant (Chatbot)
- **Context-Aware**: Powered by **Gemma 3 (27B)** via Hugging Face.
- **Strict Scope**: The AI is programmed to only answer questions based on the live dashboard data (ISS state and current headlines).
- **History Persistent**: Chat history is saved locally in your browser.

### 4. Visualizations & UX
- **Speed Trends**: Real-time line chart (Chart.js) showing speed fluctuations over time.
- **News Distribution**: Doughnut chart visualizing article count per category.
- **Dark/Light Mode**: Full theme support with persistence.
- **Toasts & Loaders**: Polished feedback via custom toast notifications and skeleton loading states.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 (Modern Grid & Flexbox)
- **Build Tool**: Vite
- **Mapping**: Leaflet.js
- **Charts**: Chart.js
- **AI**: Hugging Face Inference API (Mistral/Gemma)
- **Styling**: Premium Dark/Light mode design system

---

## 🚦 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/amanshar1302/iss-endsem-dashboard.git
   cd iss-endsem-dashboard
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory (use `.env.example` as a template):
   ```env
   VITE_NEWS_API_KEY=your_key_here
   VITE_HF_TOKEN=your_hugging_face_token_here
   ```

4. **Launch Development Server:**
   ```bash
   npm run dev
   ```
   The dashboard will be available at `http://localhost:5174/`

---

## 📡 API Sources
- **ISS Position**: [Open Notify](http://open-notify.org/) / [WhereTheISS](https://wheretheiss.at/)
- **Geocoding**: [Nominatim OpenStreetMap](https://nominatim.org/)
- **News**: [NewsAPI.org](https://newsapi.org/) / [BBC RSS](https://feeds.bbci.co.uk/)
- **AI Model**: [Hugging Face Router](https://huggingface.co/)

---

## 📜 License
This project was developed for the end-semester assignment. All rights reserved.
