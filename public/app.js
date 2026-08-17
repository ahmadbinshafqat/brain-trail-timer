const map = L.map('map').setView([37.83, -122.48], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
  draw: {
    polygon: false,
    rectangle: false,
    circle: false,
    marker: false,
    circlemarker: false,
    polyline: { shapeOptions: { color: '#2563eb', weight: 5 } }
  },
  edit: { featureGroup: drawnItems }
});
map.addControl(drawControl);

let currentGeoJSON = null;

map.on(L.Draw.Event.CREATED, (event) => {
  drawnItems.clearLayers();
  drawnItems.addLayer(event.layer);
  currentGeoJSON = event.layer.toGeoJSON();
  setStatus('Route drawn. Add your inputs and estimate.', 'ok');
});

map.on(L.Draw.Event.EDITED, () => {
  currentGeoJSON = drawnItems.toGeoJSON();
});

map.on(L.Draw.Event.DELETED, () => {
  currentGeoJSON = null;
});

document.getElementById('clear-route').addEventListener('click', () => {
  drawnItems.clearLayers();
  currentGeoJSON = null;
  document.getElementById('geojson-file').value = '';
  setStatus('Route cleared.', '');
});

document.getElementById('geojson-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const geojson = JSON.parse(text);
    loadGeoJSONOnMap(geojson);
    currentGeoJSON = geojson;
    setStatus(`Loaded ${file.name}.`, 'ok');
  } catch (error) {
    setStatus('Could not read that GeoJSON file.', 'error');
  }
});

document.getElementById('estimate-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentGeoJSON) {
    setStatus('Draw a route or upload a GeoJSON route first.', 'error');
    return;
  }

  const payload = {
    name: document.getElementById('route-name').value.trim(),
    geojson: currentGeoJSON,
    elevationGainM: Number(document.getElementById('elevation').value)
  };

  try {
    setStatus('Saving route and calculating estimate...', '');
    const routeResponse = await fetch('/api/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const routeData = await routeResponse.json();
    if (!routeResponse.ok) throw new Error(readError(routeData));

    const estimateResponse = await fetch('/api/estimates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routeId: routeData.route.id,
        paceMinPerKm: Number(document.getElementById('pace').value),
        stopMinutes: Number(document.getElementById('stops').value)
      })
    });
    const estimateData = await estimateResponse.json();
    if (!estimateResponse.ok) throw new Error(readError(estimateData));

    renderResult(estimateData.breakdown);
    setStatus('Estimate saved.', 'ok');
    loadRecentRoutes();
  } catch (error) {
    setStatus(error.message || 'Something went wrong.', 'error');
  }
});

function loadGeoJSONOnMap(geojson) {
  drawnItems.clearLayers();
  const layer = L.geoJSON(geojson, { style: { color: '#2563eb', weight: 5 } });
  layer.eachLayer((l) => drawnItems.addLayer(l));
  if (drawnItems.getLayers().length > 0) {
    map.fitBounds(drawnItems.getBounds(), { padding: [30, 30] });
  }
}

function renderResult(b) {
  document.getElementById('result').classList.remove('hidden');
  document.getElementById('total-time').textContent = formatMinutes(b.totalMinutes);
  document.getElementById('distance').textContent = `${b.distanceKm.toFixed(2)} km`;
  document.getElementById('base').textContent = `${formatMinutes(b.baseWalkingMinutes)} at ${b.paceMinPerKm} min/km`;
  document.getElementById('elevation-penalty').textContent = `${formatMinutes(b.elevationPenaltyMinutes)} for ${b.elevationGainM} m gain`;
  document.getElementById('stop-penalty').textContent = formatMinutes(b.stopMinutes);
}

async function loadRecentRoutes() {
  const response = await fetch('/api/routes');
  const data = await response.json();
  const container = document.getElementById('recent-routes');
  container.innerHTML = '';
  for (const route of data.routes) {
    const item = document.createElement('div');
    item.className = 'route-card';
    item.innerHTML = `
      <strong>${escapeHtml(route.name)}</strong>
      <span>${Number(route.distanceKm).toFixed(2)} km · ${Number(route.elevationGainM).toFixed(0)} m gain</span>
      <small>${route.latestTotalMinutes ? `Latest estimate: ${formatMinutes(route.latestTotalMinutes)}` : 'No estimate yet'}</small>
    `;
    container.appendChild(item);
  }
}

function setStatus(message, type) {
  const el = document.getElementById('status');
  el.textContent = message;
  el.className = `status ${type || ''}`;
}

function formatMinutes(value) {
  const minutes = Math.round(Number(value));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m} min`;
  return `${h} hr ${m} min`;
}

function readError(data) {
  if (typeof data.error === 'string') return data.error;
  return 'Request failed. Check your inputs and route geometry.';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

loadRecentRoutes();
