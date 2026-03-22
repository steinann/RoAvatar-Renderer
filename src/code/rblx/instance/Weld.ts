import { FLAGS } from "../../misc/flags"
import { DataType } from "../constant"
import { CFrame, Connection, Instance, Property } from "../rbx"
import { traverseRigCFrame } from "../scale"
import { InstanceWrapper } from "./InstanceWrapper"

class WeldWrapperData {
    part0ChangedConnection?: Connection
    lastUpdateTime: number = 0
    timeUpdates: number = 0
}

export class WeldWrapper extends InstanceWrapper {
    static className: string = "Weld"
    static requiredProperties: string[] = [
        "Name",
        "Enabled",
        "Part0",
        "Part1",
        "C0",
        "C1",
        "_data",
    ]

    setup() {
        //generic
        if (!this.instance.HasProperty("Name")) this.instance.addProperty(new Property("Name", DataType.String), this.instance.className)

        //specific
        if (!this.instance.HasProperty("Enabled")) this.instance.addProperty(new Property("Enabled", DataType.Bool), true)
        if (!this.instance.HasProperty("Part0")) this.instance.addProperty(new Property("Part0", DataType.Referent), undefined)
        if (!this.instance.HasProperty("Part1")) this.instance.addProperty(new Property("Part1", DataType.Referent), undefined)
        if (!this.instance.HasProperty("C0")) this.instance.addProperty(new Property("C0", DataType.CFrame), new CFrame())
        if (!this.instance.HasProperty("C1")) this.instance.addProperty(new Property("C1", DataType.CFrame), new CFrame())

        if (!this.instance.HasProperty("_data")) this.instance.addProperty(new Property("_data", DataType.NonSerializable), new WeldWrapperData())
    }

    get data() {
        return this.instance.Prop("_data") as WeldWrapperData
    }

    created(): void {
        //add connections
        if (FLAGS.LEGACY_WELD_BEHAVIOR) {
            const changedConnection = this.instance.Changed.Connect(() => {
                this.update()
            })
            const ancestryChangedConnection = this.instance.AncestryChanged.Connect(() => {
                this.update()
            })
            this.instance.addConnectionReference(changedConnection)
            this.instance.addConnectionReference(ancestryChangedConnection)
        }
    }

    preRender(): void {
        if (FLAGS.LEGACY_WELD_BEHAVIOR) return

        const part0 = this.instance.Prop("Part0") as Instance | undefined
        const part1 = this.instance.Prop("Part1") as Instance | undefined
        if (part0 && part1 && part1.HasProperty("CFrame") && part0 !== part1) {
            part1.setProperty("CFrame", traverseRigCFrame(this.instance, true, true))
        }
    }

    update(affectedPart = 1) { //TODO: part1 is not always the part that should be affected, but its difficult to fix without creating an infinite loop
        if (!this.instance.parent) return

        if (this.data.lastUpdateTime === Date.now()) {
            this.data.timeUpdates += 1
            if (this.data.timeUpdates > 100) {
                console.error(this.instance)
                console.error(`${this.instance.className} is exhausted`)
                return
            }
        } else {
            this.data.timeUpdates = 0
        }
        this.data.lastUpdateTime = Date.now()

        //variables/properties
        const part0: Instance | undefined = this.instance.Prop("Part0") as Instance | undefined
        if (part0) {
            if (this.data.part0ChangedConnection) {
                this.data.part0ChangedConnection.Disconnect()
                this.instance.removeConnectionReference(this.data.part0ChangedConnection)
            }
        }

        const part1 = this.instance.Prop("Part1") as Instance | undefined

        const C0 = this.instance.Prop("C0") as CFrame
        const C1 = this.instance.Prop("C1") as CFrame

        const transform = this.instance.PropOrDefault("Transform", new CFrame()) as CFrame

        if (part0 === part1 || !part0 || !part1) {
            return
        }

        //actual calculation
        if (this.instance.HasProperty("Enabled") && this.instance.Prop("Enabled")) {
            if (this.instance.parent) {
                    if (affectedPart === 1) {
                        if (part0.HasProperty("CFrame") && part1.HasProperty("CFrame")) {
                            const part0Cf = part0.Property("CFrame") as CFrame

                            const offset1 = C1.multiply(transform).inverse()
                            const finalCF = part0Cf.multiply(C0).multiply(offset1)

                            //update part1 position
                            part1.setProperty("CFrame", finalCF)
                        } 
                    }
            } else {
                console.warn("Motor6D/Weld is missing parent")
            }
        }

        if (part0) {
            this.data.part0ChangedConnection = part0.Changed.Connect((propertyName) => {
                if (propertyName === "CFrame") {
                    this.update(1)
                }
            })
            this.instance.addConnectionReference(this.data.part0ChangedConnection)
        }
    }
}