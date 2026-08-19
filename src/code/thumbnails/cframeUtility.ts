//Port of Thumbnailing/CFrameUtility.lua

import { add } from "../mesh/mesh-deform"
import { Vector3, CFrame } from "../rblx/rbx"

/*
	Reads in CFrame, returns CFrame with same Position and orientation around Y axis, but
	Look vector is "flattened" onto XZ frame.
	We can use this for other things than a head, but I am going to talk
	through it with head as running example because it's easier to picture.
*/
export function calculateTargetCFrame(baseCFrame: CFrame): CFrame {
	let targetLookVector = new Vector3()
	if (Math.abs(baseCFrame.lookVector()[1]) > 0.9) {
		// The head is positioned so that it is looking almost straight down.
		// Use the 'up' vector coming out of the top of the head.
		targetLookVector = new Vector3().fromVec3(baseCFrame.upVector())
    } else {
		targetLookVector = new Vector3().fromVec3(baseCFrame.lookVector())
    }
	// Flatten it into the X-Z plane.
	targetLookVector = Vector3.new(targetLookVector.X, 0, targetLookVector.Z).normalize()
	// Make a cframe with same position, just using new Look vector as look vector.
	return CFrame.lookAt(baseCFrame.Position, new Vector3().fromVec3(baseCFrame.Position).add(targetLookVector).toVec3())
}

export function adjustTargetCFrameWithExtents(targetCFrame: CFrame, minExtent: Vector3, maxExtent: Vector3): CFrame {
	let adjustment = (minExtent.add(maxExtent)).divide(new Vector3(2,2,2))
	const tmpCFrame = targetCFrame.rotationOnly()
	adjustment = tmpCFrame.multiplyVector(adjustment)
	targetCFrame.Position = add(targetCFrame.Position, adjustment.toVec3())
	return targetCFrame
}

/*
	Same idea as CalculateTargetCFrame, then we adjust the result so that Position of
	CFrame is adjusted by center of Extents.  Extents are expressed in terms of
	original targetCFrame.

	So again using an example where targetCFrame describes position/orientation of Head:
		- Suppose user has no hair, just a bald head.
		  Then minExtent = (-headSizeX/2, -headSizeY/2, -headSizeZ/2) and
		  Then maxExtent = (headSizeX/2, headSizeY/2, headSizeZ/2) and
		  Adjustment to CFrame Position is 0.
		- Suppose user is wearing a very tall narrow hat perched at the very top of the head.
		  Then minExtent = (-headSizeX/2, -headSizeY/2, -headSizeZ/2) and
		  Then maxExtent = (headSizeX/2, headSizeY/2 + hatSizeY, headSizeZ/2) and
		  Adjustment to CFrame position is +hatSizeY/2.
*/
export function calculateTargetCFrameWithExtents(baseCFrame: CFrame, minExtent: Vector3, maxExtent: Vector3): CFrame {
	const targetCFrame = calculateTargetCFrame(baseCFrame)
	return adjustTargetCFrameWithExtents(targetCFrame, minExtent, maxExtent)
}