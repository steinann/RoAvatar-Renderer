import { DataType } from "../constant";
import { CFrame, Property } from "../rbx";
import { MotorWrapper } from "./Motor";

/**
 * @category InstanceWrapper
 */
export class Motor6DWrapper extends MotorWrapper {
    static className: string = "Motor6D"
    static requiredProperties: string[] = [
        ...super.requiredProperties,
        "Transform",
    ]

    setup() {
        super.setup()

        if (!this.instance.HasProperty("Transform")) this.instance.addProperty(new Property("Transform", DataType.CFrame), new CFrame())
    }
}