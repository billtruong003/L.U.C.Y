# Đề xuất: Tách lucy-vault → repo PRIVATE riêng (git submodule) + flow setup

> Cho chủ nhân (Bill). Soạn 2026-06-16 bởi Lucy. NGHIÊN CỨU — chờ Bill duyệt mới thực thi (đụng git repo live).

## Mục tiêu (theo ý Bill)
- Memory (lucy-vault) là đồ *riêng tư/nhạy cảm* → KHÔNG để chung repo Lucy.
- Tách vault thành *repo PRIVATE riêng*, gắn vào Lucy như **git submodule** (giống `references/` đã có 6 submodule).
- Clone Lucy + submodule → có *cả não + đồ setup* ngay. Không clone submodule (người khác / chưa có quyền) → Lucy *vẫn chạy*, vault không lộ.
- Lợi ích lớn: sau này Lucy repo có thể public mà *KHÔNG lộ não* (chỉ thấy pointer + URL private, nội dung bị khoá).

## Hiện trạng (đã kiểm)
- `references/*` = submodule sẵn (.gitmodules, public). lucy-vault = *folder thường* trong repo Lucy (39 file track + hàng trăm chưa commit, 80M tổng).
- vault/.gitignore đã loại `.index/` (17M, memory.db+embeddings) + `.snapshots/` (60M) → phần git THẬT chỉ là text: Brain 589 .md + Context/Projects/Reports (~vài MB). Nhẹ, hợp git.

## Kiến trúc đề xuất
- Repo mới: `github.com/billtruong003/lucy-vault` — **PRIVATE** (bắt buộc).
- Trong Lucy repo: lucy-vault = submodule (path `lucy-vault`, url repo private).
- `.gitignore` vault giữ nguyên (loại `.index/.snapshots/*.bak-*`) → repo vault nhẹ, không đẩy DB/embedding (regenerable). Cân nhắc thêm: `Daily/` (1.2M log, hơi riêng tư — giữ vì private; tuỳ Bill).

## Các bước THỰC THI (khi Bill OK)
1. Tạo repo private `lucy-vault` (API, private:true).
2. Khởi tạo + push vault:
   `cd /root/lucy/lucy-vault && git init && git add . && git commit -m "init vault backup" && git branch -M main && git remote add origin https://github.com/billtruong003/lucy-vault.git && git push -u origin main`
3. Gỡ vault khỏi tracking repo Lucy (KHÔNG xoá file):
   `cd /root/lucy && git rm -r --cached lucy-vault && git commit -m "vault → submodule"`
4. Thêm làm submodule:
   `git submodule add https://github.com/billtruong003/lucy-vault.git lucy-vault` → sinh `.gitmodules` entry + pointer (gitlink). Commit.
5. Flow setup (viết `setup.sh` + README "Cài từ đầu"):
   - `git clone --recurse-submodules https://github.com/billtruong003/L.U.C.Y.git lucy` (hoặc clone xong `git submodule update --init`).
   - `setup.sh`: `git submodule update --init` → `npm install` (agent-machine + hub/web + hub/server) + bridge deps → `cp *.env.example .env` (Bill điền secret) → `pm2 start` các service.
   - Graceful: nếu vault rỗng (không có quyền submodule) → setup.sh tạo skeleton `lucy-vault/Context/USER.md` + `Brain/` rỗng để Lucy boot được.

## Bẫy / lưu ý (đã nghiên cứu)
1. **Vault đổi LIÊN TỤC** (dream + memory mỗi ngày) → submodule pointer cũ nhanh. → cần cron `vault-backup.sh` (cd lucy-vault; git add -A; commit "auto-backup <date>"; push) chạy sau dream đêm. Pointer trong Lucy repo cập nhật định kỳ (không cần realtime — đây là backup).
2. **KHÔNG đẩy** `.index/` (memory.db, vec) + `.snapshots/` (đã ignore) → repo vault nhẹ + tránh lộ embedding. memory.db tái tạo được từ .md (reindex).
3. **Secret:** `.env` vẫn ở Lucy repo gitignore (KHÔNG vào vault). `~/.git-credentials` ở `~/` (không repo nào). Vault repo PRIVATE.
4. **Thứ tự bước 3-4 nhạy:** lucy-vault đã là git repo (sau bước 2) → `submodule add` nhận đúng. Test trên bản sao trước nếu lo.
5. Token-guard / live: không restart service nào; thao tác git thuần, an toàn.

## Verdict
Khả thi, đúng pattern references/ sẵn có, giải đúng nỗi lo "não nhạy cảm không để lộ". Vault nhẹ (~vài MB text) nên git mượt. Rủi ro chính = thao tác git restructuring trên repo live (1032 file đang dở) → nên *commit/dọn repo Lucy trước*, rồi tách vault, làm từng bước + kiểm.

⚠️ CHỜ BILL DUYỆT mới chạy (đụng git live + tạo repo). Lucy KHÔNG tự ý.
