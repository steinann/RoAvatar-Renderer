import { CameraType, DataType } from "../constant"
import { CFrame } from "../rbx"
import { InstanceWrapper } from "./InstanceWrapper"

/**
 * @category InstanceWrapper
 */
export class CameraWrapper extends InstanceWrapper {
    static className: string = "Camera"
    static requiredProperties: string[] = [
        "Name",
        "CFrame",
        "CameraType",
        "FieldOfView",
    ]

    setup() {
        //generic
        this.addProp("Name", DataType.String, this.instance.className)

        //specific
        this.addProp("CFrame", DataType.CFrame, new CFrame())
        this.addProp("CameraType", DataType.Enum, CameraType.Fixed)
        this.addProp("FieldOfView", DataType.Float32, 70)
    }
}