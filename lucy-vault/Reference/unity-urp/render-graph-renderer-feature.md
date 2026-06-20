# URP 17 / Unity 6 — RenderGraph ScriptableRendererFeature (RAG)

> Nguồn: Unity Manual 6000.0 — render-graph-write-render-pass, render-graph-draw-objects-in-a-pass, render-graph-blit. Fetch 2026-06-16 bởi Lucy.
> Dùng cho: SS outline (P1) + mọi post/fullscreen feature các pack sau.

## 1. Cấu trúc cốt lõi
- Pass kế thừa `ScriptableRenderPass`, **override `RecordRenderGraph(RenderGraph, ContextContainer)`** (KHÔNG override `Execute()` cũ — đó là compatibility mode, deprecated U6).
- Feature kế thừa `ScriptableRendererFeature`, override `Create()` + `AddRenderPasses(renderer, ref renderingData)` → `renderer.EnqueuePass(pass)`.
- ⚠️ Trong `RecordRenderGraph` CHỈ khai input/output, KHÔNG add command vào command buffer. Lệnh vẽ nằm trong `SetRenderFunc` (phải là static lambda → tránh capture GC).

## 2. Skeleton RasterRenderPass
```csharp
class PassData { public TextureHandle source; }

public override void RecordRenderGraph(RenderGraph renderGraph, ContextContainer frameContext)
{
    using (var builder = renderGraph.AddRasterRenderPass<PassData>("PassName", out var passData))
    {
        UniversalResourceData resourceData = frameContext.Get<UniversalResourceData>();
        passData.source = resourceData.activeColorTexture;

        builder.UseTexture(passData.source);                  // input
        builder.SetRenderAttachment(destination, 0);          // output color
        builder.SetRenderFunc(static (PassData data, RasterGraphContext ctx) => ExecutePass(data, ctx));
    }
}
static void ExecutePass(PassData data, RasterGraphContext ctx) { /* draw */ }
```
Contexts hay dùng: `UniversalResourceData` (activeColorTexture/activeDepthTexture/cameraDepthTexture/cameraNormalsTexture), `UniversalCameraData`, `UniversalRenderingData`, `UniversalLightData`.

## 3. Full-screen blit material (cách làm SS outline / post)
```csharp
using UnityEngine.Rendering.RenderGraphModule.Util;

var blitParams = new RenderGraphUtils.BlitMaterialParameters(source, destination, blitMaterial, 0 /*pass*/);
renderGraph.AddBlitPass(blitParams, "STW SS Outline");
```
- Cần đọc depth/normals → trong Feature gọi `renderPass.ConfigureInput(ScriptableRenderPassInput.Depth | ScriptableRenderPassInput.Normal)` (tự ép URP tạo `_CameraDepthTexture` + `_CameraNormalsTexture` qua DepthNormals prepass).
- Tránh same source==destination: tạo temp texture đích, blit vào đó, rồi `resourceData.cameraColor = destination;` (trỏ camera color sang đích thay vì blit ngược).
- Tạo texture: `UniversalRenderer.CreateRenderGraphTexture(renderGraph, desc, name, clear)` hoặc `renderGraph.CreateTexture(desc)` từ `cameraData.cameraTargetDescriptor` (set depthBufferBits=0, msaaSamples=1).

## 4. Vẽ object với override material (inverted-hull kiểu fullscreen, hoặc mask)
```csharp
class PassData { public RendererListHandle list; }
...
var renderingData = frameContext.Get<UniversalRenderingData>();
var cameraData    = frameContext.Get<UniversalCameraData>();
var lightData     = frameContext.Get<UniversalLightData>();
var draw = RenderingUtils.CreateDrawingSettings(new ShaderTagId("UniversalForward"),
            renderingData, cameraData, lightData, cameraData.defaultOpaqueSortFlags);
draw.overrideMaterial = mat;
var p = new RendererListParams(renderingData.cullResults, draw, new FilteringSettings(RenderQueueRange.opaque, ~0));
passData.list = renderGraph.CreateRendererList(p);
builder.UseRendererList(passData.list);
builder.SetRenderAttachment(resourceData.activeColorTexture, 0);
builder.SetRenderAttachmentDepth(resourceData.activeDepthTexture, AccessFlags.Write);
builder.SetRenderFunc(static (PassData d, RasterGraphContext c) => c.cmd.DrawRendererList(d.list));
```

## 5. Gotchas
- `Execute(ScriptableRenderContext, ref RenderingData)` cũ = compatibility mode, U6 sẽ bỏ → đừng dùng cho code mới.
- SetRenderFunc lambda nên `static` (Unity warning nếu capture).
- XR single-pass: fullscreen blit qua `Blitter.BlitTexture` / AddBlitPass tự xử stereo; nếu tự vẽ triangle thì cần `_BlitTexture` + `SV_InstanceID` eye. Dùng AddBlitPass cho an toàn.
- SRP Blit Shader template: Assets > Create > Shader > SRP Blit Shader (kèm `Blit.hlsl`, hàm `Vert`/fullscreen triangle + `_BlitTexture`).
