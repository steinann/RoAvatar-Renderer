import { DataType } from "../constant";
import { CFrame, Property } from "../rbx";
import { InstanceWrapper } from "./InstanceWrapper";

export class AttachmentWrapper extends InstanceWrapper {
    static className: string = "Attachment"
    static requiredProperties: string[] = [
        "Name",
        "CFrame",
    ]

    setup() {
        //generic
        if (!this.instance.HasProperty("Name")) this.instance.addProperty(new Property("Name", DataType.String), this.instance.className)

        //specific
        if (!this.instance.HasProperty("CFrame")) this.instance.addProperty(new Property("CFrame", DataType.CFrame), new CFrame())
    }

    getWorldCFrame() {
        if (this.instance.parent) {
            if (this.instance.parent.className.includes("Part")) {
                const parentCF = this.instance.parent.PropOrDefault("CFrame", new CFrame()) as CFrame
                
                return parentCF.multiply(this.instance.Prop("CFrame") as CFrame)
            }
        }

        return this.instance.Prop("CFrame") as CFrame
    }
}