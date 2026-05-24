# Examples on using the ThumbnailGenerator

## Signatures
```ts
type ThumbnailType = "png" | "webp" | "gltf"
type ThumbnailResult = ArrayBuffer | {[key: string]: unknown} | string | undefined
async function generateModelThumbnail(auth: Authentication, renderScene: RBXRendererScene, model: Instance, size: Vec2 = [150,150], type: ThumbnailType = "png", quality: number = 1, gltfAutoDownload: boolean = false): Promise<ThumbnailResult>
async function generateOutfitThumbnail(auth: Authentication, outfit: Outfit, size: Vec2 = [150,150], type: ThumbnailType = "png", quality: number = 1, gltfAutoDownload: boolean = false): Promise<ThumbnailResult>
```

## Rendering outfit
```ts

```
## Rendering model/accessory (if it contains a camera it will be used as the camera)
```ts

```