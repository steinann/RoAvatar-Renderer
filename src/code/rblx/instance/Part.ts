import { DataType, PartType } from "../constant"
import { Property } from "../rbx"
import { BasePartWrapper } from "./BasePart"

/**
 * @category InstanceWrapper
 */
export class PartWrapper extends BasePartWrapper {
    static className: string = "Part"
    static requiredProperties: string[] = [
        ...super.requiredProperties,
        "shape",
    ]

    setup() {
        super.setup()

        if (!this.instance.HasProperty("shape")) this.instance.addProperty(new Property("shape", DataType.Enum), PartType.Block)
    }
}