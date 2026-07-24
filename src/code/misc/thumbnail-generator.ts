import * as THREE from 'three'
import type { Vec2 } from "../mesh/mesh";
import type { Color3, Instance } from "../rblx/rbx";
import { RBXRenderer, RBXRendererScene } from '../render/renderer';
import { getThumbnailCameraCFrame } from './thumbnail-position';
import { API, type Authentication } from '../api';
import { OutfitRenderer } from '../render/outfitRenderer';
import type { Outfit } from '../avatar/outfit';
import { imageDataToCanvas } from '../render/subDescs/materialDesc';
import { AvatarType } from '../avatar/constant';
import { FLAGS } from './flags';
import { warn } from './logger';
import type { OutfitModel } from '../avatar/outfitModel';

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


export type OutfitModelThumbnailOptions = {
    size: Vec2,
    type: ThumbnailType,
    quality: number,
    gltfAutoDownload: boolean,
    includeAnimations: boolean,

}
export async function generateOutfitModelThumbnail(auth: Authentication, outfitModel: OutfitModel, options: Partial<OutfitModelThumbnailOptions>): Promise<ThumbnailResult> {
    const defaultOptions: OutfitModelThumbnailOptions = {
        size: [150,150],
        type: "png",
        quality: 1,
        gltfAutoDownload: false,
        includeAnimations: false,
    }
    Object.assign(defaultOptions, options)

    const renderScene = RBXRenderer.addScene()
    setupThumbnailScene(renderScene)

    if (outfitModel.background?.id) {
        const avatarCycloramaRBX = await API.Asset.GetRBX("roavatar://AvatarCyclorama.rbxm")
        if (avatarCycloramaRBX instanceof Response) return undefined

        const avatarCycloramaRoot = avatarCycloramaRBX.generateTree()
        const avatarCyclorama = avatarCycloramaRoot.GetChildren()[0]

        if (avatarCyclorama) {
            const backgroundDataRBX = await API.Asset.GetRBX("rbxassetid://" + outfitModel.background.id)
            if (backgroundDataRBX instanceof Response) return undefined

            const backgroundDataRoot = backgroundDataRBX.generateTree()
            const backgroundData = backgroundDataRoot.GetChildren()[0]
            
            if (backgroundData) {
                if (backgroundData) {
                    const colorValue = backgroundData.Child("Color")
                    const imageIdValue = backgroundData.Child("ImageId")

                    if (colorValue && imageIdValue) {
                        const color = colorValue.Prop("Value") as Color3
                        const imageId = imageIdValue.Prop("Value") as number

                        avatarCyclorama.Child("color_mesh")!.setProperty("Color", color.toColor3uint8())
                        avatarCyclorama.Child("texture_mesh")!.setProperty("TextureID", `rbxassetid://${imageId}`)

                        avatarCyclorama.preRender()
                        RBXRenderer.addInstance(avatarCyclorama, auth, renderScene)
                        renderScene.camera.fov = 30
                        renderScene.camera.updateProjectionMatrix()
                    }
                }
            }
        }
    }

    return generateOutfitThumbnail(auth, outfitModel.outfit, defaultOptions.size, defaultOptions.type, defaultOptions.quality, defaultOptions.gltfAutoDownload, defaultOptions.includeAnimations, renderScene)
}

/**
 * Generates a 2d or 3d thumbnail of an outfit
 * @param auth Authentication
 * @param outfit Outfit to render
 * @param size Size of the resulting image, ignored for 3d thumbnails
 * @param type Type of thumbnail, "png" | "webp" | "gltf"
 * @param quality Quality of image, with 1 being max
 * @param gltfAutoDownload Automatically download gltf file
 * @returns ThumbnailResult, always a string for 2d thumbnails, 3d can be ArrayBuffer (glb, binary) or {[key: string]: unknown} (gltf, json)
 * 
 * @deprecated Use new Thumbnails category instead
 * @category ThumbnailGenerator
 * 
 * @example
 * **Example on generating 1000x1000 webp thumbnail for blank outfit**
 * ```ts
 * const outfit = new Outfit()
 * FLAGS.THUMBNAIL_TIMEOUT = 1 //makes thumbnail generation faster
 * FLAGS.PARTICLES_START_FULL = 10 //makes emitters appear as if theyve been there for some time (10 seconds)
 * FLAGS.RENDERTARGET_TO_CANVASTEXTURE = true //required for gltf export
 * const result = await generateOutfitThumbnail(new Authentication(), outfit, [1000,1000], "webp", 0.99)
 * FLAGS.RENDERTARGET_TO_CANVASTEXTURE = false
 * FLAGS.PARTICLES_START_FULL = 0
 * console.log(result)
 * ```
 */
export async function generateOutfitThumbnail(auth: Authentication, outfit: Outfit, size: Vec2 = [150,150], type: ThumbnailType = "png", quality: number = 1, gltfAutoDownload: boolean = false, includeAnimations: boolean = false, renderSceneParam?: RBXRendererScene): Promise<ThumbnailResult> {
    return new Promise((resolve) => {
        const startTime = performance.now()

        const renderScene = renderSceneParam || RBXRenderer.addScene()
        if (renderScene !== renderSceneParam) {
            setupThumbnailScene(renderScene)
        }

        const outfitRenderer = new OutfitRenderer(auth, outfit, renderScene)
        outfitRenderer.doAddInstance = false //done so that we dont do unneccesary calls + particles appear in right place instead of rest pose

        //make sure animation is loaded
        if (outfit.playerAvatarType === AvatarType.R6) outfitRenderer.deltaTimeMultiplier = 0
        API.Misc.startCurrentlyLoadingAssets("thumbnail-animation")
        outfitRenderer.onSuccess.Connect(() => {
            if (!outfit.containsAssetType("Gear")) {
                if (outfit.playerAvatarType === AvatarType.R15) {
                    outfitRenderer.setMainAnimation("pose").then(() => {
                        API.Misc.stopCurrentlyLoadingAssets("thumbnail-animation")
                    })
                } else {
                    outfitRenderer.setMainAnimation("idle").then(() => {
                        API.Misc.stopCurrentlyLoadingAssets("thumbnail-animation")
                    })
                }
            } else {
                outfitRenderer.setMainAnimation("toolnone").then(() => {
                    API.Misc.stopCurrentlyLoadingAssets("thumbnail-animation")
                })
            }
        })

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
            if (outfitRenderer.currentRig) {
                outfitRenderer.animateOnce(!outfit.containsAssetType("Gear") && outfit.playerAvatarType === AvatarType.R6 ? 0 : 1) //animate if not r6 idle
                const thumbnailResult = await generateModelThumbnail(auth, renderScene, outfitRenderer.currentRig, size, type, quality, gltfAutoDownload, includeAnimations)
                console.log("Generated outfit thumbnail after seconds:", (performance.now() - startTime) / 1000)
                resolve(thumbnailResult)
                if (outfitRenderer.currentRig) outfitRenderer.currentRig.Destroy()
            } else {
                resolve(undefined)
            }
        }
    })
}

/**
 * Gives a scene the default appearance for thumbnails
 * @param renderScene RBXRenderScene to setup
 * 
 * @deprecated Use new Thumbnails category instead
 * @category ThumbnailGenerator
 */
export function setupThumbnailScene(renderScene: RBXRendererScene) {
    renderScene.shouldAnimate = false
    renderScene.wellLitDirectionalLightIntensity *= 2
    renderScene.shadowEnabled = false
    RBXRenderer.setupScene("Thumbnail", 0xffffff, renderScene)
    if (renderScene.plane) renderScene.scene.remove(renderScene.plane)
    if (renderScene.shadowPlane) renderScene.scene.remove(renderScene.shadowPlane)
    renderScene.scene.background = null
}