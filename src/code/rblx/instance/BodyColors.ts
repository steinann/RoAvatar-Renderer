import { DataType } from "../constant";
import { Color3, Property, type Instance } from "../rbx";
import { InstanceWrapper } from "./InstanceWrapper";

/**
 * @category InstanceWrapper
 */
export class BodyColorsWrapper extends InstanceWrapper {
    static className: string = "BodyColors"
    static requiredProperties: string[] = [
        "Name",
        "HeadColor3",
        "TorsoColor3",
        "LeftArmColor3",
        "RightArmColor3",
        "LeftLegColor3",
        "RightLegColor3",
    ]

    setup() {
        //generic
        if (!this.instance.HasProperty("Name")) this.instance.addProperty(new Property("Name", DataType.String), this.instance.className)

        //specific
        if (!this.instance.HasProperty("HeadColor3")) this.instance.addProperty(new Property("HeadColor3", DataType.Color3), new Color3())
        if (!this.instance.HasProperty("TorsoColor3")) this.instance.addProperty(new Property("TorsoColor3", DataType.Color3), new Color3())
        if (!this.instance.HasProperty("LeftArmColor3")) this.instance.addProperty(new Property("LeftArmColor3", DataType.Color3), new Color3())
        if (!this.instance.HasProperty("RightArmColor3")) this.instance.addProperty(new Property("RightArmColor3", DataType.Color3), new Color3())
        if (!this.instance.HasProperty("LeftLegColor3")) this.instance.addProperty(new Property("LeftLegColor3", DataType.Color3), new Color3())
        if (!this.instance.HasProperty("RightLegColor3")) this.instance.addProperty(new Property("RightLegColor3", DataType.Color3), new Color3())
    }

    created(): void {
        this.instance.Changed.Connect(() => {
            this.update()
        })
    }

    update() {
        const rig = this.instance.parent
        if (!rig) {
            return
        }

        const humanoid = rig.FindFirstChildOfClass("Humanoid")
        if (!humanoid) {
            return
        }

        const bodyPartDictionary: {[K in string]: string[]} = {
            "Head": ["Head"],
            "Torso": ["Torso", "UpperTorso", "LowerTorso"],
            "LeftArm": ["Left Arm", "LeftHand", "LeftLowerArm", "LeftUpperArm"],
            "RightArm": ["Right Arm", "RightHand", "RightLowerArm", "RightUpperArm"],
            "LeftLeg": ["Left Leg", "LeftFoot", "LeftLowerLeg", "LeftUpperLeg"],
            "RightLeg": ["Right Leg", "RightFoot", "RightLowerLeg", "RightUpperLeg"]
        }

        const bodyParts: Instance[] = []
        for (const child of rig.GetChildren()) {
            if (child.w?.IsA("BasePart")) {
                bodyParts.push(child)
            }
        }

        for (const bodyPart in bodyPartDictionary) {
            const bodyPartNames = bodyPartDictionary[bodyPart]
            const color = (this.instance.Prop(bodyPart + "Color3") as Color3).toColor3uint8()
            for (const child of bodyParts) {
                if (bodyPartNames.includes(child.Prop("Name") as string)) {
                    child.setProperty("Color", color)
                }
            }
        }
    }
}