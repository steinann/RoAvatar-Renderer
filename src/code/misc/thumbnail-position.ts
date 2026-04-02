import { add, multiply, normalize } from "../mesh/mesh-deform";
import { CFrame, Vector3, type Instance } from "../rblx/rbx";
import { getExtents, zoomExtents } from "./extents";
import { rad } from './misc';

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

export function getCameraCFrameForHeadshotCustomized(rig: Instance, fov: number, yRot: number, distance: number) {
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
    zoomExtents(cameraCF, headCenterCF, headLocalExtents[1].minus(headLocalExtents[0]), fov, distance)

    return cameraCF
}