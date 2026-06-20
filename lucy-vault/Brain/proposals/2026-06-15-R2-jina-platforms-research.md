---
title: "R2 — Khai thác Jina sâu + Nền tảng/Tool (MCP) cho Lucy"
date: 2026-06-15
type: research-proposal
status: proposal (KHÔNG sửa code — chờ chủ nhân duyệt)
author: Lucy (deep research, đa nguồn, đối chiếu)
constraints: VPS 1.9GB RAM (ràng buộc cứng), solo owner = game dev + trợ lý tài chính (crypto/vàng/CK)
scope: Đề xuất khai thác. KHÔNG code, KHÔNG sửa file live.
---

# R2 — Jina khai thác sâu + Nền tảng/Tool nên thêm cho Lucy

> Nghiên cứu sâu, đa nguồn web, đã đối chiếu chéo. Mọi số liệu có nguồn URL ở phần [Nguồn](#nguồn). Chỗ nào nguồn không khớp / chỉ từ tracker bên thứ ba → đã ghi rõ "⚠️ cần xác nhận lại". KHÔNG bịa.

## Mục lục
- [TL;DR](#tldr)
- [PHẦN A — Jina khai thác sâu](#phần-a--jina-khai-thác-sâu)
  - [A0. Nền kinh tế free-tier Jina (1 key dùng chung)](#a0-nền-kinh-tế-free-tier-jina-1-key-dùng-chung)
  - [A1. Reranker](#a1-reranker--ưu-tiên-1)
  - [A2. Đa phương thức (ảnh/mockup/screenshot → search bằng chữ)](#a2-đa-phương-thức-ảnhmockupscreenshot--search-bằng-chữ--ưu-tiên-2)
  - [A3. Reader API + Search API](#a3-reader-api-rjinaai--search-api-sjinaai--ưu-tiên-1)
  - [A4. Classifier zero-shot (route persona)](#a4-classifier-zero-shot-route-persona--ưu-tiên-4)
  - [A5. Matryoshka (cắt chiều tiết kiệm RAM)](#a5-matryoshka-cắt-chiều-tiết-kiệm-ram--ưu-tiên-2-rẻ)
  - [A6. Late chunking + Segmenter](#a6-late-chunking--segmenter--ưu-tiên-3)
  - [A7. ColBERT / multi-vector](#a7-colbert--multi-vector--để-dành-không-hợp-vps)
- [PHẦN B — Nền tảng/Tool (MCP)](#phần-b--nền-tảngtool-mcp-làm-tay-cho-lucy)
  - [B1. Tài chính (quan trọng nhất)](#b1-tài-chính-quan-trọng-nhất)
  - [B2. Search/Read](#b2-searchread)
  - [B3. Dev/Design](#b3-devdesign)
  - [B4. Productivity](#b4-productivity)
  - [B5. Comms](#b5-comms)
  - [B6. Meta-connector (Zapier/Make/Pipedream)](#b6-meta-connector-zapiermakepipedream)
  - [B7. Browser](#b7-browser)
- [PHẦN C — Tổng hợp & thứ tự ưu tiên](#phần-c--tổng-hợp--thứ-tự-ưu-tiên)
- [Nguồn](#nguồn)

---

## TL;DR

1. **Jina = 1 API key dùng chung cho TẤT CẢ endpoint** (embeddings, reranker, reader, search, classifier, segmenter), free 10 triệu token/key. Đây là chìa khóa: gần như mọi thứ "nặng" nên gọi **qua API** thay vì self-host trên VPS 1.9GB.
2. **Ưu tiên #1 (làm trước/cùng nhau):** Reranker (qua API) sau RRF + Reader/Search API. Reranker là cú nâng độ chính xác recall có bằng chứng mạnh nhất, RAM ≈ 0 vì gọi API. Reader/Search cho Lucy "đọc web sạch" gần như miễn phí.
3. **Ưu tiên #2 (rẻ, làm sớm):** Matryoshka cắt chiều (768→512/384) tiết kiệm RAM/đĩa index ngay, vì model v5 đã hỗ trợ MRL. Đa phương thức (index ảnh/mockup/UI → search bằng chữ) qua API — phục vụ đại tu UI.
4. **Để dành:** ColBERT/multi-vector (index phình 16GB+ → KHÔNG hợp 1.9GB). Self-host bất kỳ model ≥600M (reranker-v3, clip-v2, colbert) — quá nặng, dùng API.
5. **Tài chính (tay thật cho Lucy):** **CoinGecko MCP** (hosted, không cần key) cho crypto; **Twelve Data MCP** (800 call/ngày, có cả XAU/USD vàng + CK + forex) là một-mũi-tên-nhiều-đích tốt nhất; **Binance public REST** (không key) cho nến độ phân giải cao. **Alpha Vantage MCP** dự phòng. Bỏ qua CMC. Vàng lấy từ Twelve Data hoặc gold-api.com (keyless).
6. **MCP nền tảng:** Ưu tiên các MCP **hosted/remote** (Figma remote, Linear, Sentry, Vercel, Notion, Slack, Pipedream) — tốn ~0 RAM VPS. **Tránh Playwright local** (Chromium ngốn 300–700MB) → nếu cần duyệt web thì dùng **Browserbase** (chạy trên cloud của họ).

---

## PHẦN A — Jina khai thác sâu

### A0. Nền kinh tế free-tier Jina (1 key dùng chung)

Đây là sự thật quan trọng nhất quyết định mọi lựa chọn dưới đây:

- **1 API key chạy mọi sản phẩm Jina** — Reader, Search, Embeddings, Reranker, Classifier, Segmenter, fine-tuning. Token rút từ **một pool chung**.
- **Free: mỗi key mới có 10 triệu token miễn phí.** (Xác nhận trên cả trang Embeddings lẫn Reader.)
- **Sau đó ~$0.05/triệu token** (≈$50/tỷ). ⚠️ Con số $/token chỉ thấy trên tracker bên thứ ba, KHÔNG thấy verbatim trên trang pricing chính thức → cần xác nhận lại trong dashboard.
- **Rate limit (Embeddings, tiêu biểu):** free 100 RPM / 100K TPM · paid 500 RPM / 2M TPM · premium 5000 RPM / 50M TPM. Reader/Search có hạn mức riêng (xem A3).

> **Hệ quả thiết kế cho VPS 1.9GB:** self-host CHỈ hợp với model text nhỏ nhất (v5-text-nano 239M). Mọi thứ nặng hơn (reranker, clip, colbert, đa phương thức) → **gọi API**. Pool 10M token free + 1 key duy nhất khiến API là lựa chọn mặc định thực dụng.

### A1. Reranker — ⭐ ƯU TIÊN 1
> ✅ **ĐÃ TRIỂN KHAI (2026-06-15, X1):** `jinaRerank` trong `embed.ts` (model `jina-reranker-v2-base-multilingual`, đổi qua `JINA_RERANK_MODEL`) + bước `maybeRerank` sau RRF trong `recall.ts` (pool top max(limit×3,20) → rerank → top-K). Flag `LUCY_RERANK` (mặc định TẮT, cần `JINA_API_KEY`). Lỗi/timeout → giữ thứ tự RRF (không chặn recall). Smoke `smoke:vector` phủ. Bật live: set `LUCY_RERANK=1` trong `.env.llm`.

- **Là gì:** cross-encoder xếp lại danh sách document theo độ liên quan với query — xử lý chung (query, doc) bằng cross-attention thay vì so 2 vector nén độc lập → tránh mất thông tin của single-vector similarity.
- **Model:** `jina-reranker-v3` (597M, nền Qwen3-0.6B, xử lý tới 64 doc / cửa sổ 131K token, 24 ngôn ngữ huấn luyện / 93 tổng) · `jina-reranker-m0` (đa phương thức, xếp ảnh trang tài liệu, 29+ ngôn ngữ) · `jina-reranker-v2-base-multilingual` (đời cũ, nhẹ/nhanh hơn).
- **Giá trị cho Lucy:** RRF đã cho candidate tốt; cross-encoder rerank top-N (vd top 20→5) là cú nâng precision tiêu chuẩn, **có bằng chứng mạnh nhất** (Pinecone, Cohere, ARAGOG, financial-RAG papers). Đúng với ghi chú MEMORY đang để reranker là ưu tiên #1.
- **Cách cắm:** sau bước RRF, POST {query, list top-N candidate} tới reranker endpoint → nhận thứ tự + score; lấy top-K đưa vào prompt. Tính phí theo token (query+docs) từ pool chung.
- **Free/chi phí:** dùng pool 10M token chung. Rerank top-20 mỗi recall rất rẻ.
- **Hợp VPS 1.9GB?** ✅ **qua API** (RAM ≈ 0). ❌ self-host (v3 597M / m0 quá nặng cho CPU 1.9GB).
- **Ưu tiên: 1.** Làm trước/cùng A3 + A5.

### A2. Đa phương thức (ảnh/mockup/screenshot → search bằng chữ) — ⭐ ƯU TIÊN 2

- **Là gì:** embed ảnh VÀ chữ vào **cùng không gian vector** → text-to-image search. Model: `jina-embeddings-v4` (3.8B, nền Qwen2.5-VL-3B; single-vector 2048d cắt được xuống 128 nhờ Matryoshka, hoặc multi-vector 128d/token; 32K context) · `jina-clip-v2` (865M, 89 ngôn ngữ, nhẹ hơn) · `jina-embeddings-v5-omni-*` (omni: text/ảnh/audio/video chung không gian).
- **Giá trị cho Lucy:** index screenshot UI / mockup / tham chiếu tech-art → tìm bằng câu chữ ("HUD vòng gold arc-reactor", "timeline kéo galaxy")→ **phục vụ trực tiếp đại tu UI** (Chat Cockpit + galaxy). Cũng giúp lục lại ảnh tham khảo của game dev.
- **Cách cắm:** dựng một collection vector riêng cho ảnh (sqlite-vec bảng khác), embed ảnh qua API, query bằng text embed cùng model → cosine. Giữ tách khỏi index text-recall hiện tại.
- **Free/chi phí:** API pool chung. Ảnh tính theo token/tile.
- **Hợp VPS 1.9GB?** ✅ **qua API**. ❌ self-host (v4 3.8B / clip-v2 865M / omni ~1B đều bất khả thi trên 1.9GB).
- **Ưu tiên: 2** (gắn với mốc đại tu UI; trước đó để dành).

### A3. Reader API (r.jina.ai) + Search API (s.jina.ai) — ⭐ ƯU TIÊN 1
> ✅ **ĐÃ TRIỂN KHAI (2026-06-15, X2):** `web-tools.ts` — flag `LUCY_JINA_READER` (mặc định TẮT) → `webFetch` ưu tiên `r.jina.ai/<URL>` (markdown sạch), `webSearch` ưu tiên `s.jina.ai/?q=` ; lỗi/non-2xx → fallback DuckDuckGo/stripHtml cũ. Key Jina TÙY CHỌN (`jinaKey()` từ embed.ts — có key → rate-limit cao hơn). URL vẫn qua SSRF guard trước khi proxy. Bật live: `LUCY_JINA_READER=1`.

- **Reader (r.jina.ai):** prepend `https://r.jina.ai/<URL>` → trả **markdown sạch, thân thiện LLM**. Rate: **20 RPM không cần key (free, ẩn danh)**; 500 RPM có key; 5000 RPM premium. Tính theo độ dài nội dung từ pool (ẩn danh free nhưng giới hạn rate).
- **Search (s.jina.ai):** prepend `https://s.jina.ai/<query>` → kết quả web dạng markdown để grounding RAG. **Phí cố định ~10.000 token/request** (bất kể size). Rate: **bắt buộc có key** (không có ẩn danh); 100 RPM free/paid; 1000 RPM premium; ~2.5s latency.
- **Giá trị cho Lucy:** cho Lucy "đọc 1 link sạch" và "search web → markdown" mà không cần dựng scraper riêng. Reader gần như miễn phí (ẩn danh 20 RPM) — đủ cho 1 owner.
- **Cách cắm:** thêm tool `read_url` (gọi r.jina.ai) và `web_search` (s.jina.ai) vào MCP web hiện có / lane agentic tools. So với Tavily/Exa thì Reader ẩn danh free là rẻ nhất cho khâu "đọc URL".
- **Hợp VPS 1.9GB?** ✅ hoàn toàn (chỉ là HTTP call).
- **Ưu tiên: 1** (đặc biệt Reader — gần như free, cắm nhanh).

### A4. Classifier zero-shot (route persona) — ƯU TIÊN 4

- **Là gì:** phân loại không cần data huấn luyện — đưa label ngữ nghĩa, tối đa 256 class. Few-shot (200–400 ví dụ) cho độ chính xác cao hơn. Dùng jina-embeddings-v3/clip-v2/v4. Text tới 8192 token; tới 1024 input/request.
- **Giá trị cho Lucy:** route tin nhắn vào persona/lane (đang dùng tag + Jina trong persona-chat). Classifier có thể thay/bổ trợ logic route hiện tại bằng zero-shot label ("tài chính", "tech-art", "devops"...).
- **Cảnh báo:** route hiện đã chạy bằng tag+Jina embedding (M3.5 LIVE). Classifier API là **gọi mạng thêm mỗi lượt** → thêm latency + token. Chỉ nên dùng nếu route hiện sai nhiều; nếu không, **embedding-similarity tự làm route đã đủ** mà không tốn call riêng.
- **Hợp VPS 1.9GB?** ✅ qua API (nhưng cân nhắc latency/cost mỗi lượt).
- **Ưu tiên: 4** (nice-to-have; route hiện tại đã ổn).

### A5. Matryoshka (cắt chiều tiết kiệm RAM) — ⭐ ƯU TIÊN 2 (rẻ)
> ✅ **ĐÃ TRIỂN KHAI (2026-06-15, X1):** `JINA_EMBED_DIM` (mặc định 768) truyền vào param `dimensions` của Jina — set 512/384 để cắt chiều, ⚠️ phải REINDEX (vector cũ khác chiều). Comment sai "dim 1024" trong `embed.ts` đã dọn về 768/EMBED_DIM.

- **Là gì (MRL):** khi huấn luyện, loss áp cả lên các prefix bị cắt → model "dồn" thông tin quan trọng vào các chiều đầu. Lúc inference chỉ cần **cắt vector** (vd 768→512→384) mà giữ gần nguyên chất lượng.
- **Đánh đổi:** giảm còn ~1/2 chiều thường gần như giữ nguyên chất lượng; ~1/3 vẫn giữ phần lớn. Không tuyến tính hoàn hảo; cắt quá tay mất tương tác latent.
- **Giá trị cho Lucy:** **trực tiếp đụng ràng buộc 1.9GB**. v5-omni-nano là 768d, MRL cắt được tới 32. Hạ 768→512/384 giảm RAM + đĩa index sqlite-vec với mất recall tối thiểu.
- **Cách cắm:** chọn dim đích lúc embed (param chiều) + reindex; đo lại recall@k trước/sau. ⚠️ MEMORY ghi có **comment cũ "dim 1024" sai trong `embed.ts`** cần dọn về 768 — việc này nằm trong tầm dọn dẹp đi kèm.
- **Hợp VPS 1.9GB?** ✅ đúng bài toán RAM.
- **Ưu tiên: 2** (rẻ, thắng RAM ngay; làm cùng đợt reranker).

### A6. Late chunking + Segmenter — ƯU TIÊN 3

- **Segmenter API:** cắt tài liệu dài thành chunk theo cấu trúc + đếm token; endpoint tiện ích, phí rất thấp.
- **Late chunking (kỹ thuật, không phải API riêng):** embed **cả tài liệu trong 1 cửa sổ dài trước**, *rồi* mới suy ra embedding từng chunk từ biểu diễn token → giữ ngữ cảnh xuyên chunk (giải quyết "nó", "công ty đó" bị cắt mất tham chiếu). Bật qua param `late_chunking` trên jina-embeddings-v3 (cửa sổ 8192).
- **Giá trị cho Lucy:** tốt **nếu tài liệu dài** (note dài, tài liệu kỹ thuật). Chi phí chỉ ở lúc index; **không phình storage** (vẫn 1 vector/chunk), **không thêm RAM lúc query**.
- **Cảnh báo:** với note ngắn thì lợi ích nhỏ. Kho Lucy nhiều note ngắn → ưu tiên vừa phải.
- **Hợp VPS 1.9GB?** ✅ (chi phí ở index-time, không thêm RAM runtime).
- **Ưu tiên: 3** (làm khi tối ưu chất lượng index, sau reranker/MRL).

### A7. ColBERT / multi-vector — ❌ ĐỂ DÀNH (không hợp VPS)

- **Là gì:** late-interaction — lưu **1 vector/token**, chấm điểm MaxSim → xấp xỉ chất lượng cross-encoder ở tốc độ bi-encoder. `jina-colbert-v2` 560M, 89 ngôn ngữ, biến thể 128/96/64d.
- **Thực tế storage:** scale theo O(token), KHÔNG theo O(doc). ColBERT gốc cần **154 GiB** index MS MARCO; ColBERTv2 nén vẫn **16–25 GiB**.
- **Hợp VPS 1.9GB?** ❌ **KHÔNG.** Index phình + scoring ngốn RAM/CPU. Đây là kỹ thuật **kém phù hợp nhất** với môi trường Lucy. Nếu muốn lợi ích "gần cross-encoder" → đã có Reranker API (A1) lo, rẻ hơn nhiều.
- **Ưu tiên: để dành (skip).**

---

## PHẦN B — Nền tảng/Tool (MCP) làm "tay" cho Lucy

> Nguyên tắc VPS 1.9GB: ưu tiên MCP **hosted/remote** (chỉ là kết nối OAuth/HTTP → ~0 RAM). Tránh MCP chạy process local nặng.

### B1. Tài chính (quan trọng nhất)
> ✅ **ĐÃ TRIỂN KHAI (2026-06-15, X3):** `mcp-registry.ts` thêm 3 server scope persona finance (`isFinance`: finance/analyst/marketing/researcher) — hiện ở tab "Kết nối" qua `/mcp`:
> • **binance** (`status: live`, KEYLESS, in-process `market-tools.ts`): tool `binance_price` (giá+24h) + `binance_klines` (nến OHLCV ≤200). Bật sẵn khi `LUCY_MCP=1`; tắt qua `LUCY_MCP_BINANCE=off`.
> • **coingecko** (`status: live`, KEYLESS, remote SSE `mcp.api.coingecko.com/sse`, đổi qua `COINGECKO_MCP_URL`). Bật sẵn khi `LUCY_MCP=1`.
> • **twelvedata** (`status: scaffold`, CHỜ KEY): cần `TWELVEDATA_API_KEY` + `LUCY_MCP_TWELVEDATA=on`; endpoint `TWELVEDATA_MCP_URL` (mặc định `https://mcp.twelvedata.com/mcp`). Thiếu key → DOC-only (overview state `needs-creds`).
> ⚠️ Tất cả gated sau master `LUCY_MCP` (mặc định TẮT). Smoke `smoke:mcp` Case J phủ. **Cần chủ nhân:** `TWELVEDATA_API_KEY` (CK/forex/vàng XAU — twelvedata.com).

| Nền tảng | MCP chính thức | Free tier | Giá trị | Rủi ro |
|---|---|---|---|---|
| **CoinGecko** ⭐ | ✅ CÓ (Beta, hosted `mcp.api.coingecko.com/mcp`, **keyless** tier public) | Demo key: 10.000 call/tháng; rate ⚠️ docs ghi 30/min nhưng trang pricing ghi tới 100/min (lấy ~30/min cho an toàn) | Nguồn crypto free tổng quát tốt nhất; MCP hosted keyless = cắm dễ nhất, 0 RAM local; 15k+ coin, DEX on-chain, OHLCV | Rate thấp/chia sẻ; số liệu rate mâu thuẫn; MCP Beta. Không có vàng/CK |
| **Twelve Data** ⭐ | ✅ CÓ (repo `twelvedata/mcp`, early-stage, cần key) | Basic free: **8 credit/min, 800 credit/ngày**; có CK + forex + crypto | **Đa tài sản tốt nhất một-mũi-tên**: CK + forex + crypto + **vàng XAU/USD**; throughput free cao hơn hẳn Alpha Vantage | Tính theo credit (call nhiều symbol tốn nhiều); MCP early-stage |
| **Binance** | ❌ không chính thức (nhiều community) | Public REST **không cần key** cho klines/giá/orderbook; rate theo weight (lớn) | Nguồn nến (OHLCV) realtime + lịch sử free tốt nhất, không signup | Community MCP = rủi ro supply-chain; ban IP nếu lạm dụng; hạn chế ToS/khu vực. Chỉ crypto |
| **Alpha Vantage** | ✅ CÓ (`mcp.alphavantage.co`, repo `alphavantage/alpha_vantage_mcp`) | **25 call/ngày, 5/min** (rất thấp) | Phủ CK + forex + crypto + commodities + macro (gồm vàng gián tiếp) trong 1 MCP | 25/ngày chỉ đủ snapshot thưa, không poll. Premium ~$50/mo |
| **CoinMarketCap** | ❌ không (chỉ community wrapper) | Basic free: 15.000 credit/tháng, ~50 req/min, **không có lịch sử** | Giá/market cap hiện tại | Không MCP, không history free → yếu hơn CoinGecko. ToS personal-use |
| **Glassnode** | ✅ CÓ (Beta MCP, free để khám phá) | Studio web free (Tier-1, daily); **REST API thực tế không free** — cần Professional **$999/mo** | On-chain sâu (SOPR/MVRV...) không nơi nào có | Giá là rào cản; rate chia sẻ; MCP Beta. → chỉ chạm qua **MCP Beta free**, đừng đụng REST |
| **TradingView** | ❌ không có data API/MCP công khai | — | **Webhook alert** (push tín hiệu chiến lược vào Lucy) | Không có data API hợp lệ (scrape = vi phạm ToS); webhook cần **gói trả phí**; phụ thuộc bridge bên thứ ba |
| **Vàng/XAU riêng** | ❌ (đều REST) | **gold-api.com** keyless, không card; GoldAPI.io 100 req/tháng; MetalpriceAPI free | Giá vàng spot nhanh | Cap thấp. **Cách tốt nhất:** lấy XAU/USD từ Twelve Data (đã có), hoặc gold-api.com keyless |

**Khuyến nghị tài chính:** Crypto → **CoinGecko MCP hosted keyless** (primary) + **Binance public REST** (nến độ phân giải cao). CK+forex+vàng một mũi → **Twelve Data MCP** (XAU/USD luôn). Dự phòng đa tài sản → **Alpha Vantage MCP** (nhưng 25/ngày chỉ snapshot). On-chain → chỉ **Glassnode MCP Beta free**. TradingView → chỉ làm **nguồn tín hiệu webhook**, không kéo data. Bỏ qua CMC.

### B2. Search/Read

| Nền tảng | MCP chính thức | Free tier | Giá trị | Rủi ro |
|---|---|---|---|---|
| **Tavily** ⭐ | ✅ CÓ (search/extract/map/crawl) | **1.000 credit/tháng, không cần card** (basic 1cr, advanced 2cr); PAYG $0.008/cr | Sinh ra cho agent/RAG: trả kết quả sạch, tối ưu LLM | 1.000/tháng khiêm tốn; ít "neural" hơn Exa |
| **Exa** | ✅ CÓ (open-source, hosted `mcp.exa.ai/mcp`) | $15 credit signup; ⚠️ ~1.000 req/tháng (số từ guide bên thứ ba, cần xác nhận) | Search ngữ nghĩa/neural + fetch nội dung trong 1 nhà cung cấp | Free rate chặt cho production; số free chưa rõ chính thức |
| **Perplexity** | ✅ CÓ ("Perplexity Ask", Sonar API) | Chủ yếu **trả phí** token; Pro $20/mo tặng $5 credit API/tháng | Trả lời tổng hợp + trích dẫn sẵn (ít công tích hợp) | Không có free tier thực; billing token khó dự đoán; trả answer chứ không phải doc thô |

**Khuyến nghị:** Lucy đã có **Jina Reader/Search** (A3) cho khâu đọc/search rẻ nhất. Nếu cần search ngữ nghĩa chất lượng cao thêm → **Tavily** (1.000 free + MCP chính thức) là khởi đầu ít ma sát nhất.

### B3. Dev/Design

| Nền tảng | MCP chính thức | Free tier | Giá trị | Rủi ro |
|---|---|---|---|---|
| **Figma** ⭐ | ✅ CÓ | **Remote server: có trên MỌI gói gồm Starter free**. Desktop server mới cần gói trả phí + seat Dev/Full | Đưa context design (component, variable, Code Connect) vào agent → design-to-code; hợp game dev/tech-art | Beta; bản desktop nặng local → **dùng remote** |
| **Linear** | ✅ CÓ (hosted `mcp.linear.app/mcp`, OAuth) | Có gói Free; MCP hosted | Tìm/tạo/sửa issue, project bằng ngôn ngữ tự nhiên | Tối thiểu — hosted, 0 RAM |
| **Sentry** | ✅ CÓ (hosted `mcp.sentry.dev/mcp` + bản stdio) | Có gói Developer free | Kéo/phân tích lỗi, issue + Seer vào agent | Thấp; bản hosted không tốn RAM |
| **Vercel** | ✅ CÓ (hosted `mcp.vercel.com`, **read-only**) | Hoạt động với **Hobby free** | Tra docs, xem team/project/deploy/log (read-only an toàn) | Read-only (là ưu điểm); Public Beta |

### B4. Productivity

| Nền tảng | MCP chính thức | Free tier | Giá trị | Rủi ro |
|---|---|---|---|---|
| **Notion** | ✅ CÓ (hosted, OAuth; repo `makenotion/notion-mcp-server`) | Có gói cá nhân free | Đọc/ghi workspace (docs, database) | Có quyền ghi → giới hạn scope OAuth. Hosted, 0 RAM |
| **Google Sheets/Docs/Drive** | ⚠️ Có first-party nhưng nghiêng enterprise/Cloud (preview); tài khoản Gmail cá nhân **chưa rõ đủ điều kiện** | Tài khoản cá nhân free | Đọc/ghi Sheets/Docs/Drive — hợp **nhật ký giao dịch/bảng tài chính** | Ma sát setup (Cloud project + OAuth). **Cá nhân → dùng community** `taylorwilsdon/google_workspace_mcp` hoặc `mcp-google-sheets` (stdio nhẹ, không browser) |

> Lưu ý: phiên này có sẵn MCP claude.ai Gmail / Google Calendar / Google Drive (đang kết nối) — đó là kênh Google tích hợp sẵn, có thể tận dụng thay vì tự dựng.

### B5. Comms

| Nền tảng | MCP chính thức | Free tier | Giá trị | Rủi ro |
|---|---|---|---|---|
| **Slack** | ✅ CÓ (search message + hành động, theo quyền) | Có workspace free | Cầu chính thức search Slack + hành động, tôn trọng quyền | Cần admin duyệt; scope theo permission. Hosted, 0 RAM |
| **Discord** | ❌ không (chỉ community, cần bot token, **đều chạy local**) | Bot API free | Gửi/đọc message, role, event qua bot | Process local (Node/Go nhẹ — ok VPS); tự lo bảo mật token; không support hãng. (Lucy đã dùng Discord cho daily brief/Aki) |

### B6. Meta-connector (Zapier/Make/Pipedream)

| Nền tảng | MCP chính thức | Free tier | Giá trị | Rủi ro |
|---|---|---|---|---|
| **Pipedream** ⭐ | ✅ CÓ (hosted `mcp.pipedream.com`) | Free personal: **10.000 invocation/tháng + 3 workflow**; 2.500+ app / 10.000+ tool | **Free value tốt nhất** trong 3 meta-connector cho solo | Multi-user/production cần trả phí. Hosted, 0 RAM |
| **Make.com** | ✅ CÓ | MCP có trên **mọi gói gồm free**, chỉ trả op credit; ⚠️ tool quản lý cần gói trả phí | Cho agent chạy scenario Make | Free đủ test; production cần trả phí |
| **Zapier** | ✅ CÓ | Free: 100 task/tháng, **1 MCP call = 2 task → ~50 call/tháng** | Mở ~8.000 app qua 1 endpoint | Task cháy nhanh; free chỉ để thử |

**Khuyến nghị:** nếu cần "ngàn app", **Pipedream** thắng cho 1 owner (10k invocation free).

### B7. Browser

| Nền tảng | MCP chính thức | Free tier | Giá trị | Rủi ro / RAM |
|---|---|---|---|---|
| **Playwright (Microsoft)** | ✅ CÓ (open-source Apache-2.0) | Free hoàn toàn | Tự động hóa browser local (test, scrape, điền form) | ⚠️ **Chạy Chromium thật local ~300–700MB+** → RỦI RO trên 1.9GB. Tránh chạy local |
| **Browserbase** ⭐ | ✅ CÓ (cloud browser) | **1 giờ browser + 1 concurrent** (chỉ để thử); Dev $20/mo | Browser chạy **trên cloud của họ → ~0 RAM VPS** | Free cap 1 giờ/tháng; cần API key |

**Khuyến nghị:** trên VPS 1.9GB, **đừng chạy Playwright local**. Nếu cần duyệt web động → **Browserbase** (cloud), chấp nhận cap free 1 giờ. Với phần lớn nhu cầu "đọc trang" → **Jina Reader (A3)** đã đủ và rẻ hơn.

---

## PHẦN C — Tổng hợp & thứ tự ưu tiên

### Thứ tự khai thác đề xuất (đợt)

**Đợt 1 — "Recall sắc hơn + đọc web" (làm trước/cùng nhau, RAM ≈ 0):**
1. **Jina Reranker API** (A1) sau RRF — cú nâng precision có bằng chứng mạnh nhất.
2. **Jina Reader/Search API** (A3) — Lucy đọc URL sạch + search→markdown gần như free.
3. **Matryoshka cắt chiều** (A5) — 768→512/384 thắng RAM/đĩa ngay + dọn comment "dim 1024" sai trong `embed.ts`.
4. **Tài chính cốt lõi:** cắm **CoinGecko MCP (keyless)** + **Twelve Data MCP** (crypto + CK + forex + vàng) + **Binance public REST** (nến).

**Đợt 2 — "Mắt + tay mở rộng" (gắn mốc đại tu UI):**
5. **Jina đa phương thức** (A2) — index ảnh/mockup/UI → search bằng chữ (phục vụ Chat Cockpit/galaxy).
6. **MCP hosted cho dev/productivity:** Figma (remote), Linear/Sentry/Vercel, Notion — tất cả ~0 RAM.
7. **Tavily** (search ngữ nghĩa free) nếu Jina Search chưa đủ.

**Đợt 3 — "Tinh chỉnh chất lượng / nice-to-have":**
8. **Late chunking + Segmenter** (A6) — chỉ khi có nhiều tài liệu dài.
9. **Classifier** (A4) — chỉ nếu route persona hiện tại sai nhiều (đang ổn → hạ ưu tiên).
10. **Pipedream MCP** (ngàn app) + **Browserbase** (duyệt web cloud) khi thực sự cần.

### Hợp VPS 1.9GB

- ✅ **Tốt (gọi API / hosted MCP, ~0 RAM):** Reranker, Reader/Search, đa phương thức, Classifier, Matryoshka, Late chunking — **tất cả qua Jina API**. MCP hosted: CoinGecko, Twelve Data, Alpha Vantage, Glassnode (Beta), Figma-remote, Linear, Sentry, Vercel, Notion, Slack, Pipedream, Browserbase.
- ⚠️ **Process local nhẹ (chấp nhận được):** Discord community MCP, Google Workspace community MCP (stdio, không browser).
- ❌ **Tránh trên VPS:** self-host bất kỳ model Jina ≥600M (reranker-v3, clip-v2, colbert, v4 3.8B, v5-omni ~1B); **ColBERT/multi-vector** (index 16GB+); **Playwright local** (Chromium 300–700MB).

### Để dành / không làm

- **ColBERT/multi-vector** (A7) — index phình, không hợp 1.9GB; Reranker API đã thay được lợi ích.
- **Self-host model lớn** — luôn dùng API.
- **CoinMarketCap** — thua CoinGecko (không MCP, không history free).
- **Glassnode REST** — $999/mo; chỉ chạm qua MCP Beta free.
- **TradingView như nguồn data** — không có API hợp lệ; chỉ dùng webhook tín hiệu (cần gói trả phí).

### Cảnh báo cần xác nhận lại (không bịa)

- $/token Jina (~$0.05/M) chỉ từ tracker bên thứ ba → xác nhận trong dashboard.
- Rate limit CoinGecko Demo: docs 30/min vs pricing 100/min → lập kế hoạch theo ~30/min.
- Free tier Exa & Perplexity: số từ guide bên thứ ba → xác nhận trong dashboard.
- Google Workspace first-party MCP cho tài khoản Gmail **cá nhân**: chưa rõ đủ điều kiện → tạm dùng community.
- Mọi MCP đánh dấu **Beta/early-stage** (CoinGecko, Glassnode, Twelve Data, Figma, Vercel) có thể đổi.

---

## Nguồn

### Jina
- Embeddings + free tier + rate limit: https://jina.ai/embeddings/
- Reader + Search (r./s.) + rate limit: https://jina.ai/reader/ · https://r.jina.ai/
- Reranker v3: https://jina.ai/models/jina-reranker-v3/ · m0: https://huggingface.co/jinaai/jina-reranker-m0 · v2: https://jina.ai/models/jina-reranker-v2-base-multilingual/ · https://jina.ai/reranker/
- Embeddings v4 (đa phương thức): https://jina.ai/models/jina-embeddings-v4/ · https://arxiv.org/abs/2506.18902 · https://huggingface.co/jinaai/jina-embeddings-v4
- v5-omni-nano: https://jina.ai/models/jina-embeddings-v5-omni-nano/ · https://jina.ai/news/jina-embeddings-v5-omni-multimodal-embeddings-for-text-image-audio-and-video/ · https://jina.ai/news/jina-embeddings-v5-text-distilling-4b-quality-into-sub-1b-multilingual-embeddings/
- Classifier: https://jina.ai/classifier/
- Segmenter + late chunking: https://jina.ai/segmenter/ · https://jina.ai/news/late-chunking-in-long-context-embedding-models/ · https://github.com/jina-ai/late-chunking · https://arxiv.org/pdf/2409.04701
- ColBERT v2: https://jina.ai/models/jina-colbert-v2/ · https://huggingface.co/jinaai/jina-colbert-v2 · https://arxiv.org/abs/2408.16672

### Tài chính
- CoinGecko MCP: https://docs.coingecko.com/docs/mcp-server · pricing https://www.coingecko.com/en/api/pricing · https://support.coingecko.com/hc/en-us/articles/4538771776153
- CoinMarketCap: https://coinmarketcap.com/api/ · https://coinmarketcap.com/api/faq/
- Binance: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/limits · https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints
- Glassnode: https://studio.glassnode.com/pricing · https://docs.glassnode.com/basic-api/api · https://insights.glassnode.com/glassnode-mcp-server-guide
- Alpha Vantage: https://www.alphavantage.co/support/ · https://www.alphavantage.co/premium/ · https://mcp.alphavantage.co/
- Twelve Data: https://twelvedata.com/pricing · https://twelvedata.com/docs · https://github.com/twelvedata/mcp
- TradingView (webhook bridge): https://www.tradingview.com/support/ · https://www.pineconnector.com/blogs/pico-blog/tradingview-webhook-setup
- Vàng: https://gold-api.com/ · https://www.goldapi.io/ · https://metalpriceapi.com/gold · https://unirateapi.com/gold-price-api

### MCP nền tảng
- Figma: https://www.figma.com/blog/introducing-figma-mcp-server/ · https://developers.figma.com/docs/figma-mcp-server/ · https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server
- Linear: https://linear.app/docs/mcp · https://linear.app/changelog/2025-05-01-mcp
- Sentry: https://docs.sentry.io/product/sentry-mcp/ · https://mcp.sentry.dev/mcp · https://github.com/getsentry/sentry-mcp
- Vercel: https://vercel.com/blog/introducing-vercel-mcp-connect-vercel-to-your-ai-tools · https://vercel.com/docs/mcp/vercel-mcp · https://github.com/vercel/vercel-mcp-overview
- Notion: https://github.com/makenotion/notion-mcp-server · https://developers.notion.com/guides/mcp/overview · https://www.notion.com/blog/notions-hosted-mcp-server-an-inside-look
- Google MCP: https://cloud.google.com/blog/products/ai-machine-learning/google-managed-mcp-servers-are-available-for-everyone · https://developers.google.com/workspace/drive/api/guides/configure-mcp-server · community https://github.com/taylorwilsdon/google_workspace_mcp · https://pypi.org/project/mcp-google-sheets/
- Slack: https://docs.slack.dev/ai/slack-mcp-server/ · https://slack.com/blog/news/mcp-real-time-search-api-now-available
- Discord (community): https://github.com/SaseQ/discord-mcp · https://mcpservers.org/servers/barryyip0625/mcp-discord
- Zapier: https://zapier.com/pricing · https://help.zapier.com/hc/en-us/articles/32337438839565-What-s-included-in-Zapier-s-Free-plan
- Make: https://developers.make.com/mcp-server · https://www.make.com/en/mcp · https://help.make.com/make-mcp-server
- Pipedream: https://pipedream.com/docs/connect/mcp · https://mcp.pipedream.com/
- Playwright: https://github.com/microsoft/playwright-mcp
- Browserbase: https://www.browserbase.com/mcp · https://mcpservers.org/servers/browserbase/mcp-server-browserbase

### Search/Read
- Exa: https://github.com/exa-labs/exa-mcp-server · https://exa.ai/docs/reference/exa-mcp
- Tavily: https://docs.tavily.com · https://docs.tavily.com/documentation/api-credits
- Perplexity: https://github.com/perplexityai/modelcontextprotocol

### RAG / kỹ thuật
- Reranker (two-stage): https://www.pinecone.io/learn/series/rag/rerankers/ · ARAGOG https://arxiv.org/pdf/2404.01037 · financial-RAG https://arxiv.org/pdf/2404.07221
- Matryoshka: https://sbert.net/examples/sentence_transformer/training/matryoshka/README.html
- Late interaction/ColBERT storage: https://weaviate.io/blog/late-interaction-overview · https://arxiv.org/pdf/2112.01488
