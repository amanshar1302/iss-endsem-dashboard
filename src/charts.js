// charts.js — Chart.js speed trend + news doughnut
let speedChart = null;
let newsChart = null;

const SPEED_MAX = 30; // keep last 30 readings

export function initSpeedChart() {
  const ctx = document.getElementById('speed-chart').getContext('2d');
  speedChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'ISS Speed (km/h)',
        data: [],
        borderColor: '#c0392b',
        backgroundColor: 'rgba(192,57,43,0.08)',
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointRadius: 2,
        pointHoverRadius: 5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            font: { family: 'Inter', size: 11 },
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#666',
            boxWidth: 20,
          }
        },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: {
          ticks: {
            font: { family: 'Inter', size: 9 },
            color: '#999',
            maxRotation: 45,
            maxTicksLimit: 8,
          },
          grid: { color: 'rgba(150,150,150,0.1)' }
        },
        y: {
          ticks: {
            font: { family: 'Inter', size: 9 },
            color: '#999',
          },
          grid: { color: 'rgba(150,150,150,0.1)' }
        }
      },
      animation: { duration: 400 }
    }
  });
}

export function updateSpeedChart(speedKmh, timestamp) {
  if (!speedChart) return;
  const label = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  speedChart.data.labels.push(label);
  speedChart.data.datasets[0].data.push(Math.round(speedKmh));
  if (speedChart.data.labels.length > SPEED_MAX) {
    speedChart.data.labels.shift();
    speedChart.data.datasets[0].data.shift();
  }
  speedChart.update('none');
}

export function initNewsChart(categoryCounts, onSliceClick) {
  const ctx = document.getElementById('news-chart').getContext('2d');
  const COLORS = ['#c0392b','#2980b9','#27ae60','#f39c12','#8e44ad'];
  const labels = Object.keys(categoryCounts);
  const data = Object.values(categoryCounts);

  if (newsChart) newsChart.destroy();
  newsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
      datasets: [{
        data,
        backgroundColor: COLORS.slice(0, labels.length),
        borderWidth: 2,
        borderColor: getComputedStyle(document.documentElement)
          .getPropertyValue('--bg-card').trim() || '#fff',
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: 'Inter', size: 10 },
            color: getComputedStyle(document.documentElement)
              .getPropertyValue('--text-secondary').trim() || '#666',
            padding: 12,
            boxWidth: 12,
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} articles`
          }
        }
      },
      onClick: (e, elements) => {
        if (elements.length && onSliceClick) {
          const idx = elements[0].index;
          onSliceClick(labels[idx]);
        }
      },
      animation: { duration: 600 }
    }
  });
}

export function updateChartTheme() {
  const textColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--text-secondary').trim() || '#666';
  [speedChart, newsChart].forEach(chart => {
    if (!chart) return;
    chart.options.plugins.legend.labels.color = textColor;
    chart.update();
  });
}
