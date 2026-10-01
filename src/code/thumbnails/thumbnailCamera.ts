import type { Vec3 } from "../mesh/mesh"
import { add, multiply, normalize } from "../mesh/mesh-deform"
import { getExtentsCenter, getExtentsWorld, zoomExtents } from "../misc/extents"
import { rad } from "../misc/misc"
import { CFrame, Instance } from "../rblx/rbx"

/**
 * Calculates the CFrame the camera should be at when generating a thumbnail
 * @param model The model-like instance to get thumbnail camera for
 * @returns Thumbnail camera cframe
 * @category ThumbnailGenerator
 */
export function getThumbnailCameraCFrame(model: Instance, fov: number, forceAngle?: Vec3): CFrame | undefined {
    //find thumbnail camera
    const thumbnailCamera = model.FindFirstChild("ThumbnailCamera")
    if (thumbnailCamera && thumbnailCamera.IsA("Camera")) return thumbnailCamera.PropOrDefault("CFrame", new CFrame()) as CFrame

    //find thumbnail configuration
    const thumbnailConfiguration = model.FindFirstChild("ThumbnailConfiguration")
    if (thumbnailConfiguration) {
        //thumbnail camera target
        const thumbnailCameraTarget = thumbnailConfiguration.FindFirstChild("ThumbnailCameraTarget")
        if (thumbnailCameraTarget && thumbnailCameraTarget.IsA("ObjectValue")) {
            const targetInstance = thumbnailCameraTarget.Prop("Value") as Instance | undefined
            if (targetInstance && targetInstance.IsA("BasePart")) {
                const targetCF = targetInstance.PropOrDefault("CFrame", new CFrame()) as CFrame

                //thumbnail camera value
                const thumbnailCameraValue = thumbnailConfiguration.FindFirstChild("ThumbnailCameraValue")
                if (thumbnailCameraValue && thumbnailCameraValue.IsA("CFrameValue")) {
                    const cf = thumbnailCameraValue.PropOrDefault("Value", new CFrame()) as CFrame
                    const resultCF = targetCF.multiply(cf)
                    return resultCF
                }
            }
        }
    }

    let rootPart = model.PropOrDefault("PrimaryPart", undefined) as Instance | undefined
    if (!rootPart) rootPart = model.FindFirstChildOfClass("Part")
    if (!rootPart) rootPart = model.FindFirstChildOfClass("MeshPart")
    if (!rootPart) return

    const rootPartCF = (rootPart.PropOrDefault("CFrame", new CFrame()) as CFrame).clone()

    const worldExtents = getExtentsWorld(model)
    if (!worldExtents) return
    const extentsSize = worldExtents[1].minus(worldExtents[0])

    rootPartCF.Position = getExtentsCenter(worldExtents).toVec3()

    let lookVector = rootPartCF.lookVector()

    if (Math.abs(lookVector[1]) > 0.95) {
		lookVector = [0,0,-1]
    } else {
		lookVector[1] = 0
        lookVector = normalize(lookVector)
    }

    let lookCF = CFrame.lookAt([0,0,0], lookVector)

    if (!forceAngle) {
        //its like euler angles zxy
        lookCF = lookCF.multiply(CFrame.fromEulerAngles(0,0,rad(45)))
        lookCF = lookCF.multiply(CFrame.fromEulerAngles(rad(35),0,0))
        lookCF = lookCF.multiply(CFrame.fromEulerAngles(0,0,0))
    } else {
        lookCF = lookCF.multiply(CFrame.fromEulerAngles(rad(forceAngle[0]), rad(forceAngle[1]), rad(forceAngle[2])))
    }

    lookVector = lookCF.lookVector()

    lookCF.Position = add(rootPartCF.Position, multiply([10,10,10], lookVector))

    lookCF = CFrame.lookAt(lookCF.Position, rootPartCF.Position)

    //newZoomExtents(rootPartCF, lookCF, worldExtents)
    const cameraCF = lookCF.clone()
    //zoomToExtents(cameraCF, rootPartCF, extentsSize, 70)
    zoomExtents(cameraCF, rootPartCF, extentsSize, fov, 1)

    return cameraCF
}

/**
 * Calculates the CFrame the camera should be at when generating a thumbnail
 * @param model The model-like instance to get thumbnail camera for
 * @returns Thumbnail camera cframe
 * @category ThumbnailGenerator
 */
export function getThumbnailCamera(model: Instance): Instance {
    //find thumbnail camera
    const thumbnailCamera = model.FindFirstChild("ThumbnailCamera")
    if (thumbnailCamera && thumbnailCamera.IsA("Camera")) return thumbnailCamera

    const camera = new Instance("Camera")

    //find thumbnail configuration
    const thumbnailConfiguration = model.FindFirstChild("ThumbnailConfiguration")
    if (thumbnailConfiguration) {
        //thumbnail camera target
        const thumbnailCameraTarget = thumbnailConfiguration.FindFirstChild("ThumbnailCameraTarget")
        if (thumbnailCameraTarget && thumbnailCameraTarget.IsA("ObjectValue")) {
            const targetInstance = thumbnailCameraTarget.Prop("Value") as Instance | undefined
            if (targetInstance && targetInstance.IsA("BasePart")) {
                const targetCF = targetInstance.PropOrDefault("CFrame", new CFrame()) as CFrame

                //thumbnail camera value
                const thumbnailCameraValue = thumbnailConfiguration.FindFirstChild("ThumbnailCameraValue")
                if (thumbnailCameraValue && thumbnailCameraValue.IsA("CFrameValue")) {
                    const cf = thumbnailCameraValue.PropOrDefault("Value", new CFrame()) as CFrame
                    const resultCF = targetCF.multiply(cf)
                    //zoomExtents(resultCF, targetCF, targetInstance.Prop("Size") as Vector3, 20, 1)
                    camera.setProperty("FieldOfView", 70)
                    camera.setProperty("CFrame", resultCF)
                    return camera
                }
            }
        }
    }

    let rootPart = model.PropOrDefault("PrimaryPart", undefined) as Instance | undefined
    if (!rootPart) rootPart = model.FindFirstChildOfClass("Part")
    if (!rootPart) rootPart = model.FindFirstChildOfClass("MeshPart")
    if (!rootPart) return camera

    const rootPartCF = (rootPart.PropOrDefault("CFrame", new CFrame()) as CFrame).clone()

    const worldExtents = getExtentsWorld(model)
    if (!worldExtents) return camera
    const extentsSize = worldExtents[1].minus(worldExtents[0])

    rootPartCF.Position = getExtentsCenter(worldExtents).toVec3()

    //calculate camera cframe if we still dont have it
    let lookVector = rootPartCF.lookVector()

    if (Math.abs(lookVector[1]) > 0.95) {
		lookVector = [0,0,-1]
    } else {
		lookVector[1] = 0
        lookVector = normalize(lookVector)
    }

    let lookCF = CFrame.lookAt([0,0,0], lookVector)

    //its like euler angles zxy
    lookCF = lookCF.multiply(CFrame.fromEulerAngles(0,0,rad(45)))
    lookCF = lookCF.multiply(CFrame.fromEulerAngles(rad(35),0,0))
    lookCF = lookCF.multiply(CFrame.fromEulerAngles(0,0,0))

    lookVector = lookCF.lookVector()

    lookCF.Position = add(rootPartCF.Position, multiply([10,10,10], lookVector))

    lookCF = CFrame.lookAt(lookCF.Position, rootPartCF.Position)

    //newZoomExtents(rootPartCF, lookCF, worldExtents)
    const cameraCF = lookCF.clone()
    //zoomToExtents(cameraCF, rootPartCF, extentsSize, 70)
    zoomExtents(cameraCF, rootPartCF, extentsSize, 70, 1)

    camera.setProperty("CFrame", cameraCF)

    return camera
}