const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Auto-shutdown on inactivity ──────────────────────────────────────────────
const IDLE_TIMEOUT_MS = 45 * 1000;
let lastActivity = Date.now();

app.use((req, res, next) => {
  lastActivity = Date.now();
  next();
});

setInterval(() => {
  if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
    console.log(`\n  Idle for ${IDLE_TIMEOUT_MS / 1000}s — shutting down.`);
    process.exit(0);
  }
}, 5000);

const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schema_data.json'), 'utf8'));
const BASE_URL = 'https://api.muapi.ai/api/v1';

// ── Auth ─────────────────────────────────────────────────────────────────────

const PASSWORD = 'Nab#1754';
const SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const SESSION_COOKIE = 'ms_session';

function makeToken() {
  return crypto.createHmac('sha256', SESSION_SECRET).update(PASSWORD).digest('hex');
}

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const pair = raw.split(';').map(s => s.trim()).find(s => s.startsWith(name + '='));
  return pair ? decodeURIComponent(pair.split('=').slice(1).join('=')) : null;
}

function isAuthenticated(req) {
  const token = getCookie(req, SESSION_COOKIE);
  return token === makeToken();
}

const loginPage = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Media Studio — Login</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d0d0f;
    color:#e8e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .card{background:#18181c;border:1px solid #2e2e38;border-radius:14px;padding:40px;
    width:340px;display:flex;flex-direction:column;gap:20px}
  .logo{font-size:22px;font-weight:700;background:linear-gradient(135deg,#7c6af7,#a78bfa);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;text-align:center}
  .sub{font-size:13px;color:#888899;text-align:center;margin-top:-12px}
  label{font-size:12px;color:#888899;font-weight:500;margin-bottom:4px;display:block}
  input{width:100%;background:#22222a;border:1px solid #2e2e38;border-radius:8px;
    color:#e8e8f0;font-size:14px;padding:10px 14px;outline:none;transition:border-color .2s}
  input:focus{border-color:#7c6af7}
  button{background:linear-gradient(135deg,#7c6af7,#6366f1);color:#fff;border:none;
    border-radius:9px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;
    transition:opacity .2s;width:100%}
  button:hover{opacity:.9}
  .err{color:#f87171;font-size:13px;text-align:center;display:none}
</style>
</head>
<body>
<div class="card">
  <div class="logo">⚡ Media Studio</div>
  <div class="sub">Enter password to continue</div>
  <form method="POST" action="/login" onsubmit="return validate()">
    <div><label>Password</label><input type="password" name="password" id="pw" autofocus></div>
    <div class="err" id="err">Incorrect password</div>
    <button type="submit" style="margin-top:8px">Unlock</button>
  </form>
</div>
<script>
  const err = new URLSearchParams(location.search).get('error');
  if(err) document.getElementById('err').style.display='block';
  function validate(){const v=document.getElementById('pw').value;return v.length>0}
</script>
</body>
</html>`;

app.post('/login', (req, res) => {
  if (req.body.password === PASSWORD) {
    const token = makeToken();
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict`);
    res.redirect('/');
  } else {
    res.redirect('/login?error=1');
  }
});

app.get('/login', (req, res) => res.send(loginPage));

app.get('/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
  res.redirect('/login');
});

// Auth middleware — must come before static + API routes
app.use((req, res, next) => {
  if (req.path === '/login' || req.path === '/logout') return next();
  if (!isAuthenticated(req)) return res.redirect('/login');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ── Model registry ────────────────────────────────────────────────────────────

const CATEGORIES = ['Text to Image', 'Text to Video', 'Image to Video'];

// Rough cost estimates (USD) based on model family/tier
function estimateCost(modelId, category, duration) {
  const id = modelId.toLowerCase();
  const d = parseInt(duration) || 5;

  if (category === 'Text to Image') {
    if (/schnell|turbo|fast|lite|z-image-turbo/.test(id)) return '$0.01';
    if (/flux-dev|sdxl|wan2\.(1|2|5|6)-text-to-image|hidream.*fast|z-image-base/.test(id)) return '$0.02–0.04';
    if (/flux-2-(dev|flex)|hidream.*dev|chroma|hunyuan|seedream|qwen/.test(id)) return '$0.04–0.08';
    if (/flux-(kontext-pro|2-pro)|ideogram|nano-banana(?!-pro)|kling-o1-text-to-image/.test(id)) return '$0.08–0.15';
    if (/kontext-max|nano-banana-pro|leonardoai|reve|neta|perfect-pony|flux-krea/.test(id)) return '$0.10–0.20';
    if (/midjourney|gpt4o|gpt-image|imagen4-(fast|$)|google-imagen4$/.test(id)) return '$0.20–0.40';
    if (/imagen4-ultra|grok/.test(id)) return '$0.40–0.80';
    return '$0.04–0.08';
  }

  if (category === 'Text to Video' || category === 'Image to Video') {
    if (/lite|fast|5b|turbo-std|standard/.test(id)) return `~$${(0.06 * d).toFixed(2)}/gen`;
    if (/wan2\.(1|2|5|6)|hunyuan|pixverse|vidu|ltx|minimax.*standard/.test(id)) return `~$${(0.12 * d).toFixed(2)}/gen`;
    if (/seedance-pro|minimax.*pro|runway|kling-v2\.[156]/.test(id)) return `~$${(0.20 * d).toFixed(2)}/gen`;
    if (/kling-v2\.1-master|kling-v2\.5-turbo-pro|kling-o1|kling-v3\.0/.test(id)) return `~$${(0.30 * d).toFixed(2)}/gen`;
    if (/veo3(?!\.1)|sora-2(?!-pro)|openai-sora$/.test(id)) return `~$${(0.50 * d).toFixed(2)}/gen`;
    if (/veo3\.1|sora-2-pro|grok-imagine.*video/.test(id)) return `~$${(0.80 * d).toFixed(2)}/gen`;
    return `~$${(0.15 * d).toFixed(2)}/gen`;
  }

  return null;
}

function getEndpoint(model) {
  const m = SCHEMA.find(s => s.name === model);
  if (!m) return null;
  const schemas = m.input_schema?.schemas || {};
  for (const key of Object.keys(schemas)) {
    const ep = schemas[key]?.endpoint_url;
    if (ep) return ep;
  }
  return m.input_schema?.endpoint_url || m.name;
}

function getModels() {
  const result = {};
  for (const cat of CATEGORIES) {
    const seen = new Set();
    result[cat] = SCHEMA
      .filter(m => m.category === cat)
      .filter(m => {
        const ep = getEndpoint(m.name);
        if (!ep || seen.has(ep)) return false;
        seen.add(ep);
        return true;
      })
      .map(m => ({
        id: m.name,
        label: m.variant || m.name,
        family: m.family || '',
        description: m.description || '',
        endpoint: getEndpoint(m.name),
      }));
  }
  return result;
}

// ── API Routes ────────────────────────────────────────────────────────────────

app.get('/api/heartbeat', (req, res) => res.json({ alive: true }));

app.get('/api/models', (req, res) => res.json(getModels()));

app.get('/api/cost', (req, res) => {
  const { model, category, duration } = req.query;
  res.json({ estimate: estimateCost(model, category, duration) });
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'No API key' });

  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(req.file.path), req.file.originalname);
    const response = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, ...form.getHeaders() },
      body: form,
    });
    fs.unlinkSync(req.file.path);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate', async (req, res) => {
  const { model, payload } = req.body;
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'No API key' });
  if (!model) return res.status(400).json({ error: 'No model specified' });

  const endpoint = getEndpoint(model);
  if (!endpoint) return res.status(400).json({ error: `Unknown model: ${model}` });

  try {
    const response = await fetch(`${BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/result/:id', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'No API key' });

  try {
    const response = await fetch(
      `${BASE_URL}/predict/result?request_id=${req.params.id}`,
      { headers: { 'x-api-key': apiKey } }
    );
    res.json(await response.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const OUTPUT_DIR = path.join(__dirname, '..', 'media_outputs');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

app.post('/api/save', async (req, res) => {
  const { url, model } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL' });

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

    const ext = (url.split('?')[0].split('.').pop() || 'bin').toLowerCase();
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeModel = (model || 'media').replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
    const filename = `${ts}_${safeModel}.${ext}`;
    const filepath = path.join(OUTPUT_DIR, filename);

    const buffer = await response.buffer();
    fs.writeFileSync(filepath, buffer);
    res.json({ saved: true, path: filepath, filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/balance', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'No API key' });

  try {
    const response = await fetch(`${BASE_URL}/account/balance`, {
      headers: { 'x-api-key': apiKey },
    });
    res.json(await response.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Generative Media Studio`);
  console.log(`  http://localhost:${PORT}\n`);
});
