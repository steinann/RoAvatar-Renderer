import { DataType } from "../constant"
import { Property } from "../rbx"
import { BasePartWrapper } from "./BasePart"

/**
 * @category InstanceWrapper
 */
export class MeshPartWrapper extends BasePartWrapper {
    static className: string = "MeshPart"
    static requiredProperties: string[] = [
        ...super.requiredProperties,
        "DoubleSided",
    ]

    setup() {
        super.setup()

        if (!this.instance.HasProperty("DoubleSided")) this.instance.addProperty(new Property("DoubleSided", DataType.Bool), false)
    }
}