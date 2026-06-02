import { DataType } from "../constant";
import { CFrame, Property, Vector3 } from "../rbx";
import { InstanceWrapper } from "./InstanceWrapper";

/**
 * @category InstanceWrapper
 */
export class BasePartWrapper extends InstanceWrapper {
    static className: string = "BasePart"
    static requiredProperties: string[] = [
        "Name",
        "CFrame",
        "size",
        "Transparency",
    ]

    setup() {
        //generic
        if (!this.instance.HasProperty("Name")) this.instance.addProperty(new Property("Name", DataType.String), this.instance.className)

        //specific
        if (!this.instance.HasProperty("CFrame")) this.instance.addProperty(new Property("CFrame", DataType.CFrame), new CFrame())
        if (!this.instance.HasProperty("size")) this.instance.addProperty(new Property("size", DataType.Vector3), new Vector3())
        if (!this.instance.HasProperty("Transparency")) this.instance.addProperty(new Property("Transparency", DataType.Float32), 0)
    }
}