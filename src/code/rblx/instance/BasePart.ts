import { FLAGS } from "../../misc/flags";
import { Assembly, getRootAssemblyPart_Generate, type AssemblyNode } from "../assembly";
import { DataType } from "../constant";
import { CFrame, Instance, Property, Vector3 } from "../rbx";
import { InstanceWrapper } from "./InstanceWrapper";

class BasePartWrapperData {
    assemblyNode?: AssemblyNode
}

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
        "_data"
    ]

    setup() {
        //generic
        if (!this.instance.HasProperty("Name")) this.instance.addProperty(new Property("Name", DataType.String), this.instance.className)

        //specific
        if (!this.instance.HasProperty("CFrame")) this.instance.addProperty(new Property("CFrame", DataType.CFrame), new CFrame())
        if (!this.instance.HasProperty("size")) this.instance.addProperty(new Property("size", DataType.Vector3), new Vector3())
        if (!this.instance.HasProperty("Transparency")) this.instance.addProperty(new Property("Transparency", DataType.Float32), 0)

        if (!this.instance.HasProperty("_data")) this.instance.addProperty(new Property("_data", DataType.NonSerializable), new BasePartWrapperData())
    }

    get data() {
        return this.instance.Prop("_data") as BasePartWrapperData
    }

    created() {
        const destroyAssembly = () => {
            if (this.data.assemblyNode) {
                this.data.assemblyNode.assembly.destroy()
            }
        }

        this.instance.referencedByChanged.Connect(destroyAssembly)
        this.instance.AncestryChanged.Connect(destroyAssembly)
        this.instance.ChildRemoved.Connect(destroyAssembly)
        this.instance.Destroying.Connect(destroyAssembly)
    }

    preRender(): void {
        if (FLAGS.USE_ASSEMBLY) {
            const assemblyNode = this.GetAssemblyNode()
            if (assemblyNode.depth === 0) {
                assemblyNode.assembly.traverseTree()
            }
        }
    }

    GetAssemblyNode(): AssemblyNode {
        if (this.data.assemblyNode) return this.data.assemblyNode

        const rootPart = getRootAssemblyPart_Generate(this.instance)
        new Assembly(rootPart)
        return this.data.assemblyNode!
    }

    GetAssembly(): Assembly {
        return this.GetAssemblyNode().assembly
    }

    GetConnectors(): Instance[] {
        const connectors: Instance[] = []

        const references = this.instance.getReferencedBy()
        for (const reference of references) {
            if (reference.IsA("JointInstance")) {
                connectors.push(reference)
            }
        }

        return connectors
    }

    GetConnectedParts(): Instance[] {
        const connected: Instance[] = []

        const references = this.instance.getReferencedBy()
        for (const reference of references) {
            if (reference.IsA("JointInstance")) {
                const part0 = reference.Prop("Part0") as Instance | undefined
                const part1 = reference.Prop("Part1") as Instance | undefined

                if (part0 && part0 !== this.instance && part0.IsA("BasePart")) connected.push(part0)
                if (part1 && part1 !== this.instance && part1.IsA("BasePart")) connected.push(part1)
            }
        }

        return connected
    }
}