//Port of Thumbnailing/CameraUtility.lua

import { rad } from "../misc/misc"
import { CameraType } from "../rblx/constant"
import { CFrame, Instance, Vector3 } from "../rblx/rbx"
import { adjustTargetCFrameWithExtents, calculateTargetCFrame } from "./cframeUtility"
import { calculateBodyPartsExtents, calculateHeadExtents, calculateModelExtents } from "./rigExtents"
import { vector3FromXYRotPlusDistance } from "./vectoryUtility"

export const CONSTANTS_CameraUtility = {
    //When generating a head thumbnail, how much 'margin' around extent of head + accoutrements?
    DefaultHeadMarginScale: 1.1,
    //When generating a full body thumbnail, how much 'margin' around whole body?
    DefaultBodyMarginScale: 1.1,
    //Amount of margin around a body part in a generated thumbnail
    DefaultBodyPartMarginScale: 1.2,
    XRotForFullBody: 15.0,
    XRotForCloseup: 0.0,
    DistanceScaleForFullBody: 1.0,
}

// TODO: AVBURST-13133 Remove module.DefaultHeadMarginScale = 1.1 as camera code concentrates here
const HEAD_MARGIN_SCALE = 1.1
const HEAD_X_ROTATION_RAD = rad(15.0)
const HEAD_Y_ROTATION_RAD = rad(30.0)

// The camera cframe to use if the Body Part mannequin should face left/right.
// First angle is X rotation, second is Y rotation
const FACE_LEFT_CFRAME = CFrame.fromEulerAngles(rad(-20), rad(20), 0, "YXZ")
const FACE_RIGHT_CFRAME = CFrame.fromEulerAngles(rad(-20), rad(-20), 0, "YXZ")

// FOV for Body Part and Head thumbnails
const HEAD_BODYPART_FIELD_OF_VIEW_DEG = 30

// Accessory constants
const ACCESSORY_DEFAULT_CFRAME = CFrame.Angles(rad(25), rad(25), rad(0))
const ACCESSORY_FIELD_OF_VIEW_DEG = 20
const ACCESSORY_EXTENT_SCALE = 1.1
// used if LC item is a left shoe
const LEFT_SHOE_CFRAME = CFrame.Angles(rad(0), rad(90), rad(0))
// used if LC item is a right shoe
const RIGHT_SHOE_CFRAME = CFrame.Angles(rad(0), rad(-90), rad(0))

export type CameraOptions = {
	optFieldOfView?: number,
	optFieldOfViewForDistanceScale?: number,
	minExtent: Vector3,
	maxExtent: Vector3,
	extentScale: number,
	optCameraDistanceScale?: number,
	targetCFrame: CFrame,
	optCameraXRot?: number,
	optCameraYRot?: number,
}

/*
	Determine a position by applying targetCFrame to relativePos.
	Return CFrame looking from that pos back towards target.
*/
export function getCameraCFrame(targetCFrame: CFrame, relativePos: Vector3): CFrame {
	const cameraPos = targetCFrame.multiplyVector(relativePos)
	return CFrame.lookAt(cameraPos.toVec3(), targetCFrame.Position)
}

/*
	Thumbnailer.Click does the following to decide which camera to use:
	1. if the first child of workspace has a child named "ThumbnailCamera", use that, without changes.
	2. otherwise use default system camera, and move that camera to try to contain all
	  the interesting stuff in the scene.
	Call this to get into scenario 1, a camera we control/can edit from lua.
*/
export function createThumbnailCamera(): Instance {
	// The thumbnailer will look for a child of first child of
	// workspace called "Thumbnail Camera".  If it finds that, will
	// use it.
	const camera = new Instance("Camera")
	camera.setProperty("Name", "ThumbnailCamera")
	camera.setProperty("CameraType", CameraType.Scriptable)
	//camera.setParent(workspace.GetChildren()[0])
	return camera
}

/*
	We are given field of view and the extent size of the thing we want to have
	on screen, plus a margin expressed as scale.
	How far back should we position the camera to capture everything?
*/
export function calculateBaseDistanceToCamera(
	fieldOfViewRad: number,
	minExtent: Vector3,
	maxExtent: Vector3,
	marginScale: number
): number {
	const offsetFromCenter = Math.max((maxExtent.X - minExtent.X) / 2, (maxExtent.Y - minExtent.Y) / 2)
	const t = Math.tan(fieldOfViewRad / 2)
	return (offsetFromCenter * marginScale) / t
}

/*
	Helper function we can use both on RCC and in lua-app, so camera setup is as similar as possible
	between the two.
	Sets camera position, orientation, and field of view.

	Options include:
		Optional:
			optFieldOfView - field of view for the camera.  Defaults to existing camera field of view.
			optFieldOfViewForDistanceScale - field of view to use for distance scale calculation. Separate
				from optFieldOfView because in universal app we are dealing with the "peekaboo" view, where
				the picture we care about is some subrange of complete camera extent.  Defaults to
				camera field of view after applying optFieldOfView.
			optCameraXRot - camera rotation around X axis, defaults to 0.
			optCameraYRot - camera rotation around Y axis, defaults to 0.
			optCameraDistanceScale - scale applied to default camera distance from target, defaults to 1.
		Required:
			targetCFrame - Cframe describing position of the thing we want to view.
			minExtent, maxExtent - extents of thing we want to view.  Relative to targetCFrame.
			extentScale - scale to apply to extents to provide some margin around thing we're looking at.
*/
export function setupCamera(camera: Instance, cameraOptions: CameraOptions) {
	if (cameraOptions.optFieldOfView) {
		camera.setProperty("FieldOfView", cameraOptions.optFieldOfView)
    }

	// get distance to camera based on extents
	const fieldOfViewForDistanceScale = cameraOptions.optFieldOfViewForDistanceScale || camera.Prop("FieldOfView") as number
	let distanceToCamera = calculateBaseDistanceToCamera(
		rad(fieldOfViewForDistanceScale),
		cameraOptions.minExtent,
		cameraOptions.maxExtent,
		cameraOptions.extentScale
	)

	if (cameraOptions.optCameraDistanceScale) {
		distanceToCamera = distanceToCamera * cameraOptions.optCameraDistanceScale
    }

	// Adjust to account for extent size.
	const finalTargetCFrame = adjustTargetCFrameWithExtents(
		cameraOptions.targetCFrame,
		cameraOptions.minExtent,
		cameraOptions.maxExtent
	)

	const cameraXRotDeg = cameraOptions.optCameraXRot || 0
	const cameraYRotDeg = cameraOptions.optCameraYRot || 0

	const cPos = vector3FromXYRotPlusDistance(cameraXRotDeg, cameraYRotDeg, distanceToCamera)
	camera.setProperty("CFrame", getCameraCFrame(finalTargetCFrame, cPos))
}

/*
	Sets up a camera meant for BodyPart Thumbnails given
	mannequin: the mannequin Model
	faceRight: whether the mannequin should face right
	focusPartNames: the names of the parts to focus on in the thumbnail
	camera: the Camera to set up
*/
export function setupBodyPartCamera(
	mannequin: Instance,
	faceRight: boolean,
	focusPartNames: string[],
	camera: Instance
) {
	const mannequinFocusParts = []
    for (const focusPartName of focusPartNames) {
        const focusPart = mannequin.FindFirstDescendant(focusPartName)
        if (focusPart) {
            mannequinFocusParts.push(focusPart)
        }
    }

	const humanoidRootPart = mannequin.FindFirstChild("HumanoidRootPart")
    if (humanoidRootPart) {
        let mannequinTargetCFrame = humanoidRootPart.Prop("CFrame") as CFrame
        const adjustment = faceRight ? FACE_RIGHT_CFRAME : FACE_LEFT_CFRAME
        mannequinTargetCFrame = adjustment.multiply(mannequinTargetCFrame)
        const [minPartsExtent, maxPartsExtent] =
            calculateBodyPartsExtents(mannequinTargetCFrame, mannequinFocusParts)
        // Setup Camera with these options
        const cameraOptions: CameraOptions = {
            optFieldOfView: HEAD_BODYPART_FIELD_OF_VIEW_DEG,
            targetCFrame: mannequinTargetCFrame,
            minExtent: minPartsExtent,
            maxExtent: maxPartsExtent,
            extentScale: CONSTANTS_CameraUtility.DefaultBodyPartMarginScale,
        }

        setupCamera(camera, cameraOptions)
    }
}

/*
	Sets up a camera to be used in Head Thumbnails given:

	headModel: The head to make a thumbnail of
	camera: the Camera to set up for the thumbnail
*/
export function setupHeadCamera(headModel: Instance, camera: Instance) {
	const head = headModel.FindFirstChild("Head")
    if (head) {
        // Figure out the target CFrame: a cframe describing the centroid of the thing we
        // are looking at.
        // It's roughly the head CFrame, but the head may be tilted somehow: we
        // want target CFrame's Up vector to point straight up.  We want a
        // a CFrame with head CFrame position, and head CFrame "Look" vector
        // flattened into the X-Z plane.
        let headTargetCFrame = calculateTargetCFrame(head.Prop("CFrame") as CFrame)

        // Turn the head before we calculate extents so we're calculating extents on what the camera is
        // actually seeing.
        const adjustment = CFrame.fromEulerAngles(HEAD_X_ROTATION_RAD, HEAD_Y_ROTATION_RAD, 0, "YXZ")
        headTargetCFrame = adjustment.multiply(headTargetCFrame)

        // Get extents of head, hair, and hats, relative to target cframe.
        const [minHeadExtent, maxHeadExtent] = calculateHeadExtents(headModel, headTargetCFrame)

        // Setup Camera
        const cameraOptions: CameraOptions = {
            optFieldOfView: HEAD_BODYPART_FIELD_OF_VIEW_DEG,
            targetCFrame: headTargetCFrame,
            minExtent: minHeadExtent,
            maxExtent: maxHeadExtent,
            extentScale: HEAD_MARGIN_SCALE,
        }
        setupCamera(camera, cameraOptions)
    }
}

function isLeftShoe(acc: Instance) {
	const handle = acc.FindFirstChildOfClass("MeshPart")
	if (!handle) {
		return false
    }
	//assert(handle, "Assert handle is not nil to silence type checker")
	return undefined !== handle.FindFirstChild("LeftFootAttachment")
}

function isRightShoe(acc: Instance) {
	const handle = acc.FindFirstChildOfClass("MeshPart")
	if (!handle) {
		return false
    }
	//assert(handle, "Assert handle is not nil to silence type checker")
	return undefined !== handle.FindFirstChild("RightFootAttachment")
}

function getAccessoryAngle(acc: Instance) {
	if (isLeftShoe(acc)) {
		return LEFT_SHOE_CFRAME
    } else if (isRightShoe(acc)) {
		return RIGHT_SHOE_CFRAME
    }
	return ACCESSORY_DEFAULT_CFRAME
}

export function setupAccessoryCamera(accessoryModel: Instance, camera: Instance) {
	const modelChildren = accessoryModel.GetChildren()
	//assert(#modelChildren == 1, "Assert SetupMeshPartAccessoryCamera accessoryModel only has accessory as a child.")
	const accoutrement = modelChildren[0]
	const handle = accoutrement.FindFirstChild("Handle")
	//assert(handle, "Assert Accessory has handle for camera setup.")
    if (handle) {
        handle.setProperty("CFrame", new CFrame())
        const targetCFrame = (handle.Prop("CFrame") as CFrame).multiply(getAccessoryAngle(accoutrement))

        const [minPartsExtent, maxPartsExtent] = calculateModelExtents(accessoryModel, targetCFrame)
        // Setup Camera
        const cameraOptions: CameraOptions = {
            optFieldOfView: ACCESSORY_FIELD_OF_VIEW_DEG,
            targetCFrame: targetCFrame,
            minExtent: minPartsExtent,
            maxExtent: maxPartsExtent,
            extentScale: ACCESSORY_EXTENT_SCALE,
        }
        setupCamera(camera, cameraOptions)
    }
}