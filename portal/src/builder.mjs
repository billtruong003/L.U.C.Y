// builder.mjs — quét registry/*.json → validate → group theo zone → render → ghi dist/ (LP-2)
// Data-driven: nguồn sự thật = registry/. KHÔNG hardcode project. Chạy: node src/builder.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZONES, ZONE_META, validate } from './schema.mjs';
import { renderPage } from './template.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REGISTRY_DIR = path.join(ROOT, 'registry');
const DIST_DIR = path.join(ROOT, 'dist');

// Đọc + validate toàn bộ manifest trong registry/. Trả {projects, errors}.
export function loadRegistry(dir = REGISTRY_DIR) {
  const projects = [];
  const errors = [];
  if (!fs.existsSync(dir)) return { projects, errors };
  // Bỏ qua file bắt đầu bằng _ (mẫu/draft như _sample.json)
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort();
  for (const f of files) {
    const fp = path.join(dir, f);
    try {
      const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
      projects.push(validate(raw));
    } catch (e) {
      errors.push({ file: f, error: e.message });
    }
  }
  return { projects, errors };
}

// Gom theo zone (giữ thứ tự ZONES), sort project trong zone: live trước, rồi title.
export function groupByZone(projects) {
  const order = { live: 0, wip: 1, archived: 2 };
  return ZONES.map((key) => ({
    key,
    meta: ZONE_META[key],
    projects: projects
      .filter((p) => p.zone === key)
      .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)
        || a.title.localeCompare(b.title, 'vi')),
  }));
}

export function build({ registryDir = REGISTRY_DIR, distDir = DIST_DIR, generatedAt = null } = {}) {
  const { projects, errors } = loadRegistry(registryDir);
  for (const e of errors) console.error(`⚠️  bỏ qua ${e.file}: ${e.error}`);
  const zones = groupByZone(projects);
  const html = renderPage({ zones, generatedAt });
  fs.mkdirSync(distDir, { recursive: true });
  const out = path.join(distDir, 'index.html');
  fs.writeFileSync(out, html, 'utf8');
  return { out, count: projects.length, errors, zones };
}

// Chạy trực tiếp = build + log tóm tắt
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  // dùng tham số --date=YYYY-MM-DD nếu có (tránh Date.now() để build reproducible)
  const dateArg = process.argv.find((a) => a.startsWith('--date='));
  const generatedAt = dateArg ? dateArg.slice('--date='.length) : null;
  const r = build({ generatedAt });
  const perZone = r.zones.map((z) => `${z.meta.icon}${z.projects.length}`).join(' ');
  console.log(`✅ build: ${r.count} dự án [${perZone}] → ${r.out}`);
  if (r.errors.length) {
    console.error(`⚠️  ${r.errors.length} manifest lỗi (đã bỏ qua)`);
    process.exitCode = 1;
  }
}

export default { build, loadRegistry, groupByZone };
