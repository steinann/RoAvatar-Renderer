import { DataType } from "../constant";
import { CFrame, Property } from "../rbx";
import { InstanceWrapper } from "./InstanceWrapper";

/**
 * @category InstanceWrapper
 */
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

    getWorldCFrame(includeTransform: boolean = true): CFrame {
        if (this.instance.parent) {
            if (this.instance.parent.w?.IsA("BasePart")) {
                const parentCF = this.instance.parent.PropOrDefault("CFrame", new CFrame()) as CFrame

                const transform = includeTransform ? this.instance.PropOrDefault("Transform", new CFrame()) as CFrame : new CFrame()
                return parentCF.multiply(this.instance.Prop("CFrame") as CFrame).multiply(transform)
            } else if (this.instance.parent.w?.IsA("Attachment")) {
                const w = this.instance.parent.w;
                
                const transform = includeTransform ? this.instance.PropOrDefault("Transform", new CFrame()) as CFrame : new CFrame()
                return (w as AttachmentWrapper).getWorldCFrame().multiply(this.instance.Prop("CFrame") as CFrame).multiply(transform)
            }
        }

        return this.instance.Prop("CFrame") as CFrame
    }
}