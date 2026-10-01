import { RBXRenderer } from "../../render/renderer"
import type { RBXRendererScene } from "../../render/rendererScene"
import { setupThumbnailScene } from "../thumbnailScene"

/**
 * @returns A RBXRenderScene ready to be used for thumbnail generation
 */
export function createThumbnailScene(): RBXRendererScene {
    const renderScene = RBXRenderer.addScene(false)
    renderScene.isForRenderTarget = true
    setupThumbnailScene(renderScene)

    return renderScene
}