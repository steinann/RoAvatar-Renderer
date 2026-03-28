import { DataType } from "../constant";
import { CFrame, Property } from "../rbx";
import { InstanceWrapper } from "./InstanceWrapper";

export class AnimationConstraintWrapper extends InstanceWrapper {
    static className: string = "AnimationConstraint"
    static requiredProperties: string[] = [
        "Name",
        "Attachment0",
        "Attachment1",
        "Transform",
    ]

    setup() {
        //generic
        if (!this.instance.HasProperty("Name")) this.instance.addProperty(new Property("Name", DataType.String), this.instance.className)

        //specific
        if (!this.instance.HasProperty("Attachment0")) this.instance.addProperty(new Property("Attachment0", DataType.Referent), undefined)
        if (!this.instance.HasProperty("Attachment1")) this.instance.addProperty(new Property("Attachment1", DataType.Referent), undefined)
        if (!this.instance.HasProperty("Transform")) this.instance.addProperty(new Property("Transform", DataType.CFrame), new CFrame())
    }
}