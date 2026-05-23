import * as THREE from 'three'
import type { Vec2 } from "../mesh/mesh";
import type { Instance } from "../rblx/rbx";
import { RBXRenderer, RBXRendererScene } from '../render/renderer';
import { getCameraCFrameForAvatarNonCustomized } from './thumbnail-position';
import { API, type Authentication } from '../api';
import { OutfitRenderer } from '../render/outfitRenderer';
import type { Outfit } from '../avatar/outfit';
import { imageDataToCanvas } from '../render/subDescs/materialDesc';
import { AvatarType } from '../avatar/constant';
import { FLAGS } from './flags';
import { warn } from './logger';

export type ThumbnailType = "png" | "webp" | "gltf"
export type ThumbnailResult = ArrayBuffer | {[key: string]: unknown} | string | undefined

function renderToRenderTarget(width: number, height: number, renderScene: RBXRendererScene) {
    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
        colorSpace: THREE.SRGBColorSpace,
        generateMipmaps: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        type: THREE.UnsignedByteType,
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

export async function generateModelThumbnail(auth: Authentication, renderScene: RBXRendererScene, model: Instance, size: Vec2 = [150,150], type: ThumbnailType = "png", quality: number = 1, gltfAutoDownload: boolean = false): Promise<ThumbnailResult> {
    return new Promise((resolve) => {
        const cameraCFrame = getCameraCFrameForAvatarNonCustomized(model)
        if (cameraCFrame) {
            RBXRenderer.setCameraCFrame(cameraCFrame, renderScene)
        }

        RBXRenderer.addInstance(model, auth, renderScene)

        let exportTimeout: NodeJS.Timeout | undefined = setTimeout(doExport, FLAGS.THUMBNAIL_TIMEOUT)

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
            
            if (type === "gltf") {
                if (!FLAGS.RENDERTARGET_TO_CANVASTEXTURE && FLAGS.USE_RENDERTARGET) {
                    warn(true, "FLAGS.RENDERTARGET_TO_CANVASTEXTURE is false, GLTF export cannot export render target textures, consider setting this flag to true")
                }
                resolve(await renderScene.exportGLTF(`result`, gltfAutoDownload))
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

export async function generateOutfitThumbnail(auth: Authentication, outfit: Outfit, size: Vec2 = [150,150], type: ThumbnailType = "png", quality: number = 1, gltfAutoDownload: boolean = false): Promise<ThumbnailResult> {
    return new Promise((resolve) => {
        const renderScene = RBXRenderer.addScene()
        setupThumbnailScene(renderScene)

        const outfitRenderer = new OutfitRenderer(auth, outfit, renderScene)
        if (outfit.playerAvatarType === AvatarType.R6) outfitRenderer.deltaTimeMultiplier = 0
        outfitRenderer.startAnimating()

        let exportTimeout: NodeJS.Timeout | undefined = setTimeout(doExport, FLAGS.THUMBNAIL_TIMEOUT)

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
            if (!outfit.containsAssetType("Gear")) {
                if (outfit.playerAvatarType === AvatarType.R15) {
                    outfitRenderer.setMainAnimation("pose")
                }
            } else {
                outfitRenderer.setMainAnimation("toolnone")
            }
            if (outfitRenderer.currentRig) {
                const thumbnailResult = await generateModelThumbnail(auth, renderScene, outfitRenderer.currentRig, size, type, quality, gltfAutoDownload)
                resolve(thumbnailResult)
                outfitRenderer.stopAnimating()
                if (outfitRenderer.currentRig) outfitRenderer.currentRig.Destroy()
            } else {
                resolve(undefined)
            }
        }
    })
}

export function setupThumbnailScene(renderScene: RBXRendererScene) {
    renderScene.shouldAnimate = false
    renderScene.wellLitDirectionalLightIntensity *= 2
    renderScene.shadowEnabled = false
    RBXRenderer.setupScene("WellLit", 0xffffff, renderScene)
    if (renderScene.plane) renderScene.scene.remove(renderScene.plane)
    if (renderScene.shadowPlane) renderScene.scene.remove(renderScene.shadowPlane)
    renderScene.scene.background = null
}