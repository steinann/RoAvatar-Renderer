import { DataType } from "../constant";
import { CFrame, Property } from "../rbx";
import { ConstraintWrapper } from "./Constraint";

/**
 * @category InstanceWrapper
 */
export class AnimationConstraintWrapper extends ConstraintWrapper {
    static className: string = "AnimationConstraint"
    static requiredProperties: string[] = [
        ...super.requiredProperties,
        "Transform",
    ]

    setup() {
        super.setup()
        
        if (!this.instance.HasProperty("Transform")) this.instance.addProperty(new Property("Transform", DataType.CFrame), new CFrame())
    }
}