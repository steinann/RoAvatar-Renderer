import { API, Authentication } from "../../api"
import type { ThumbnailResult } from "../../misc/thumbnail-generator"
import { CFrame, Instance } from "../../rblx/rbx"
import { RBXRenderer } from "../../render/renderer"
import type { RBXRendererScene } from "../../render/rendererScene"
import { imageThumbnailClick, modelThumbnailClick, type ImageThumbnailFormat, type ImageThumbnailOptions, type ModelThumbnailFormat } from "../generator"
import { getThumbnailCamera } from "../thumbnailCamera"
import { cropForModel } from "../cropping"
import { createThumbnailScene } from "./thumbnailScriptHelper"
import { setupAccessoryCamera } from "../cameraUtility"

/**
 * Generates an accessory thumbnail
 * @param id The id of the accessory, although any accessory-like asset will work
 * @param type Type of thumbnail, both 2D and 3D supported
 * @param imageOptions Extra image options such as size and quality
 * @param isAccessoryCamera The alternative camera mode layered clothing uses. Default false
 * @returns Promise<ThumbnailResult>
 * 
 * @category ThumbnailGenerator
 */
export default async function generateAccessoryThumbnail(
        auth: Authentication,
        id: number,
        type: ImageThumbnailFormat | ModelThumbnailFormat,
        imageOptions?: ImageThumbnailOptions,
        isAccessoryCamera: boolean = false
    ): Promise<ThumbnailResult> {

    //cleanup things that need to be destroyed
    let renderSceneToDestroy: RBXRendererScene | undefined = undefined
    const instancesToDestroy: Instance[] = []

    const cleanup = () => {
        if (renderSceneToDestroy) renderSceneToDestroy.destroy()
        for (const instance of instancesToDestroy) {
            instance.Destroy()
        }

        return undefined
    }

    //get request options
    const resultOptions: ImageThumbnailOptions = {
        quality: 1,
        size: [420, 420]
    }
    if (imageOptions) Object.assign(resultOptions, imageOptions)
    
    //create scene
    const renderScene = createThumbnailScene()
    renderSceneToDestroy = renderScene

    //get accessory
    const rbx = await API.Asset.GetRBX(`rbxassetid://${id}`, {"Roblox-AssetFormat":"avatar_meshpart_accessory"})
    if (rbx instanceof Response) return cleanup()

    const root = rbx.generateTree()
    instancesToDestroy.push(root)
    const accessory = root.FindFirstChildOfClass("Accessory")
    if (!accessory) return cleanup()

    //setup camera
    let camera: Instance | undefined = undefined
    if (isAccessoryCamera) {
        camera = new Instance("Camera")
        setupAccessoryCamera(root, camera)
    } else {
        //we get camera instead of just cframe since an accessory could theoretically? have a camera with a non-standard fov
        camera = getThumbnailCamera(accessory)
    }
    
    instancesToDestroy.push(camera)

    //set renderer camera cframe, fov and aspect ratio
    RBXRenderer.setCameraCFrame(camera.PropOrDefault("CFrame", new CFrame()) as CFrame, renderScene)
    RBXRenderer.setCameraFov(camera.PropOrDefault("FieldOfView", 70) as number, renderScene)
    renderScene.camera.aspect = resultOptions.size[0] / resultOptions.size[1]
    renderScene.camera.updateProjectionMatrix()

    let [newWidth, newHeight] = [resultOptions.size[0], resultOptions.size[1]]

    if (!isAccessoryCamera) {
        [newWidth, newHeight] = cropForModel(accessory, renderScene, resultOptions.size[0], resultOptions.size[1])
    }

    //add it to the renderer
    RBXRenderer.addInstance(accessory, auth, renderScene)

    //wait until all RenderDescs are compiled
    const compiledSuccessfully = await renderScene.waitUntilFullyCompiled([accessory, ...accessory.GetChildrenDangerous()])
    if (!compiledSuccessfully) return cleanup()

    //render (click)
    const result = type === "gltf" || type === "glb" ?
        await modelThumbnailClick(renderScene, type) :
        await imageThumbnailClick(renderScene, newWidth, newHeight, type, {
            quality: resultOptions.quality,
        })
    
    cleanup()
    return result
}