# URP — Kỹ thuật Outline (toon) (RAG)

> Nguồn: ameye.dev "5 ways to draw an outline" + "Edge Detection Outlines"; Cyanilux custom renderer features; Robinseibold/EmmyVoita URP outline repos. Tổng hợp 2026-06-16 bởi Lucy.

## 1. Inverted-Hull (extrusion) — per-material, rẻ, mọi platform (kể cả VR/mobile)
- Thêm 1 pass: cull **Front** (vẽ mặt sau), phình vertex theo normal: `posWS += normalWS * width`, đặt màu outline phẳng.
- Width modes: world-space (xa nhỏ dần) vs screen-space (đều theo pixel — phình ở clip: `clip.xy += normalize(normalCS.xy) * width * clip.w`, bù aspect).
- Mesh có hard-edge/normal tách → outline rách. Khắc phục: bake smoothed-normal vào vertex color/UV (đọc thay normal khi phình). Pack nên ghi chú điều này.
- ⚠️ Phá batch khi nhiều material khác nhau (thêm draw/pass). Nhưng GPU instancing vẫn chạy cùng mesh+mat.
- VR: phình phải qua macro stereo (clip space đúng từng mắt).

## 2. Screen-Space edge detection — Renderer Feature, 1 fullscreen draw, giữ batch scene
- Cần DepthNormals prepass → `ConfigureInput(Depth | Normal)` để có `_CameraDepthTexture` + `_CameraNormalsTexture`.
- **Roberts cross**: lấy 4 góc chéo (TL,TR,BL,BR) quanh pixel, edge = sqrt(d0²+d1²) với d0=|TL-BR|, d1=|TR-BL|.
  - Depth edge: bắt silhouette (cạnh ngoài).
  - Normal edge: bắt cạnh gấp khúc cùng độ sâu (crease).
  - Gộp: `max(edgeDepth, edgeNormal)` (hoặc weighted) để bắt cả 2.
- Đẹp/đồng đều, độ dày theo pixel, không sửa mesh. Nhưng tốn 1 fullscreen pass + cần depth/normals (cost mobile cao hơn hull).
- Bù scale theo depth (cạnh xa mảnh hơn) + ngưỡng (bias) lọc noise. Linearize depth trước khi so (`LinearEyeDepth`).

## 3. Khi nào dùng cái nào (tradeoff perf↔visual — nguyên tắc #1)
- Mobile/VR cảnh đông, ít material → **Inverted-Hull** (giữ draw/batch trên mỗi mesh, không cần prepass).
- PC, muốn outline đều toàn cảnh kể cả crease nội bộ → **Screen-Space** (1 pass, giữ batch scene nhưng thêm prepass).
- Kit này ship CẢ HAI, ghi rõ cái nào phá batch / cần prepass.

## 4. Toon lighting kèm (nhắc lại — đã ở StylizedLighting.hlsl)
- Cel ramp = step/smooth/texture-LUT trên N·L (half-lambert remap để tối không đen).
- Banded colored shadow: lerp(shadowTint, lit, rampStep) thay vì nhân đen.
- Rim/fresnel: `pow(1 - saturate(N·V), power)`, chỉ ăn vùng sáng để khỏi loé trong bóng.
- Hair aniso (Kajiya-Kay): highlight theo tangent, shift bằng noise/map → 2 dải highlight.
