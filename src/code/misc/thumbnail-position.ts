import { add, multiply, normalize } from "../mesh/mesh-deform";
import { CFrame, type Instance } from "../rblx/rbx";
import { getAvatarCameraCFrame, getHeadshotCameraCFrame } from "../thumbnails/cameraPresetsUtility";
import { getExtents, getExtentsCenter, getExtentsWorld, zoomExtents } from "./extents";

export function getHeadExtents(rig: Instance) {
    const head = rig.FindFirstChild("Head")
    if (!head) return

    //get head parts
    const headParts: Instance[] = []
    for (const child of rig.GetDescendants()) {
        if (child === head) { //head itself
            headParts.push(head)
        } else { //accessories
            const weld = child.FindFirstChildOfClass("Weld")
            if (weld && child.parent && child.parent.className === "Accessory") {
                if (weld.Prop("Part0") === head || weld.Prop("Part1") === head) {
                    headParts.push(child)
                }
            }
        }
    }

    //actual extents
    const extents = getExtents(head.Prop("CFrame") as CFrame, headParts)
    return extents
}

/**
 * Calculates the CFrame the camera should be at when generating a customized headshot thumbnail
 * @param rig Character
 * @param fov Customized fov
 * @param yRot Customized yRot
 * @param distance Customized distanceScale
 * @returns Thumbnail camera cframe
 * @category ThumbnailGenerator
 */
export function getCameraCFrameForHeadshotCustomized(rig: Instance, fov: number, yRot: number, distance: number): CFrame | undefined {
    const camera = getHeadshotCameraCFrame(rig, undefined, undefined, fov, {
        optCameraYRot: yRot,
        optCameraDistanceScale: distance,
        extentScale: 1.1,
    })
    if (camera) {
        const cameraCF = camera.Prop("CFrame") as CFrame
        camera.Destroy()
        return cameraCF
    }
}

/**
 * Calculates the CFrame the camera should be at when generating a customized avatar thumbnail
 * @param rig Character
 * @param fov Customized fov
 * @param yRot Customized yRot
 * @returns Thumbnail camera cframe
 * @category ThumbnailGenerator
 */
export function getCameraCFrameForAvatarCustomized(rig: Instance, fov: number, yRot: number): CFrame | undefined {
    const camera = getAvatarCameraCFrame(rig, undefined, undefined, fov, {
        optCameraYRot: yRot,
        optCameraDistanceScale: 1,
        extentScale: 1.1,
    })
    if (camera) {
        const cameraCF = camera.Prop("CFrame") as CFrame
        camera.Destroy()
        return cameraCF
    }
}
/*export function getCameraCFrameForHeadshotCustomized(rig: Instance, fov: number, yRot: number, distance: number): CFrame | undefined {
    //// eslint-disable-next-line no-debugger
    //debugger;

    const head = rig.FindFirstChild("Head")
    if (!head) return

    const headCF = head.PropOrDefault("CFrame", new CFrame()) as CFrame

    const headLocalExtents = getHeadExtents(rig)
    if (!headLocalExtents) return

    const headCenterPosLocal = headLocalExtents[0].add(headLocalExtents[1].minus(headLocalExtents[0]).divide(new Vector3(2,2,2)))
    const headCenterPos = new Vector3().fromVec3(headCF.multiply(new CFrame(...headCenterPosLocal.toVec3())).Position)
    const headCenterCF = new CFrame(...headCenterPos.toVec3())

    let lookVector = headCF.lookVector()

    if (Math.abs(lookVector[1]) > 0.95) {
		lookVector = [0,0,-1]
    } else {
		lookVector[1] = 0
        lookVector = normalize(lookVector)
    }
    
    let lookCF = CFrame.lookAt([0,0,0], lookVector)
    lookCF = lookCF.multiply(CFrame.fromEulerAngles(0, rad(yRot), 0, "ZXY"))
    
    lookVector = lookCF.lookVector()

    const fovMultiplier = 70 / fov
    lookCF.Position = add(headCenterCF.Position, multiply(multiply([10,10,10], lookVector), [fovMultiplier,fovMultiplier,fovMultiplier]))
    lookCF = CFrame.lookAt(lookCF.Position, headCenterCF.Position)
    
    const cameraCF = lookCF.clone()
    zoomExtents(cameraCF, headCenterCF, headLocalExtents[1].minus(headLocalExtents[0]), fov, distance, "largestAxis")

    return cameraCF
}*/

/**
 * @deprecated Use getThumbnailCameraCFrame instead
 * @param rig 
 * @returns 
 */
export function getCameraCFrameForAvatarNonCustomized(rig: Instance): CFrame | undefined {
    const thumbnailCamera = rig.FindFirstChildOfClass("Camera")
    if (thumbnailCamera) return thumbnailCamera.PropOrDefault("CFrame", new CFrame()) as CFrame

    let rootPart = rig.PropOrDefault("PrimaryPart", undefined) as Instance | undefined
    if (!rootPart) rootPart = rig.FindFirstChildOfClass("Part")
    if (!rootPart) rootPart = rig.FindFirstChildOfClass("MeshPart")
    if (!rootPart) return

    const rootPartCF = (rootPart.PropOrDefault("CFrame", new CFrame()) as CFrame).clone()

    const worldExtents = getExtentsWorld(rig)
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
    lookCF = lookCF.multiply(CFrame.fromEulerAngles(25 * Math.PI/180, 27.5 * Math.PI/180, 0, "ZXY"))

    lookVector = lookCF.lookVector()

    lookCF.Position = add(rootPartCF.Position, multiply([10,10,10], lookVector))
    lookCF = CFrame.lookAt(lookCF.Position, rootPartCF.Position)

    //newZoomExtents(rootPartCF, lookCF, worldExtents)
    const cameraCF = lookCF.clone()
    //zoomToExtents(cameraCF, rootPartCF, extentsSize, 70)
    zoomExtents(cameraCF, rootPartCF, extentsSize, 70, 1)

    return cameraCF
}