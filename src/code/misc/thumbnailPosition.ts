import type { Instance } from "../rblx/rbx";
import { getExtentsForParts } from "./extents";

export function getHeadExtents(rig: Instance, includeTransform?: boolean) {
    const head = rig.FindFirstChild("Head")
    if (!head) return

    //get head parts
    const headParts: Instance[] = []
    for (const child of rig.GetDescendants()) {
        if (child === head) { //head itself
            headParts.push(head)
        } else { //accessories
            const weld = child.FindFirstChildOfClass("Weld")
            if (weld) {
                if (weld.Prop("Part0") === head || weld.Prop("Part1") === head) {
                    headParts.push(child)
                }
            }
        }
    }

    //actual extents
    const extents = getExtentsForParts(headParts, includeTransform)
    return extents
}

export function updateCameraForHeadshotCustomized() {
    
}