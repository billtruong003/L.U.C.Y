'use strict';
/*
 * ai-img-order — order intake microservice for the "Ảnh sản phẩm AI cho shop" landing page.
 *
 * Responsibilities:
 *   - Serve a tiny JSON API: POST /order  (also reachable as /shop/api/order behind nginx)
 *   - Health check:          GET  /health
 *   - Read TELEGRAM_BOT_TOKEN + LUCY_ALLOWED_USER_ID from /root/lucy/bridge/.env (READ ONLY)
 *   - Format each order nicely and push it to the owner's Telegram chat.
 *
 * Hard rules honored here:
 *   - Secrets are NEVER logged, echoed, or returned in responses.
 *   - No external npm deps (uses only Node built-ins) so install is trivial / offline-safe.
 *   - Standalone: does not touch lucy-bridge / lucy-hub / lucy-coordinator.
 */

const http = require('http');
const fs = require('fs');
const https = require('https');

const PORT = process.env.AI_IMG_ORDER_PORT || 8810;
const BRIDGE_ENV = process.env.BRIDGE_ENV_PATH || '/root/lucy/bridge/.env';

// ---- Load secrets from bridge/.env (READ ONLY, never logged) -------------------------------
function loadBridgeEnv(path) {
  const out = {};
  try {
    const raw = fs.readFileSync(path, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let val = m[2];
      // strip surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      out[m[1]] = val;
    }
  } catch (e) {
    console.error('[ai-img-order] cannot read bridge env file:', e.code || e.message);
  }
  return out;
}

const env = loadBridgeEnv(BRIDGE_ENV);
const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN || '';
const OWNER_CHAT_ID = env.LUCY_ALLOWED_USER_ID || '';

// Startup sanity log WITHOUT revealing secret values.
console.log('[ai-img-order] starting on port', PORT);
console.log('[ai-img-order] telegram token loaded:', TELEGRAM_BOT_TOKEN ? 'yes' : 'NO');
console.log('[ai-img-order] owner chat id loaded:', OWNER_CHAT_ID ? 'yes' : 'NO');

// ---- Telegram push --------------------------------------------------------------------------
function sendTelegram(text) {
  return new Promise((resolve, reject) => {
    if (!TELEGRAM_BOT_TOKEN || !OWNER_CHAT_ID) {
      return reject(new Error('telegram_not_configured'));
    }
    const payload = JSON.stringify({
      chat_id: OWNER_CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    });
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 15000,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(true);
          } else {
            // Do not include token in error; Telegram error body is safe (no token).
            reject(new Error('telegram_http_' + res.statusCode + ': ' + body.slice(0, 300)));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('telegram_timeout')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ---- Helpers --------------------------------------------------------------------------------
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function clip(s, n) {
  s = String(s == null ? '' : s).trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function formatOrder(o) {
  const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const test = o.test ? ' <b>[TEST] đơn thử</b>' : '';
  const lines = [
    `🛒 <b>ĐƠN MỚI — Ảnh sản phẩm AI</b>${test}`,
    `🕒 ${esc(now)} (giờ VN)`,
    '',
    `👤 <b>Tên:</b> ${esc(clip(o.name, 120)) || '(trống)'}`,
    `📞 <b>Liên hệ:</b> ${esc(clip(o.contact, 160)) || '(trống)'}`,
    `📦 <b>Gói:</b> ${esc(clip(o.plan, 60)) || '(chưa chọn)'}`,
    `🔗 <b>Link/Mô tả SP:</b> ${esc(clip(o.product, 1500)) || '(trống)'}`,
  ];
  if (o.note && String(o.note).trim()) {
    lines.push(`📝 <b>Ghi chú:</b> ${esc(clip(o.note, 1000))}`);
  }
  return lines.join('\n');
}

const ALLOWED_ORIGIN = '*'; // static landing is served from same host; '*' is fine for a public order form.

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function json(res, code, obj) {
  cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req, limitBytes, cb) {
  let data = '';
  let tooBig = false;
  req.on('data', (chunk) => {
    if (tooBig) return;
    data += chunk;
    if (data.length > limitBytes) {
      tooBig = true;
      cb(new Error('payload_too_large'));
    }
  });
  req.on('end', () => {
    if (tooBig) return;
    cb(null, data);
  });
  req.on('error', cb);
}

// ---- naive in-memory rate limit (per IP) to blunt spam -------------------------------------
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const max = 8;
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > max;
}

// ---- HTTP server ----------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  const url = (req.url || '').split('?')[0];

  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'GET' && (url === '/health' || url === '/shop/api/health')) {
    return json(res, 200, {
      ok: true,
      service: 'ai-img-order',
      telegram: TELEGRAM_BOT_TOKEN && OWNER_CHAT_ID ? 'configured' : 'missing',
    });
  }

  if (req.method === 'POST' && (url === '/order' || url === '/shop/api/order')) {
    const ip = (req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?')
      .toString()
      .split(',')[0]
      .trim();

    if (rateLimited(ip)) {
      return json(res, 429, { ok: false, error: 'Bạn gửi quá nhanh, thử lại sau ít phút nhé.' });
    }

    readBody(req, 64 * 1024, async (err, raw) => {
      if (err) {
        return json(res, 413, { ok: false, error: 'Nội dung quá lớn.' });
      }
      let body;
      try {
        body = JSON.parse(raw || '{}');
      } catch {
        return json(res, 400, { ok: false, error: 'Dữ liệu không hợp lệ.' });
      }

      // honeypot: bots fill hidden "website" field
      if (body.website) {
        return json(res, 200, { ok: true }); // pretend success, drop silently
      }

      const order = {
        name: body.name,
        contact: body.contact,
        plan: body.plan,
        product: body.product,
        note: body.note,
        test: body.test === true || body.test === 'true',
      };

      if (!order.name || !order.contact) {
        return json(res, 400, { ok: false, error: 'Vui lòng nhập tên và thông tin liên hệ.' });
      }

      try {
        await sendTelegram(formatOrder(order));
        return json(res, 200, { ok: true, message: 'Đã nhận đơn! Bên mình sẽ liên hệ sớm.' });
      } catch (e) {
        // Safe error (never contains token)
        console.error('[ai-img-order] telegram send failed:', e.message);
        return json(res, 502, { ok: false, error: 'Gửi đơn thất bại, vui lòng thử lại hoặc liên hệ trực tiếp.' });
      }
    });
    return;
  }

  json(res, 404, { ok: false, error: 'not_found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('[ai-img-order] listening on 127.0.0.1:' + PORT);
});
