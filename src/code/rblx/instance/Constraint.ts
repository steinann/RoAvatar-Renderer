import { DataType } from "../constant";
import { CFrame, Instance } from "../rbx";
import type { AttachmentWrapper } from "./Attachment";
import type { BasePartWrapper } from "./BasePart";
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
        "Visible",
    ]

    setup() {
        //generic
        this.addProp("Name", DataType.String, this.instance.className)

        //specific
        this.addProp("Attachment0", DataType.Referent, undefined)
        this.addProp("Attachment1", DataType.Referent, undefined)

        this.addProp("Visible", DataType.Bool, false)
    }

    getAssemblyOffset(includeTransform: boolean) {
        const att0 = this.instance.Prop("Attachment0") as Instance | undefined
        const att1 = this.instance.Prop("Attachment1") as Instance | undefined

        if (att0 && att1 && att0 !== att1 && att0.IsA("Attachment") && att1.IsA("Attachment")) {
            const att0W = att0.w as AttachmentWrapper
            const att1W = att1.w as AttachmentWrapper

            const part0 = att0W.getPartParent()
            const part1 = att1W.getPartParent()

            if (part0 && part1 && part0 !== part1) {
                const part0W = part0.w
                const part1W = part1.w

                if (part0W && part1W && part0W.IsA("BasePart") && part1W.IsA("BasePart")) {
                    const c0 = att0W.getPartRelativeCFrame(includeTransform) //this.instance.Prop("C0") as CFrame
                    const c1 = att1W.getPartRelativeCFrame(includeTransform) //this.instance.Prop("C1") as CFrame
                    const transform = this.instance.PropOrDefault("Transform", new CFrame()) as CFrame

                    const an0 = (part0W as BasePartWrapper).GetAssemblyNode()
                    const an1 = (part1W as BasePartWrapper).GetAssemblyNode()

                    const affectedPart = an0.depth <= an1.depth ? 1 : 0 

                    //part0 * c0 = part1 * c1 * transform

                    //part1 = part0 * c0 * (c1 * transform):Inverse()
                    if (affectedPart === 1) {
                        if (includeTransform) {
                            return c0.multiply((c1.multiply(transform)).inverse())
                        } else {
                            return c0.multiply(c1.inverse())
                        }
                    //part0 = part1 * c1 * transform * c0:Inverse()
                    } else if (affectedPart === 0) {
                        if (includeTransform) {
                            return c1.multiply(transform).multiply(c0.inverse())
                        } else {
                            return c1.multiply(c0.inverse())
                        }
                    }
                }
            }
        }

        return new CFrame()
    }
}