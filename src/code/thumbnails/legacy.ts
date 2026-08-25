import { type Authentication } from "../api";
import type { Outfit } from "../avatar/outfit";
import type { OutfitModel } from "../avatar/outfitModel";
import type { Vec2 } from "../mesh/mesh";
import { download, saveByteArray } from "../misc/misc";
import type { ThumbnailCameraType, ThumbnailResult, ThumbnailType } from "../misc/thumbnail-generator";
import { getCameraCFrameForAvatarCustomized, getCameraCFrameForHeadshotCustomized } from "../misc/thumbnail-position";
import { CFrame } from "../rblx/rbx";
import { OutfitRenderer } from "../render/outfitRenderer";
import { RBXRenderer, type RBXRendererScene } from "../render/renderer";
import { getFullBodyCameraCFrame } from "./cameraPresetsUtility";
import { imageThumbnailClick, modelThumbnailClick } from "./generator";
import { getThumbnailCameraCFrame } from "./thumbnailCamera";
import { setupThumbnailScene } from "./thumbnailScene";

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
 * FLAGS.RENDERTARGET_TO_CANVASTEXTURE = true //required for gltf export
 * const result = await generateOutfitThumbnail(new Authentication(), outfit, [1000,1000], "webp", 0.99)
 * FLAGS.RENDERTARGET_TO_CANVASTEXTURE = false
 * console.log(result)
 * ```
 */
export async function generateOutfitThumbnail(auth: Authentication, outfit: Outfit | OutfitModel, size: Vec2 = [150, 150], type: ThumbnailType = "png", quality: number = 1, gltfAutoDownload: boolean = false, includeAnimations: boolean = false, renderSceneParam?: RBXRendererScene, thumbnailCameraType: ThumbnailCameraType = "default"): Promise<ThumbnailResult> {
    //setup scene
    const renderScene = renderSceneParam || RBXRenderer.addScene()
    if (renderScene !== renderSceneParam) {
        setupThumbnailScene(renderScene)
    }

    //load and setup outfit
    const outfitRenderer = new OutfitRenderer(auth, outfit, renderScene)
    const outfitSuccess = await outfitRenderer.prepareForThumbnail()
    
    if (!outfitSuccess) {
        //cleanup
        outfitRenderer.destroy()
        renderScene.destroy()

        return undefined
    }

    if ((thumbnailCameraType === "default") && outfitRenderer.backgroundRenderer.backgroundId) {
        thumbnailCameraType = "avatarFullbody"
    }

    if (outfitRenderer.backgroundRenderer.backgroundId) {
        renderScene.directionalLight!.castShadow = true
        renderScene.directionalLight!.position.set(-0.55828 * 10, 0.72756 * 10, -0.39873 * 10)
        renderScene.directionalLight2!.position.set(0.55828 * 10, -0.72756 * 10, 0.39873 * 10)
    }

    //finalize
    if (outfitRenderer.currentRig) {
        //update camera positioning
        let cameraCFrame = new CFrame()
        switch (thumbnailCameraType) {
            case "default":
                cameraCFrame = getThumbnailCameraCFrame(outfitRenderer.currentRig, renderScene.camera.fov) || cameraCFrame
                break
            case "avatarHeadshot":
                cameraCFrame = getCameraCFrameForHeadshotCustomized(outfitRenderer.currentRig, 30, 0, 1) || cameraCFrame
                break
            case "avatarFullbody":
                cameraCFrame = getCameraCFrameForAvatarCustomized(outfitRenderer.currentRig, 30, 0) || cameraCFrame
                break
            case "fullbody":
                cameraCFrame = getFullBodyCameraCFrame(outfitRenderer.currentRig) || cameraCFrame
                break
        }
        if (cameraCFrame) {
            RBXRenderer.setCameraCFrame(cameraCFrame, renderScene)
            RBXRenderer.setCameraFov(thumbnailCameraType === "default" ? 70 : thumbnailCameraType === "fullbody" ? 56 : 30, renderScene)
            renderScene.camera.updateProjectionMatrix()
        }
        
        //update stuff so it faces new camera position
        outfitRenderer.updateParticleMatrix()
        outfitRenderer.backgroundRenderer.animateOnce()

        //click
        const result = type === "gltf" || type === "glb" ?
            await modelThumbnailClick(renderScene, type, {
                includeAnimations,
            }) :
            await imageThumbnailClick(renderScene, size[0], size[1], type, {
                quality,
            })

        //auto download
        if (gltfAutoDownload && (type === "gltf" || type === "glb")) {
            if (result instanceof ArrayBuffer) {
                saveByteArray([result], `result.glb`)
            } else {
                download(`result.gltf`,JSON.stringify(result)) 
            }
        }

        //cleanup
        outfitRenderer.destroy()
        renderScene.destroy()

        return result
    } else {
        //cleanup
        outfitRenderer.destroy()
        renderScene.destroy()

        return undefined
    }
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

    return generateOutfitThumbnail(auth, outfitModel, defaultOptions.size, defaultOptions.type, defaultOptions.quality, defaultOptions.gltfAutoDownload, defaultOptions.includeAnimations)
    /*
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

    return generateOutfitThumbnail(auth, outfitModel.outfit, defaultOptions.size, defaultOptions.type, defaultOptions.quality, defaultOptions.gltfAutoDownload, defaultOptions.includeAnimations, renderScene)*/
}