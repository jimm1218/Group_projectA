const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8001);
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

loadLocalEnv(path.join(ROOT, '.env.local'));
loadLocalEnv(path.join(ROOT, '.env'));

function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (key && value && !process.env[key]) process.env[key] = value;
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        req.destroy();
        reject(new Error('Request body is too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON request body'));
      }
    });
    req.on('error', reject);
  });
}

function buildGeminiPrompt(review, rag) {
  return `${rag.prompt_template}

LOCAL_RAG_DRAFT:
${rag.local_reply}

GENERATION_SEED:
${rag.generation_seed || Date.now()}

OUTPUT_CONTRACT:
請只輸出一段可直接貼上的繁體中文品牌回覆。
限制：
- 不要輸出 Markdown。
- 不要承認法律責任。
- 不要承諾退款、賠償、折扣或優惠。
- 不要編造門市電話、政策、調查結果或未確認事實。
- 高風險時，引導顧客私訊或提供用餐時間與品項，並表示會交由主管追蹤。
- 回覆要比 LOCAL_RAG_DRAFT 更自然、更貼近評論內容，但仍遵守 KB/SOP。
- 每次生成請改寫句型、開頭和收尾，不要照抄 LOCAL_RAG_DRAFT。

REVIEW_JSON:
${JSON.stringify(review, null, 2)}`;
}

async function callGemini(review, rag) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured');
    err.status = 503;
    throw err;
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const prompt = buildGeminiPrompt(review, rag);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 1.0,
        topP: 0.95,
        maxOutputTokens: 360
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || `Gemini API returned ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  const replyText = data.candidates?.[0]?.content?.parts
    ?.map(part => part.text || '')
    .join('')
    .trim();

  if (!replyText) {
    const err = new Error('Gemini API returned no text');
    err.status = 502;
    throw err;
  }

  return { reply_text: replyText, model };
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const filePath = path.normalize(path.join(ROOT, pathname));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.md': 'text/markdown; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/gemini-reply') {
    try {
      const body = await readJsonBody(req);
      const result = await callGemini(body.review || {}, body.rag || {});
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, err.status || 500, { error: err.message || 'Gemini gateway failed' });
    }
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  const keyStatus = process.env.GEMINI_API_KEY ? 'configured' : 'missing';
  console.log(`Gemini RAG preview server running at http://localhost:${PORT}`);
  console.log(`GEMINI_API_KEY: ${keyStatus}`);
  console.log(`GEMINI_MODEL: ${DEFAULT_MODEL}`);
});
