import type { BasePartWrapper } from "./instance/BasePart";
import { CFrame, Vector3, type Instance } from "./rbx";
import { traverseRigCFrame } from "./scale";

export function getPartAssemblyScore(part: Instance) {
    let score = 0

    if (part.PropOrDefault("Name", "Part") as string === "HumanoidRootPart") {
        score += 1000000
    }

    if (part.PropOrDefault("Anchored", false) as boolean) {
        score += 100000
    }

    if (part.PropOrDefault("Massless", false) as boolean) {
        score += 10000
    }

    const size = part.PropOrDefault("Size", new Vector3(0,0,0)) as Vector3
    score += size.X * size.Y * size.X

    return score
}

export function getPartsInAssembly_Generate(part: Instance) {
    const inAssembly: Instance[] = []
    let toCheck: Instance[] = [part]

    while (toCheck.length > 0) {
        const newToCheck: Instance[] = []

        for (const part of toCheck) {
            const connected = (part.w as BasePartWrapper).GetConnectedParts()
            for (const connect of connected) {
                if (!inAssembly.includes(connect)) {
                    inAssembly.push(connect)
                    newToCheck.push(connect)
                }
            }
        }

        toCheck = newToCheck
    }
    
    return inAssembly
}

export function getRootAssemblyPart_Generate(part: Instance) {
    const parts = getPartsInAssembly_Generate(part)
    let highestScore = -1
    let highestPart = part

    for (const part of parts) {
        const score = getPartAssemblyScore(part)
        if (score > highestScore) {
            highestScore = score
            highestPart = part
        }
    }

    return highestPart
}

export class AssemblyNode {
    depth: number
    nodes: AssemblyNode[] = []

    part: Instance
    children: Instance[] = []
    connectors: Instance[] = []

    parent: AssemblyNode | Assembly
    assembly: Assembly

    constructor(assembly: Assembly, parent: AssemblyNode | Assembly, depth: number, part: Instance, already: Instance[] = []) {
        this.assembly = assembly
        this.parent = parent
        this.depth = depth
        this.part = part
        
        if (part.IsA("BasePart")) {
            const w = part.w as BasePartWrapper
            w.data.assemblyNode = this
        }

        const connected = (part.w as BasePartWrapper).GetConnectedParts()
        for (const connect of connected) {
            if (!already.includes(connect)) {
                this.children.push(connect)
            }
        }

        const jointConnectors = (part.w as BasePartWrapper).GetConnectors()
        this.connectors = jointConnectors
    }

    getNodeChildren() {
        return this.nodes
    }

    getNodeDescendants(): AssemblyNode[] {
        let descendants = [...this.getNodeChildren()]

        for (const child of this.getNodeChildren()) {
            descendants = descendants.concat(child.getNodeDescendants())
        }

        return descendants
    }

    /**
     * Should only be called when destroying entire assembly by calling Assembly.destroy()
     */
    destroy() {
        if (this.part.IsA("BasePart")) {
            const w = this.part.w as BasePartWrapper
            w.data.assemblyNode = undefined
        }
    }
}

export class Assembly {
    rootNode: AssemblyNode

    allNodes: AssemblyNode[] | undefined
    allConnectors: Instance[] | undefined

    constructor(rootPart: Instance) {
        const checked: Instance[] = [rootPart]

        let depth = 0
        this.rootNode = new AssemblyNode(this, this, 0, rootPart, checked)
        let toCheckNodes: AssemblyNode[] = [this.rootNode]

        while (toCheckNodes.length > 0) {
            depth += 1
            const newToCheckNodes: AssemblyNode[] = []

            for (const toCheck of toCheckNodes) {
                for (const child of toCheck.children) {
                    const childNode = new AssemblyNode(this, toCheck, depth, child, checked)
                    checked.push(child)
                    newToCheckNodes.push(childNode)
                    toCheck.nodes.push(childNode)
                }
            }

            toCheckNodes = newToCheckNodes
        }
    }

    getNodeDescendants(): AssemblyNode[] {
        if (!this.allNodes) {
            this.allNodes = [this.rootNode, ...this.rootNode.getNodeDescendants()]
        }

        return this.allNodes
    }

    getPartDescendants(): Instance[] {
        return this.getNodeDescendants().map((v) => {return v.part})
    }

    getAllConnectors(): Instance[] {
        if (!this.allConnectors) {
            this.allConnectors = []

            for (const node of this.getNodeDescendants()) {
                this.allConnectors.push(...node.connectors)
            }
        }

        return this.allConnectors
    }

    getNode(name: string): AssemblyNode | undefined {
        for (const node of this.getNodeDescendants()) {
            if (node.part.Prop("Name") === name) {
                return node
            }
        }
    }

    getPart(name: string): Instance | undefined {
        return this.getNode(name)?.part
    }

    traverseCFrame(node: AssemblyNode, includeTransform: boolean, applyRoot: boolean = false): CFrame {
        return traverseRigCFrame(node.part, includeTransform, applyRoot)
    }

    destroy() {
        const descendants = this.getNodeDescendants()
        for (const descendant of descendants) {
            descendant.destroy()
        }
    }
}