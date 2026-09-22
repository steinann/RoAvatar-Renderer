import { DataType } from "../constant";
import { CFrame, Instance, Property } from "../rbx";
import { InstanceWrapper } from "./InstanceWrapper";

/**
 * @category InstanceWrapper
 */
export class AccessoryWrapper extends InstanceWrapper {
    static className: string = "Accessory"
    static requiredProperties: string[] = [
        "Name"
    ]

    setup() {
        //generic
        if (!this.instance.HasProperty("Name")) this.instance.addProperty(new Property("Name", DataType.String), this.instance.className)
    }

    created(): void {
        this.instance.AncestryChanged.Connect(() => {
            this.AccessoryBuildWeld()
        })
    }

    /**
     * 
     * @returns [bodyAttachment, handleAttachment] or undefined
     */
    getBodyAccessoryAttachmentPair(): [Instance, Instance] | undefined {
        if (this.instance.parent) {
            const humanoid = this.instance.parent.FindFirstChildOfClass("Humanoid")
            
            if (humanoid) {
                const handle = this.instance.FindFirstChild("Handle")
                if (handle) {
                    for (const child of handle.GetChildrenDangerous()) {
                        if (child.className === "Attachment") {
                            const bodyParts: Instance[] = this.instance.parent.GetChildrenDangerous()
                            for (const bodyPart of bodyParts) {
                                if (bodyPart.className !== "Part" && bodyPart.className !== "MeshPart") continue

                                const bodyPartChildren = bodyPart.GetChildrenDangerous()
                                for (const bodyChild of bodyPartChildren) {
                                    if (bodyChild.className === "Attachment" && child && bodyChild.Property("Name") === child.Property("Name") && bodyChild.parent && bodyChild.parent.parent === this.instance.parent) {
                                        return [bodyChild, child]
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    AccessoryBuildWeld() {
        if (this.instance.parent && this.instance.className === "Accessory") { //create accessory weld TODO: making the part0/C0 and part1/C1 accurate (0 = hat, 1 = body) would be good, probably
            const humanoid = this.instance.parent.FindFirstChildOfClass("Humanoid")

            if (humanoid) {
                const handle = this.instance.FindFirstChild("Handle")
                if (handle) {
                    const attachmentPair = this.getBodyAccessoryAttachmentPair()

                    const oldAccessoryWeld = handle.FindFirstChild("AccessoryWeld")

                    if (attachmentPair) {
                        const [bodyAttachment, accessoryAttachment] = attachmentPair

                        const weld = oldAccessoryWeld || new Instance("Weld")

                        weld.addProperty(new Property("Name", DataType.String), "AccessoryWeld")
                        weld.addProperty(new Property("Archivable", DataType.Bool), true)
                        weld.addProperty(new Property("C1", DataType.CFrame), (accessoryAttachment.Property("CFrame") as CFrame).clone())
                        weld.addProperty(new Property("C0", DataType.CFrame), (bodyAttachment.Property("CFrame") as CFrame).clone())
                        weld.addProperty(new Property("Part1", DataType.Referent), accessoryAttachment.parent)
                        weld.addProperty(new Property("Part0", DataType.Referent), bodyAttachment.parent)
                        weld.addProperty(new Property("Active", DataType.Bool), true)
                        weld.addProperty(new Property("Enabled", DataType.Bool), false)

                        weld.setParent(handle)

                        weld.setProperty("Enabled", true)
                    } else { //default to what im guessing is legacy behavior (but not putting the weld inside the head and calling it HeadWeld because that is annoying)
                        const head = this.instance.parent.FindFirstChild("Head")
                        if (!head) return //i can confirm nothing happens

                        const attachmentPoint = this.instance.PropOrDefault("AttachmentPoint", new CFrame()) as CFrame

                        const weld = oldAccessoryWeld || new Instance("Weld")

                        weld.addProperty(new Property("Name", DataType.String), "AccessoryWeld")
                        weld.addProperty(new Property("Archivable", DataType.Bool), true)
                        weld.addProperty(new Property("C1", DataType.CFrame), attachmentPoint.clone())
                        weld.addProperty(new Property("C0", DataType.CFrame), new CFrame())
                        weld.addProperty(new Property("Part1", DataType.Referent), handle)
                        weld.addProperty(new Property("Part0", DataType.Referent), head)
                        weld.addProperty(new Property("Active", DataType.Bool), true)
                        weld.addProperty(new Property("Enabled", DataType.Bool), false)

                        weld.setParent(handle)

                        weld.setProperty("Enabled", true)
                    }
                }
            }
        }
    }
}