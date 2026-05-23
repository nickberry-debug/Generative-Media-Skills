const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schema_data.json'), 'utf8'));
const BASE_URL = 'https://api.muapi.ai/api/v1';

// ── Model registry ──────────────────────────────────────────────────────────

const CATEGORIES = ['Text to Image', 'Text to Video', 'Image to Video'];

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

// ── Routes ──────────────────────────────────────────────────────────────────

app.get('/api/models', (req, res) => {
  res.json(getModels());
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
      headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
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
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
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
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/balance', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'No API key' });

  try {
    const response = await fetch(`${BASE_URL}/account/balance`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Generative Media Studio`);
  console.log(`  http://localhost:${PORT}\n`);
});
