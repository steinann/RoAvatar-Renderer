import * as THREE from "three"
import { getTexture, RenderDesc } from "../renderDesc";
import { TextureMode } from "../../rblx/constant";
import { CFrame, Content, Instance, NumberSequence, NumberSequenceKeypoint } from "../../rblx/rbx";
import type { AttachmentWrapper } from "../../rblx/instance/Attachment";
import { lerp, specialClamp } from "../../misc/misc";
import { FLAGS } from "../../misc/flags";

export class BeamDesc extends RenderDesc {
    static classTypes: string[] = ["Beam"]

    lastTime: number = Date.now() / 1000
    time: number = Date.now() / 1000

    enabled: boolean = true
    
    lightEmission: number = 0 //blends between normal -> additive blending, how?? graphics magic
    lightInfluence: number = 1

    texture: string | undefined
    textureLength: number = 1
    textureMode: number = TextureMode.Stretch //static behaves identically to wrap
    textureSpeed: number = 1

    transparency: NumberSequence = new NumberSequence([new NumberSequenceKeypoint(0, 0.5), new NumberSequenceKeypoint(1, 0.5)])
    zOffset: number = 0 //this moves its world position based on camera direction

    cframe0: CFrame = new CFrame()
    cframe1: CFrame = new CFrame()
    curveSize0: number = 0
    curveSize1: number = 1
    width0: number = 1
    width1: number = 1

    faceCamera: boolean = false
    segments: number = 10

    //results
    results?: THREE.Object3D[] = []

    isSame(newDesc: BeamDesc): boolean {
        return this.time === newDesc.time &&
                this.enabled === newDesc.enabled &&
                this.lightEmission === newDesc.lightEmission &&
                this.lightInfluence === newDesc.lightInfluence &&
                this.texture === newDesc.texture &&
                this.textureLength === newDesc.textureLength &&
                this.textureMode === newDesc.textureMode &&
                this.textureSpeed === newDesc.textureSpeed &&
                this.transparency.isSame(newDesc.transparency) &&
                this.zOffset === newDesc.zOffset &&
                this.cframe0.isSame(newDesc.cframe0) &&
                this.cframe1.isSame(newDesc.cframe1) &&
                this.curveSize0 === newDesc.curveSize0 &&
                this.curveSize1 === newDesc.curveSize1 &&
                this.width0 === newDesc.width0 &&
                this.width1 === newDesc.width1 &&
                this.faceCamera === newDesc.faceCamera &&
                this.segments === newDesc.segments
    }

    needsRegeneration(newDesc: BeamDesc): boolean {
        return this.enabled !== newDesc.enabled ||
                this.texture !== newDesc.texture ||
                this.segments !== newDesc.segments
    }

    virtualFromRenderDesc(newDesc: BeamDesc) {
        //everything that doesnt require compilation should be here (except lastTime since thats data we want to keep from previous)
        this.time = newDesc.time
        this.lightEmission = newDesc.lightEmission
        this.lightInfluence = newDesc.lightInfluence
        this.textureLength = newDesc.textureLength
        this.textureMode = newDesc.textureMode
        this.textureSpeed = newDesc.textureSpeed
        this.transparency = newDesc.transparency.clone()
        this.zOffset = newDesc.zOffset
        this.cframe0 = newDesc.cframe0.clone()
        this.cframe1 = newDesc.cframe1.clone()
        this.curveSize0 = newDesc.curveSize0
        this.curveSize1 = newDesc.curveSize1
        this.width0 = newDesc.width0
        this.width1 = newDesc.width1
        this.faceCamera = newDesc.faceCamera
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    virtualTransferFrom(_oldDesc: BeamDesc): void {
        //things that should be transferred after recompilation should be here (for example individual particles in emitters)
    }

    fromInstance(child: Instance) {
        this.enabled = child.PropOrDefault("Enabled", this.enabled) as boolean
        
        this.lightEmission = child.PropOrDefault("LightEmission", this.lightEmission) as number
        this.lightInfluence = child.PropOrDefault("LightInfluence", this.lightInfluence) as number

        this.texture = child.PropOrDefault("Texture", this.texture) as string | undefined
        if (!this.texture) {
            const textureContent = child.PropOrDefault("TextureContent", undefined) as Content | undefined
            if (textureContent) {
                this.texture = textureContent.uri
            }
        }
        this.textureLength = child.PropOrDefault("TextureLength", this.textureLength) as number
        this.textureMode = child.PropOrDefault("TextureMode", this.textureMode) as number
        this.textureSpeed = child.PropOrDefault("TextureSpeed", this.textureSpeed) as number

        this.transparency = child.PropOrDefault("Transparency", this.transparency) as NumberSequence
        this.zOffset = child.PropOrDefault("ZOffset", this.zOffset) as number

        const att0 = child.PropOrDefault("Attachment0", undefined) as Instance | undefined
        if (att0 && att0.IsA("Attachment")) {
            const att0W = att0.w as AttachmentWrapper
            this.cframe0 = att0W.getWorldCFrame()
        }
        const att1 = child.PropOrDefault("Attachment1", undefined) as Instance | undefined
        if (att1 && att1.IsA("Attachment")) {
            const att1W = att1.w as AttachmentWrapper
            this.cframe1 = att1W.getWorldCFrame()
        }
        this.curveSize0 = child.PropOrDefault("CurveSize0", this.curveSize0) as number
        this.curveSize1 = child.PropOrDefault("CurveSize1", this.curveSize1) as number
        this.width0 = child.PropOrDefault("Width0", this.width0) as number
        this.width1 = child.PropOrDefault("Width1", this.width1) as number
        
        this.faceCamera = child.PropOrDefault("FaceCamera", this.faceCamera) as boolean
        this.segments = child.PropOrDefault("Segments", this.segments) as number

        if (!FLAGS.BEAMS_ENABLED) this.enabled = false
    }

    async compileResults(renderer: THREE.WebGLRenderer, scene: THREE.Scene): Promise<THREE.Object3D[]> {
        const originalResults = this.results

        this.results = []
        if (this.enabled) {
            let textureResult = undefined
            if (this.texture) {
                textureResult = await getTexture(this.texture)
            }

            const material = new THREE.MeshBasicMaterial({
                side: THREE.DoubleSide,
                map: textureResult,
            })

            const geometry = new THREE.PlaneGeometry(1,1,this.segments,1)

            const mesh = new THREE.Mesh(geometry, material)
            mesh.name = this.instance ? this.instance.PropOrDefault("Name", "Unknown") as string + "_Beam" : "Unknown_Beam"
            this.results.push(mesh)
        }

        if (originalResults) {
            this.disposeMeshes(scene, originalResults as THREE.Mesh[])
            this.disposeRenderLists(renderer)
        }

        this.updateResults()

        return this.results
    }

    updateResults() {
        if (!this.results) return
        const v0 = new THREE.Vector3(...this.cframe0.Position)
        const v1 = new THREE.Vector3(...this.cframe0.multiply(new CFrame(0, Math.max(this.curveSize0,0.001), 0)).Position)
        const v2 = new THREE.Vector3(...this.cframe1.Position)
        const v3 = new THREE.Vector3(...this.cframe1.multiply(new CFrame(0, Math.max(this.curveSize1,0.001), 0)).Position)

        const curve = new THREE.CubicBezierCurve3(v0, v1, v2, v3)

        for (const result of this.results) {
            const resultGeometry = (result as THREE.Mesh).geometry
            const positions = resultGeometry.getAttribute("position")
            //x - time (-0.5 -> 0.5)
            //y - left or right (-0.5 or 0.5)
            //z - 0
            
            for (let i = 0; i < positions.count; i++) {
                const normSide = i < positions.count / 2 ? 0.5 : -0.5

                const t = i % (positions.count / 2) / (positions.count / 2 - 1)
                const side = normSide * lerp(this.width0, this.width1, t)

                const prevT = specialClamp(t - 0.001, 0, 1)
                const nextT = specialClamp(prevT + 0.001, 0, 1)
                const prevPos = curve.getPoint(prevT)
                const nextPos = curve.getPoint(nextT)
                const lookCF = CFrame.lookAt(prevPos.toArray(), nextPos.toArray())
                const sideCF = lookCF.multiply(new CFrame(0, side, 0))

                positions.setXYZ(i, ...sideCF.Position)
            }

            //const resultCF = this.cframe0
            //setTHREEObjectCF(result, resultCF)
        }

        this.lastTime = this.time
    }
    
    dispose(_renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
        if (!this.results) return
        for (const result of this.results) {
            scene.remove(result)
        }
    }
}