import * as THREE from "three"
import { Instance, Vector2, Vector3 } from "../rblx/rbx"
import { getExtentsWorld } from "../misc/extents"
import type { RBXRendererScene } from "../render/rendererScene"

/**
 * Returns 2D bounds for array of positions in screen spade
 * 
 * @category ThumbnailGenerator
 */
export function getViewExtents(camera: THREE.Camera, positions: Vector3[], width: number, height: number): [Vector2, Vector2] {
    const minExtents = new Vector2(1000000, 1000000)
    const maxExtents = new Vector2(-1000000, -1000000)

    for (const pos of positions) {
        const projPos = new THREE.Vector3(...pos.toVec3()).project(camera)

        const x = (projPos.x / 2 + 0.5) * width
        const y = (-projPos.y / 2 + 0.5) * height

        if (x < minExtents.X) minExtents.X = x
        if (x > maxExtents.X) maxExtents.X = x
        if (y < minExtents.Y) minExtents.Y = y
        if (y > maxExtents.Y) maxExtents.Y = y
    }

    minExtents.X = Math.max(0, minExtents.X)
    minExtents.Y = Math.max(0, minExtents.Y)
    maxExtents.X = Math.min(width, maxExtents.X)
    maxExtents.Y = Math.min(height, maxExtents.Y)

    return [minExtents, maxExtents]
}

/**
 * Returns 2D bounds for model in screen space
 * 
 * @category ThumbnailGenerator
 */
export function getModelViewExtents(model: Instance, camera: THREE.Camera, width: number, height: number): [Vector2, Vector2] {
    const worldExtents = getExtentsWorld(model)

    const corners = [
        new Vector3(worldExtents[0].X, worldExtents[0].Y, worldExtents[0].Z),
        new Vector3(worldExtents[0].X, worldExtents[0].Y, worldExtents[1].Z),
        new Vector3(worldExtents[0].X, worldExtents[1].Y, worldExtents[0].Z),
        new Vector3(worldExtents[0].X, worldExtents[1].Y, worldExtents[1].Z),
        new Vector3(worldExtents[1].X, worldExtents[0].Y, worldExtents[0].Z),
        new Vector3(worldExtents[1].X, worldExtents[0].Y, worldExtents[1].Z),
        new Vector3(worldExtents[1].X, worldExtents[1].Y, worldExtents[0].Z),
        new Vector3(worldExtents[1].X, worldExtents[1].Y, worldExtents[1].Z)
    ]

    return getViewExtents(camera, corners, width, height)
}

/**
 * Used internally by cropForModel
 * 
 * @category ThumbnailGenerator
 */
export function cropCameraToViewExtents(camera: THREE.PerspectiveCamera, viewExtents: [Vector2, Vector2], width: number, height: number, keepAspectRatio: boolean = true): number {
    //view bounds
    const blx = viewExtents[0].X
    const bly = viewExtents[0].Y
    const bhx = viewExtents[1].X
    const bhy = viewExtents[1].Y

    //view width/height
    const xDiff = bhx - blx
    const yDiff = bhy - bly

    //view center
    const cx = blx + xDiff / 2
    const cy = bly + yDiff / 2

    //calculate new width/height while taking aspect ratio into consideration
    const scaleW = xDiff / width
    const scaleH = yDiff / height

    const maxScale = Math.max(scaleW, scaleH)

    const cropWidth = keepAspectRatio ? width * maxScale : xDiff
    const cropHeight = keepAspectRatio ? height * maxScale : yDiff

    //calculate final bounds from view center (instead of full bounds center)
    const flx = cx - cropWidth / 2
    const fly = cy - cropHeight / 2

    const x = flx
    const y = fly

    camera.setViewOffset(
        width,
        height,
        x,
        y,
        cropWidth,
        cropHeight
    )

    return cropWidth/cropHeight
}

/**
 * Crops the camera projection matrix to only contain model, allows for image to be cropped without lowering resolution
 * @param model Model that should be in focus
 * @param renderScene RenderScene containing model and camera
 * @param width Width of thumbnail in pixels
 * @param height Height of thumbnail in pixels
 * @param resizeToRemoveUnusedSpace If the aspect ratio can be changed to crop out unused space. Default false
 * @returns [newWidth, newHeight] (Only differs from provided width/height if resizeToRemoveUnusedSpace = true)
 * 
 * @category ThumbnailGenerator
 */
export function cropForModel(model: Instance, renderScene: RBXRendererScene, width: number, height: number, resizeToRemoveUnusedSpace: boolean = false) {
    const viewExtents = getModelViewExtents(model, renderScene.camera, width, height)
    const targetAspectRatio = cropCameraToViewExtents(renderScene.camera, viewExtents, width, height, !resizeToRemoveUnusedSpace)
    renderScene.camera.updateProjectionMatrix()

    let newHeight = height
    let newWidth = width
    
    if (resizeToRemoveUnusedSpace) {
        newWidth = width * targetAspectRatio
        if (newWidth > width) {
            newWidth = width
            newHeight = height / targetAspectRatio
        }
    }

    return [Math.ceil(newWidth), Math.ceil(newHeight)]
}