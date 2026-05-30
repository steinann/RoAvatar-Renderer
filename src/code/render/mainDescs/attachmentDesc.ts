import * as THREE from "three"
import { RenderDesc, setTHREEObjectCF } from "../renderDesc";
import { CFrame, Instance } from "../../rblx/rbx";
import { AttachmentWrapper } from "../../rblx/instance/Attachment";
import { FLAGS } from "../../misc/flags";

const attachmentGeometry = new THREE.SphereGeometry(0.125, 16, 8)

export class AttachmentDesc extends RenderDesc {
    static classTypes: string[] = ["Attachment"]

    visible: boolean = false

    cframe: CFrame = new CFrame()

    isSame(other: AttachmentDesc): boolean {
        return this.visible === other.visible &&
                this.cframe.isSame(other.cframe)
    }

    needsRegeneration(other: AttachmentDesc): boolean {
        return this.visible !== other.visible
    }

    virtualFromRenderDesc(other: AttachmentDesc) {
        this.cframe = other.cframe.clone()
    }

    fromInstance(child: Instance) {
        const attachmentW = new AttachmentWrapper(child)
        this.cframe = attachmentW.getWorldCFrame()

        this.visible = child.PropOrDefault("Visible", this.visible) as boolean || FLAGS.ALWAYS_SHOW_ATTACHMENTS
    }

    async compileResults(): Promise<THREE.Object3D[]> {
        this.results = []

        if (this.visible) {
            const mesh = new THREE.Mesh(attachmentGeometry, new THREE.MeshLambertMaterial({color: 0x00ff00}))
            mesh.name = this.instance ? this.instance.PropOrDefault("Name", "Unknown") as string + "_Att" : "Unknown_Att"
            this.results.push(mesh)
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
    }
}