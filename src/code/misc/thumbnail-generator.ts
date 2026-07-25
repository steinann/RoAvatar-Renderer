import * as THREE from 'three'
import type { Vec2 } from "../mesh/mesh";
import type { Instance } from "../rblx/rbx";
import { RBXRenderer, RBXRendererScene } from '../render/renderer';
import { API, type Authentication } from '../api';
import { imageDataToCanvas } from '../render/subDescs/materialDesc';
import { FLAGS } from './flags';
import { warn } from './logger';
import { getThumbnailCameraCFrame } from '../thumbnails/thumbnailCamera';

/**
 * @deprecated Use new Thumbnails category instead
 * @category ThumbnailGenerator */
export type ThumbnailType = "png" | "webp" | "gltf" | "glb"
/**
 * @deprecated Use new Thumbnails category instead
 * @category ThumbnailGenerator */
export type ThumbnailResult = ArrayBuffer | {[key: string]: unknown} | string | undefined

function renderToRenderTarget(width: number, height: number, renderScene: RBXRendererScene) {
    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
        colorSpace: THREE.SRGBColorSpace,
        generateMipmaps: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        type: THREE.UnsignedByteType,
        samples: 4,
    })

    const rbxRenderer = RBXRenderer.getRenderer()
    if (!rbxRenderer) return renderTarget

    rbxRenderer.setRenderTarget(renderTarget)
    rbxRenderer.render(renderScene.scene, renderScene.camera)
    
    return renderTarget
}

async function renderTargetToCanvas(renderTarget: THREE.WebGLRenderTarget) {
    const rbxRenderer = RBXRenderer.getRenderer()
    if (!rbxRenderer) return

    const width = renderTarget.width
    const height = renderTarget.height

    const data = new Uint8Array(width * height * 4)
    await rbxRenderer.readRenderTargetPixelsAsync(renderTarget, 0, 0, width, height, data)

    return imageDataToCanvas(data, width, height)
}

/**
 * Generates a 2d or 3d thumbnail of a model/similar instance
 * @param auth Authentication
 * @param renderScene Scene to render inside, do note the scene appearance is not populated automatically, use setupThumbnailScene()
 * @param model Model to render
 * @param size Size of the resulting image, ignored for 3d thumbnails
 * @param type Type of thumbnail, "png" | "webp" | "gltf"
 * @param quality Quality of image, with 1 being max-
 * @param gltfAutoDownload Automatically download gltf file
 * @returns ThumbnailResult, always a string for 2d thumbnails, 3d can be ArrayBuffer (glb, binary) or {[key: string]: unknown} (gltf, json)
 * 
 * @deprecated Use new Thumbnails category instead
 * @category ThumbnailGenerator
 * 
 * @example
 * **Example of generating thumbnail of accessory**
 * ```ts
 * //config
 * const ASSETID = 1039433
 * 
 * //code
 * FLAGS.ANIMATE_SKELETON = false
 * FLAGS.UPDATE_SKELETON = true
 * 
 * const rScene = RBXRenderer.addScene()
 * setupThumbnailScene(rScene)
 * 
 * const accessoryrbx = await API.Asset.GetRBX(`rbxassetid://${ASSETID}`, {"Roblox-AssetFormat":"avatar_meshpart_accessory"})
 * const accessory = accessoryrbx.generateTree().GetChildren()[0]
 * const handle = accessory.FindFirstChildOfClass("MeshPart")
 * const cf = handle.Prop("CFrame")
 * if (!accessory.FindFirstChildOfClass("Camera")) cf.Position = [0,0,0]
 * 
 * const result = await generateModelThumbnail(new Authentication(), rScene, accessory, [1000,1000], "webp", 0.99)
 * console.log(result)
 * console.log(result.length)
 * ```
 */
export async function generateModelThumbnail(auth: Authentication, renderScene: RBXRendererScene, model: Instance, size: Vec2 = [150,150], type: ThumbnailType = "png", quality: number = 1, gltfAutoDownload: boolean = false, includeAnimations: boolean = false): Promise<ThumbnailResult> {
    return new Promise((resolve) => {
        const cameraCFrame = getThumbnailCameraCFrame(model, renderScene.camera.fov)
        if (cameraCFrame) {
            RBXRenderer.setCameraCFrame(cameraCFrame, renderScene)
        }

        RBXRenderer.addInstance(model, auth, renderScene)

        let exportTimeout: NodeJS.Timeout | undefined = !API.Misc.getCurrentlyLoading() ? setTimeout(doExport, FLAGS.THUMBNAIL_TIMEOUT) : undefined

        const onLoadingConnection = API.Events.OnLoadingAssets.Connect((currentlyLoading) => {
            if (exportTimeout) {
                clearTimeout(exportTimeout)
                exportTimeout = undefined
            }

            if (!currentlyLoading) {
                exportTimeout = setTimeout(doExport, FLAGS.THUMBNAIL_TIMEOUT)
            }
        })

        async function doExport() {
            onLoadingConnection.Disconnect()
            
            if (type === "gltf" || type === "glb") {
                if (!FLAGS.RENDERTARGET_TO_CANVASTEXTURE && FLAGS.USE_RENDERTARGET) {
                    warn(true, "FLAGS.RENDERTARGET_TO_CANVASTEXTURE is false, GLTF export cannot export render target textures, consider setting this flag to true")
                }
                resolve(await renderScene.exportGLTF(`result`, gltfAutoDownload, {
                    includeAnimations,
                    binary: type === "glb"
                }))
            } else {
                const renderTarget = renderToRenderTarget(...size, renderScene)
                const canvasTarget = await renderTargetToCanvas(renderTarget)
                if (canvasTarget) {
                    resolve(canvasTarget.toDataURL(`image/${type}`, quality))
                } else {
                    resolve(undefined)
                }
            }
            renderScene.destroy()
        }
    })
}