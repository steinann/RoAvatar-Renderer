import * as THREE from 'three'
import { RBXRenderer } from "../render/renderer"
import { imageDataToCanvas } from '../render/subDescs/materialDesc'
import type { RBXRendererScene } from '../render/rendererScene'
import type { Vec2 } from '../mesh/mesh'

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
    rbxRenderer.setClearColor(0x000000, 0)
    rbxRenderer.clear()
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

    return imageDataToCanvas(data, width, height, true)
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
    size: Vec2
}

/**
 * @category
 */
export type ImageThumbnailResult = string | undefined

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
export async function imageThumbnailClick(renderScene: RBXRendererScene, width: number, height: number, format: ImageThumbnailFormat, options?: Partial<ImageThumbnailOptions>): Promise<ImageThumbnailResult> {
    const resultOptions: ImageThumbnailOptions = {
        quality: 1,
        size: [width,height]
    }
    if (options) Object.assign(resultOptions, options)
    
    const renderTarget = renderToRenderTarget(resultOptions.size[0], resultOptions.size[1], renderScene)
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
 * @category ThumbnailGenerator
 */
export type ModelThumbnailResult = ArrayBuffer | {[key: string]: unknown}

/**
 * Generates a 3D model from the scene
 * @param renderScene Scene that will be rendered
 * @param format Format of resulting model
 * @param options 
 * @returns ArrayBuffer for glb or Object for gltf
 * 
 * @category ThumbnailGenerator
 */
export async function modelThumbnailClick(renderScene: RBXRendererScene, format: ModelThumbnailFormat, options?: Partial<ModelThumbnailOptions>): Promise<ModelThumbnailResult> {
    const resultOptions: ModelThumbnailOptions = {
        includeAnimations: false,
    }
    if (options) Object.assign(resultOptions, options)

    return await renderScene.exportGLTF(`result`, false, {
        includeAnimations: resultOptions.includeAnimations,
        binary: format === "glb"
    })
}