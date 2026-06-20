# URP Stylized Surface / Material Techniques (P4)

Research notes backing the **P4 Surface** pack (Crystal, Ice, Liquid, Lava, Glass, Metal) of Stylized Toon World Kit. URP 17 / Unity 6. Verify-by-docs RAG: these are the techniques + the exact URP hooks each shader relies on.

## Fake refraction via the Opaque Texture
- URP exposes the post-opaque color buffer as **`_CameraOpaqueTexture`**; include
  `Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareOpaqueTexture.hlsl` → use `half3 SampleSceneColor(float2 uv)`.
- Requires **Opaque Texture** enabled on the URP Renderer (and the material must render in the **Transparent** queue so the opaque pass already ran).
- Refraction = sample scene color at `screenUV + offset`. A cheap, stable offset is the **view-space normal XY**: `TransformWorldToViewDir(normalWS, true).xy * strength`. View-space keeps the distortion screen-aligned regardless of camera.
- **Dispersion** (chromatic gem look): sample R/G/B at slightly different offsets (`offset * (1±disp)`) and recombine → rainbow fringe at silhouette.
- **Frosted glass**: jitter the refraction UV by a noise sample and **box-blur the scene color** (5-tap: center + ±x/±y at a small radius), then `lerp`/multiply by tint. More taps = smoother but costlier; 5-tap reads "frosted" well for stylized.
- Desaturate the refracted color toward luma (`lerp(luma, c, sat)`) to avoid a harsh stained-glass tint when the body color is strong.

## Fake subsurface / depth tint (Ice, Liquid)
- No real SSS: approximate "thickness" with **inverse Fresnel** — `pow(1 - saturate(dot(N,V)), power)` is high where you look *through* more material (grazing / center of a convex blob), low at silhouette facing you.
- Ice: `lerp(litColor, litColor * depthColor, invFresnel * strength)` tints thick areas blue.
- Liquid: same factor drives a shallow→deep color ramp (`lerp(shallow, deep, pow(1-NdotV, power))`).

## Sparkle / glints (Ice, snow)
- Voronoi cellular noise (`STW_Voronoi`) gives distance-to-feature-point; `1 - smoothstep(0, eps, dist)` lights a tiny dot at each cell center.
- **Per-cell twinkle**: hash the cell id (`STW_Hash21(floor(uv*scale))`) and `step(1-amount, hash)` so only a random subset sparkle; animate by passing `_Time * speed` as the voronoi angle offset.
- Modulate by `dot(N,V)` so glints favor facets pointing at the camera (view-dependent, like real ice).

## Fill level (Liquid in a bottle)
- Clip in **object space**: pass `positionOS.y` to the fragment and `clip(fillY - positionOS.y)` to discard everything above the liquid line. Drives a vorpal "pour" by animating `fillY`.
- Add a sin **wobble** (`sin(worldX*freq + t*speed)*amp`) to `fillY` for sloshing.
- A **surface band** (`1 - saturate(abs(fillY - posOS.y)/width)`) brightens the meniscus.
- Liquid mesh is hollow → render **two-sided** (`Cull Off`) and flip back-face normals so the inside is lit. Use URP's portable **`IS_FRONT_VFACE(cullFace, 1, -1)`** with `FRONT_FACE_TYPE cullFace : FRONT_FACE_SEMANTIC` (cross-platform; raw `VFACE` is not portable to all backends).

## Lava / magma (flow + crust + emissive cracks)
- **Flow-map (Valve 2-phase)**: `STW_Flow()` returns two UV sets advanced on offset phases plus a triangle blend weight; sampling an fBm at both and `lerp`-ing hides the texture "reset" pop → continuous molten motion.
- **Crust mask**: `smoothstep(coverage±sharpness, heat)` over the heat field → 1 = cooled rock (toon-lit), 0 = crack. Cracks get the **emissive** lava: `lerp(lowColor, highColor, heat)` in **HDR**, times `1-crustMask`, times a slow `sin` **pulse**. Crust is shaded; lava ignores lights (it's the light source).

## Stylized environment for metal — version-safe
- URP's `GlossyEnvironmentReflection(...)` signature **changed across URP 12 → 14 → 17** (positionWS / APV overloads added), so calling it directly risks breaking on a different URP. For a *stylized* metal we don't need a sharp probe.
- Use **`SampleSH(reflectVector)`** (spherical-harmonics ambient sampled along `reflect(-V, N)`): gives a soft directional ambient reflection, compiles unchanged on every URP version, needs no reflection probe. Toon-band it with `STW_RampStep` and tint → reads as stylized chrome/gold.
- Anisotropic sweep highlight: `STW_AnisoSpecular(tangentWS, L, V, shift, exp)` (Kajiya-Kay style), then `smoothstep` to a hard band for the toon look.

## Pass / state checklist used by this pack
- Transparent (Crystal/Liquid/Glass): `Blend SrcAlpha OneMinusSrcAlpha`, `ZWrite Off`, Transparent queue, single ForwardLit pass.
- Opaque (Ice/Lava/Metal): ForwardLit + **ShadowCaster** + **DepthNormals** (so they cast shadows and feed SS-outline/SSAO), shared `CBUFFER(UnityPerMaterial)` in `HLSLINCLUDE` for SRP Batcher.
- All: `STW_*` instancing/VR-SPI macros, `multi_compile_fog`, fresnel/noise/lighting from P0 — no duplicated math.

## Gotchas captured
- Don't double-include `DeclareDepthTexture.hlsl` — `StylizedSurface.hlsl`/`StylizedVFX.hlsl` already pull it; a shader that includes one of those must not include it again.
- A shader only sees `STW_*` helpers from the Core files it **actually includes** (transitively). `STW_ScreenUV`/`STW_DepthFade` live in `StylizedSurface.hlsl`; if a shader only includes `StylizedLighting`+`StylizedNoise`, inline `screenPos.xy/screenPos.w` instead.
- `SampleSceneColor`/`SampleSceneDepth` silently return garbage if the matching texture isn't enabled on the Renderer — document the requirement in each material's GUI HelpBox.
