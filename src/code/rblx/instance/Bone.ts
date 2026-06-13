import { DataType } from "../constant"
import { CFrame, Property } from "../rbx"
import { AttachmentWrapper } from "./Attachment"

/**
 * @category InstanceWrapper
 */
export class BoneWrapper extends AttachmentWrapper {
    static className: string = "Bone"
    static requiredProperties: string[] = [
        ...super.requiredProperties,
        "Transform"
    ]

    setup() {
        super.setup()

        if (!this.instance.HasProperty("Transform")) this.instance.addProperty(new Property("Transform", DataType.CFrame), new CFrame())
    }
}