---
name: unity-shader-version-gotchas
description: Case ngộ HLSL/URP giữa các Unity version (cho Stylized Shader Kit) — bồi dần khi research/đọc src
metadata: 
  node_type: memory
  type: reference
  originSessionId: 0ded98c3-60c8-4e72-a49d-0ebcaeafa57e
---

Kho case ngộ shader URP/HLSL để build **Stylized Toon World Kit** (URP 17 / Unity 6+). Spec: `/root/lucy-workspace/stylized-shader-kit-spec.md`. BỒI THÊM mỗi lần research hoặc đọc src Bill cấp.

**Đã biết (seed 2026-06-16):**
- **Unity 6 / URP 17 — RenderGraph BẮT BUỘC** cho ScriptableRendererFeature (SS outline, post): dùng API RenderGraph (`AddRasterRenderPass`/`RecordRenderGraph`); `ScriptableRenderPass.Execute()` cũ = compatibility mode, deprecated → đừng viết kiểu cũ.
- **Forward+ là default Unity 6** (khác Forward cũ): light loop cluster → cần `#pragma multi_compile _ _FORWARD_PLUS` + dùng macro light đúng, không hardcode loop kiểu Built-in.
- **SRP Batcher:** mọi material property PHẢI nằm trong `CBUFFER_START(UnityPerMaterial)...CBUFFER_END`; để ngoài → vỡ batcher (perf hit âm thầm, mất điểm review store).
- **Macro texture:** dùng `TEXTURE2D(_X); SAMPLER(sampler_X); SAMPLE_TEXTURE2D(...)` (URP), KHÔNG `sampler2D/tex2D` kiểu Built-in.
- **VR Single-Pass Instanced (SPI):** shader phải khai `UNITY_VERTEX_OUTPUT_STEREO` trong struct v2f + `UNITY_SETUP_INSTANCE_ID(v)` + `UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o)` ở vertex + `UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(i)` ở fragment → nếu thiếu, VR render lệch/1 mắt. Target Mobile+PC+VR = bắt buộc có. Texture array cho stereo nếu cần.
- **Tối ưu draw call/batch:** inverted-hull outline = thêm 1 pass/draw + phá SRP Batcher khi khác material → nên có biến thể Screen-Space (Renderer Feature, 1 draw, giữ batch). Ghi rõ cái nào phá batch cho người dùng mobile.
- **Include core URP:** `Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl` + `Lighting.hlsl` (đường dẫn/nội dung đổi theo version → bọc trong URPCompat.hlsl).

**Cần xác minh khi research (chưa chắc):**
- Khác biệt URP 12 (U2021) ↔ 14 (U2022) ↔ 17 (U6): tên keyword, signature hàm lighting, `GetMainLight`/shadow API.
- Built-in → URP port gotchas (nếu bán hỗ trợ cả Built-in).
- Keyword limit / `shader_feature` vs `multi_compile` cho biến thể.
- DepthNormals prepass yêu cầu cho SS outline + SSAO.

**Bổ sung Sprint 0 (2026-06-16, áp khi build P0 Core Library — repo billtruong003/stylized-toon-world-kit ĐÃ có nền):**
- **Additional lights — 2 path:** Forward+ duyệt cluster qua `LIGHT_LOOP_BEGIN(count)...LIGHT_LOOP_END` (biến `lightIndex` tự có), gate `#if USE_FORWARD_PLUS` (URP define khi keyword `_FORWARD_PLUS`). Forward cũ (URP12/14) KHÔNG có macro → fallback `for(i<GetAdditionalLightsCount())`+`GetAdditionalLight(i,posWS,shadowMask)`. Viết CẢ HAI nhánh.
- **ShadowCaster pass:** `_LightDirection`/`_LightPosition` global (ĐỂ NGOÀI CBUFFER UnityPerMaterial), keyword `_CASTING_PUNCTUAL_LIGHT_SHADOW`, `ApplyShadowBias(posWS,nWS,dir)` + clamp z theo `UNITY_REVERSED_Z`/`UNITY_NEAR_CLIP_VALUE`.
- **DepthNormals pass** (LightMode=DepthNormals): frag trả `half4(NormalizeNormalPerPixel(nWS)*0.5+0.5,0)` — cần cho SS outline + SSAO.
- **Depth sample:** include `.../ShaderLibrary/DeclareDepthTexture.hlsl`→`SampleSceneDepth(uv)`+`LinearEyeDepth(raw,_ZBufferParams)`; depth-fade=(sceneEyeDepth−screenPos.w)/dist. Cần URP bật Depth (+Opaque cho refraction).
- **GI/lightmap:** `DECLARE_LIGHTMAP_OR_SH(lmUV,vertexSH,idx)` trong Varyings + `OUTPUT_LIGHTMAP_UV`/`OUTPUT_SH` vertex; `SampleSH(nWS)` ambient. ⚠️URP17 có `OUTPUT_SH4` mới (kèm probeOcclusion); `OUTPUT_SH` cũ vẫn compile (compat) — check nếu Unity báo deprecate.
- **VR SPI wrap sẵn** trong URPCompat: `STW_VERTEX_INPUT_INSTANCE_ID`/`STW_VERTEX_OUTPUT_STEREO`/`STW_SETUP_INSTANCE_VERT(IN,OUT)`/`STW_SETUP_INSTANCE_FRAG(IN)` → mọi shader khai 4 dòng, đỡ quên lệch mắt.
- **Pragma KHÔNG include được** → để checklist pragma dạng comment trong URPCompat, DÁN tay vào từng Pass.
- **TEXTURE2D_PARAM(tex,samp)** để truyền tex+sampler vào hàm helper (triplanar/ramp-texture).

**Bổ sung Sprint 1 (2026-06-16, build P1 Toon+Outline — 6 shader + SS-outline feature):**
- ⭐**Forward+ `LIGHT_LOOP_BEGIN(count)` CẦN biến tên ĐÚNG `inputData`** (kiểu `InputData`) đã set `inputData.normalizedScreenSpaceUV` + `inputData.positionWS` TRƯỚC macro — vì macro init ClusterIterator đọc 2 field đó. Thiếu = LỖI COMPILE khi `_FORWARD_PLUS` (default U6!). Sprint 0 StylizedLighting.hlsl viết `LIGHT_LOOP_BEGIN` mà KHÔNG có inputData → đã phải fix: thêm `float2 screenUV` (+ đổi positionWS→float3) vào STWToonSurface, mỗi frag set `s.screenUV=GetNormalizedScreenSpaceUV(IN.positionCS)`. Lấy screenUV từ SV_POSITION ở fragment.
- **`GetNormalizedScreenSpaceUV(float4 positionCS)`** (Core/ShaderVariablesFunctions) đổi clip→[0,1] screen UV cho cluster + sample fullscreen.
- **Outline per-material KHÔNG cần renderer feature:** thêm 1 Pass `Tags{"LightMode"="SRPDefaultUnlit"}` + `Cull Front` → URP DrawObjectsPass vẽ KÈM pass UniversalForward (cùng lúc opaque) → outline tự render. Đây là cách inverted-hull chuẩn URP (khỏi viết C#).
- **SS outline = fullscreen blit material (RenderGraph):** Feature gọi `ConfigureInput(ScriptableRenderPassInput.Depth | Normal)` để ép có `_CameraDepthTexture`+`_CameraNormalsTexture`; pass dùng `RenderGraphUtils.BlitMaterialParameters(source,dest,mat,passIdx)` + `renderGraph.AddBlitPass(para,"name")` (tự xử XR SPI). Tránh same src==dst: blit sang temp `UniversalRenderer.CreateRenderGraphTexture(rg,desc,...)` rồi `resourceData.cameraColor=dest`. Namespace: `UnityEngine.Rendering.RenderGraphModule.Util` cho BlitMaterialParameters/AddBlitPass.
- **Shader fullscreen blit:** include `com.unity.render-pipelines.core/ShaderLibrary/Blit.hlsl` → có sẵn `Vert`/`Varyings`(`.texcoord`)/`_BlitTexture`(TEXTURE2D_X)/`sampler_LinearClamp`; `#pragma vertex Vert`. `_BlitTexture_TexelSize` KHÔNG chắc auto-bind → tính texel = `1.0/_ZBufferParams`? KHÔNG — dùng `1.0/_ScreenParams.xy` cho chắc.
- **`SampleSceneNormals(uv)`** (DeclareNormalsTexture.hlsl) trả world normal; `SampleSceneDepth`+`LinearEyeDepth(...,_ZBufferParams)` cho depth. Roberts cross: 4 góc chéo, edge=sqrt(d0²+d1²)*scale-bias; gộp max(depthEdge,normalEdge).
- **`GetVertexNormalInputs(normalOS, tangentOS)`** (overload có tangent) trả `nrm.tangentWS` cho normal-map/aniso; tangent sign = `IN.tangentOS.w * GetOddNegativeScale()`.
- **`DisallowMultipleRendererFeature("Name")`** attribute cho ScriptableRendererFeature; `CoreUtils.CreateEngineMaterial(shader)` + destroy ở `Dispose`; `resourceData.isActiveTargetBackBuffer` → return (không blit thẳng backbuffer).

**Bổ sung Sprint 2 (2026-06-16, build P3 VFX — 7 shader + Core/StylizedVFX.hlsl):**
- **`HLSLINCLUDE...ENDHLSL` (ngoài Pass, trong SubShader)** chèn vào ĐẦU MỌI `HLSLPROGRAM` của SubShader → đặt CBUFFER + hàm helper dùng chung cho cả 3 pass (ForwardLit/ShadowCaster/DepthNormals). Dùng cho Dissolve để khỏi lặp CBUFFER 3 lần. `#pragma` thì vẫn để TRONG từng pass (pragma không theo include).
- **`DeclareDepthTexture.hlsl` include 1 LẦN/compilation unit** — định nghĩa `_CameraDepthTexture`; kéo CẢ `StylizedSurface.hlsl` LẪN `StylizedVFX.hlsl` vào cùng 1 pass = redefinition. Mỗi VFX shader chỉ include StylizedVFX.
- **VFX trong suốt unlit:** 1 pass `LightMode=UniversalForward`, KHÔNG ShadowCaster/DepthNormals (transparent không ghi depth) → đỡ variant. Tags `Queue=Transparent`+`IgnoreProjector=True`. `Blend [_SrcBlend][_DstBlend]`, `ZWrite [_ZWrite]`.
- **Render-state prop (`_SrcBlend/_DstBlend/_ZWrite/_Cull`) VẪN phải nằm trong CBUFFER UnityPerMaterial** dù chỉ dùng ở ShaderLab `[_X]` — không thì vỡ SRP Batcher. (Enum int: One=1, SrcAlpha=5, OneMinusSrcAlpha=10; additive=`One One`.)
- **Particle vertex stream:** khai `half4 color : COLOR` trong Attributes → nhân vào rgb/a cuối → Particle System (Color-over-Lifetime) lái màu+alpha per-particle, miễn phí.
- **Dissolve clip phải lặp ở CẢ ShadowCaster + DepthNormals** (cùng noise−threshold) nếu không bóng & SS-outline giữ nguyên silhouette trong khi thân tan.
- **Flow-map 2 phase (Valve):** `STW_Flow` — 2 offset `frac(t)`/`frac(t+0.5)`, sample 2 lần, lerp theo weight tam giác `abs(0.5-phase)*2` → chảy vô hạn không pop.
- **Soft particle / intersection glow:** so `LinearEyeDepth(SampleSceneDepth(screenUV))` vs `screenPos.w` → diff nhỏ thì fade (soft) hoặc nghịch đảo = viền sáng nơi shield cắt geometry. CẦN URP bật Depth Texture.
- **Hex grid SDF** (`STW_HexEdge`): gập UV vào lattice 2 cell `fmod` (r=(1,√3)), distance-to-edge → lưới tổ ong analytic, khỏi texture. **Polar UV** (`STW_PolarUV`): `atan2/2π+0.5` = góc, `length*2` = bán kính → magic circle xoay.
- **`_Time` là float4** (`.y`=giây) từ UnityInput.hlsl (qua Core.hlsl) — dùng thẳng cho panner/scanline, giữ purity bằng cách truyền `_Time.y` vào helper.

**Bổ sung Sprint 3 (2026-06-16, build P2 Environment — 7 shader, folder `Environment/`):**
- **Gerstner wave (Catlike Coding):** `k=2π/wavelength`, tốc độ pha nước sâu `c=sqrt(9.8/k)`, biên độ `a=steepness/k`; offset `(dir.x*a*cosF, a*sinF, dir.y*a*cosF)` với `f=k(dot(dir,xz)-c*t)`. **Normal giải tích:** cộng dồn tangent/binormal partial-deriv từng sóng rồi `normalize(cross(binormal,tangent))` — KHỎI ddx/ddy, khỏi normal map.
- ⭐**Vertex displacement (Ocean/Grass/Tree) PHẢI lặp Y HỆT ở ShadowCaster + DepthNormals** → để hàm displace/wind trong `HLSLINCLUDE` dùng chung mọi pass, nếu không BÓNG + SS-outline giữ silhouette tĩnh trong khi hình lắc.
- **Depth-gradient nước:** `sceneEye=LinearEyeDepth(SampleSceneDepth(screenUV),_ZBufferParams)` − `screenPos.w` = bề dày cột nước → lerp shallow→deep + foam viền. Cần URP Depth Texture.
- **Wind sway mask theo chiều cao:** grass dùng `uv.y` (gốc=0/ngọn=1), cây dùng vertex `COLOR.a` (chuẩn foliage Unity, keyword chọn) hoặc `uv.y`; bend bậc 2 (`mask*mask`) cho dáng cong; gust = sin tần thấp toàn vùng nhân biên độ.
- **Dither alpha edge** (lá cây nhiều lớp): clip alpha so với hash màn hình ổn định (`STW_Hash21(floor(positionCS.xy))`) thay clip cứng → mép mịn, rẻ hơn alpha-to-coverage. Lặp ở mọi pass clip.
- **Translucency (SSS giả lá):** `pow(saturate(dot(viewDir,-lightDir)),p)*color` → sáng khi nhìn ngược nắng.
- **Sky dome unlit:** gradient theo `dir.y` (camera→fragment normalize), 2 bảng day/night blend theo `_MainLightPosition.y`; sun `dot(dir,sunDir)`→disk+halo; mây fBm chiếu vòm phẳng `dir.xz/(dir.y+k)` (đỡ dồn đỉnh), ngưỡng `smoothstep` cho mép cel. Gắn DOME MESH (Cull Front, Queue Background), KHÔNG slot Skybox.
- **Terrain auto-blend KHÔNG splatmap:** ground planar / cliff `STW_Triplanar` theo `STW_SlopeMask(normalWS.y)` / peak `STW_HeightGradient(worldY)` slope-biased + macro noise phá tiling.
- ⚠️**Include path:** shader trong thư mục con (Environment/, VFX/) phải dùng `"../Core/X.hlsl"` — Unity resolve `#include "x"` theo thư mục FILE đang include, KHÔNG auto tìm Core/. (P3 VFX include bare `"URPCompat.hlsl"` từ VFX/ → nghi vấn cần Bill verify ở Unity; P2 dùng `../Core/` cho chắc.)
- **Tránh double `DeclareDepthTexture`:** đừng include cả StylizedSurface LẪN StylizedVFX trong 1 pass (cả hai kéo DeclareDepthTexture → trùng `_CameraDepthTexture`). Env transparent dùng StylizedSurface (có STW_DepthFade) + tự viết vertex, KHÔNG đụng StylizedVFX.

## ✅ VERIFY WORKFLOW (Bill chốt 2026-06-16): viết blind + verify-bằng-docs-RAG
Vì VPS KHÔNG có Unity (không compile URP thật được), chiến lược: VIẾT BLIND nhưng GIẢM SAI bằng cách tra docs THẬT, không nhớ mò.
- **Fetch docs Unity URP/HLSL chính thức → lưu vault** (markdown sạch qua Jina Reader r.jina.ai), thư mục riêng (đề xuất `Reference/unity-urp/`), chunk theo heading (docs dài → tách đoạn để recall trúng).
- **Embed bằng Jina** (pipeline embed.ts → vector) → khi VIẾT shader, RECALL từ KB này (vd "GetMainLight signature URP17", "ShadowCaster pass URP", "CBUFFER UnityPerMaterial") → dùng API/macro ĐÚNG từ docs.
- Vòng: recall docs → viết → (full compile vẫn cần Unity local/GameCI ở bước cuối, nhưng sai cú pháp/API giảm mạnh).
- ⚠️ Cô lập KB để không làm loãng recall chung (recall theo similarity nên chủ yếu kéo khi query về shader — chấp nhận được; nếu loãng thì tách namespace).

**Nguồn cần fetch (đề xuất, chờ Bill duyệt):** Unity Manual "Writing HLSL shader programs" (6000.x) · URP shader writing (unlit/lit structure) · ShaderLab reference · ShaderVariablesFunctions/Core.hlsl/Lighting.hlsl API · RenderGraph API (ScriptableRendererFeature) · SRP Batcher requirements · built-in shader variables + keywords/multi_compile · (tùy) src URP ShaderLibrary trên GitHub. Cyanilux + nedmakesgames URP-code tutorials (giải thích tốt).

Liên quan: Bill = Technical Artist (Toon/Outline/Dissolve HLSL) [[owner-bill-truong-profile]]; bán marketplace passive (money-ideas.md); [[jina-potential-roadmap]] (late-chunking để embed docs dài chuẩn hơn).

## 🔴 LỖI COMPILE THẬT từ Unity của Bill (2026-06-16 — blind-write bị, SỬA NGAY)
Bill import StylizedToonWorldKit → Console hàng loạt lỗi. ĐÂY LÀ SỰ THẬT, ưu tiên hơn seed:
1. **`_FORWARD_PLUS` ĐÃ DEPRECATED → đổi `_CLUSTER_LIGHT_LOOP`** (URP Bill đang dùng). ⚠️ SỬA seed phía trên (seed ghi _FORWARD_PLUS là SAI với version này).
2. **Missing include `URPCompat.hlsl`** trong nhiều shader (đường dẫn include sai/relative không resolve) → phải dùng đường dẫn đúng hoặc package path.
3. **`Blit.hlsl` đường dẫn cũ** `com.unity.render-pipelines.core/.../Blit.hlsl` → URP mới ở `com.unity.render-pipelines.universal/ShaderLibrary/Blit.hlsl`.
4. **`cannot implicitly convert const float2 → float3`** ở `StylizedSurface.hlsl:31` → ép kiểu `float3(uv, 0.0)`. Lan ra Crystal/Ocean/Eye/Waterfall (đều include file này).
5. **`syntax error: unexpected token '}'`** nhiều file (Toon Template/Lava/RampLit/Outline/Hair/Tree) → braces lệch do `#if/#ifdef` không định nghĩa / macro include hỏng (hệ quả của #1-2).
6. **Dissolve: `Both vertex and fragment programs must be present`** (dòng 92/215/282) → pass thiếu `HLSLPROGRAM`/vertex+fragment.
→ BÀI HỌC: blind-write KHÔNG đủ; gotcha seed có cái SAI (_FORWARD_PLUS). Cần 1 sprint FIX dựa lỗi thật + verify bằng docs RAG (lần này có lỗi cụ thể từ Unity = chuẩn nhất).
