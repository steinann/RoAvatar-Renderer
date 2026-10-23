import { DataType } from "../constant";
import { CFrame } from "../rbx";
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
        
        this.addProp("Transform", DataType.CFrame, new CFrame())
    }
}