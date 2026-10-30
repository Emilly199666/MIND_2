/* ============================================================
   MIND · 脑海  —  本地持久化服务器（零依赖 Node）
   ------------------------------------------------------------
   作用：
   1. 以稳定的 http://127.0.0.1:8000 提供静态页面（origin 固定，
      彻底消除 file:// 与多端口导致 localStorage 互相看不到的问题）。
   2. 把所有数据以 JSON 落盘到 data/mind_data.json（权威副本，
      与浏览器/缓存无关，永不因清缓存而丢失）。
   3. 每次保存同时写入 data/backups/mind_data-<时间戳>.json 滚动备份
      （默认保留最近 20 份），任意一次出错都可回滚。

   启动：  node server.js            （默认 8000 端口）
           PORT=9000 node server.js  （自定义端口）
   仅监听 127.0.0.1（本机），不对外暴露。
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const STATE_FILE = path.join(DATA_DIR, 'mind_data.json');
const PORT = parseInt(process.env.PORT, 10) || 8000;
const HOST = '127.0.0.1';
const MAX_BACKUPS = 20;

// 确保目录存在
function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/* ---------- 静态文件服务 ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function serveStatic(req, res, urlPath) {
  // 防目录穿越
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let rel = safePath === '/' || safePath === '' ? 'index.html' : safePath.replace(/^\/+/, '');
  let filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // 找不到则返回 index.html（兼容前端路由）
      filePath = path.join(ROOT, 'index.html');
    }
    fs.readFile(filePath, (e2, buf) => {
      if (e2) { res.writeHead(404); res.end('Not found'); return; }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(buf);
    });
  });
}

/* ---------- 数据读写（带滚动备份） ---------- */
function readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[mind] 读取数据失败:', e.message);
    return null;
  }
}

function rotateBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => /^mind_data-\d{14}\.json$/.test(f))
      .map(f => ({ name: f, full: path.join(BACKUP_DIR, f) }))
      .sort((a, b) => b.name.localeCompare(a.name)); // 新→旧
    // 保留最新 MAX_BACKUPS-1 份，超出删除
    files.slice(MAX_BACKUPS - 1).forEach(f => {
      try { fs.unlinkSync(f.full); } catch (e) {}
    });
  } catch (e) { /* 忽略 */ }
}

function writeState(payloadStr) {
  ensureDirs();
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
  const backupPath = path.join(BACKUP_DIR, `mind_data-${ts}.json`);
  // 先写一份带时间戳的备份
  fs.writeFileSync(backupPath, payloadStr, 'utf8');
  // 原子式覆盖主文件：先写临时文件再 rename
  const tmpPath = STATE_FILE + '.tmp';
  fs.writeFileSync(tmpPath, payloadStr, 'utf8');
  fs.renameSync(tmpPath, STATE_FILE);
  rotateBackups();
}

/* ---------- API 路由 ---------- */
function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

function handleApi(req, res, url) {
  // 健康检查
  if (url.pathname === '/api/ping') {
    sendJSON(res, 200, { ok: true, time: Date.now() });
    return;
  }

  // 读取数据（权威副本）
  if (url.pathname === '/api/state' && req.method === 'GET') {
    const file = readState();
    if (file == null) { sendJSON(res, 404, { ok: false, message: '尚无本地数据' }); return; }
    // 磁盘格式为 { data: <真实状态>, savedAt }，此处把真实状态解包出来返回
    sendJSON(res, 200, { ok: true, data: (file && file.data != null) ? file.data : file, savedAt: (file && file.savedAt) || readSavedAt() });
    return;
  }

  // 写入数据
  if (url.pathname === '/api/state' && req.method === 'POST') {
    let chunks = '';
    req.on('data', c => { chunks += c; if (chunks.length > 64 * 1024 * 1024) req.destroy(); });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(chunks);
        const payload = parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : parsed;
        if (!payload || typeof payload !== 'object') {
          sendJSON(res, 400, { ok: false, message: '数据格式不正确' });
          return;
        }
        const out = JSON.stringify({ data: payload, savedAt: Date.now() }, null, 2);
        writeState(out);
        sendJSON(res, 200, { ok: true, savedAt: Date.now() });
      } catch (e) {
        sendJSON(res, 400, { ok: false, message: '解析失败: ' + e.message });
      }
    });
    return;
  }

  // 列出可用备份
  if (url.pathname === '/api/backups' && req.method === 'GET') {
    try {
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => /^mind_data-\d{14}\.json$/.test(f))
        .sort((a, b) => b.localeCompare(a)) // 新→旧
        .map(f => {
          const p = path.join(BACKUP_DIR, f);
          let size = 0; try { size = fs.statSync(p).size; } catch (e) {}
          return { name: f, size, mtime: fs.statSync(p).mtimeMs };
        });
      // 是否存在当前主文件
      let current = null;
      if (fs.existsSync(STATE_FILE)) {
        current = { name: 'mind_data.json', size: fs.statSync(STATE_FILE).size, mtime: fs.statSync(STATE_FILE).mtimeMs };
      }
      sendJSON(res, 200, { ok: true, current, backups: files });
    } catch (e) {
      sendJSON(res, 500, { ok: false, message: e.message });
    }
    return;
  }

  // 回滚到某份备份
  if (url.pathname.startsWith('/api/restore/') && req.method === 'POST') {
    const name = decodeURIComponent(url.pathname.split('/api/restore/')[1] || '');
    if (!/^mind_data-\d{14}\.json$/.test(name)) { sendJSON(res, 400, { ok: false, message: '非法文件名' }); return; }
    const src = path.join(BACKUP_DIR, name);
    if (!fs.existsSync(src)) { sendJSON(res, 404, { ok: false, message: '备份不存在' }); return; }
    try {
      const buf = fs.readFileSync(src, 'utf8');
      writeState(buf); // 写回主文件，并自动再生成一份新备份
      sendJSON(res, 200, { ok: true, message: '已回滚到 ' + name });
    } catch (e) {
      sendJSON(res, 500, { ok: false, message: e.message });
    }
    return;
  }

  sendJSON(res, 404, { ok: false, message: 'unknown api' });
}

function readSavedAt() {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const o = JSON.parse(raw);
    return o && o.savedAt ? o.savedAt : null;
  } catch (e) { return null; }
}

/* ---------- 启动 ---------- */
ensureDirs();
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url);
  } else {
    serveStatic(req, res, url.pathname);
  }
});

server.listen(PORT, HOST, () => {
  console.log('=================================================');
  console.log('  MIND · 脑海  本地服务已启动');
  console.log(`  请在浏览器打开:  http://${HOST}:${PORT}/`);
  console.log('  数据将持久化到:  data/mind_data.json');
  console.log('  （绑定 127.0.0.1，仅本机可访问；Ctrl+C 退出）');
  console.log('=================================================');
});
