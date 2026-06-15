import { DataType } from "../constant";
import { Property } from "../rbx";
import { InstanceWrapper } from "./InstanceWrapper";

/**
 * @category InstanceWrapper
 */
export class ConstraintWrapper extends InstanceWrapper {
    static className: string = "Constraint"
    static requiredProperties: string[] = [
        "Name",
        "Attachment0",
        "Attachment1",
    ]

    setup() {
        //generic
        if (!this.instance.HasProperty("Name")) this.instance.addProperty(new Property("Name", DataType.String), this.instance.className)

        //specific
        if (!this.instance.HasProperty("Attachment0")) this.instance.addProperty(new Property("Attachment0", DataType.Referent), undefined)
        if (!this.instance.HasProperty("Attachment1")) this.instance.addProperty(new Property("Attachment1", DataType.Referent), undefined)
    }
}