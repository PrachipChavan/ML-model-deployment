/* ============================================================
   app.js — ML Deploy Dashboard · Full Application Logic
   ============================================================ */

'use strict';

// ─── State ────────────────────────────────────────────────────
let currentCloud = 'gcp';
let currentPage  = 'dashboard';
let currentStep  = 1;
let selectedCloudForDeploy = 'gcp';
let logInterval  = null;
let chartsInitialized = false;

// ─── Sample Data ──────────────────────────────────────────────
const models = [
  { id:'m1', name:'fraud-detector-v3',    type:'Classification', emoji:'🔍', cloud:'gcp', framework:'TensorFlow 2.x',  version:'3.2.1', status:'running',   latency:28,  rpm:4200, accuracy:0.974, region:'us-central1', instances:3, updated:'2h ago' },
  { id:'m2', name:'churn-predictor',      type:'Classification', emoji:'📉', cloud:'aws', framework:'XGBoost 1.7',     version:'2.0.4', status:'running',   latency:15,  rpm:1800, accuracy:0.911, region:'us-east-1',   instances:2, updated:'5h ago' },
  { id:'m3', name:'nlp-sentiment-bert',   type:'NLP',           emoji:'💬', cloud:'gcp', framework:'Hugging Face',    version:'1.5.0', status:'running',   latency:120, rpm:890,  accuracy:0.956, region:'us-central1', instances:4, updated:'1d ago' },
  { id:'m4', name:'demand-forecast-lstm', type:'Regression',    emoji:'📈', cloud:'aws', framework:'PyTorch 2.x',     version:'4.1.0', status:'deploying', latency:55,  rpm:320,  accuracy:0.883, region:'eu-west-1',   instances:1, updated:'Now'    },
  { id:'m5', name:'image-classifier-v2',  type:'Computer Vision',emoji:'🖼️', cloud:'gcp', framework:'TensorFlow 2.x',  version:'2.3.0', status:'running',   latency:82,  rpm:2100, accuracy:0.968, region:'us-central1', instances:5, updated:'3h ago' },
  { id:'m6', name:'rec-system-collab',    type:'Recommendation', emoji:'⭐', cloud:'aws', framework:'PyTorch 2.x',     version:'1.8.2', status:'warning',   latency:210, rpm:6400, accuracy:0.841, region:'ap-southeast-1',instances:6,updated:'30m ago'},
  { id:'m7', name:'anomaly-detector',     type:'Unsupervised',  emoji:'🚨', cloud:'gcp', framework:'scikit-learn',    version:'1.1.0', status:'running',   latency:18,  rpm:7800, accuracy:0.927, region:'europe-west4',instances:2, updated:'6h ago' },
  { id:'m8', name:'price-optimizer',      type:'Regression',    emoji:'💰', cloud:'aws', framework:'XGBoost 1.7',     version:'3.0.1', status:'stopped',   latency:0,   rpm:0,    accuracy:0.895, region:'us-west-2',   instances:0, updated:'2d ago' },
];

const endpoints = [
  { id:'ep1', name:'Fraud Detection API',   model:'fraud-detector-v3',    cloud:'gcp', url:'https://us-central1-aiplatform.googleapis.com/v1/projects/ml-prod/endpoints/4829',  status:'running', rps:70,  p99:95,  uptime:99.98 },
  { id:'ep2', name:'Churn Prediction API',  model:'churn-predictor',       cloud:'aws', url:'https://runtime.sagemaker.us-east-1.amazonaws.com/endpoints/churn-pred-ep/invocations', status:'running', rps:30,  p99:42,  uptime:99.91 },
  { id:'ep3', name:'Sentiment Analysis API',model:'nlp-sentiment-bert',    cloud:'gcp', url:'https://us-central1-aiplatform.googleapis.com/v1/projects/ml-prod/endpoints/7731',  status:'running', rps:14,  p99:380, uptime:99.74 },
  { id:'ep4', name:'Demand Forecast API',   model:'demand-forecast-lstm',  cloud:'aws', url:'https://runtime.sagemaker.eu-west-1.amazonaws.com/endpoints/demand-fc-ep/invocations', status:'deploying',rps:0, p99:0,   uptime:0 },
  { id:'ep5', name:'Image Classifier API',  model:'image-classifier-v2',   cloud:'gcp', url:'https://us-central1-aiplatform.googleapis.com/v1/projects/ml-prod/endpoints/1123',  status:'running', rps:35,  p99:220, uptime:99.85 },
];

const pipelines = [
  { id:'pl1', name:'Fraud Model CI/CD', cloud:'gcp', service:'Cloud Build → Vertex AI', schedule:'On push to main', lastRun:'2h ago', status:'done',
    steps:[{label:'Source',s:'done'},{label:'Build',s:'done'},{label:'Test',s:'done'},{label:'Train',s:'done'},{label:'Evaluate',s:'done'},{label:'Deploy',s:'done'}] },
  { id:'pl2', name:'Churn Model Retrain', cloud:'aws', service:'SageMaker Pipelines', schedule:'Daily 02:00 UTC', lastRun:'Running',  status:'running',
    steps:[{label:'Ingest',s:'done'},{label:'Process',s:'done'},{label:'Train',s:'running'},{label:'Eval',s:'pending'},{label:'Deploy',s:'pending'}] },
  { id:'pl3', name:'NLP Fine-tune', cloud:'gcp', service:'Vertex AI Pipelines', schedule:'Weekly', lastRun:'1d ago', status:'done',
    steps:[{label:'Data Prep',s:'done'},{label:'Fine-tune',s:'done'},{label:'Eval',s:'done'},{label:'A/B Test',s:'done'},{label:'Deploy',s:'done'}] },
];

const storageItems = [
  { name:'ml-models-prod',  cloud:'gcp', type:'GCS Bucket',   size:'42.7 GB',  used:0.68, region:'us-central1',  files:1247 },
  { name:'ml-artifacts-dev',cloud:'gcp', type:'GCS Bucket',   size:'18.3 GB',  used:0.29, region:'us-central1',  files:563 },
  { name:'sagemaker-models',cloud:'aws', type:'S3 Bucket',    size:'89.1 GB',  used:0.85, region:'us-east-1',    files:3421 },
  { name:'training-datasets',cloud:'aws', type:'S3 Bucket',   size:'215.0 GB', used:0.92, region:'us-east-1',    files:8920 },
];

const alerts = [
  { id:'a1', severity:'critical', title:'High Latency — Recommendation System', detail:'P99 latency exceeded 500ms threshold on rec-system-collab (current: 210ms avg)', time:'12 min ago' },
  { id:'a2', severity:'warning',  title:'GPU Utilization Spike — Image Classifier', detail:'GPU memory usage at 91% on n1-highmem-8 instance in us-central1', time:'45 min ago' },
  { id:'a3', severity:'info',     title:'Deployment Completed — Demand Forecast', detail:'demand-forecast-lstm v4.1.0 successfully deployed to SageMaker endpoint', time:'2 hours ago' },
];

// ─── Initialization ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  animateKPIs();
  setTimeout(() => {
    initCharts();
    populateTable();
    chartsInitialized = true;
  }, 300);
  loadModelCards();
  loadEndpoints();
  loadMetrics();
  loadLogs();
  loadAlerts();
  loadPipelines();
  loadStorage();
  loadSettings();
  loadDeployWizard();
  startRealTimeUpdates();
  
  // Custom Initialization
  setGuideTab('gcp');
  checkBackendStatus();
  setInterval(checkBackendStatus, 5000);
});

// ─── Particle Canvas ──────────────────────────────────────────
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, particles = [];

  function resize() {
    w = canvas.width  = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const colors = ['rgba(124,58,237,', 'rgba(6,182,212,', 'rgba(16,185,129,'];

  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 2 + 0.5,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: Math.random() * 0.5 + 0.1,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 150) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(124,58,237,${(1 - dist/150) * 0.08})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw particles
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color + p.opacity + ')';
      ctx.fill();
      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0 || p.x > w) p.dx *= -1;
      if (p.y < 0 || p.y > h) p.dy *= -1;
    });

    requestAnimationFrame(draw);
  }
  draw();
}

// ─── KPI Counter Animation ────────────────────────────────────
function animateKPIs() {
  document.querySelectorAll('.kpi-value').forEach(el => {
    const target = parseInt(el.dataset.target);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    let current = 0;
    const step = target / 60;
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = prefix + Math.floor(current).toLocaleString() + suffix;
      if (current >= target) clearInterval(timer);
    }, 20);
  });
}

// ─── Chart.js Charts ─────────────────────────────────────────
function initCharts() {
  // Request & Latency chart
  const reqCtx = document.getElementById('requestChart');
  if (!reqCtx) return;

  const hours = Array.from({length:24}, (_, i) => {
    const h = (new Date().getHours() - 23 + i + 24) % 24;
    return `${String(h).padStart(2,'0')}:00`;
  });

  const reqs = Array.from({length:24}, () => Math.floor(Math.random()*15000+5000));
  const lats = Array.from({length:24}, () => Math.floor(Math.random()*40+25));

  new Chart(reqCtx, {
    type: 'bar',
    data: {
      labels: hours,
      datasets: [
        {
          label: 'Requests/min',
          data: reqs,
          backgroundColor: 'rgba(124,58,237,0.35)',
          borderColor: 'rgba(124,58,237,0.8)',
          borderWidth: 1,
          borderRadius: 3,
          yAxisID: 'y',
        },
        {
          label: 'Latency (ms)',
          data: lats,
          type: 'line',
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6,182,212,0.08)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
          yAxisID: 'y1',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { size: 11, family: 'Inter' }, boxWidth: 12, padding: 16 }
        },
        tooltip: {
          backgroundColor: '#111827',
          borderColor: '#1e2d4a',
          borderWidth: 1,
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
        }
      },
      scales: {
        x: {
          ticks: { color: '#4b6286', font: { size: 10 }, maxRotation: 0 },
          grid: { color: 'rgba(30,45,74,0.4)' }
        },
        y: {
          ticks: { color: '#4b6286', font: { size: 10 } },
          grid: { color: 'rgba(30,45,74,0.4)' },
          title: { display: true, text: 'Req/min', color: '#4b6286', font: { size: 10 } }
        },
        y1: {
          position: 'right',
          ticks: { color: '#06b6d4', font: { size: 10 } },
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Latency ms', color: '#06b6d4', font: { size: 10 } }
        }
      }
    }
  });

  // Doughnut model distribution
  const distCtx = document.getElementById('modelDistChart');
  if (!distCtx) return;

  const distData = [
    { label: 'Classification', value: 4, color: '#7c3aed' },
    { label: 'Regression',     value: 2, color: '#06b6d4' },
    { label: 'NLP',            value: 1, color: '#10b981' },
    { label: 'Computer Vision',value: 2, color: '#f59e0b' },
    { label: 'Recommendation', value: 1, color: '#ef4444' },
    { label: 'Unsupervised',   value: 2, color: '#8b5cf6' },
  ];

  new Chart(distCtx, {
    type: 'doughnut',
    data: {
      labels: distData.map(d => d.label),
      datasets: [{
        data: distData.map(d => d.value),
        backgroundColor: distData.map(d => d.color + 'cc'),
        borderColor: distData.map(d => d.color),
        borderWidth: 1.5,
        hoverBorderWidth: 2.5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111827',
          borderColor: '#1e2d4a',
          borderWidth: 1,
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
        }
      }
    }
  });

  // Legend
  const legendEl = document.getElementById('modelLegend');
  if (legendEl) {
    legendEl.innerHTML = distData.map(d =>
      `<div class="legend-item">
        <div class="legend-dot" style="background:${d.color}"></div>
        <span>${d.label} (${d.value})</span>
      </div>`
    ).join('');
  }
}

// ─── Table ────────────────────────────────────────────────────
function populateTable(filterCloud = 'all') {
  const tbody = document.getElementById('modelsTableBody');
  if (!tbody) return;

  const filtered = filterCloud === 'all' ? models : models.filter(m => m.cloud === filterCloud);

  tbody.innerHTML = filtered.map(m => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:9px">
          <span style="font-size:18px">${m.emoji}</span>
          <div>
            <div style="font-weight:600;font-size:13px">${m.name}</div>
            <div style="font-size:11px;color:var(--text-muted)">${m.type}</div>
          </div>
        </div>
      </td>
      <td><code style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--cyan)">${m.version}</code></td>
      <td><span class="cloud-tag ${m.cloud}">${m.cloud.toUpperCase()}</span></td>
      <td style="color:var(--text-secondary);font-size:12px">${m.framework}</td>
      <td><span class="status-badge ${m.status}">${capitalize(m.status)}</span></td>
      <td>
        <span style="font-weight:600">${m.latency}</span>
        <span style="font-size:11px;color:var(--text-muted)">ms</span>
      </td>
      <td style="font-weight:600">${m.rpm.toLocaleString()}</td>
      <td>
        <div class="accuracy-bar">
          <span style="font-weight:600;font-size:12px">${(m.accuracy*100).toFixed(1)}%</span>
          <div class="accuracy-track">
            <div class="accuracy-fill" style="width:${m.accuracy*100}%"></div>
          </div>
        </div>
      </td>
      <td>
        <button class="action-btn" onclick="showToast('Viewing ${m.name} details','info')">View</button>
        <button class="action-btn" onclick="showToast('${m.name} logs opened','info')">Logs</button>
        ${m.status === 'stopped' ? `<button class="action-btn" onclick="showToast('Starting ${m.name}...','success')">Start</button>` : `<button class="action-btn danger" onclick="showToast('${m.name} stopped','warning')">Stop</button>`}
      </td>
    </tr>
  `).join('');

  // Filter listener
  const filterEl = document.getElementById('filterCloud');
  if (filterEl) {
    filterEl.onchange = () => populateTable(filterEl.value);
  }
}

// ─── Model Cards ──────────────────────────────────────────────
function loadModelCards() {
  const grid = document.getElementById('modelCardsGrid');
  if (!grid) return;

  grid.innerHTML = models.map(m => `
    <div class="model-card" onclick="showToast('Viewing ${m.name}','info')">
      <div class="model-card-header">
        <div class="model-card-icon">${m.emoji}</div>
        <span class="cloud-tag ${m.cloud}">${m.cloud.toUpperCase()}</span>
      </div>
      <div class="model-card-name">${m.name}</div>
      <div class="model-card-type">${m.type} · ${m.framework}</div>
      <div class="model-card-stats">
        <div class="model-stat">
          <span class="model-stat-label">Version</span>
          <span class="model-stat-value" style="color:var(--cyan);font-family:'JetBrains Mono',monospace;font-size:12px">${m.version}</span>
        </div>
        <div class="model-stat">
          <span class="model-stat-label">Accuracy</span>
          <span class="model-stat-value" style="color:var(--green)">${(m.accuracy*100).toFixed(1)}%</span>
        </div>
        <div class="model-stat">
          <span class="model-stat-label">Instances</span>
          <span class="model-stat-value">${m.instances}</span>
        </div>
      </div>
      <div class="model-card-footer">
        <span class="status-badge ${m.status}">${capitalize(m.status)}</span>
        <div style="display:flex;gap:6px">
          <button class="btn-sm" onclick="event.stopPropagation();showToast('Deploying ${m.name}...','success')">Deploy</button>
          <button class="btn-sm" onclick="event.stopPropagation();showToast('Viewing metrics for ${m.name}','info')">Metrics</button>
        </div>
      </div>
      <div style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:4px">
          <span>Accuracy</span><span>${(m.accuracy*100).toFixed(1)}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${m.accuracy*100}%"></div>
        </div>
      </div>
    </div>
  `).join('');
}

// ─── Endpoints ────────────────────────────────────────────────
function loadEndpoints() {
  const grid = document.getElementById('endpointsGrid');
  if (!grid) return;

  grid.innerHTML = endpoints.map(ep => `
    <div class="endpoint-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div>
          <div style="font-size:15px;font-weight:700">${ep.name}</div>
          <div style="font-size:11px;color:var(--text-muted)">${ep.model}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="cloud-tag ${ep.cloud}">${ep.cloud.toUpperCase()}</span>
          <span class="status-badge ${ep.status}">${capitalize(ep.status)}</span>
        </div>
      </div>
      <div class="endpoint-url">${ep.url}</div>
      <div class="endpoint-stats">
        <div class="endpoint-stat">
          <div class="endpoint-stat-val" style="color:var(--purple-l)">${ep.rps}</div>
          <div class="endpoint-stat-label">RPS</div>
        </div>
        <div class="endpoint-stat">
          <div class="endpoint-stat-val" style="color:var(--cyan)">${ep.p99}ms</div>
          <div class="endpoint-stat-label">P99 Latency</div>
        </div>
        <div class="endpoint-stat">
          <div class="endpoint-stat-val" style="color:var(--green)">${ep.uptime}%</div>
          <div class="endpoint-stat-label">Uptime</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn-sm" onclick="copyUrl('${ep.url}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy URL
        </button>
        <button class="btn-sm" onclick="showToast('Testing endpoint ${ep.name}...','info')">Test</button>
        <button class="btn-sm" onclick="showToast('Opening logs for ${ep.name}','info')">Logs</button>
      </div>
    </div>
  `).join('');
}

function copyUrl(url) {
  navigator.clipboard.writeText(url).then(() => showToast('Endpoint URL copied!', 'success'));
}

// ─── Metrics Page ─────────────────────────────────────────────
function loadMetrics() {
  const grid = document.getElementById('metricsGrid');
  if (!grid) return;

  const metricDefs = [
    { title:'Model Accuracy Over Time', sub:'Last 30 days · All models', id:'metricAccChart', full:false },
    { title:'Throughput Distribution', sub:'Requests per endpoint', id:'metricRpmChart',  full:false },
    { title:'Resource Utilization', sub:'CPU & Memory · All instances', id:'metricResChart', full:true  },
    { title:'Model Drift Detection', sub:'Feature distribution shift', id:'metricDriftChart',full:false },
    { title:'Cost Breakdown', sub:'Daily cost by cloud', id:'metricCostChart', full:false },
  ];

  grid.innerHTML = metricDefs.map(m => `
    <div class="metric-card${m.full ? ' full' : ''}">
      <div class="chart-header">
        <div>
          <h3 class="chart-title">${m.title}</h3>
          <p class="chart-sub">${m.sub}</p>
        </div>
      </div>
      <canvas id="${m.id}" height="${m.full ? 180 : 200}"></canvas>
    </div>
  `).join('');

  setTimeout(() => renderMetricCharts(), 100);
}

function renderMetricCharts() {
  const days = Array.from({length:30}, (_,i) => `Day ${i+1}`);

  // Accuracy trend
  const accCtx = document.getElementById('metricAccChart');
  if (accCtx) {
    new Chart(accCtx, {
      type: 'line',
      data: {
        labels: days,
        datasets: [
          { label:'fraud-detector',    data: days.map(()=>(Math.random()*3+95).toFixed(2)),   borderColor:'#7c3aed', tension:0.4, pointRadius:0, borderWidth:2 },
          { label:'churn-predictor',   data: days.map(()=>(Math.random()*3+88).toFixed(2)),   borderColor:'#06b6d4', tension:0.4, pointRadius:0, borderWidth:2 },
          { label:'nlp-sentiment',     data: days.map(()=>(Math.random()*2+93).toFixed(2)),   borderColor:'#10b981', tension:0.4, pointRadius:0, borderWidth:2 },
        ]
      },
      options: chartDefaults('Accuracy %', '#1e2d4a')
    });
  }

  // Throughput bar
  const rpmCtx = document.getElementById('metricRpmChart');
  if (rpmCtx) {
    new Chart(rpmCtx, {
      type: 'bar',
      data: {
        labels: endpoints.map(e => e.name.split(' ')[0]),
        datasets: [{
          data: endpoints.map(e => e.rps),
          backgroundColor: ['#7c3aed99','#06b6d499','#10b98199','#f59e0b99','#ef444499'],
          borderRadius: 6,
        }]
      },
      options: { ...chartDefaults('RPS', '#1e2d4a'), plugins: { legend: { display: false } } }
    });
  }

  // Resource utilization line
  const resCtx = document.getElementById('metricResChart');
  if (resCtx) {
    new Chart(resCtx, {
      type: 'line',
      data: {
        labels: Array.from({length:24}, (_,i) => `${String(i).padStart(2,'0')}:00`),
        datasets: [
          { label:'CPU %',    data: Array.from({length:24}, ()=>Math.floor(Math.random()*30+40)), borderColor:'#7c3aed', fill:true, backgroundColor:'rgba(124,58,237,0.08)', tension:0.4, pointRadius:0, borderWidth:2 },
          { label:'Memory %', data: Array.from({length:24}, ()=>Math.floor(Math.random()*20+55)), borderColor:'#06b6d4', fill:true, backgroundColor:'rgba(6,182,212,0.06)', tension:0.4, pointRadius:0, borderWidth:2 },
          { label:'GPU %',    data: Array.from({length:24}, ()=>Math.floor(Math.random()*40+30)), borderColor:'#10b981', fill:false, tension:0.4, pointRadius:0, borderWidth:2 },
        ]
      },
      options: chartDefaults('Utilization %', '#1e2d4a')
    });
  }

  // Drift
  const driftCtx = document.getElementById('metricDriftChart');
  if (driftCtx) {
    new Chart(driftCtx, {
      type: 'radar',
      data: {
        labels: ['Feature 1','Feature 2','Feature 3','Feature 4','Feature 5','Feature 6'],
        datasets: [
          { label:'Baseline', data:[90,85,88,92,87,91], borderColor:'#7c3aed', backgroundColor:'rgba(124,58,237,0.1)', pointRadius:3 },
          { label:'Current',  data:[85,88,80,89,91,84], borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,0.1)',  pointRadius:3 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { r: { ticks: { color:'#4b6286', font:{size:9} }, grid:{ color:'#1e2d4a' }, pointLabels:{ color:'#94a3b8', font:{size:10} } } },
        plugins: { legend: { labels:{ color:'#94a3b8', font:{size:11,family:'Inter'}, boxWidth:12 } } }
      }
    });
  }

  // Cost breakdown
  const costCtx = document.getElementById('metricCostChart');
  if (costCtx) {
    new Chart(costCtx, {
      type: 'bar',
      data: {
        labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
        datasets: [
          { label:'GCP', data:[120,135,128,142,131,98,105], backgroundColor:'rgba(66,133,244,0.7)', borderRadius:4 },
          { label:'AWS', data:[142,158,151,167,149,112,118], backgroundColor:'rgba(255,153,0,0.7)',   borderRadius:4 },
        ]
      },
      options: { ...chartDefaults('USD', '#1e2d4a'), plugins: { legend: { labels:{ color:'#94a3b8', font:{size:11}, boxWidth:12 } } } }
    });
  }
}

function chartDefaults(yLabel, gridColor) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode:'index', intersect:false },
    plugins: {
      legend: { labels: { color:'#94a3b8', font:{size:11,family:'Inter'}, boxWidth:12, padding:16 } },
      tooltip: { backgroundColor:'#111827', borderColor:'#1e2d4a', borderWidth:1, titleColor:'#f1f5f9', bodyColor:'#94a3b8' }
    },
    scales: {
      x: { ticks:{ color:'#4b6286', font:{size:10} }, grid:{ color:`${gridColor}66` } },
      y: { ticks:{ color:'#4b6286', font:{size:10} }, grid:{ color:`${gridColor}66` }, title:{display:true, text:yLabel, color:'#4b6286', font:{size:10}} }
    }
  };
}

// ─── Logs ────────────────────────────────────────────────────
const logMessages = [
  ['INFO',  'fraud-detector-v3',    'Received inference request — batch_size=32'],
  ['INFO',  'churn-predictor',      'Prediction completed in 14ms'],
  ['DEBUG', 'nlp-sentiment-bert',   'Tokenization complete — input_length=128'],
  ['INFO',  'image-classifier-v2',  'GPU memory allocated: 4.2GB / 16GB'],
  ['WARN',  'rec-system-collab',    'Response time exceeded 200ms threshold: 218ms'],
  ['INFO',  'demand-forecast-lstm', 'Model warmup complete — ready to serve'],
  ['INFO',  'anomaly-detector',     'Anomaly score: 0.03 — within normal range'],
  ['ERROR', 'rec-system-collab',    'Failed to load feature store — retrying (attempt 2/3)'],
  ['INFO',  'fraud-detector-v3',    'Autoscaling triggered — adding 1 replica'],
  ['DEBUG', 'churn-predictor',      'Feature engineering pipeline executed in 3ms'],
  ['INFO',  'image-classifier-v2',  'Top-1 prediction: cat (confidence=0.97)'],
  ['WARN',  'anomaly-detector',     'High anomaly score detected: 0.89 — alerting'],
];

let logIdx = 0;
function loadLogs() {
  const container = document.getElementById('logsContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="logs-toolbar">
      <span class="status-badge running" style="font-size:11px">● Live</span>
      <select class="select-ctrl" style="font-size:11px;padding:4px 10px" id="logLevel">
        <option>All Levels</option><option>INFO</option><option>WARN</option><option>ERROR</option><option>DEBUG</option>
      </select>
      <select class="select-ctrl" style="font-size:11px;padding:4px 10px" id="logModel">
        <option>All Models</option>
        ${models.map(m => `<option>${m.name}</option>`).join('')}
      </select>
      <button class="btn-sm" onclick="clearLogs()">Clear</button>
      <button class="btn-sm" style="margin-left:auto" onclick="showToast('Logs exported as log.txt','success')">Export</button>
    </div>
    <div class="logs-stream" id="logStream"></div>
  `;

  streamLogs();
}

function streamLogs() {
  const stream = document.getElementById('logStream');
  if (!stream) return;

  // Initial logs
  for (let i = 0; i < 15; i++) appendLog(stream, true);

  if (logInterval) clearInterval(logInterval);
  logInterval = setInterval(() => {
    if (document.getElementById('logStream')) appendLog(document.getElementById('logStream'));
  }, 1800);
}

function appendLog(stream, noScroll = false) {
  if (!stream) return;
  const entry = logMessages[logIdx % logMessages.length];
  logIdx++;
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-level ${entry[0]}">${entry[0]}</span>
    <span style="color:var(--purple-l);min-width:160px">[${entry[1]}]</span>
    <span class="log-msg">${entry[2]}</span>
  `;
  stream.appendChild(line);
  if (!noScroll) stream.scrollTop = stream.scrollHeight;
  if (stream.children.length > 200) stream.removeChild(stream.firstChild);
}

function clearLogs() {
  const stream = document.getElementById('logStream');
  if (stream) stream.innerHTML = '';
  showToast('Logs cleared', 'info');
}

// ─── Alerts ──────────────────────────────────────────────────
function loadAlerts() {
  const el = document.getElementById('alertsList');
  if (!el) return;
  const icons = { critical:'🔴', warning:'🟡', info:'🔵' };
  el.innerHTML = alerts.map(a => `
    <div class="alert-item">
      <div class="alert-icon ${a.severity}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${a.severity==='critical' ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' :
            a.severity==='warning'  ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' :
            '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
        </svg>
      </div>
      <div style="flex:1">
        <div class="alert-title">${a.title}</div>
        <div class="alert-detail">${a.detail}</div>
      </div>
      <div class="alert-time">${a.time}</div>
      <button class="btn-sm" onclick="dismissAlert('${a.id}',this)">Dismiss</button>
    </div>
  `).join('');
}

function dismissAlert(id, btn) {
  btn.closest('.alert-item').style.opacity = '0';
  btn.closest('.alert-item').style.transition = 'opacity 0.3s';
  setTimeout(() => btn.closest('.alert-item').remove(), 300);
  showToast('Alert dismissed', 'success');
}

// ─── Pipelines ───────────────────────────────────────────────
function loadPipelines() {
  const el = document.getElementById('pipelinesList');
  if (!el) return;
  el.innerHTML = pipelines.map(pl => `
    <div class="pipeline-item">
      <div class="pipeline-header">
        <div>
          <div style="font-size:15px;font-weight:700">${pl.name}</div>
          <div style="font-size:12px;color:var(--text-muted)">${pl.service} · ${pl.schedule}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="cloud-tag ${pl.cloud}">${pl.cloud.toUpperCase()}</span>
          <span class="status-badge ${pl.status}">${capitalize(pl.status)}</span>
          <span style="font-size:12px;color:var(--text-muted)">Last: ${pl.lastRun}</span>
          <button class="btn-sm" onclick="showToast('Triggering ${pl.name}...','success')">Run Now</button>
        </div>
      </div>
      <div class="pipeline-steps">
        ${pl.steps.map((step, i) => `
          ${i > 0 ? `<div class="pipeline-connector ${step.s==='pending' ? '' : 'done'}"></div>` : ''}
          <div class="pipeline-step">
            <div class="pipeline-step-dot ${step.s}">${step.s==='done' ? '✓' : step.s==='running' ? '▶' : '○'}</div>
            <div class="pipeline-step-label">${step.label}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ─── Storage ─────────────────────────────────────────────────
function loadStorage() {
  const el = document.getElementById('storageList');
  if (!el) return;
  el.innerHTML = storageItems.map(s => `
    <div class="storage-card">
      <div class="storage-icon" style="background:${s.cloud==='gcp' ? 'rgba(66,133,244,0.15)' : 'rgba(255,153,0,0.15)'}">
        ${s.cloud==='gcp' ? '🪣' : '🪣'}
      </div>
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:3px">
          <span style="font-size:15px;font-weight:700">${s.name}</span>
          <span class="cloud-tag ${s.cloud}">${s.cloud.toUpperCase()} · ${s.type}</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted)">${s.region} · ${s.files.toLocaleString()} objects</div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
          <div class="storage-bar" style="flex:1">
            <div class="storage-bar-fill" style="width:${s.used*100}%"></div>
          </div>
          <span style="font-size:12px;font-weight:600;color:${s.used > 0.85 ? 'var(--orange)' : 'var(--text-secondary)'}">${s.size} (${Math.round(s.used*100)}%)</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-direction:column;align-items:flex-end">
        <button class="btn-sm" onclick="showToast('Opening ${s.name} browser','info')">Browse</button>
        <button class="btn-sm" onclick="showToast('Uploading to ${s.name}','success')">Upload</button>
      </div>
    </div>
  `).join('');
}

// ─── Settings ────────────────────────────────────────────────
function loadSettings() {
  const el = document.getElementById('settingsContent');
  if (!el) return;

  el.innerHTML = `
    <div class="settings-section">
      <div class="settings-title">Cloud Credentials</div>
      <div class="settings-row">
        <div><div class="settings-label">GCP Project ID</div><div class="settings-detail">Google Cloud Platform project</div></div>
        <code style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--cyan);background:rgba(6,182,212,0.08);padding:5px 10px;border-radius:6px">ml-prod-438210</code>
      </div>
      <div class="settings-row">
        <div><div class="settings-label">GCP Service Account</div><div class="settings-detail">Active credentials</div></div>
        <span class="status-badge running">Connected</span>
      </div>
      <div class="settings-row">
        <div><div class="settings-label">AWS Account ID</div><div class="settings-detail">Amazon Web Services account</div></div>
        <code style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--orange);background:rgba(255,153,0,0.08);padding:5px 10px;border-radius:6px">123456789012</code>
      </div>
      <div class="settings-row">
        <div><div class="settings-label">AWS IAM Role</div><div class="settings-detail">SageMaker execution role</div></div>
        <span class="status-badge running">Connected</span>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-title">Deployment Defaults</div>
      <div class="settings-row">
        <div><div class="settings-label">Auto-scaling</div><div class="settings-detail">Automatically scale replicas based on load</div></div>
        <div class="toggle on" onclick="this.classList.toggle('on')"></div>
      </div>
      <div class="settings-row">
        <div><div class="settings-label">Model Drift Alerts</div><div class="settings-detail">Alert when feature distribution shifts > 10%</div></div>
        <div class="toggle on" onclick="this.classList.toggle('on')"></div>
      </div>
      <div class="settings-row">
        <div><div class="settings-label">Blue-Green Deployment</div><div class="settings-detail">Zero-downtime deployments</div></div>
        <div class="toggle on" onclick="this.classList.toggle('on')"></div>
      </div>
      <div class="settings-row">
        <div><div class="settings-label">Cost Optimization</div><div class="settings-detail">Scale to zero for idle endpoints</div></div>
        <div class="toggle" onclick="this.classList.toggle('on')"></div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-title">Notifications</div>
      <div class="settings-row">
        <div><div class="settings-label">Email Alerts</div><div class="settings-detail">Critical alerts via email</div></div>
        <div class="toggle on" onclick="this.classList.toggle('on')"></div>
      </div>
      <div class="settings-row">
        <div><div class="settings-label">Slack Integration</div><div class="settings-detail">Pipeline & deployment notifications</div></div>
        <div class="toggle on" onclick="this.classList.toggle('on')"></div>
      </div>
      <div class="settings-row">
        <div><div class="settings-label">PagerDuty</div><div class="settings-detail">On-call alerts for critical incidents</div></div>
        <div class="toggle" onclick="this.classList.toggle('on')"></div>
      </div>
    </div>
  `;
}

// ─── Deploy Wizard (in Deploy page) ──────────────────────────
function loadDeployWizard() {
  const wiz = document.getElementById('deployWizard');
  if (!wiz) return;

  wiz.innerHTML = `
    <div class="wizard-step">
      <div class="wizard-step-header">
        <div class="wizard-step-num">1</div>
        <div><div class="wizard-step-title">Choose Cloud Provider</div><p style="font-size:12px;color:var(--text-muted)">Select GCP Vertex AI or AWS SageMaker</p></div>
      </div>
      <div class="cloud-select-grid">
        <div class="cloud-option active" id="wiz-gcp" onclick="selectWizCloud('gcp')">
          <div class="cloud-option-icon">
            <svg width="36" height="36" viewBox="0 0 24 24"><path d="M12 6.08c3.23 0 6.05 1.47 7.93 3.77L23 6.78C20.66 3.43 16.58 1 12 1 7.43 1 3.35 3.43 1 6.78l3.07 3.07C5.95 7.55 8.77 6.08 12 6.08z" fill="#EA4335"/><path d="M22.99 12c0-.88-.09-1.74-.25-2.57L12 9.43v4.57h6.15c-.65 3.06-2.86 5.39-5.75 6.43l3.1 3.1C19.36 21.44 22.99 17.1 22.99 12z" fill="#4285F4"/><path d="M5.09 15.77C4.72 14.6 4.5 13.33 4.5 12c0-1.33.22-2.6.59-3.77L2.01 5.18C.72 7.18 0 9.51 0 12c0 2.49.72 4.82 2.01 6.82l3.08-3.05z" fill="#FBBC05"/><path d="M12 23c3.23 0 6.05-1.23 8.12-3.23l-3.1-3.1C15.71 17.55 13.95 18 12 18c-3.45 0-6.36-2.33-7.37-5.5L1.51 15.6C3.85 19.75 7.67 23 12 23z" fill="#34A853"/></svg>
          </div>
          <span class="cloud-option-name">Google Cloud Platform</span>
          <span class="cloud-option-service">Vertex AI Endpoints</span>
        </div>
        <div class="cloud-option" id="wiz-aws" onclick="selectWizCloud('aws')">
          <div class="cloud-option-icon" style="font-size:32px">☁</div>
          <span class="cloud-option-name">Amazon Web Services</span>
          <span class="cloud-option-service">SageMaker Real-time</span>
        </div>
      </div>
    </div>

    <div class="wizard-step">
      <div class="wizard-step-header">
        <div class="wizard-step-num">2</div>
        <div><div class="wizard-step-title">Model Configuration</div><p style="font-size:12px;color:var(--text-muted)">Set model name, framework, and artifact path</p></div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Model Name</label>
          <input type="text" class="form-input" placeholder="e.g. my-model-v1" />
        </div>
        <div class="form-group">
          <label class="form-label">ML Framework</label>
          <select class="form-select">
            <option>TensorFlow 2.x</option><option>PyTorch 2.x</option><option>scikit-learn</option><option>XGBoost</option><option>Hugging Face</option>
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Model Artifact URI</label>
          <input type="text" class="form-input" placeholder="gs://my-bucket/models/ or s3://my-bucket/model/" />
        </div>
      </div>
    </div>

    <div class="wizard-step">
      <div class="wizard-step-header">
        <div class="wizard-step-num">3</div>
        <div><div class="wizard-step-title">Compute Resources</div><p style="font-size:12px;color:var(--text-muted)">Choose instance type and scaling policy</p></div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Machine Type</label>
          <select class="form-select">
            <option>n1-standard-4 (CPU)</option><option>n1-highmem-8 (CPU)</option><option>n1-standard-8 + T4 GPU</option><option>a2-highgpu-1g (A100)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Accelerator</label>
          <select class="form-select">
            <option>None</option><option>NVIDIA T4 (16GB)</option><option>NVIDIA A100 (40GB)</option><option>NVIDIA V100 (16GB)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Min Replicas</label>
          <input type="number" class="form-input" value="1" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Max Replicas</label>
          <input type="number" class="form-input" value="10" min="1" />
        </div>
      </div>
    </div>

    <div style="display:flex;justify-content:flex-end;margin-top:8px">
      <button class="btn-primary" onclick="fakeDeployFromWizard()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        Launch Deployment
      </button>
    </div>
  `;
}

function selectWizCloud(cloud) {
  document.getElementById('wiz-gcp').classList.toggle('active', cloud==='gcp');
  document.getElementById('wiz-aws').classList.toggle('active', cloud==='aws');
}

function fakeDeployFromWizard() {
  showToast('🚀 Deployment initiated! ETA: ~3 minutes', 'success');
  setTimeout(() => showToast('Model registered in Model Registry', 'info'), 1500);
  setTimeout(() => showToast('Endpoint created and warming up...', 'info'), 3000);
  setTimeout(() => showToast('✅ Deployment successful!', 'success'), 5000);
}

// ─── Cloud Switch ─────────────────────────────────────────────
function switchCloud(cloud) {
  currentCloud = cloud;
  document.getElementById('gcpBtn').classList.toggle('active', cloud==='gcp');
  document.getElementById('awsBtn').classList.toggle('active', cloud==='aws');

  const indicator = document.getElementById('cloudIndicator');
  if (indicator) {
    const dot = indicator.querySelector('.cloud-dot');
    dot.className = 'cloud-dot ' + (cloud === 'gcp' ? 'gcp-dot' : 'aws-dot');
    indicator.querySelector('span').textContent = cloud === 'gcp' ? 'GCP · us-central1' : 'AWS · us-east-1';
  }
  showToast(`Switched to ${cloud === 'gcp' ? 'Google Cloud Platform' : 'Amazon Web Services'}`, 'info');
}

// ─── Navigation ───────────────────────────────────────────────
const pageLabels = {
  dashboard:'Overview', models:'Model Registry', deploy:'New Deployment',
  endpoints:'API Endpoints', metrics:'Performance', logs:'System Logs',
  alerts:'Alert Center', pipelines:'ML Pipelines', storage:'Model Storage', settings:'Platform Settings'
};

function navigateTo(page, el) {
  event?.preventDefault();
  currentPage = page;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  else document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

  // Update breadcrumb
  document.getElementById('breadcrumbCurrent').textContent = pageLabels[page] || page;

  // Show page
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(page + 'Page');
  if (target) target.classList.add('active');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ─── Deploy Modal ─────────────────────────────────────────────
function openDeployModal() {
  currentStep = 1;
  updateStep();
  document.getElementById('deployModal').classList.add('open');
}

function closeDeployModal() {
  document.getElementById('deployModal').classList.remove('open');
}

function openRegisterModal() {
  showToast('Model registration form coming soon!', 'info');
}

document.getElementById('deployModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeDeployModal();
});

function selectCloudOption(cloud) {
  selectedCloudForDeploy = cloud;
  document.getElementById('gcpOption').classList.toggle('active', cloud==='gcp');
  document.getElementById('awsOption').classList.toggle('active', cloud==='aws');

  // Update instance types
  const inst = document.getElementById('instanceType');
  if (inst) {
    inst.innerHTML = cloud === 'gcp'
      ? '<option>n1-standard-4 (4 vCPU, 15GB)</option><option>n1-highmem-8 (8 vCPU, 52GB)</option><option>a2-highgpu-1g (T4 GPU)</option><option>a2-ultragpu-1g (A100 GPU)</option>'
      : '<option>ml.m5.xlarge (4 vCPU, 16GB)</option><option>ml.m5.4xlarge (16 vCPU, 64GB)</option><option>ml.p3.2xlarge (V100 GPU)</option><option>ml.p4d.24xlarge (8×A100)</option>';
  }
}

function nextStep() {
  if (currentStep === 3) {
    // Deploy!
    closeDeployModal();
    showToast('🚀 Deployment initiated on ' + (selectedCloudForDeploy === 'gcp' ? 'GCP Vertex AI' : 'AWS SageMaker'), 'success');
    setTimeout(() => showToast('Model registered successfully', 'info'), 1500);
    setTimeout(() => showToast('Endpoint warming up...', 'info'), 3000);
    setTimeout(() => showToast('✅ Deployment complete!', 'success'), 5000);
    return;
  }

  if (currentStep === 2) {
    // Build review panel
    const panel = document.getElementById('reviewPanel');
    const name = document.getElementById('modelName')?.value || 'my-model-v1';
    const fw   = document.getElementById('framework')?.value || 'TensorFlow 2.x';
    const uri  = document.getElementById('modelUri')?.value   || 'gs://bucket/models/';
    const inst = document.getElementById('instanceType')?.value || 'n1-standard-4';
    const minR = document.getElementById('minReplicas')?.value || '1';
    const maxR = document.getElementById('maxReplicas')?.value || '10';
    if (panel) {
      panel.innerHTML = `
        <div class="review-row"><span class="review-key">Cloud Provider</span><span class="review-val">${selectedCloudForDeploy === 'gcp' ? '☁ GCP Vertex AI' : '☁ AWS SageMaker'}</span></div>
        <div class="review-row"><span class="review-key">Model Name</span><span class="review-val">${name}</span></div>
        <div class="review-row"><span class="review-key">Framework</span><span class="review-val">${fw}</span></div>
        <div class="review-row"><span class="review-key">Artifact URI</span><span class="review-val" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--cyan)">${uri}</span></div>
        <div class="review-row"><span class="review-key">Instance Type</span><span class="review-val">${inst}</span></div>
        <div class="review-row"><span class="review-key">Scaling</span><span class="review-val">${minR} → ${maxR} replicas</span></div>
        <div class="review-row"><span class="review-key">Estimated Cost</span><span class="review-val" style="color:var(--green)">~$${Math.floor(Math.random()*50+20)}/day</span></div>
      `;
    }
  }

  currentStep = Math.min(currentStep + 1, 3);
  updateStep();
}

function prevStep() {
  currentStep = Math.max(currentStep - 1, 1);
  updateStep();
}

function updateStep() {
  document.querySelectorAll('.form-step').forEach((s,i) => s.classList.toggle('active', i+1 === currentStep));
  document.querySelectorAll('.step-dot').forEach((d,i) => d.classList.toggle('active', i+1 === currentStep));
  document.getElementById('prevBtn').style.display = currentStep > 1 ? 'flex' : 'none';
  document.getElementById('nextBtn').textContent = currentStep === 3 ? '🚀 Deploy Now' : 'Next →';
}

// ─── Time range toggle ────────────────────────────────────────
function setTimeRange(range, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  showToast(`Showing ${range} data`, 'info');
}

// ─── Refresh table ────────────────────────────────────────────
function refreshTable() {
  const btn = event.target.closest('button');
  btn.style.opacity = '0.5';
  setTimeout(() => {
    populateTable();
    btn.style.opacity = '1';
    showToast('Table refreshed', 'success');
  }, 800);
}

// ─── Real-time updates ────────────────────────────────────────
function startRealTimeUpdates() {
  setInterval(() => {
    // Randomly update KPIs
    const rpmEl = document.querySelector('.kpi-value[data-target="18423"]');
    if (rpmEl) {
      const val = 18000 + Math.floor(Math.random() * 1000);
      rpmEl.textContent = val.toLocaleString();
    }
    const latEl = document.querySelector('.kpi-value[data-target="42"]');
    if (latEl) {
      const val = 38 + Math.floor(Math.random() * 10);
      latEl.textContent = val + 'ms';
    }
  }, 3000);
}

// ─── Toast ───────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const icons = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
    info:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ─── Utility ─────────────────────────────────────────────────
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Code Guide & IaC Tabs ───────────────────────────────────
const guideData = {
  gcp: `
    <div style="font-size:12px; margin-bottom:12px; border-bottom:1px solid var(--bg-border); padding-bottom:12px;">
      <strong>GCP Deployment Guides</strong>: Run standard Docker serving on Cloud Run or utilize standard GCP Vertex AI Model Registry and Endpoint APIs.
    </div>
    
    <div class="nav-section-label" style="padding-top:0;">GCP Cloud Run Deploy Script (deploy_cloud_run.sh)</div>
    <pre style="background:var(--bg-input); padding:12px; border-radius:6px; border:1px solid var(--bg-border); overflow-x:auto; font-family:'JetBrains Mono',monospace; font-size:11px; color:#cbd5e1; margin-bottom:14px; max-height:220px; text-align:left;">
# Authenticate and set project
gcloud auth login
gcloud config set project ml-prod-438210

# Enable needed services
gcloud services enable artifactregistry.googleapis.com run.googleapis.com

# Create Repo and Build Container
gcloud artifacts repositories create ml-deploy-repo --repository-format=docker --location=us-central1
gcloud builds submit ../backend --tag us-central1-docker.pkg.dev/ml-prod-438210/ml-deploy-repo/fraud-detector-api:latest

# Deploy to Cloud Run
gcloud run deploy fraud-detector-service \\
  --image us-central1-docker.pkg.dev/ml-prod-438210/ml-deploy-repo/fraud-detector-api:latest \\
  --platform managed --region us-central1 --allow-unauthenticated --memory 2Gi --cpu 2
    </pre>

    <div class="nav-section-label">Terraform configuration (terraform/main.tf)</div>
    <pre style="background:var(--bg-input); padding:12px; border-radius:6px; border:1px solid var(--bg-border); overflow-x:auto; font-family:'JetBrains Mono',monospace; font-size:11px; color:#cbd5e1; max-height:220px; text-align:left;">
resource "google_artifact_registry_repository" "ml_repo" {
  location      = "us-central1"
  repository_id = "ml-deploy-repo"
  format        = "DOCKER"
}

resource "google_cloud_run_service" "model_service" {
  name     = "fraud-detector-service"
  location = "us-central1"
  template {
    spec {
      containers {
        image = "us-central1-docker.pkg.dev/ml-prod-438210/ml-deploy-repo/fraud-detector-api:latest"
        ports { container_port = 8080 }
        resources { limits = { memory = "2Gi", cpu = "2" } }
      }
    }
  }
}
    </pre>
  `,
  aws: `
    <div style="font-size:12px; margin-bottom:12px; border-bottom:1px solid var(--bg-border); padding-bottom:12px;">
      <strong>AWS Deployment Guides</strong>: Build container image, push to AWS ECR, deploy using AWS App Runner or upload weights to S3 and deploy to SageMaker.
    </div>
    
    <div class="nav-section-label" style="padding-top:0;">AWS App Runner Deploy Script (deploy_app_runner.sh)</div>
    <pre style="background:var(--bg-input); padding:12px; border-radius:6px; border:1px solid var(--bg-border); overflow-x:auto; font-family:'JetBrains Mono',monospace; font-size:11px; color:#cbd5e1; margin-bottom:14px; max-height:220px; text-align:left;">
# Log into AWS ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Create Repo and Build Container
aws ecr create-repository --repository-name fraud-detector-repo --region us-east-1
docker build -t fraud-detector-repo:latest ../backend
docker tag fraud-detector-repo:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/fraud-detector-repo:latest

# Push to ECR
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/fraud-detector-repo:latest

# Create App Runner Service
aws apprunner create-service --service-name fraud-detector-service \\
  --source-configuration "{\\"ImageRepository\\": {\\"ImageIdentifier\\": \\"123456789012.dkr.ecr.us-east-1.amazonaws.com/fraud-detector-repo:latest\\", \\"ImageRepositoryType\\": \\"ECR\\", \\"ImageConfiguration\\": {\\"Port\\": \\"8080\\"}}, \\"AuthenticationConfiguration\\": {\\"AccessRoleArn\\": \\"arn:aws:iam::123456789012:role/AppRunnerECRAccessRole\\"}}"
    </pre>

    <div class="nav-section-label">AWS SageMaker SDK Deploy (deploy_sagemaker.py)</div>
    <pre style="background:var(--bg-input); padding:12px; border-radius:6px; border:1px solid var(--bg-border); overflow-x:auto; font-family:'JetBrains Mono',monospace; font-size:11px; color:#cbd5e1; max-height:220px; text-align:left;">
import boto3
sagemaker = boto3.client('sagemaker', region_name='us-east-1')

# Create SageMaker Model resource
sagemaker.create_model(
    ModelName='fraud-detector-sagemaker-v3',
    PrimaryContainer={
        'Image': '683313688378.dkr.ecr.us-east-1.amazonaws.com/sagemaker-scikit-learn:1.0-1-cpu-py3',
        'ModelDataUrl': 's3://sagemaker-ml-models-bucket-prod/models/model.tar.gz'
    },
    ExecutionRoleArn='arn:aws:iam::123456789012:role/service-role/AmazonSageMaker-ExecutionRole'
)

# Create Endpoint configuration & Endpoint
sagemaker.create_endpoint_config(
    EndpointConfigName='fraud-detector-endpoint-config',
    ProductionVariants=[{'VariantName': 'AllTraffic', 'ModelName': 'fraud-detector-sagemaker-v3', 'InitialInstanceCount': 1, 'InstanceType': 'ml.m5.large'}]
)
sagemaker.create_endpoint(EndpointName='fraud-detector-active-endpoint', EndpointConfigName='fraud-detector-endpoint-config')
    </pre>
  `
};

function setGuideTab(cloud) {
  const gcpBtn = document.getElementById('guideGcpBtn');
  const awsBtn = document.getElementById('guideAwsBtn');
  if (gcpBtn && awsBtn) {
    gcpBtn.classList.toggle('active', cloud === 'gcp');
    awsBtn.classList.toggle('active', cloud === 'aws');
  }
  const guideContent = document.getElementById('guideContent');
  if (guideContent) {
    guideContent.innerHTML = guideData[cloud] || '';
  }
}

// ─── Live Backend Integration ────────────────────────────────
let isLocalApiOnline = false;

function getBackendUrl() {
  // Use the same hostname serving the page (e.g. 192.168.x.x) so mobile devices connect properly
  const hostname = window.location.hostname || 'localhost';
  return `http://${hostname}:8085`;
}

function checkBackendStatus() {
  const indicator = document.getElementById('sandboxApiIndicator');
  const statusText = document.getElementById('sandboxApiStatus');
  if (!indicator || !statusText) return;

  fetch(getBackendUrl() + '/')
    .then(res => {
      if (res.ok) {
        isLocalApiOnline = true;
        statusText.innerText = "Local API: Connected";
        indicator.querySelector('.cloud-dot').style.background = "var(--green)";
        indicator.querySelector('.cloud-dot').style.boxShadow = "0 0 6px var(--green)";
      } else {
        throw new Error();
      }
    })
    .catch(() => {
      isLocalApiOnline = false;
      statusText.innerText = "Local API: Offline (Mock Mode)";
      indicator.querySelector('.cloud-dot').style.background = "var(--orange)";
      indicator.querySelector('.cloud-dot').style.boxShadow = "0 0 6px var(--orange)";
    });
}

function runSandboxInference(event) {
  event.preventDefault();
  
  const loading = document.getElementById('sandboxLoading');
  const placeholder = document.getElementById('sandboxPlaceholder');
  const result = document.getElementById('sandboxResult');
  
  if (loading) loading.style.display = 'flex';
  if (placeholder) placeholder.style.display = 'none';
  if (result) result.style.display = 'none';

  // Read form inputs
  const amount = parseFloat(document.getElementById('sb_amount').value);
  const latency = parseFloat(document.getElementById('sb_latency').value);
  const distance = parseFloat(document.getElementById('sb_distance').value);
  const device_score = parseFloat(document.getElementById('sb_device_score').value);
  const velocity = parseFloat(document.getElementById('sb_velocity').value);
  const age = parseFloat(document.getElementById('sb_age').value);
  const category_risk = parseFloat(document.getElementById('sb_category_risk').value);
  const country_match = document.getElementById('sb_country_match').classList.contains('on') ? 1.0 : 0.0;

  if (isLocalApiOnline) {
    // Send request to real FastAPI server
    const requestData = {
      amount,
      time: 3600.0, // static dummy
      latency,
      distance,
      device_score,
      country_match,
      velocity,
      age,
      category_risk,
      card_type_risk: 0.08 // static dummy
    };

    const startTime = performance.now();
    fetch(getBackendUrl() + '/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    })
    .then(res => {
      if (!res.ok) throw new Error("Inference call failed");
      return res.json();
    })
    .then(data => {
      const duration = Math.round(performance.now() - startTime);
      displaySandboxResult(data.fraud_probability, data.is_fraud, "Local FastAPI Server", `${duration}ms`);
    })
    .catch(err => {
      console.error(err);
      showToast("Error invoking API endpoint. Falling back to mock prediction.", "error");
      fallbackMockPrediction(amount, latency, distance, device_score, velocity, age, category_risk, country_match);
    });
  } else {
    // Mock simulation
    setTimeout(() => {
      fallbackMockPrediction(amount, latency, distance, device_score, velocity, age, category_risk, country_match);
    }, 400);
  }
}

function fallbackMockPrediction(amount, latency, distance, device_score, velocity, age, category_risk, country_match) {
  // Simple heuristic model:
  // Base risk increases with transaction amount, category risk, distance
  // Risk decreases with device security score, account age
  // High latency and country mismatches add risk
  let riskScore = 0.05; // base risk
  
  riskScore += (amount / 2000) * 0.3; // max 0.3
  riskScore += category_risk * 0.4;    // max 0.26
  riskScore += (distance / 500) * 0.15; // max 0.15
  riskScore += (1.0 - device_score) * 0.2; // max 0.2
  riskScore += (velocity / 20) * 0.15;  // max 0.15
  riskScore -= (age / 365) * 0.1;       // max -0.1
  riskScore += (latency > 200 ? 0.1 : 0.0);
  riskScore += (country_match === 0.0 ? 0.25 : 0.0);

  // Bounds
  riskScore = Math.max(0.01, Math.min(0.99, riskScore));
  
  const is_fraud = riskScore > 0.48;
  displaySandboxResult(riskScore, is_fraud, "Mock Sandbox API", `${Math.floor(Math.random() * 8 + 3)}ms`);
}

function displaySandboxResult(prob, isFraud, source, responseTime) {
  const loading = document.getElementById('sandboxLoading');
  const result = document.getElementById('sandboxResult');
  const badge = document.getElementById('resultStatusBadge');
  const text = document.getElementById('resultProbText');
  const bar = document.getElementById('resultProbBar');
  const servingText = document.getElementById('resultServingApi');
  const timeText = document.getElementById('resultTime');

  if (loading) loading.style.display = 'none';
  if (result) result.style.display = 'block';

  const percent = (prob * 100).toFixed(1);
  text.innerText = `${percent}%`;
  bar.style.width = `${percent}%`;
  servingText.innerText = source;
  timeText.innerText = responseTime;

  if (isFraud) {
    badge.innerText = "SUSPICIOUS";
    badge.className = "status-badge stopped"; // styled as red stopped tag
    bar.style.background = "var(--red)";
    showToast("⚠️ Transaction flagged as suspicious!", "warning");
  } else {
    badge.innerText = "NORMAL";
    badge.className = "status-badge running"; // styled as green running tag
    bar.style.background = "var(--gradient)";
  }
}

// Load Chart.js
const chartScript = document.createElement('script');
chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
chartScript.onload = () => {
  initCharts();
  renderMetricCharts();
};
document.head.appendChild(chartScript);
