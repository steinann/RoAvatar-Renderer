import { add, minus, multiply, normalize } from "../mesh/mesh-deform"
import { CFrame, Instance, Vector3 } from "../rblx/rbx"
import { traverseRigCFrame } from "../rblx/scale"
import { rad } from "./misc"

function getCorners(cframe: CFrame, size: Vector3): CFrame[] {
    const halfX = size.X / 2
    const halfY = size.Y / 2
    const halfZ = size.Z / 2
    
    //Return a list of all the corners
    return [
        cframe.multiply(new CFrame(halfX, halfY, halfZ)),
        cframe.multiply(new CFrame(halfX, halfY, -halfZ)),
        cframe.multiply(new CFrame(-halfX, halfY, halfZ)),
        cframe.multiply(new CFrame(-halfX, halfY, -halfZ)),
        cframe.multiply(new CFrame(halfX, -halfY, halfZ)),
        cframe.multiply(new CFrame(halfX, -halfY, -halfZ)),
        cframe.multiply(new CFrame(-halfX, -halfY, halfZ)),
        cframe.multiply(new CFrame(-halfX, -halfY, -halfZ))
    ]
}

function getLower(a: Vector3, b: Vector3): Vector3 {
    return new Vector3(
        a.X < b.X ? a.X : b.X,
        a.Y < b.Y ? a.Y : b.Y,
        a.Z < b.Z ? a.Z : b.Z
    )
}

function getHigher(a: Vector3, b: Vector3): Vector3 {
    return new Vector3(
        a.X > b.X ? a.X : b.X,
        a.Y > b.Y ? a.Y : b.Y,
        a.Z > b.Z ? a.Z : b.Z
    )
}

/**
 * @deprecated this is SO broken
 * @category ThumbnailGenerator
 * */
export function getExtentsForParts(parts: Instance[], includeTransform?: boolean): [Vector3, Vector3] {
    let lowerExtents = new Vector3(0, 0, 0)
    let higherExtents = new Vector3(0, 0, 0)

    for (const child of parts) {
        if (child.className === "Part" || child.className === "MeshPart") {
            const cframe = traverseRigCFrame(child, includeTransform, true)
            const size = child.Prop("Size") as Vector3

            const corners = getCorners(cframe, size)
            for (const corner of corners) {
                lowerExtents = getLower(lowerExtents, new Vector3().fromVec3(corner.Position))
                higherExtents = getHigher(higherExtents, new Vector3().fromVec3(corner.Position))
            }
        }
    }

    return [lowerExtents, higherExtents]
}

/**@category ThumbnailGenerator */
export function getExtents(cframe: CFrame, parts: Instance[]): [Vector3, Vector3] {
    const inverseCF = cframe.inverse()

    let lowerExtents = new Vector3(0,0,0)
    let higherExtents = new Vector3(0,0,0)

    for (const child of parts) {
        if (child.className === "Part" || child.className === "MeshPart") {
            const partCF = child.Prop("CFrame") as CFrame
            const partSize = child.Prop("Size") as Vector3

            const corners = getCorners(inverseCF.multiply(partCF), partSize)
            for (const corner of corners) {
                lowerExtents = getLower(lowerExtents, new Vector3().fromVec3(corner.Position))
                higherExtents = getHigher(higherExtents, new Vector3().fromVec3(corner.Position))
            }
        }
    }

    return [lowerExtents, higherExtents]
}

/**@category ThumbnailGenerator */
export function getExtentsCenter(extents: [Vector3, Vector3]) {
    return extents[1].minus(extents[0]).divide(new Vector3(2,2,2)).add(extents[0])
}

/**
 * Makes model fit inside camera
 * @param cameraCFrame Original camera cframe
 * @param modelCFrame Model cframe
 * @param modelSize Model extents size
 * @param targetFOV Camera fov
 * @param distanceScale Distance is multiplied by this
 * @category ThumbnailGenerator
 */
export function zoomExtents(cameraCFrame: CFrame, modelCFrame: CFrame, modelSize: Vector3, targetFOV: number, distanceScale: number) {
	const largestSize = Math.max(modelSize.X, modelSize.Y, modelSize.Z)
	
	const fovMultiplier = 70 / targetFOV
	
	const lookDir = multiply(normalize(minus(cameraCFrame.Position, modelCFrame.Position)), [distanceScale, distanceScale, distanceScale])
    cameraCFrame.Position = add(modelCFrame.Position, multiply(multiply(lookDir, [largestSize, largestSize, largestSize]), [fovMultiplier, fovMultiplier, fovMultiplier]))
}

function getCameraOffset(fov: number, extentsSize: Vector3) {
	const halfSize = extentsSize.magnitude() / 2
	const fovDivisor = Math.tan(rad(fov / 2))
	return halfSize / fovDivisor
}

//this one seems to be slightly wrong?
//https://devforum.roblox.com/t/how-does-the-thumbnailgenerator-service-set-the-cameras-positionangle-relative-to-a-models-size/2862899/3
/**
 * @deprecated Use zoomExtents instead
 * @param cameraCFrame 
 * @param modelCFrame 
 * @param modelSize 
 * @param fov 
 * @category ThumbnailGenerator
 */
export function zoomToExtents(cameraCFrame: CFrame, modelCFrame: CFrame, modelSize: Vector3, fov: number = 70) {
	const cameraOffset = getCameraOffset(fov, modelSize)
	const cameraRotation = new CFrame()
    cameraRotation.Orientation = cameraCFrame.Orientation

	const instancePosition = modelCFrame.Position
    cameraCFrame.Position = add(instancePosition, multiply(minus([0,0,0],cameraRotation.lookVector()), [cameraOffset,cameraOffset,cameraOffset]))
}