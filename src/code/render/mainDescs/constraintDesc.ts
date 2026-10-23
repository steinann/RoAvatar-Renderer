import * as THREE from "three"
import { RenderDesc } from "../renderDesc";
import { CFrame, Instance } from "../../rblx/rbx";
import { AttachmentWrapper } from "../../rblx/instance/Attachment";
import { FLAGS } from "../../misc/flags";

export class ConstraintDesc extends RenderDesc {
    static classTypes: string[] = ["AnimationConstraint", "RigidConstraint"]

    visible: boolean = false

    att0CF: CFrame = new CFrame()
    att1CF: CFrame = new CFrame()

    isSame(other: ConstraintDesc): boolean {
        return this.visible === other.visible &&
                this.att0CF.isSame(other.att0CF) &&
                this.att1CF.isSame(other.att1CF)
    }

    needsRegeneration(newDesc: ConstraintDesc): boolean {
        return this.visible !== newDesc.visible
    }

    virtualFromRenderDesc(other: ConstraintDesc) {
        this.att0CF = other.att0CF.clone()
        this.att1CF = other.att1CF.clone()
    }

    fromInstance(child: Instance) {
        const att0 = child.PropOrDefault("Attachment0", undefined) as Instance | undefined
        const att1 = child.PropOrDefault("Attachment1", undefined) as Instance | undefined

        if (att0 && att0.IsA("Attachment")) {
            this.att0CF = (att0.w as AttachmentWrapper).getWorldCFrame(true)
        }

        if (att1 && att1.IsA("Attachment")) {
            this.att1CF = (att1.w as AttachmentWrapper).getWorldCFrame(true)
        }

        this.visible = child.PropOrDefault("Visible", this.visible) as boolean || FLAGS.ALWAYS_SHOW_ATTACHMENTS
    }

    async compileResults(): Promise<THREE.Object3D[]> {
        this.results = []

        if (this.visible) {
            const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
            this.toDispose.push(lineGeometry)

            const material = new THREE.LineBasicMaterial({color: 0x4444ff, depthTest: false, transparent: true, opacity: 1})
            this.toDispose.push(material)

            const mesh = new THREE.Line(lineGeometry, material)
            mesh.name = this.instance ? this.instance.PropOrDefault("Name", "Unknown") as string + "_Att" : "Unknown_Att"
            this.results.push(mesh)
        }

        this.updateResults()

        return this.results
    }

    updateResults() {
        if (!this.results) return

        for (const result of this.results) {
            const resultGeometry = (result as THREE.Mesh).geometry

            const positions = resultGeometry.getAttribute("position")

            positions.setXYZ(0, ...this.att0CF.Position)
            positions.setXYZ(1, ...this.att1CF.Position)

            positions.needsUpdate = true
        }
    }
    
    dispose(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
        if (!this.results) return

        for (const result of this.results) {
            scene.remove(result)
        }

        this.clearToDispose()
        this.disposeRenderLists(renderer)
    }
}