import * as THREE from "three"
import { getTexture, RenderDesc, setTHREEObjectCF } from "../renderDesc";
import { TextureMode } from "../../rblx/constant";
import { CFrame, Color3, ColorSequence, Content, Instance, NumberSequence, NumberSequenceKeypoint } from "../../rblx/rbx";
import type { AttachmentWrapper } from "../../rblx/instance/Attachment";
import { lerp, specialClamp } from "../../misc/misc";
import { FLAGS } from "../../misc/flags";
import { lerpCFrame } from "../../rblx/animation";
import { multiply } from "../../mesh/mesh-deform";
import { beam_fragmentShader, beam_vertexShader } from "../shaders/beamShader";

export class BeamDesc extends RenderDesc {
    static classTypes: string[] = ["Beam"]

    lastTime: number = Date.now() / 1000
    time: number = Date.now() / 1000
    passedLength: number = 0

    enabled: boolean = true
    
    lightEmission: number = 0 //blends between normal -> additive blending
    lightInfluence: number = 1

    texture: string | undefined
    textureLength: number = 1
    textureMode: number = TextureMode.Stretch //static behaves identically to wrap
    textureSpeed: number = 1

    brightness: number = 1
    color: ColorSequence = ColorSequence.fromColor(new Color3(1,1,1))
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
                this.color.isSame(newDesc.color) &&
                this.transparency.isSame(newDesc.transparency) &&
                this.zOffset === newDesc.zOffset &&
                this.cframe0.isSame(newDesc.cframe0) &&
                this.cframe1.isSame(newDesc.cframe1) &&
                this.curveSize0 === newDesc.curveSize0 &&
                this.curveSize1 === newDesc.curveSize1 &&
                this.width0 === newDesc.width0 &&
                this.width1 === newDesc.width1 &&
                this.faceCamera === newDesc.faceCamera &&
                this.segments === newDesc.segments &&
                this.brightness === newDesc.brightness
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
        this.brightness = newDesc.brightness
        this.color = newDesc.color.clone()
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

    virtualTransferFrom(oldDesc: BeamDesc): void {
        //things that should be transferred after recompilation should be here (for example individual particles in emitters)
        this.passedLength = oldDesc.passedLength
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

        this.brightness = child.PropOrDefault("Brightness", this.brightness) as number
        this.color = child.PropOrDefault("Color", this.color) as ColorSequence
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
                if (textureResult) {
                    textureResult.wrapT = THREE.RepeatWrapping
                }
            }

            if (!textureResult) {
                textureResult = new THREE.DataTexture(new Uint8Array([255,255,255,255]), 1, 1, THREE.RGBAFormat)
                textureResult.colorSpace = THREE.SRGBColorSpace
                textureResult.needsUpdate = true
            }

            /*const material = new THREE.MeshBasicMaterial({
                side: THREE.DoubleSide,
                map: textureResult,
                vertexColors: true,
                transparent: true,
                depthWrite: false,
            })*/
            const material = new THREE.ShaderMaterial({
                side: THREE.DoubleSide,
                vertexColors: true,
                transparent: true,
                depthWrite: false,
                lights: true,
                premultipliedAlpha: true,
                toneMapped: true,

                blending: THREE.CustomBlending,
                
                blendSrc: THREE.OneFactor,
                blendDst: THREE.OneMinusSrcAlphaFactor,
                blendEquation: THREE.AddEquation,
                
                blendSrcAlpha: THREE.OneMinusDstAlphaFactor,
                blendDstAlpha: THREE.OneFactor,
                blendEquationAlpha: THREE.AddEquation,

                vertexShader: beam_vertexShader,
                fragmentShader: beam_fragmentShader,

                uniforms: THREE.UniformsUtils.merge([
                THREE.UniformsLib.lights,    
                {
                    uMap: { value: textureResult },

                    uLightInfluence: { value: this.lightInfluence },
                    uLightEmission: { value: this.lightEmission },
                    uBrightness: { value: this.brightness },
                }
            ]),
            })

            const geometry = new THREE.PlaneGeometry(1,1,this.segments,1)

            const colorValues = new Float32Array((this.segments + 1) * 2 * 4).fill(0)
            geometry.setAttribute("color", new THREE.BufferAttribute(colorValues, 4))

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
        const deltaTime = this.time - this.lastTime
        this.passedLength += deltaTime * this.textureSpeed

        const camera = this.renderScene.camera
        const toCamera = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion)

        const v0 = new THREE.Vector3(...this.cframe0.Position)
        const v1 = new THREE.Vector3(...this.cframe0.multiply(new CFrame(this.curveSize0, 0, 0)).Position)
        const v2 = new THREE.Vector3(...this.cframe1.multiply(new CFrame(-this.curveSize1, 0, 0)).Position)
        const v3 = new THREE.Vector3(...this.cframe1.Position)

        const curve = new THREE.CubicBezierCurve3(v0, v1, v2, v3)
        const curveLength = curve.getLength()

        for (const result of this.results) {
            const resultMaterial = (result as THREE.Mesh).material as THREE.ShaderMaterial

            if (resultMaterial) {
                resultMaterial.uniforms.uLightInfluence.value = this.lightInfluence
                resultMaterial.uniforms.uLightEmission.value = this.lightEmission
                resultMaterial.uniforms.uBrightness.value = this.brightness
                resultMaterial.needsUpdate = true
            }

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
                const prevPos = curve.getPointAt(prevT)
                const nextPos = curve.getPointAt(nextT)

                let finalMatrix = undefined

                if (!this.faceCamera) {
                    const vZ = new THREE.Vector3().subVectors(nextPos, prevPos).normalize()
                    let vY = new THREE.Vector3(...lerpCFrame(this.cframe0, this.cframe1, t).upVector())
                    const vX = new THREE.Vector3().crossVectors(vZ, vY)
                    vY = new THREE.Vector3().crossVectors(vZ, vX)

                    const rotation = new THREE.Matrix4().set(
                        vX.x, vY.x, vZ.x, 0,
                        vX.y, vY.y, vZ.y, 0,
                        vX.z, vY.z, vZ.z, 0,
                        0, 0, 0, 1
                    )
                    finalMatrix = new THREE.Matrix4().makeTranslation(prevPos).multiply(rotation)
                } else {
                    const vZ = new THREE.Vector3().subVectors(nextPos, prevPos).normalize()
                    let vX = toCamera.clone().negate().normalize()
                    const vY = new THREE.Vector3().crossVectors(vZ, vX).normalize()
                    vX = new THREE.Vector3().crossVectors(vY, vZ).normalize()

                    const rotation = new THREE.Matrix4().set(
                        vX.x, vY.x, vZ.x, 0,
                        vX.y, vY.y, vZ.y, 0,
                        vX.z, vY.z, vZ.z, 0,
                        0, 0, 0, 1
                    )
                    finalMatrix = new THREE.Matrix4().makeTranslation(prevPos).multiply(rotation)
                }

                const lookCF = new CFrame().fromMatrix(finalMatrix.toArray())
                const sideCF = lookCF.multiply(new CFrame(0, side, 0))

                positions.setXYZ(i, ...sideCF.Position)
            }

            const colors = resultGeometry.getAttribute("color")
            for (let i = 0; i < colors.count; i++) {
                const t = i % (colors.count / 2) / (colors.count / 2 - 1)

                const color = (this.color.getValue(t)).clone()
                const transparencyValue = this.transparency.getValue(t, 0)

                let srgbColor = new THREE.Color()
                srgbColor.set(color.R, color.G, color.B)
                srgbColor = srgbColor.convertSRGBToLinear()
        
                color.R = srgbColor.r
                color.G = srgbColor.g
                color.B = srgbColor.b

                colors.setXYZW(i, color.R, color.G, color.B, 1 - transparencyValue)
            }

            const uvs = resultGeometry.getAttribute("uv")
            if (this.textureMode === TextureMode.Stretch) {
                for (let i = 0; i < uvs.count; i++) {
                    const t = i % (colors.count / 2) / (colors.count / 2 - 1)
                    const normSide = i < positions.count / 2 ? 1 : 0

                    uvs.setXY(i, normSide, (1 - t + this.passedLength) * this.textureLength)
                }
            } else {
                for (let i = 0; i < uvs.count; i++) {
                    const t = i % (colors.count / 2) / (colors.count / 2 - 1)
                    const normSide = i < positions.count / 2 ? 1 : 0

                    uvs.setXY(i, normSide, (1 - t + this.passedLength / curveLength) * curveLength / this.textureLength)
                }
            }

            positions.needsUpdate = true
            colors.needsUpdate = true
            uvs.needsUpdate = true

            const resultCF = new CFrame()
            resultCF.Position = multiply(toCamera.clone().negate().normalize().toArray(), [this.zOffset, this.zOffset, this.zOffset])
            //const resultCF = this.cframe0
            setTHREEObjectCF(result, resultCF)
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