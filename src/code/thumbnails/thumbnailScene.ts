import { RBXRenderer, type RBXRendererScene } from "../render/renderer"

/**
 * Gives a scene the default appearance for thumbnails
 * @param renderScene RBXRenderScene to setup
 * 
 * @category ThumbnailGenerator
 */
export function setupThumbnailScene(renderScene: RBXRendererScene) {
    //make sure particles are populated
    renderScene.particlesStartFull = 4
    renderScene.particlesStartFullFramerate = 20

    //make sure FLAGS.LAYERED_CLOTHING_COOLDOWN doesnt cause thumbnail to return early
    renderScene.forceAccurateNeedsRegeneration = true

    //make sure scene is not rendered every frame
    renderScene.shouldAnimate = false

    //appearance
    renderScene.wellLitDirectionalLightIntensity *= 2
    renderScene.shadowEnabled = false
    RBXRenderer.setupScene("Thumbnail", 0xffffff, renderScene)
    if (renderScene.plane) renderScene.scene.remove(renderScene.plane)
    if (renderScene.shadowPlane) renderScene.scene.remove(renderScene.shadowPlane)
    renderScene.scene.background = null
}