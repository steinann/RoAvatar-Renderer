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
const outfit = new Outfit()
FLAGS.RENDERTARGET_TO_CANVASTEXTURE = true //required for gltf export
const result = await generateOutfitThumbnail(new Authentication(), outfit, [1000,1000], "webp", 0.99)
console.log(result)
```
## Rendering model/accessory (if it contains a camera it will be used as the camera)
```ts
//config
const ASSETID = 1039433

//code
FLAGS.ANIMATE_SKELETON = false
FLAGS.UPDATE_SKELETON = true

const rScene = RBXRenderer.addScene()
setupThumbnailScene(rScene)

const accessoryrbx = await API.Asset.GetRBX(`rbxassetid://${ASSETID}`, {"Roblox-AssetFormat":"avatar_meshpart_accessory"})
const accessory = accessoryrbx.generateTree().GetChildren()[0]
const handle = accessory.FindFirstChildOfClass("MeshPart")
const cf = handle.Prop("CFrame")
if (!accessory.FindFirstChildOfClass("Camera")) cf.Position = [0,0,0]

const result = await generateModelThumbnail(new Authentication(), rScene, accessory, [1000,1000], "webp", 0.99)
console.log(result)
console.log(result.length)
```