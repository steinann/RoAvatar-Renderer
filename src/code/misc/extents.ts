import { add, minus, multiply, normalize } from "../mesh/mesh-deform"
import { CFrame, Instance, Vector3 } from "../rblx/rbx"
import { traverseRigCFrame } from "../rblx/scale"

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

/**@deprecated this is SO broken */
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

export function zoomExtents(cameraCFrame: CFrame, modelCFrame: CFrame, modelSize: Vector3, targetFOV: number, distanceScale: number) {
	const largestSize = Math.max(modelSize.X, modelSize.Y, modelSize.Z)
	
	const fovMultiplier = 70 / targetFOV
	
	const lookDir = multiply(normalize(minus(cameraCFrame.Position, modelCFrame.Position)), [distanceScale, distanceScale, distanceScale])
    cameraCFrame.Position = add(modelCFrame.Position, multiply(multiply(lookDir, [largestSize, largestSize, largestSize]), [fovMultiplier, fovMultiplier, fovMultiplier]))
}