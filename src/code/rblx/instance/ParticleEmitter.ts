import { EmitterGroupDesc } from "../../render/mainDescs/emitterGroupDesc"
import { RBXRenderer } from "../../render/renderer"
import { DataType } from "../constant"
import { Property } from "../rbx"
import { InstanceWrapper } from "./InstanceWrapper"

/**
 * @category InstanceWrapper
 */
export class ParticleEmitterWrapper extends InstanceWrapper {
    static className: string = "ParticleEmitter"
    static requiredProperties: string[] = [
        "Name",
    ]

    setup() {
        //generic
        if (!this.instance.HasProperty("Name")) this.instance.addProperty(new Property("Name", DataType.String), this.instance.className)
    }

    Emit(count: number = 16) {
        const renderDescs = RBXRenderer.getRenderDescs(this.instance)

        for (const renderDesc of renderDescs) {
            if (renderDesc instanceof EmitterGroupDesc) {
                for (const emitterDesc of renderDesc.emitterDescs) {
                    for (let i = 0; i < count; i++) {
                        emitterDesc.emit(renderDesc, true)
                    }
                }
            }
        }
    }
}