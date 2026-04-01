import { DataType } from "../constant";
import { CFrame, Instance, Property } from "../rbx";
import { InstanceWrapper } from "./InstanceWrapper";

export class ModelWrapper extends InstanceWrapper {
    static className: string = "Model"
    static requiredProperties: string[] = ["Name", "PrimaryPart"]

    setup() {
        //generic
        if (!this.instance.HasProperty("Name")) this.instance.addProperty(new Property("Name", DataType.String), this.instance.className)

        //specific
        if (!this.instance.HasProperty("PrimaryPart")) this.instance.addProperty(new Property("PrimaryPart", DataType.Referent), undefined)
    }

    GetModelCFrame(): CFrame {
        const primaryPart = this.instance.Prop("PrimaryPart") as Instance | undefined

        if (primaryPart) {
            return primaryPart.Prop("CFrame") as CFrame
        }
        
        throw new Error("Model has no PrimaryPart")
    }
}