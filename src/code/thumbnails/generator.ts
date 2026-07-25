import * as THREE from 'three'
import { RBXRenderer, RBXRendererScene } from "../render/renderer"
import { imageDataToCanvas } from '../render/subDescs/materialDesc'

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
 * @category ThumbnailGenerator
 */
export type ImageThumbnailFormat = "png" | "webp" | "jpeg"

/**
 * @category ThumbnailGenerator
 */
export interface ImageThumbnailOptions {
    quality: number,
}

/**
 * Renders a scene to an image and returns a data url
 * @param renderScene Scene that will be rendered
 * @param width Width in pixels
 * @param height Height in pixels
 * @param format Type of image
 * @param options
 * @returns data url
 * 
 * @category ThumbnailGenerator
 */
export async function imageThumbnailClick(renderScene: RBXRendererScene, width: number, height: number, format: ImageThumbnailFormat, options?: Partial<ImageThumbnailOptions>): Promise<string | undefined> {
    const resultOptions: ImageThumbnailOptions = {
        quality: 1,
    }
    if (options) Object.assign(resultOptions, options)
    
    const renderTarget = renderToRenderTarget(width, height, renderScene)
    const canvas = await renderTargetToCanvas(renderTarget)
    renderTarget.dispose()

    if (canvas) {
        return canvas.toDataURL(`image/${format}`, resultOptions.quality)
    } else {
        return undefined
    }
}

/**
 * @category ThumbnailGenerator
 */
export type ModelThumbnailFormat = "gltf" | "glb"

/**
 * @category ThumbnailGenerator
 */
export interface ModelThumbnailOptions {
    includeAnimations: boolean,
}

/**
 * Generates a 3D model from the scene
 * @param renderScene Scene that will be rendered
 * @param format Format of resulting model
 * @param options 
 * @returns ArrayBuffer for glb or Object for gltf
 * 
 * @category ThumbnailGenerator
 */
export async function modelThumbnailClick(renderScene: RBXRendererScene, format: ModelThumbnailFormat, options?: Partial<ModelThumbnailOptions>): Promise<ArrayBuffer | {[key: string]: unknown}> {
    const resultOptions: ModelThumbnailOptions = {
        includeAnimations: false,
    }
    if (options) Object.assign(resultOptions, options)

    return await renderScene.exportGLTF(`result`, false, {
        includeAnimations: resultOptions.includeAnimations,
        binary: format === "glb"
    })
}