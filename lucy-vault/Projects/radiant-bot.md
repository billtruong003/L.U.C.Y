---
title: radiant-bot — dự án
type: project
tags: [project, radiant-bot]
permalink: project-radiant-bot
---

# radiant-bot (Discord + Aki)

## Quan sát
- [repo] Canonical = `BillService/radiant-bot` (KHÔNG dùng bản `D:/Project/radiant-bot` — stale 3 tuần) #repo
- [api] Vừa ship `POST /api/agent/*` HMAC — Lucy điều khiển Aki (đẩy báo cáo vào kênh, tạo kênh/thread) #api
- [stack] discord.js v14, TS strict, custom WAL+Snapshot store (~100MB RAM cho 10k user) #stack
- [aki] Aki hiện text-only (Grok), CHƯA tool-use #aki
- [quan-hệ] Là "mặt cộng đồng" trong hệ sinh thái; Lucy điều phối, Aki thực thi phía Discord #vai-trò

## Liên hệ
- thuộc_về [[user-bill]]
- điều_phối_bởi [[project-lucy]]
