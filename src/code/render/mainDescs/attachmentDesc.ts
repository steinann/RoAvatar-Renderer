import * as THREE from "three"
import { RenderDesc, setTHREEObjectCF } from "../renderDesc";
import { CFrame, Instance } from "../../rblx/rbx";
import { AttachmentWrapper } from "../../rblx/instance/Attachment";
import { FLAGS } from "../../misc/flags";

const attachmentGeometry = new THREE.SphereGeometry(0.125, 16, 8)
const boneGeometry = new THREE.ConeGeometry(0.125, 0.125 * 2, 16, 8)

export class AttachmentDesc extends RenderDesc {
    static classTypes: string[] = ["Attachment", "Bone"]

    visible: boolean = false

    cframe: CFrame = new CFrame()

    isBone: boolean = false

    isSame(other: AttachmentDesc): boolean {
        return this.visible === other.visible &&
                this.cframe.isSame(other.cframe) &&
                this.isBone === other.isBone
    }

    needsRegeneration(newDesc: AttachmentDesc): boolean {
        return this.visible !== newDesc.visible ||
                this.isBone !== newDesc.isBone
    }

    virtualFromRenderDesc(other: AttachmentDesc) {
        this.cframe = other.cframe.clone()
    }

    fromInstance(child: Instance) {
        const attachmentW = child.w as AttachmentWrapper
        this.cframe = attachmentW.getWorldCFrame()

        this.visible = child.PropOrDefault("Visible", this.visible) as boolean || FLAGS.ALWAYS_SHOW_ATTACHMENTS

        if (child.IsA("Bone")) this.isBone = true
    }

    async compileResults(): Promise<THREE.Object3D[]> {
        this.results = []

        if (this.visible) {
            const material = new THREE.MeshLambertMaterial({color: this.isBone ? 0x0000ee : 0x00ee00})
            this.toDispose.push(material)

            const material2 = new THREE.MeshLambertMaterial({color: this.isBone ? 0x0000ee : 0x00ee00, transparent: true, opacity: 0.35, depthTest: false})
            this.toDispose.push(material2)

            const mesh = new THREE.Mesh(this.isBone ? boneGeometry : attachmentGeometry, material)
            mesh.name = this.instance ? this.instance.PropOrDefault("Name", "Unknown") as string + "_Att" : "Unknown_Att"

            const mesh2 = new THREE.Mesh(this.isBone ? boneGeometry : attachmentGeometry, material2)
            mesh2.name = this.instance ? this.instance.PropOrDefault("Name", "Unknown") as string + "_Att" : "Unknown_Att"

            if (this.isBone) {
                mesh.scale.set(0.7,1,0.7)
                mesh2.scale.set(0.7,1,0.7)
            }

            this.results.push(mesh)
            this.results.push(mesh2)
        }

        this.updateResults()

        return this.results
    }

    updateResults() {
        if (!this.results) return
        for (const attachment of this.results) {
            const resultCF = this.cframe
            setTHREEObjectCF(attachment, resultCF)
        }
    }
    
    dispose(_renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
        if (!this.results) return
        for (const result of this.results) {
            scene.remove(result)
        }

        this.clearToDispose()
    }
}