//Port of Thumbnailing/CameraPresetsUtility.lua

import { add, multiply } from "../mesh/mesh-deform"
import { rad } from "../misc/misc"
import { HumanoidRigType, R15BodyPartNames, R6BodyPartNames } from "../rblx/constant"
import { CFrame, Vector3, type Instance } from "../rblx/rbx"
import { calculateBodyPartsExtents, calculateHeadExtents, calculateModelExtents } from "./rigExtents"
import { CONSTANTS_CameraUtility, createThumbnailCamera, getCameraCFrame, setupCamera, type CameraOptions } from "./cameraUtility"
import type { AttachmentWrapper } from "../rblx/instance/Attachment"
import { calculateTargetCFrame } from "./cframeUtility"

/*
	Preset configurations for camera positions and orientations in thumbnail generation.
*/

//FFLAGS VALUES ARE BASED ON THE ONES AT THE TIME THE SCRIPT WAS MADE, https://clientsettings.roblox.com/v2/settings/application/PCDesktopClient

//this seems to be 110 for some reason? even though its missing from the fflag list
const FIntCameraPresetHeadshotExtentScaleHundredths =
	110//130//game:DefineFastInt("CameraPresetHeadshotExtentScaleHundredths", 130)

export const CONSTANTS_CameraPresetsUtility = {
    GOLDEN_RATIO: 600, //game:DefineFastInt("AvatarGoldenRatio", 618) / 1000 -- = 0.618
    UPVECTOR_ORENTATION_TRESHOLD: -60 / 100, //game:DefineFastInt("UpVectorOrentationThreshold1", -60) / 100 // = -0.6
    AVATAR_ROTATION_DEGREE: 15, //game:DefineFastInt("LookAvatarRotationDegree1", 23)
}

function getTorsoOrUpperTorso(character: Instance) {
	return character.FindFirstChild("Torso") || character.FindFirstChild("UpperTorso")
}

function getMannequinBodyParts(character: Instance, humanoid: Instance): Instance[] {
	const bodyParts: Instance[] = []
	if (humanoid.Prop("RigType") == HumanoidRigType.R6) {
		for (const partName of R15BodyPartNames) {
			// CharacterMesh doesn't have size
			// HumanoidRootPart might be off the center of the body parts, it might be invisible but occupy invisible space
			//if (partName ~= "CharacterMesh" and partName ~= "HumanoidRootPart" then
                const bodyPart = character.FindFirstChild(partName)
				if (bodyPart) bodyParts.push(bodyPart)
			//end
        }
    } else if (humanoid.Prop("RigType") == HumanoidRigType.R15) {
		for (const partName of R6BodyPartNames) {
			// HumanoidRootPart might be off the center of the body parts, it might be invisible but occupy invisible space
			//if partName ~= "HumanoidRootPart" then
				const bodyPart = character.FindFirstChild(partName)
				if (bodyPart) bodyParts.push(bodyPart)
			//end
        }
    }
	return bodyParts
}

export function getCharacterTorsoCFrame(character: Instance): CFrame {
    const torso = getTorsoOrUpperTorso(character)
	return torso ? torso.Prop("CFrame") as CFrame : new CFrame()
}

/*
  Get the camera cframe for the avatar front facing and camera look at the golden ratio of the avatar body (accessories crop allowed)
  @param character: Model
  @param applyEmote: function
    Due to different usage (Client vs RCC vs viewport) have different way to apply emote, we need to pass in the function to apply the emote
  @param isFallbackEmoteApplied: boolean
  @param fieldOfViewDeg: number? in degrees, by default 56
  @param characterInitialCFrame: CFrame?
    By accepting the character initial CFrame, we give caller the ability to call this method multiple times with the same character but different emotes without breaking the initial pivot
  @return CFrame?
    if returns nil, it means the character does not have a humanoid or error out
  - Design Spec: https://roblox.atlassian.net/wiki/spaces/ECO/pages/2738783097/Design+Spec+Look+-+Avatar+Thumbnailing
  - Tech Spec: https://roblox.atlassian.net/wiki/spaces/ECO/pages/2747236505/Tech+Spec+New+Look+-+Avatar+Thumbnail+tech+spec
*/
export function getFullBodyCameraCFrame(
	character: Instance,
	applyEmote?: () => void,
	isFallbackEmoteApplied?: boolean,
	fieldOfViewDeg?: number,
	characterInitialCFrame?: CFrame
) {
	const fovAngle = fieldOfViewDeg || 56
	const characterInitialPivotTo = characterInitialCFrame || getCharacterTorsoCFrame(character)
	const characterInitialLookVector = characterInitialPivotTo.lookVector()
	if (applyEmote) {
		applyEmote()
    }

	const humanoid = character.FindFirstChildOfClass("Humanoid")
	if (!humanoid) {
		return
    }
	const bodyParts = getMannequinBodyParts(character, humanoid)

	/*
		Pick a auxiliary cframe inside the character to calculate the character's max/min extents of the character.
		Also, the final cframe pivot to, characterGoldenRatioPivotTo, share the same rotation with this auxiliary cframe
		Thus, we pick the cframe of the torso/uppertorso as the auxiliary cframe
	*/
	const characterPivotToAuxiliaryCFrame = getCharacterTorsoCFrame(character)
	const characterAuxiliaryUpVector = characterPivotToAuxiliaryCFrame.upVector()

    const head = character.FindFirstChild("Head")
    if (!head) return

	const [characterHeadRotationX, characterHeadRotationY, characterHeadRotationZ] = (head.Prop("CFrame") as CFrame).toEulerAngles("XYZ")

	if (isFallbackEmoteApplied) {
		// Rotate the character to the right by degrees to meet the default emote head facing
		//character:PivotTo(
		//	characterInitialPivotTo * CFrame.Angles(0, math.rad(CameraPresetsUtility.AVATAR_ROTATION_DEGREE * -1), 0)
		//)
	}

	// Reminder: extents are in the object coordinates, not world coordinates
	const [minPartsExtent, maxPartsExtent] =
		calculateBodyPartsExtents(characterPivotToAuxiliaryCFrame, bodyParts)

	// Fov Angle is hard coded to 56 and keep the similiar as the UA avatar scene workspace also considering the camera distance
	const tanAlpha = Math.tan(rad(fovAngle / 2))

	/*
		Start: Golden Ratio 0.618
	  		This will change the cframe inside the extents
		  	Use the extent to calculate the golden focus position and adjust the cframe position
  	*/
	const goldPositionOfExtent = minPartsExtent.lerp(maxPartsExtent, CONSTANTS_CameraPresetsUtility.GOLDEN_RATIO)
	const centerPositionOfExtent = minPartsExtent.lerp(maxPartsExtent, 0.5)
	const goldPosition = new Vector3(centerPositionOfExtent.X, goldPositionOfExtent.Y, centerPositionOfExtent.Z)

	const goldPositionWorldSpace = characterPivotToAuxiliaryCFrame.multiplyVector(goldPosition)
	let characterGoldenRatioPivotTo = characterPivotToAuxiliaryCFrame.rotationOnly()
	characterGoldenRatioPivotTo.Position = add(characterGoldenRatioPivotTo.Position, goldPositionWorldSpace.toVec3())

	if (!isFallbackEmoteApplied) {
		const headPivotTo =
			CFrame.fromEulerAngles(characterHeadRotationX, characterHeadRotationY, characterHeadRotationZ, "XYZ")
		characterGoldenRatioPivotTo = headPivotTo.rotationOnly()
        characterGoldenRatioPivotTo.Position = add(characterGoldenRatioPivotTo.Position, goldPositionWorldSpace.toVec3())
    }

	const distanceToLowerExtents = Math.max(goldPosition.X - minPartsExtent.X, goldPosition.Y - minPartsExtent.Y)
	const distanceToUpperExtents = Math.max(maxPartsExtent.X - goldPosition.X, maxPartsExtent.Y - goldPosition.Y)

	// project to x-y plane and calculate the distanceToCamera
	const dc1 = distanceToLowerExtents * CONSTANTS_CameraUtility.DefaultBodyMarginScale / tanAlpha
	const dc1Option = distanceToUpperExtents * CONSTANTS_CameraUtility.DefaultBodyMarginScale / tanAlpha
	// [[End: Golden Ratio 0.618]]

	let distanceToCameraOption = dc1

	//Because we are using the golden ratio, upside down and upside right will have edge cases that we will crop the top
	const isUpsideDown = characterAuxiliaryUpVector[1] < CONSTANTS_CameraPresetsUtility.UPVECTOR_ORENTATION_TRESHOLD
	const isUpsideRight = characterAuxiliaryUpVector[0] < CONSTANTS_CameraPresetsUtility.UPVECTOR_ORENTATION_TRESHOLD

	if (isUpsideDown || isUpsideRight) {
		distanceToCameraOption = Math.max(dc1, dc1Option)
    }
	/*
		-- This comment line give the power to apply range limit auto zoom
		-- dc2 is the camera distance include all accessories
		local minExtentWithAccessories, maxExtentWithAccessories = CharacterUtility.CalculateModelExtents(character, characterPivotToAuxiliaryCFrame)
		local dc2 = math.max(maxExtentWithAccessories.X - minExtentWithAccessories.X, maxExtentWithAccessories.Y - minExtentWithAccessories.Y) * CameraUtility.DefaultBodyMarginScale / 2 / tanAlpha
		local distanceToCamera = math.max(dc1, dc1Option) * math.max(math.min(dc2/math.max(dc1, dc1Option), 1.5), 1.1)
	*/

	const distanceToCamera = distanceToCameraOption * CONSTANTS_CameraUtility.DistanceScaleForFullBody

	const relativePositionToCamera = new Vector3().fromVec3(multiply(characterInitialLookVector, [distanceToCamera,distanceToCamera,distanceToCamera]))
	return getCameraCFrame(characterGoldenRatioPivotTo, relativePositionToCamera)
}

// Legacy function name alias, will be removed in the future. Please use GetFullBodyCameraCFrame instead
//CameraPresetsUtility.GetCameraCFrame_ForAvatarR15Action_LookAtGoldenRatioOfTheHumanoid =
//	CameraPresetsUtility.GetFullBodyCameraCFrame

export function getHeadshotCameraCFrame(
	character: Instance,
	applyEmote?: () => void,
	isFallbackEmoteApplied?: boolean,
	fieldOfViewDeg?: number,
    cameraOptionsOverride?: Partial<CameraOptions>
) {
	const fovAngle = fieldOfViewDeg || 30
	if (applyEmote) {
		applyEmote()
    }

	if (isFallbackEmoteApplied) {
		// Rotate the character to the right by degrees to meet the default emote head facing
		//const characterInitialPivotTo = getCharacterTorsoCFrame(character)
		//character:PivotTo(
		//	characterInitialPivotTo * CFrame.Angles(0, math.rad(CameraPresetsUtility.AVATAR_ROTATION_DEGREE * -1), 0)
		//)
    }

	const characterHead = character.FindFirstChild("Head")
	if (!characterHead) {
        return
		//error("Character is missing a Head, cannot apply upper body camera preset.")
    }

	// Focus point is the FaceFrontAttachment if it exists, otherwise the Head's CFrame.
	let targetCFrame = characterHead.Prop("CFrame") as CFrame
	const faceFrontAttachment = characterHead.FindFirstChild("FaceFrontAttachment")
    
	if (faceFrontAttachment) {
        const faceFrontAttachmentW = faceFrontAttachment.w
        if (faceFrontAttachmentW) {
		    targetCFrame = (faceFrontAttachmentW as AttachmentWrapper).getWorldCFrame()
        }
    }

	const headTargetCFrame = calculateTargetCFrame(targetCFrame)

	// Get extents of head, hair, and hats, relative to target cframe.
	const [minHeadExtent, maxHeadExtent] = calculateHeadExtents(character, headTargetCFrame)

	const camera = createThumbnailCamera()
	const cameraOptions: CameraOptions = {
		extentScale: FIntCameraPresetHeadshotExtentScaleHundredths / 100,
		maxExtent: maxHeadExtent,
		minExtent: minHeadExtent,
		optCameraXRot: CONSTANTS_CameraUtility.XRotForCloseup,
		optFieldOfView: fovAngle,
		targetCFrame: headTargetCFrame,
	}
    Object.assign(cameraOptions, cameraOptionsOverride)
	setupCamera(camera, cameraOptions)
    return camera
}

export function getAvatarCameraCFrame(
	character: Instance,
	applyEmote?: () => void,
	isFallbackEmoteApplied?: boolean,
	fieldOfViewDeg?: number,
    cameraOptionsOverride?: Partial<CameraOptions>
) {
	const fovAngle = fieldOfViewDeg || 30
	if (applyEmote) {
		applyEmote()
    }

	if (isFallbackEmoteApplied) {
		// Rotate the character to the right by degrees to meet the default emote head facing
		//const characterInitialPivotTo = getCharacterTorsoCFrame(character)
		//character:PivotTo(
		//	characterInitialPivotTo * CFrame.Angles(0, math.rad(CameraPresetsUtility.AVATAR_ROTATION_DEGREE * -1), 0)
		//)
    }

	const characterHead = character.FindFirstChild("Head")
	if (!characterHead) {
        return
		//error("Character is missing a Head, cannot apply upper body camera preset.")
    }

	// Focus point is the FaceFrontAttachment if it exists, otherwise the Head's CFrame.
	let targetCFrame = characterHead.Prop("CFrame") as CFrame
	const faceFrontAttachment = characterHead.FindFirstChild("FaceFrontAttachment")
    
	if (faceFrontAttachment) {
        const faceFrontAttachmentW = faceFrontAttachment.w
        if (faceFrontAttachmentW) {
		    targetCFrame = (faceFrontAttachmentW as AttachmentWrapper).getWorldCFrame()
        }
    }

    const torsoCFrame = getCharacterTorsoCFrame(character)
    targetCFrame.Position = torsoCFrame.Position

	const headTargetCFrame = calculateTargetCFrame(targetCFrame)

	// Get extents of head, hair, and hats, relative to target cframe.
	const [minHeadExtent, maxHeadExtent] = calculateModelExtents(character, headTargetCFrame)

	const camera = createThumbnailCamera()
	const cameraOptions: CameraOptions = {
		extentScale: FIntCameraPresetHeadshotExtentScaleHundredths / 100,
		maxExtent: maxHeadExtent,
		minExtent: minHeadExtent,
		optCameraXRot: CONSTANTS_CameraUtility.XRotForFullBody,
		optFieldOfView: fovAngle,
		targetCFrame: headTargetCFrame,
	}
    Object.assign(cameraOptions, cameraOptionsOverride)
	setupCamera(camera, cameraOptions)
    return camera
}