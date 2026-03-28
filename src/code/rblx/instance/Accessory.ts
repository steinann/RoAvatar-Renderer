import { DataType } from "../constant";
import { CFrame, Instance, Property } from "../rbx";
import { InstanceWrapper } from "./InstanceWrapper";

export class AccessoryWrapper extends InstanceWrapper {
    static className: string = "Accessory"
    static requiredProperties: string[] = [
        "Name"
    ]

    setup() {
        //generic
        if (!this.instance.HasProperty("Name")) this.instance.addProperty(new Property("Name", DataType.String), "Accessory")
    }

    created(): void {
        this.instance.AncestryChanged.Connect(() => {
            this.AccessoryBuildWeld()
        })
    }

    AccessoryBuildWeld() {
        if (this.instance.parent && this.instance.className === "Accessory") { //create accessory weld TODO: making the part0/C0 and part1/C1 accurate (0 = hat, 1 = body) would be good, probably
            const humanoid = this.instance.parent.FindFirstChildOfClass("Humanoid")

            if (humanoid) {
                const handle = this.instance.FindFirstChild("Handle")
                if (handle) {
                    let accessoryAttachment = null
                    let bodyAttachment = null

                    for (const child of handle.GetChildren()) {
                        if (child.className === "Attachment") {
                            const bodyDescendants: Instance[] = this.instance.parent.GetDescendants()
                            for (const bodyChild of bodyDescendants) {
                                if (bodyChild.className === "Attachment" && child && bodyChild.Property("Name") === child.Property("Name") && bodyChild.parent && bodyChild.parent.parent === this.instance.parent) {
                                    bodyAttachment = bodyChild
                                    accessoryAttachment = child
                                    break
                                }
                            }
                        }
                    }

                    if (!bodyAttachment) {
                        return
                    }
                    if (!accessoryAttachment) {
                        return
                    }

                    const oldAccessoryWeld = handle.FindFirstChild("AccessoryWeld")
                    if (oldAccessoryWeld) {
                        oldAccessoryWeld.Destroy()
                    }

                    const weld = new Instance("Weld")

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
                }
            }
        }
    }
}