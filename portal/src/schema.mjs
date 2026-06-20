// schema.mjs — định nghĩa + validate manifest cổng dự án Lucy (LP-1)
// Nguồn sự thật: 1 file JSON / project trong registry/. KHÔNG framework, node thuần ESM.

// 4 zone hiển thị (khớp mockup lucy-portal-mockup.html)
export const ZONES = ['preview', 'report', 'money', 'daily'];

// status hợp lệ → quyết định màu chấm/badge ở template
export const STATUSES = ['live', 'wip', 'archived'];

// Meta từng zone (icon + nhãn + path hiển thị) — template đọc từ đây, KHÔNG hardcode rời rạc
export const ZONE_META = {
  preview: { icon: '🌐', label: 'Dự án Web', path: '/preview/', accent: 'green',
    desc: 'Các web app đang chạy — bấm để mở thẳng.' },
  report:  { icon: '📊', label: 'Kho báo cáo Lucy', path: '/lucy-report-info/', accent: 'cyan',
    desc: 'Báo cáo phân tích & kiến trúc — tách hẳn khỏi daily.' },
  money:   { icon: '💰', label: 'Money Ideas', path: '/lucy/money', accent: 'gold',
    desc: 'Sổ ý tưởng kiếm tiền — render từ vault.' },
  daily:   { icon: '📅', label: 'Daily & Hub', path: 'liên kết', accent: 'violet',
    desc: 'Giữ nguyên chỗ cũ — chỉ trỏ link qua.' },
};

const FIELDS = ['id', 'title', 'zone', 'url', 'description', 'status', 'tags', 'thumbnail', 'createdAt', 'updatedAt'];

// Trả về manifest đã chuẩn hoá (apply default). Ném lỗi nếu thiếu field bắt buộc.
// Bắt buộc: id, title, zone, url. Default: status=wip, tags=[], thumbnail=null.
export function validate(manifest) {
  if (manifest == null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('manifest phải là object JSON');
  }
  const errs = [];
  for (const f of ['id', 'title', 'zone', 'url']) {
    if (manifest[f] == null || String(manifest[f]).trim() === '') {
      errs.push(`thiếu field bắt buộc "${f}"`);
    }
  }
  if (manifest.zone != null && !ZONES.includes(manifest.zone)) {
    errs.push(`zone "${manifest.zone}" không hợp lệ (cho phép: ${ZONES.join(', ')})`);
  }
  if (manifest.status != null && !STATUSES.includes(manifest.status)) {
    errs.push(`status "${manifest.status}" không hợp lệ (cho phép: ${STATUSES.join(', ')})`);
  }
  if (manifest.tags != null && !Array.isArray(manifest.tags)) {
    errs.push('tags phải là mảng');
  }
  if (errs.length) {
    throw new Error(`manifest "${manifest.id ?? '(no id)'}" KHÔNG hợp lệ: ${errs.join('; ')}`);
  }
  return {
    id: String(manifest.id),
    title: String(manifest.title),
    zone: manifest.zone,
    url: String(manifest.url),
    description: manifest.description != null ? String(manifest.description) : '',
    status: manifest.status ?? 'wip',
    tags: Array.isArray(manifest.tags) ? manifest.tags.map(String) : [],
    thumbnail: manifest.thumbnail ?? null,
    createdAt: manifest.createdAt ?? null,
    updatedAt: manifest.updatedAt ?? null,
  };
}

// Tiện ích cho CLI: tạo skeleton manifest từ field rời (register --field=...)
export function fromFields(fields) {
  return validate({
    id: fields.id,
    title: fields.title,
    zone: fields.zone,
    url: fields.url,
    description: fields.description,
    status: fields.status,
    tags: fields.tags,
    thumbnail: fields.thumbnail,
    createdAt: fields.createdAt,
    updatedAt: fields.updatedAt,
  });
}

export const KNOWN_FIELDS = FIELDS;
