//Port of Thumbnailing/CharacterUtility.lua
import { CFrame, Vector3, type Instance } from "../rblx/rbx";

/*
    A map of names of all Attachment children of character's head.
*/
function getHeadAttachments(rig: Instance) {
    const headAttachments = new Map<string,boolean>()

    const head = rig.Child("Head")
    if (head) {
        for (const child of head.GetDescendants()) {
            if (child.IsA("Attachment")) {
                headAttachments.set(child.Prop("Name") as string, true)
            }
        }
    }

    return headAttachments
}

/*
	Helper function for growExtentsToInclude.
	We have a part of size "size" with cframe "cFrame".
	x, y, and z are all 1 or -1, giving us one of the eight corners of
	the unrotated part.
	We want to figure out the untransformed corner, then apply cFrame
	to move into world space.
*/
function makeRotatedCorner(x: number, y: number, z: number, halfSize: Vector3, cFrame: CFrame): Vector3 {
	const corner = Vector3.new(x * halfSize.X, y * halfSize.Y, z * halfSize.Z)

    const newCF = cFrame.multiply(new CFrame(...corner.toVec3()))

	return Vector3.new(...newCF.Position)
}

/*
	Simple logic to grow the extents to fit the given point.
	Returns (possibly updated) extents.
*/
function growExtentsToIncludePoint(minExtent: Vector3, maxExtent: Vector3, point: Vector3): [Vector3, Vector3] {
	minExtent =
		Vector3.new(Math.min(point.X, minExtent.X), Math.min(point.Y, minExtent.Y), Math.min(point.Z, minExtent.Z))
	maxExtent =
		Vector3.new(Math.max(point.X, maxExtent.X), Math.max(point.Y, maxExtent.Y), Math.max(point.Z, maxExtent.Z))
	return [minExtent, maxExtent]
}

/*
	Helper for functions below: given a part, grow min/max extent to
	account for the size of this thing.
	Apply the part's transform to each corner of bounding box of part.
	Apply given inverse so we wind up with extents relative to some coordinate frame.

	There's optional arguments to clamp y above a certain threshold.
	This is available for the case of Closeups with hats that go down below the chin:
	we don't want the center of the closeup to be dragged down to the belly.
*/
function growExtentsToInclude(
	minExtent: Vector3,
	maxExtent: Vector3,
	part: Instance,
	cInverse: CFrame,
	optYMinCFrame?: CFrame,
	optYMin?: number
): [Vector3, Vector3] {
	const size = (part.Prop("Size") as Vector3).divide(new Vector3(2,2,2))

	for (let x = -1; x <= 1; x += 2) {
		for (let y = -1; y <= 1; y += 2) {
			for (let z = -1; z <= 1; z += 2) {
				let corner = makeRotatedCorner(x, y, z, size, part.Prop("CFrame") as CFrame)

				if (optYMinCFrame && optYMin !== undefined) {
					// 'corner' is the position in space of this corner.
					// transform it back into the 'yMin' cframe, clamp y to be no less than
					// optYMin, and transform back.
					const transformedCorner = new Vector3(...(optYMinCFrame.inverse().multiply(new CFrame(...corner.toVec3()))).Position)
					const clampedTransformedCorner =
						Vector3.new(transformedCorner.X, Math.max(optYMin, transformedCorner.Y), transformedCorner.Z)
					corner = new Vector3(...optYMinCFrame.multiply(new CFrame(...clampedTransformedCorner.toVec3())).Position)
                }

				corner = new Vector3(...cInverse.multiply(new CFrame(...corner.toVec3())).Position);
				[minExtent, maxExtent] = growExtentsToIncludePoint(minExtent, maxExtent, corner)
            }
        }
    }

	return [minExtent, maxExtent]
}

function initExtents(): [Vector3, Vector3] {
	const minExtent = Vector3.new(Infinity, Infinity, Infinity)
	const maxExtent = Vector3.new(-Infinity, -Infinity, -Infinity)
	return [minExtent, maxExtent]
}

/*
	Helper function for CalculateModelExtents.
	We are walking the tree of parts/meshes under a model, growing extents to include
	everything we find.
	Apply given inverse so we wind up with extents relative to some coordinate frame.
	indent is not used in current code but if we want to add print statements to debug,
	particularly using _printExtents, it's useful to have because then the output indentation
	reflects the tree structure.
*/
function recursiveCalculateExtents(
	minExtent: Vector3,
	maxExtent: Vector3,
	instance: Instance,
	cInverse: CFrame,
	indent: string | undefined
): [Vector3, Vector3] {
	if (!indent) {
		indent = ""
    }
	//assert(indent, "indent is non-nil. Silence type checker.")
	indent = indent + "  "
	for (const child of instance.GetChildren()) {
		if (child.IsA("BasePart")) {
			[minExtent, maxExtent] = growExtentsToInclude(minExtent, maxExtent, child, cInverse)
        }
		[minExtent, maxExtent] = recursiveCalculateExtents(minExtent, maxExtent, child, cInverse, indent)
    }
	return [minExtent, maxExtent]
}

/*
	Imagine a box in target CFrame.
	This box should just graze the furthest extent of all the Parts
	in this model.
	Returns the min and max offsets of the box, expressed relative to targetCFrame.
*/
export function calculateModelExtents(model: Instance, targetCFrame: CFrame): [Vector3, Vector3] {
	let [minExtent, maxExtent] = initExtents()
	const cInverse = targetCFrame.inverse();
	[minExtent, maxExtent] = recursiveCalculateExtents(minExtent, maxExtent, model, cInverse, "  ")
	return [minExtent, maxExtent]
}

/*
	Imagine a box in targetCFrame.
	This box should just graze the furthest extent of:
	 - head.
	 - hair.
	 - all hats.
	This returns the min and max offsets of this box, expressed relative to targetCFrame.
*/
export function calculateHeadExtents(character: Instance, targetCFrame: CFrame): [Vector3, Vector3] {
	let [minExtent, maxExtent] = initExtents()

	const head = character.FindFirstChild("Head")
	if (!head) {
		return [minExtent, maxExtent]
    }

	const cInverse = targetCFrame.inverse()

	// We don't want our min y extent to consider anything below the avatar's chin.  Figure
	// our where that is.
	const untransformedHeadYMin = -(head.Prop("Size") as Vector3).Y / 2;

	// Get extent of head.
	[minExtent, maxExtent] = growExtentsToInclude(minExtent, maxExtent, head, cInverse)

	// Account for hair and hats too.
	const headAttachments = getHeadAttachments(character)

	for (const child of character.GetChildren()) {
		if (child.IsA("Accessory")) {
			const handle = child.FindFirstChild("Handle")
			if (handle) {
				const attachment = handle.FindFirstChildOfClass("Attachment")
				// Legacy hat does not have attachment in it and should be considered
				if (!attachment || headAttachments.has(attachment.Prop("Name") as string)) {
					[minExtent, maxExtent] =
						growExtentsToInclude(minExtent, maxExtent, handle, cInverse, head.Prop("CFrame") as CFrame, untransformedHeadYMin)
                }
            }
        }
    }

	return [minExtent, maxExtent]
}

/*
	For a bounding box of all parts, this box should just graze the furthest extent of all the given parts
	This returns the min and max offsets of this box, expressed relative to targetCFrame.
*/
export function calculateBodyPartsExtents(targetCFrame: CFrame, bodyParts: Instance[]): [Vector3, Vector3] {
	let [minExtent, maxExtent] = initExtents()

	const cInverse = targetCFrame.inverse()

	for (const part of bodyParts) {
		[minExtent, maxExtent] = growExtentsToInclude(minExtent, maxExtent, part, cInverse, targetCFrame)
    }

	return [minExtent, maxExtent]
}