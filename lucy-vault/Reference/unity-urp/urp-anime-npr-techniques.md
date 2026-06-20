---
title: URP Anime/NPR character shader techniques (P5)
source: research notes for Stylized Toon World Kit Sprint 5
verified: 2026-06-16
tags: [unity, urp, hlsl, npr, anime, toon, sdf, sss]
---

# Anime / NPR character shading — kỹ thuật & cách hiện thực (URP 17 / Unity 6)

Ghi chú thực thi cho pack P5 (Body / Face SDF / Hair / Eye / Skin SSS). Tất cả dệt
trên P0 Core (`STW_ToonLighting`, `STW_AnisoSpecular`, `STW_ParallaxOffset`, `STW_Fresnel`).

## 1. ILM material mask (body)
- ILM = "Ink Lightmap" kiểu Genshin/Honkai: 1 texture mang nhiều kênh control vùng:
  - **R** = cường độ specular per-vùng (kim loại sáng, vải mờ).
  - **G** = AO / hệ số bóng (lõm darker).
  - (B/A thường: inner-line, specular size, ramp offset — tuỳ pipeline.)
- Ta dùng 2 kênh đủ bán: spec intensity (R) nhân vào toon-spec, AO (G) nhân occlusion.
- Toon-spec phẳng kiểu anime: `smoothstep(0.5±eps, pow(N·H, lerp(256,8,size)))` (P0 `STW_ToonSpecular`).

## 2. Face SDF shadow (kỹ thuật đặc trưng anime)
- **Vấn đề**: normal mặt nhiễu (mũi/mắt) → N·L cho bóng xấu, giật.
- **Giải**: 1 SDF grayscale (signed-distance-ish) mã hoá "pixel này còn sáng tới góc đèn nào".
  Vẽ cho **đèn từ 1 bên** (quy ước: TRÁI).
- Thuật toán/frag:
  1. Trục đầu: `forward = TransformObjectToWorldDir(0,0,1)`, `right = (...,(1,0,0))`. Chiếu xuống mặt phẳng ngang (.xz).
  2. `FdotL = dot(forwardXZ, lightXZ)` (1=đèn trước, -1=sau gáy); `RdotL = dot(rightXZ, lightXZ)` (dấu = bên trái/phải).
  3. Mirror UV.x khi `RdotL < 0` (đèn sang phải) để tái dùng 1 SDF.
  4. `threshold = 1 - (FdotL*0.5+0.5)` (0 khi đèn trước → 1 khi đèn sau).
  5. `lit = smoothstep(threshold-soft, threshold+soft, sdf)` → bóng trôi mượt khi xoay đèn.
- **Gotcha**: mesh mặt phải quay +Z, KHÔNG scale lệch (trục lấy từ object matrix). Mặt thường
  chỉ theo **key light** → bỏ additional lights cho rẻ + tránh nhiễu.

## 3. Hair anisotropic (Kajiya-Kay)
- Highlight kéo theo **tangent** (không theo normal): `sinTH = sqrt(1-(T·H+shift)^2)`, `pow(sinTH, exp)` (P0 `STW_AnisoSpecular`).
- 2 dải (primary mảnh + secondary rộng), **shift** bằng noise map → bóng tóc trượt khi xoay.
- Anime: highlight **tô về base color** (`lerp(specCol, specCol*albedo, blend)`) cho hợp tông nhuộm.
- Cần **tangent** (UV chải dọc sợi) mới đúng hướng.

## 4. Eye (parallax iris)
- Lớp: sclera → iris → pupil → limbal ring → corneal highlight.
- **Parallax iris**: offset UV iris theo view trong **tangent space** (`offset = viewTS.xy/viewTS.z * height*scale`)
  → iris "lõm" như giác mạc thật (P0 `STW_ParallaxOffset`). viewTS = `(dot(v,T),dot(v,B),dot(v,N))`.
- Pupil/limbal/iris = mask theo bán kính UV quanh tâm (0.5,0.5) bằng `smoothstep`.
- Highlight giác mạc = đốm procedural (pos/size), cộng qua **emission** (không dính bóng).

## 5. Skin fake SSS + blush
- **Colored banded shadow**: shadowTint = màu SSS ấm (đỏ/cam) thay vì xám → da "trong".
- **Terminator scatter**: dải ửng đỏ tại mép sáng/tối `saturate(1 - |N·L|/width)` → tán xạ dưới da.
- **Blush**: mask (R) → `lerp(albedo, blushColor, mask*strength)`.
- Sheen specular nhẹ (toon-spec) cho da bóng.

## Quy tắc chung (giữ parity toàn kit)
- Opaque đủ 3 pass: ForwardLit + ShadowCaster + DepthNormals (cho shadow + SS-outline/SSAO).
- Mọi material property trong `CBUFFER_START(UnityPerMaterial)` (SRP Batcher). Property `[Toggle(_KW)]`
  chỉ drive keyword → **KHÔNG** vào CBUFFER (không sample trong HLSL).
- `_FORWARD_PLUS` keyword + `LIGHT_LOOP_BEGIN/END` cho additional lights cluster (U6 default).
- Macro VR SPI: `STW_VERTEX_INPUT_INSTANCE_ID` / `STW_VERTEX_OUTPUT_STEREO` / `STW_SETUP_INSTANCE_*`.
