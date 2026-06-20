---
title: URP Stylized Environment Shader Techniques (P2)
source: Catlike Coding (Flow/Waves), Cyanilux, MinionsArt, Roystan, Unity URP docs
captured: 2026-06-16
for: Stylized Toon World Kit — Sprint 3 (P2 Environment)
tags: [unity, urp, hlsl, shader, environment, water, ocean, grass, sky, terrain]
---

# URP Stylized Environment — kỹ thuật áp cho P2

Ghi chú kỹ thuật (verify-by-docs) cho 7 shader môi trường. Mọi shader trỏ về P0 Core
(`StylizedLighting/Noise/Surface/URPCompat`). Đây là phần "concept hiểu trước khi viết".

## 1. Stylized Water (hồ/sông) — transparent
- **Depth-gradient color:** so sánh eye-depth của scene (`SampleSceneDepth` →
  `LinearEyeDepth(..,_ZBufferParams)`) với eye-depth của fragment (`screenPos.w`). Hiệu
  `sceneEye - fragEye` = bề dày cột nước → `saturate(depth/_DepthRamp)` lerp shallow→deep.
- **Edge foam:** cùng phép depth, `saturate(depth/_FoamDistance)` nhỏ ở mép giao → so với
  noise cuộn (`step`) ra viền bọt. (Cyanilux "stylized water").
- **Flow normals:** sample normal map 2 lần với UV scroll ngược pha rồi cộng .xy (đỡ lộ pattern).
- **Caustic:** voronoi F1 animate (`STW_Voronoi(uv, time)`), nghịch đảo + pow → mạng sáng; chỉ
  add ở vùng nông (1 - depthGrad).
- ⚠️ Cần URP **Depth Texture** (Renderer asset). Transparent: `ZWrite Off`, queue Transparent.

## 2. Stylized Ocean — Gerstner waves (opaque)
- **Gerstner** (Catlike Coding "Waves"): mỗi sóng dịch đỉnh theo phương truyền, đáy phẳng đỉnh nhọn.
  `k = 2π/wavelength`, tốc độ pha nước sâu `c = sqrt(g/k)` (g≈9.8), biên độ `a = steepness/k`.
  Offset = `(dir.x*a*cos(f), a*sin(f), dir.y*a*cos(f))` với `f = k(dot(dir,xz) - c*t)`.
- **Normal giải tích:** cộng dồn tangent & binormal partial-derivative của từng sóng rồi
  `normalize(cross(binormal, tangent))` — không cần sample normal map, không cần ddx/ddy.
- **Crest foam:** theo độ cao đỉnh (offset.y) hoặc Jacobian (steepness tổng > 1 = chóp gãy).
- **ShadowCaster phải áp CÙNG displacement** → để hàm trong `HLSLINCLUDE` dùng chung mọi pass,
  bóng mới khớp sóng.

## 3 & 4. Grass / Tree wind (cutout lit)
- **Vertex wind:** lệch world-space theo `sin(dot(positionWS.xz, dir)*freq + t*speed)`, cộng
  harmonic bậc 2 cho tự nhiên. **Mask theo chiều cao** để gốc đứng yên: grass dùng `uv.y`
  (blade gốc=0/ngọn=1), cây dùng vertex `COLOR.a` (chuẩn foliage Unity) hoặc `uv.y`. Bend bậc 2
  (`mask*mask`) cho dáng cong. (MinionsArt "grass", Roystan "grass").
- **Gió đợt (gust):** sin tần thấp toàn vùng nhân vào biên độ.
- **Translucency (SSS giả lá):** `pow(saturate(dot(viewDir, -lightDir)), p)` → sáng khi nhìn ngược nắng.
- **Alpha edge:** clip cứng (`_Cutoff`) hoặc **dither** (so alpha với hash màn hình ổn định) cho
  mép lá mịn nhiều lớp — rẻ hơn alpha-to-coverage.
- ⚠️ Wind phải có ở **ForwardLit + ShadowCaster + DepthNormals** (cùng hàm) → bóng & SS-outline
  không lệch với hình.

## 5. Stylized Sky / Clouds (unlit dome)
- **Gradient 3 chặng:** theo `dir.y` (hướng từ camera ra fragment, normalize). horizon→mid (pow
  sharp) → zenith (pow). 2 bảng màu **day/night** blend theo độ cao mặt trời `_MainLightPosition.y`.
- **Sun:** `dot(viewDir, sunDir)` → disk (`smoothstep` gần 1) + halo (`pow` mũ lớn).
- **Mây toon:** `STW_FBM` 2 lớp scroll, chiếu vòm phẳng `dir.xz/(dir.y+k)` (đỡ dồn ở đỉnh),
  ngưỡng hoá `smoothstep(cover, cover+sharp, n)` cho mép cel; giới hạn theo dải độ cao.
- Vẽ **dome mesh** (Cull Front, ZWrite Off, queue Background) — KHÔNG dùng slot Skybox material.

## 6. Stylized Terrain — auto blend (opaque lit)
- **3 lớp tự động (không splatmap):** ground (planar XZ) / cliff (triplanar) / peak (snow-sand).
- **Slope mask:** `smoothstep` quanh `normalWS.y` → đá ở vách dốc (`STW_SlopeMask`).
- **Height gradient:** `saturate((worldY-min)/(max-min))^sharp` → tuyết/cát ở đỉnh, bias tránh dốc.
- **Triplanar** cho lớp đá (đỡ stretch trên vách đứng): blend 3 trục theo `pow(abs(normal),sharp)`.
- **Macro variation:** noise tần thấp nhân albedo → phá lặp texture trên diện rộng.

## 7. Stylized Waterfall — flow (transparent)
- **Dòng chảy:** 2 lớp `STW_GradientNoise` cuộn theo `-uv.y*time` + distortion ngang (noise đẩy UV).
- **Foam:** ngưỡng noise + tăng ở đỉnh (`smoothstep(0.7,1,uv.y)`) & chân (`smoothstep(0.3,0,uv.y)`).
- **Mist chân thác:** soft-particle / depth-fade (`STW_DepthFade`) → mờ nơi cắt geometry.

## Gotchas chung (đã đưa vào memory unity-shader-version-gotchas)
- `DeclareDepthTexture.hlsl` KHÔNG có include-guard riêng kiểu STW → **đừng include cả
  `StylizedSurface.hlsl` và `StylizedVFX.hlsl`** trong cùng pass (cả hai kéo DeclareDepthTexture →
  trùng khai `_CameraDepthTexture`). Chọn 1.
- Include path: shader trong thư mục con phải dùng **đường dẫn tương đối đúng** (`"../Core/X.hlsl"`),
  Unity resolve `#include "x"` theo thư mục file đang include, KHÔNG tự tìm trong Core/.
- Vertex-displacement shader (Ocean/Grass/Tree): displacement phải lặp ở ShadowCaster/DepthNormals.
