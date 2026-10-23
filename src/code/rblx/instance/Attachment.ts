import { DataType } from "../constant";
import { CFrame, Instance, Property } from "../rbx";
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

    getWorldCFrame(includeTransform: boolean = true, relativeToPart: boolean = false): CFrame {
        const parent = this.getInfluencingParent()

        if (parent) {
            if (parent.IsA("BasePart") && !relativeToPart) {
                const parentCF = parent.PropOrDefault("CFrame", new CFrame()) as CFrame

                const transform = includeTransform ? this.instance.PropOrDefault("Transform", new CFrame()) as CFrame : new CFrame()
                return parentCF.multiply(this.instance.Prop("CFrame") as CFrame).multiply(transform)
            } else if (parent.IsA("Attachment")) {
                const w = parent.w;
                
                const transform = includeTransform ? this.instance.PropOrDefault("Transform", new CFrame()) as CFrame : new CFrame()
                return (w as AttachmentWrapper).getWorldCFrame(includeTransform, relativeToPart).multiply(this.instance.Prop("CFrame") as CFrame).multiply(transform)
            }
        }

        return this.instance.Prop("CFrame") as CFrame
    }

    getPartRelativeCFrame(): CFrame {
        return this.getWorldCFrame(false, true)
    }

    setPartRelativeCFrame(cf: CFrame) {
        const ogFullRelativeCF = this.getPartRelativeCFrame()
        const ogCF = this.instance.Prop("CFrame") as CFrame
        const ogPartRelative = ogFullRelativeCF.multiply(ogCF.inverse())

        const resultCf = ogPartRelative.inverse().multiply(cf)
        this.instance.setProperty("CFrame", resultCf)
    }

    getPartParent(): Instance | undefined {
        let parent = this.instance.parent

        while (parent && !parent.IsA("BasePart")) {
            parent = parent.parent
        }

        return parent
    }

    getInfluencingParent(): Instance | undefined {
        let parent = this.instance.parent

        while (parent && !(parent.IsA("BasePart") || parent.IsA("Attachment"))) {
            parent = parent.parent
        }

        return parent
    }
}