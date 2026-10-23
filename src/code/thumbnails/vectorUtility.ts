//Port of Thumbnailing/VectorUtility.lua
import { rad } from "../misc/misc"
import { CFrame, Vector3 } from "../rblx/rbx"

// Make a vector of length radius along the "Look vector" axis (I think that's -z).
// Then apply given rotations around X and Y axis.
export function vector3FromXYRotPlusDistance(xAngleDeg: number, yAngleDeg: number, radius: number): Vector3 {
	const cFrame = CFrame.fromEulerAngles(rad(xAngleDeg), rad(yAngleDeg), 0, "XYZ")
	return new Vector3(...cFrame.lookVector()).multiply(new Vector3(radius,radius,radius))
}