# URP VFX / Effects techniques (P3 pack) — Unity 6 / URP 17

Reference notes backing the Stylized Toon World Kit **P3 VFX** sprint. Verify-by-docs RAG: these are the
HLSL techniques used by the 7 VFX shaders, with the URP gotchas that matter on Unity 6.

## Transparent unlit VFX skeleton (URP)
- Tags: `"RenderPipeline"="UniversalPipeline" "RenderType"="Transparent" "Queue"="Transparent" "IgnoreProjector"="True"`.
- One `Pass` with `Tags{ "LightMode"="UniversalForward" }`, `Blend [_SrcBlend][_DstBlend]`, `ZWrite [_ZWrite]`.
- **No** ShadowCaster/DepthNormals for transparent FX (they don't write depth/cast shadows) — saves variants.
- Still need `#pragma multi_compile_fog` + `multi_compile_instancing` and the VR Single-Pass-Instanced macros,
  or VFX render to one eye only in XR.
- **SRP Batcher**: even render-state-only props (`_SrcBlend/_DstBlend/_ZWrite/_Cull`) must sit inside
  `CBUFFER_START(UnityPerMaterial)` or the shader drops out of the batcher.

## Blend modes (set via `[Enum(UnityEngine.Rendering.BlendMode)]`)
- **Additive** (glow/energy/fire): `One One`, `ZWrite Off`. Self-illuminating, ignores background darkness.
- **Premultiplied/alpha** (hologram, things with dark detail): `One OneMinusSrcAlpha` (premul) or
  `SrcAlpha OneMinusSrcAlpha` (straight). Enum ints: One=1, SrcAlpha=5, OneMinusSrcAlpha=10.

## Particle vertex stream
- Declare `half4 color : COLOR` in Attributes → multiply into final `rgb`/`a`. Lets a Particle System's
  Color-over-Lifetime / start-color drive the shader per-particle with no extra material work.

## Flow-map (Valve 2-phase) — magic / energy flow
- Sample a flow map `.rg` remapped to `-1..1` = local flow direction.
- Advance UV by two half-offset phases (`frac(t)`, `frac(t+0.5)`), sample twice, lerp by a triangle weight
  `abs(0.5-phase)*2` → seamless infinite flow with no visible reset pop. (`STW_Flow` in `StylizedNoise.hlsl`.)

## Soft particles & intersection glow — needs Depth Texture
- Enable **Depth Texture** on the URP Renderer. Include `DeclareDepthTexture.hlsl`, `SampleSceneDepth(uv)`,
  `LinearEyeDepth(raw, _ZBufferParams)`. Compare scene eye-depth vs `screenPos.w` (fragment eye-depth):
  - small diff → fade out (soft particle) to hide hard quad intersection lines.
  - inverse (1 - softfade) → bright **intersection rim** where a shield/forcefield cuts geometry.

## Hex grid (force field) — analytic SDF, no texture
- Fold UV into a hex lattice with two offset `fmod` cells (`r = (1, sqrt(3))`), pick nearest cell center,
  distance-to-edge via hex metric → thin animated honeycomb lines. Cheaper & crisper than a tiled texture.

## Polar UV (magic circle)
- `angle = atan2(d.y,d.x)/2π + 0.5`, `radius = length(d)*2`. Animate `angle += time*spin` → spinning rings;
  feed radius into ramps for concentric magic-circle bands.

## Procedural flame vs flipbook
- **Procedural**: scroll fBm upward, distort UV horizontally by a second noise, shape-mask by height
  (`1 - h/flameHeight`), 3-stop HDR color ramp (inner→mid→outer). Zero textures, scales on mobile at low octaves.
- **Flipbook**: sample an N×M sprite sheet, frame `= floor(time*fps) % (cols*rows)`; row indexed top-down.
  Use a `shader_feature_local` keyword so one shader serves both, no dead samples in the procedural variant.

## Dissolve (lit cutout) — keep shadow & outline in sync
- `clip(noise - _Dissolve)` in ForwardLit **and** re-run the same clip in **ShadowCaster** + **DepthNormals**
  passes, otherwise the shadow and the screen-space outline keep the full silhouette while the body dissolves.
- World-space noise option (`positionWS` instead of UV) avoids seams when the mesh is scaled/tiled.
- Edge glow = thin band just above the clip threshold: `1 - saturate((noise-_Dissolve)/_EdgeWidth)`.

## Hologram glitch / scanline / flicker
- Scanline: `pow(sin((coord*density - time*speed)*2π)*0.5+0.5, sharpness)`.
- Glitch: hash per horizontal band + per time-step; offset UV.x only when hash passes a threshold → random
  horizontal tearing. Flicker: hash on `floor(time*speed)` modulating global brightness.

## Gotchas confirmed this sprint
- `_Time` is `float4`; `.y` = seconds (from `UnityInput.hlsl`, pulled in by `Core.hlsl`). Available everywhere.
- `DeclareDepthTexture.hlsl` defines `_CameraDepthTexture` — include it **once** per compilation unit
  (don't pull both `StylizedSurface.hlsl` and `StylizedVFX.hlsl` into the same pass → redefinition).
- `HLSLINCLUDE` block content is injected at the top of **every** `HLSLPROGRAM` in the SubShader — handy to
  share a CBUFFER + helper across ForwardLit/ShadowCaster/DepthNormals (used by Dissolve).
