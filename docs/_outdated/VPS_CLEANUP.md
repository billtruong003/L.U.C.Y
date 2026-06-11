# Lucy — VPS Cleanup / Audit (dọn cái thừa, giữ radiant-bot + Lucy)

> **Mục tiêu:** VPS Vietnix `14.225.255.73` chỉ còn chạy **(1) radiant-bot** + **(2) Lucy Hermes (provider=xai)**.
> Xóa **OmniRoute, Docker thừa, session/cache cũ**, giải phóng RAM cho box 2GB.
>
> 🔴 **LUẬT AN TOÀN:** đây là **prod, radiant-bot đang sống**. **AUDIT trước, xóa sau.** Mỗi lệnh `rm/docker rm`
> phải xem output inventory trước. **KHÔNG đụng radiant-bot.** Nghi gì → dán output hỏi trước khi xóa.

---

## 0. GIỮ LẠI (whitelist — tuyệt đối không xóa)

| Giữ | Vì sao |
|---|---|
| **radiant-bot** (pm2 process + thư mục repo + `.env`) | bot Discord đang chạy — KHÔNG đụng |
| **Lucy Hermes** mới: `~/.hermes/` (config provider=xai + .env) + `~/lucy/` | body Lucy |
| System deps: `node`, `npm`, `python3.11`, `pm2`, `git`, `ffmpeg`, `ripgrep` | radiant-bot + Hermes cần |
| **claude** CLI (nếu đã cài cho brief 1×/ngày) | research |

## 1. AUDIT — chạy hết, dán output về (CHƯA xóa gì)

```bash
echo "===== RAM / DISK =====" ; free -h ; df -h /
echo "===== PM2 (process đang chạy) =====" ; pm2 list
echo "===== DOCKER containers =====" ; docker ps -a 2>/dev/null || echo "docker: không có/không chạy"
echo "===== DOCKER images =====" ; docker images 2>/dev/null
echo "===== DOCKER volumes =====" ; docker volume ls 2>/dev/null
echo "===== PORT đang nghe =====" ; ss -tulpn | grep -E ':(20128|9119|3000|8080|443|80)' || ss -tulpn | head
echo "===== systemd services lạ =====" ; systemctl list-units --type=service --state=running | grep -iE 'omni|hermes|lucy|docker' 
echo "===== /opt (thường chứa đồ cài tay) =====" ; ls -la /opt 2>/dev/null
echo "===== Hermes home size + sessions =====" ; du -sh ~/.hermes 2>/dev/null ; ls ~/.hermes/sessions 2>/dev/null | wc -l
echo "===== Top thư mục nặng trong home =====" ; du -sh ~/* 2>/dev/null | sort -rh | head -15
```

→ **Dán output về.** Từ đó chốt chính xác cái gì thừa. Dưới là kịch bản xóa theo từng nhóm.

---

## 2. Xóa OmniRoute (chắc chắn thừa — Lucy đã bỏ, dùng xAI thẳng)

Tên đã biết (từ hermes/README cũ): container `omniroute`, image `diegosouzapw/omniroute:latest`,
volume `omniroute-data`, thư mục `/opt/omniroute` (chứa `.env` + `.xai_key`).

```bash
docker stop omniroute 2>/dev/null ; docker rm omniroute 2>/dev/null
docker rmi diegosouzapw/omniroute:latest 2>/dev/null
docker volume rm omniroute-data 2>/dev/null
# /opt/omniroute chứa .xai_key (ĐÃ LỘ → rotate ở console.x.ai) + .env
sudo rm -rf /opt/omniroute
# nếu OmniRoute chạy bằng systemd/pm2:
pm2 delete omniroute 2>/dev/null ; pm2 save 2>/dev/null
sudo systemctl disable --now omniroute 2>/dev/null
```
> 🔐 `/opt/omniroute/.xai_key` là key cũ đã lộ — **revoke ở console.x.ai** rồi mới yên tâm xóa.

## 3. Docker — gỡ HẲN nếu KHÔNG còn ai dùng (free RAM lớn nhất)

```bash
# Sau khi xóa OmniRoute, còn container/image nào không?
docker ps -a ; docker images
```
- Nếu **trống** (radiant-bot chạy bằng pm2/node, KHÔNG dùng Docker) → gỡ Docker để free RAM:
```bash
sudo systemctl disable --now docker docker.socket containerd 2>/dev/null
docker system prune -a --volumes -f 2>/dev/null   # dọn sạch trước khi gỡ
sudo apt-get purge -y docker-ce docker-ce-cli containerd.io docker.io 2>/dev/null
sudo apt-get autoremove -y
```
- Nếu **còn thứ khác** đang dùng Docker → **CHỈ** `docker system prune -a --volumes -f` (dọn rác, giữ Docker). **Đừng gỡ.**

> ⚠️ Xác nhận radiant-bot KHÔNG chạy trong Docker (xem `pm2 list` ở §1) trước khi đụng Docker.

## 4. Hermes sessions / cache / request-dump cũ

```bash
# đếm trước
ls ~/.hermes/sessions 2>/dev/null | wc -l ; du -sh ~/.hermes/sessions 2>/dev/null
# prune bằng lệnh chính chủ (an toàn) — giữ N ngày gần nhất:
hermes sessions prune --older-than 7 2>/dev/null || rm -f ~/.hermes/sessions/request_dump_* 2>/dev/null
# log cũ
du -sh ~/.hermes/logs 2>/dev/null ; find ~/.hermes/logs -name '*.log' -mtime +14 -delete 2>/dev/null
```

## 5. Lucy Hermes cũ (nếu có bản chạy qua OmniRoute trước đây)

Nếu `pm2 list` có process Lucy/Hermes cũ trỏ OmniRoute (provider=anthropic, base_url localhost:20128):
```bash
pm2 delete lucy-hermes 2>/dev/null            # xóa process cũ
# cấu hình lại theo provider=xai (xem VPS_KICKOFF.md / DEPLOY.md), rồi dựng lại:
pm2 start "hermes gateway" --name lucy-hermes && pm2 save
```
Backup config cũ nếu muốn: `cp ~/.hermes/config.yaml ~/.hermes/config.yaml.bak-$(date +%s)`.

## 6. Cruft khác (tùy §1 audit)
- Thư mục thử nghiệm cũ trong `~` (du -sh đã liệt kê) — xóa cái KHÔNG phải radiant-bot/lucy.
- `apt-get clean ; apt-get autoremove -y` dọn cache gói.
- `journalctl --vacuum-time=7d` nếu log systemd phình.

---

## 7. VERIFY sau khi dọn
```bash
pm2 list                  # radiant-bot VẪN chạy (online) + lucy-hermes (nếu đã dựng)
free -h ; df -h /         # RAM/disk free tăng
ss -tulpn | grep 20128 || echo "OmniRoute đã tắt (port 20128 trống) — OK"
docker ps 2>/dev/null || echo "Docker đã gỡ/không còn container — OK"
# Discord: kiểm Aki còn phản hồi. Telegram: kiểm Lucy (nếu P1 xong).
```

## Checklist
- [ ] AUDIT §1 chạy + review xong.
- [ ] OmniRoute xóa (container/image/volume//opt/omniroute) + **xAI key cũ revoked**.
- [ ] Docker: gỡ hẳn (nếu thừa) HOẶC prune (nếu còn dùng).
- [ ] Sessions/logs cũ pruned.
- [ ] **radiant-bot vẫn online** (KHÔNG vỡ).
- [ ] RAM free đủ cho Lucy Hermes (grok call nhẹ + brief 1×/ngày).
