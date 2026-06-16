#!/usr/bin/env node
/**
 * Lucy reports — DATA LAYER (time-series cho chart).
 *
 * Cron mỗi ngày ghi số liệu THẬT vào đây, report tự render chart (không cần model viết tay).
 *
 * CLI:
 *   node lucy_data.mjs record --date 2026-06-13 --session pm --set BTC=66000 ETH=3500 XAU=2330 VNINDEX=1280
 *   node lucy_data.mjs show [--date 2026-06-13]
 *   node lucy_data.mjs metrics            # in bảng metric đang khai báo
 *
 * Giá trị nhận mọi định dạng người-đọc: "66,000", "$2,330.5", "1.280,5"? -> dùng dấu . thập phân,
 * tự bỏ $, dấu phẩy ngăn nghìn, %, khoảng trắng. Không parse được -> bỏ qua key đó (không bịa).
 *
 * File: $LUCY_WEB_ROOT/data/market-series.json  (default /var/www/lucy-reports/data)
 *
 * Cũng export hàm dùng bởi gen_brief.mjs: loadData(), buildSeriesArrays().
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = process.env.LUCY_WEB_ROOT || '/var/www/lucy-reports';
const DATA_DIR = path.join(WEB_ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'market-series.json');

/**
 * Metric registry — khai báo nhãn / đơn vị / màu / nhóm.
 * Thêm metric mới = thêm 1 entry (hoặc cron tự ghi key lạ -> nhận default style).
 *  group: 'crypto' | 'gold' | 'stock' | 'macro'  (để gom nhóm hiển thị)
 *  fmt:   'usd' | 'vnd' | 'num' | 'pct'           (cách format số)
 */
export const METRICS = {
  BTC:     { label: 'Bitcoin',        unit: 'USD',      color: '#f7931a', group: 'crypto', fmt: 'usd' },
  ETH:     { label: 'Ethereum',       unit: 'USD',      color: '#627eea', group: 'crypto', fmt: 'usd' },
  SOL:     { label: 'Solana',         unit: 'USD',      color: '#14f195', group: 'crypto', fmt: 'usd' },
  BNB:     { label: 'BNB',            unit: 'USD',      color: '#f3ba2f', group: 'crypto', fmt: 'usd' },
  XRP:     { label: 'XRP',            unit: 'USD',      color: '#cfd8e3', group: 'crypto', fmt: 'usd' },
  BTCDOM:  { label: 'BTC Dominance',  unit: '%',        color: '#f7931a', group: 'crypto', fmt: 'pct' },
  TOTALMC: { label: 'Total MCap',     unit: 'T USD',    color: '#5aa9ff', group: 'crypto', fmt: 'num' },
  XAU:     { label: 'Vàng thế giới',  unit: 'USD/oz',   color: '#ecc14a', group: 'gold',   fmt: 'usd' },
  SJC:     { label: 'Vàng SJC',       unit: 'tr/lượng', color: '#ffd700', group: 'gold',   fmt: 'num' },
  VNINDEX: { label: 'VN-Index',       unit: 'điểm',     color: '#5aa9ff', group: 'stock',  fmt: 'num' },
  SP500:   { label: 'S&P 500',        unit: 'điểm',     color: '#2ecc71', group: 'stock',  fmt: 'num' },
  NASDAQ:  { label: 'Nasdaq',         unit: 'điểm',     color: '#c08cff', group: 'stock',  fmt: 'num' },
  DXY:     { label: 'DXY',            unit: '',         color: '#93a1b5', group: 'macro',  fmt: 'num' },
  OIL:     { label: 'Dầu WTI',        unit: 'USD',      color: '#8b5a2b', group: 'macro',  fmt: 'usd' },
};

const DEFAULT_META = (key) => ({ label: key, unit: '', color: '#5aa9ff', group: 'other', fmt: 'num' });

// ---------- IO ----------

export function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const d = JSON.parse(raw);
    if (!d.series) d.series = {};
    if (!d.metrics) d.metrics = {};
    return d;
  } catch {
    return { metrics: {}, series: {} };
  }
}

function saveData(d) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), 'utf8');
}

/** "$66,000.5" / "1.280" / "+2.3%" -> Number | null (không bịa) */
export function parseNum(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s || /^(n\/?a|chưa|none|null|-)$/i.test(s)) return null;
  s = s.replace(/[^0-9.\-]/g, ''); // bỏ $, %, phẩy nghìn, khoảng trắng, chữ
  if (s === '' || s === '-' || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ---------- series builder (cho chart) ----------

/**
 * Trả về mảng metric đã sắp xếp theo ngày, mỗi metric:
 *   { key, meta, points:[{date,v}], first, last, prev, changePct, dayChangePct }
 * Chỉ trả metric có >=1 điểm. Lấy `days` ngày gần nhất (default 14).
 * Ưu tiên phiên pm (chốt) > am cho mỗi ngày.
 */
export function buildSeriesArrays(data, days = 14) {
  const dates = Object.keys(data.series || {}).sort(); // asc
  const recent = dates.slice(-days);
  const keys = new Set();
  for (const dt of recent) {
    const day = data.series[dt] || {};
    for (const sess of ['am', 'pm']) {
      Object.keys(day[sess] || {}).forEach((k) => keys.add(k));
    }
  }
  const out = [];
  for (const key of keys) {
    const meta = data.metrics[key] || METRICS[key] || DEFAULT_META(key);
    const points = [];
    for (const dt of recent) {
      const day = data.series[dt] || {};
      const v = (day.pm && day.pm[key] != null) ? day.pm[key]
              : (day.am && day.am[key] != null) ? day.am[key]
              : null;
      if (v != null) points.push({ date: dt, v });
    }
    if (!points.length) continue;
    const first = points[0].v;
    const last = points[points.length - 1].v;
    const prev = points.length > 1 ? points[points.length - 2].v : first;
    const changePct = first ? ((last - first) / Math.abs(first)) * 100 : 0;
    const dayChangePct = prev ? ((last - prev) / Math.abs(prev)) * 100 : 0;
    out.push({ key, meta, points, first, last, prev, changePct, dayChangePct });
  }
  // sắp theo nhóm rồi theo thứ tự khai báo METRICS
  const order = Object.keys(METRICS);
  const groupOrder = { crypto: 0, gold: 1, stock: 2, macro: 3, other: 4 };
  out.sort((a, b) => {
    const ga = groupOrder[a.meta.group] ?? 9, gb = groupOrder[b.meta.group] ?? 9;
    if (ga !== gb) return ga - gb;
    return (order.indexOf(a.key) + 1 || 999) - (order.indexOf(b.key) + 1 || 999);
  });
  return out;
}

// ---------- CLI ----------

function parseArgs(argv) {
  const o = { set: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--date') o.date = argv[++i];
    else if (a === '--session') o.session = argv[++i];
    else if (a === '--set') {
      // gom mọi token KEY=VAL còn lại tới flag tiếp theo
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        const tok = argv[++i];
        const eq = tok.indexOf('=');
        if (eq > 0) o.set[tok.slice(0, eq).toUpperCase()] = tok.slice(eq + 1);
      }
    }
  }
  return o;
}

function cmdRecord(argv) {
  const o = parseArgs(argv);
  const date = o.date && /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? o.date : new Date().toISOString().slice(0, 10);
  const session = o.session === 'pm' || o.session === 'afternoon' ? 'pm' : 'am';
  const data = loadData();
  data.series[date] = data.series[date] || {};
  data.series[date][session] = data.series[date][session] || {};

  const written = [], skipped = [];
  for (const [key, raw] of Object.entries(o.set)) {
    const n = parseNum(raw);
    if (n == null) { skipped.push(key); continue; }
    data.series[date][session][key] = n;
    // đảm bảo có metadata
    if (!data.metrics[key]) data.metrics[key] = METRICS[key] || DEFAULT_META(key);
    written.push(`${key}=${n}`);
  }
  saveData(data);
  console.log(`DATA OK ${date}/${session} — ghi ${written.length}: ${written.join(' ')}` +
    (skipped.length ? ` | bỏ qua (không parse được): ${skipped.join(' ')}` : ''));
}

function cmdShow(argv) {
  const o = parseArgs(argv);
  const data = loadData();
  if (o.date) { console.log(JSON.stringify(data.series[o.date] || {}, null, 2)); return; }
  const arrays = buildSeriesArrays(data, 30);
  if (!arrays.length) { console.log('(chưa có dữ liệu)'); return; }
  for (const m of arrays) {
    const sign = m.changePct >= 0 ? '+' : '';
    console.log(`${m.key.padEnd(8)} ${String(m.last).padStart(12)} ${m.meta.unit.padEnd(9)} ` +
      `${m.points.length}pt  Δ14d ${sign}${m.changePct.toFixed(2)}%`);
  }
}

function cmdMetrics() {
  for (const [k, m] of Object.entries(METRICS)) {
    console.log(`${k.padEnd(8)} ${m.label.padEnd(18)} ${m.unit.padEnd(10)} ${m.group.padEnd(7)} ${m.color}`);
  }
}

const __isCLI = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (__isCLI) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'record') cmdRecord(rest);
  else if (cmd === 'show') cmdShow(rest);
  else if (cmd === 'metrics') cmdMetrics();
  else {
    console.error('Usage: lucy_data.mjs <record|show|metrics> ...');
    console.error('  record --date YYYY-MM-DD --session am|pm --set KEY=VAL KEY=VAL ...');
    process.exit(1);
  }
}
