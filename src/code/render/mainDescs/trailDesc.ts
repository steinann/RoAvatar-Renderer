import * as THREE from "three"
import { getTexture, RenderDesc } from "../renderDesc";
import { TextureMode } from "../../rblx/constant";
import { CFrame, Color3, ColorSequence, Content, Instance, NumberSequence, NumberSequenceKeypoint } from "../../rblx/rbx";
import type { AttachmentWrapper } from "../../rblx/instance/Attachment";
import { FLAGS } from "../../misc/flags";
import { lerpCFrame } from "../../rblx/animation";
import { add, distance } from "../../mesh/mesh-deform";
import { specialClamp } from "../../misc/misc";
import type { Vec3 } from "../../mesh/mesh";
import { beam_fragmentShader, beam_vertexShader } from "../shaders/beamShader";

class TrailSegment {
    cframe: CFrame
    length: number
    time: number = 0

    constructor(cf: CFrame, length: number) {
        this.cframe = cf
        this.length = length
    }
}

export class TrailDesc extends RenderDesc {
    static classTypes: string[] = ["Trail"]

    lastTime: number = Date.now() / 1000
    time: number = Date.now() / 1000
    segmentTime: number = 0

    enabled: boolean = true
    
    lightEmission: number = 0 //blends between normal -> additive blending
    lightInfluence: number = 1

    texture: string | undefined
    textureLength: number = 1
    textureMode: number = TextureMode.Stretch

    brightness: number = 1
    color: ColorSequence = ColorSequence.fromColor(new Color3(1,1,1))
    transparency: NumberSequence = new NumberSequence([new NumberSequenceKeypoint(0, 0.5), new NumberSequenceKeypoint(1, 0.5)])
    widthScale: NumberSequence = new NumberSequence([new NumberSequenceKeypoint(0, 1), new NumberSequenceKeypoint(1, 1)])

    cframe0: CFrame = new CFrame()
    cframe1: CFrame = new CFrame()

    lifetime: number = 1
    maxLength: number = 0
    minLength: number = 0.1

    faceCamera: boolean = false

    //results
    results?: THREE.Object3D[] = []
    segments: TrailSegment[] = []

    get maxSegments() {
        const maxLength = this.maxLength === 0 ? 9999 : this.maxLength

        return Math.ceil(Math.min(this.lifetime * FLAGS.TRAIL_FPS, maxLength / this.minLength)) + 2
    }

    isSame(newDesc: TrailDesc): boolean {
        return this.time === newDesc.time &&
                this.enabled === newDesc.enabled &&
                this.lightEmission === newDesc.lightEmission &&
                this.lightInfluence === newDesc.lightInfluence &&
                this.texture === newDesc.texture &&
                this.textureLength === newDesc.textureLength &&
                this.textureMode === newDesc.textureMode &&
                this.color.isSame(newDesc.color) &&
                this.transparency.isSame(newDesc.transparency) &&
                this.widthScale.isSame(newDesc.widthScale) &&
                this.cframe0.isSame(newDesc.cframe0) &&
                this.cframe1.isSame(newDesc.cframe1) &&
                this.faceCamera === newDesc.faceCamera &&
                this.lifetime === newDesc.lifetime &&
                this.maxLength === newDesc.maxLength &&
                this.minLength === newDesc.minLength &&
                this.brightness === newDesc.brightness
    }

    needsRegeneration(newDesc: TrailDesc): boolean {
        return this.enabled !== newDesc.enabled ||
                this.texture !== newDesc.texture ||
                this.lifetime !== newDesc.lifetime
    }

    virtualFromRenderDesc(newDesc: TrailDesc) {
        //everything that doesnt require compilation should be here (except lastTime since thats data we want to keep from previous)
        this.time = newDesc.time
        this.lightEmission = newDesc.lightEmission
        this.lightInfluence = newDesc.lightInfluence
        this.textureLength = newDesc.textureLength
        this.textureMode = newDesc.textureMode
        this.brightness = newDesc.brightness
        this.color = newDesc.color.clone()
        this.transparency = newDesc.transparency.clone()
        this.widthScale = newDesc.widthScale.clone()
        this.cframe0 = newDesc.cframe0.clone()
        this.cframe1 = newDesc.cframe1.clone()
        this.lifetime = newDesc.lifetime
        this.maxLength = newDesc.maxLength
        this.minLength = newDesc.minLength
        this.faceCamera = newDesc.faceCamera
    }

    virtualTransferFrom(oldDesc: TrailDesc): void {
        //things that should be transferred after recompilation should be here (for example individual particles in emitters)
        this.segmentTime = oldDesc.segmentTime
        this.segments = oldDesc.segments
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

        this.brightness = child.PropOrDefault("Brightness", this.brightness) as number
        this.color = child.PropOrDefault("Color", this.color) as ColorSequence
        this.transparency = child.PropOrDefault("Transparency", this.transparency) as NumberSequence
        this.widthScale = child.PropOrDefault("WidthScale", this.widthScale) as NumberSequence

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
        
        this.lifetime = child.PropOrDefault("Lifetime", this.lifetime) as number
        this.maxLength = child.PropOrDefault("MaxLength", this.maxLength) as number
        this.minLength = child.PropOrDefault("MinLength", this.minLength) as number

        this.faceCamera = child.PropOrDefault("FaceCamera", this.faceCamera) as boolean

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
                textureResult = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat)
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

            const geometry = new THREE.PlaneGeometry(1,1,this.maxSegments,1)

            const colorValues = new Float32Array((this.maxSegments + 1) * 2 * 4).fill(1)
            geometry.setAttribute("color", new THREE.BufferAttribute(colorValues, 4))

            const mesh = new THREE.Mesh(geometry, material)
            mesh.frustumCulled = false
            mesh.name = this.instance ? this.instance.PropOrDefault("Name", "Unknown") as string + "_Trail" : "Unknown_Trail"
            this.results.push(mesh)
        }

        if (originalResults) {
            this.disposeMeshes(scene, originalResults as THREE.Mesh[])
            this.disposeRenderLists(renderer)
        }

        this.updateResults()

        return this.results
    }

    calculateSegmentCFrame(): CFrame {
        let newCF = lerpCFrame(this.cframe0, this.cframe1, 0.5)
        newCF = CFrame.lookAt(newCF.Position, this.cframe0.Position)
        return newCF
    }

    addSegment() {
        const newCF = this.calculateSegmentCFrame()
        const newLength = distance(this.cframe0.Position, this.cframe1.Position)

        const lastSegment = this.segments[0]
        if (lastSegment) {
            const lastSegmentDistance = distance(lastSegment.cframe.Position, newCF.Position)
            if (lastSegmentDistance <= this.minLength) {
                return
            }
        }

        const newSegment = new TrailSegment(newCF, newLength)
        newSegment.time = this.segmentTime
        this.segments.unshift(newSegment)
    }

    getSegmentCFrame(i: number) {
        if (i <= 0) {
            return this.calculateSegmentCFrame()
        } else {
            const segment = this.segments[specialClamp(i - 1, 0, this.segments.length - 1)]
            if (segment) {
                return segment.cframe
            } else {
                return this.calculateSegmentCFrame()
            }
        }
    }

    getSegmentLength(i: number) {
        if (i <= 0) {
            return distance(this.cframe0.Position, this.cframe1.Position)
        } else {
            const segment = this.segments[specialClamp(i - 1, 0, this.segments.length - 1)]
            if (segment) {
                return segment.length
            } else {
                return 0
            }
        }
    }

    getSegmentTime(i: number) {
        if (i <= 0) {
            return this.segmentTime
        } else {
            const segment = this.segments[specialClamp(i - 1, 0, this.segments.length - 1)]
            if (segment) {
                return segment.time
            } else {
                return this.segmentTime
            }
        }
    }

    updateResults() {
        if (!this.results) return
        const deltaTime = this.time - this.lastTime
        this.segmentTime += deltaTime
        const requiredSegmentTime = 1 / FLAGS.TRAIL_FPS

        //add time to segments
        for (const segment of this.segments) {
            segment.time += deltaTime
        }

        //splice away old segment
        let lastSegmentCF: CFrame | undefined = undefined
        for (let i = 0; i < this.segments.length; i++) {
            let totalLength = 0

            const segment = this.segments[i]
            if (segment.time >= this.lifetime || totalLength > this.maxLength) {
                this.segments.splice(i, this.segments.length - i)
                break
            }

            if (lastSegmentCF) {
                const diff = distance(lastSegmentCF.Position, segment.cframe.Position)
                totalLength += diff
            }

            lastSegmentCF = segment.cframe
        }

        //add new segments
        if (this.segmentTime >= requiredSegmentTime) {
            this.addSegment()
            this.segmentTime = 0
        }

        for (const result of this.results) {
            const resultMaterial = (result as THREE.Mesh).material as THREE.ShaderMaterial
            const resultGeometry = (result as THREE.Mesh).geometry

            if (resultMaterial) {
                resultMaterial.uniforms.uLightInfluence.value = this.lightInfluence
                resultMaterial.uniforms.uLightEmission.value = this.lightEmission
                resultMaterial.uniforms.uBrightness.value = this.brightness
                resultMaterial.needsUpdate = true
            }

            const positions = resultGeometry.getAttribute("position")
            //x - time (-0.5 -> 0.5)
            //y - left or right (-0.5 or 0.5)
            //z - 0
            
            for (let i = 0; i < positions.count; i++) {
                const index = Math.floor(i % (positions.count / 2))
                const segmentLength = this.getSegmentLength(index)
                const segmentCF = this.getSegmentCFrame(index)

                const normSide = i < positions.count / 2 ? 0.5 : -0.5

                const t = this.getSegmentTime(index) / this.lifetime
                const side = normSide * segmentLength * this.widthScale.getValue(t, 0) //lerp(this.width0, this.width1, t)

                const sideCF = segmentCF.multiply(new CFrame(0, 0, side))

                positions.setXYZ(i, ...sideCF.Position)
            }

            const colors = resultGeometry.getAttribute("color")
            for (let i = 0; i < colors.count; i++) {
                const index = Math.floor(i % (positions.count / 2))
                const t = this.getSegmentTime(index) / this.lifetime //i % (colors.count / 2) / (colors.count / 2 - 1)

                const colorValue = this.color.getValue(t)
                const transparencyValue = this.transparency.getValue(t, 0)

                colors.setXYZW(i, colorValue.R, colorValue.G, colorValue.B, 1 - transparencyValue)
            }

            const uvs = resultGeometry.getAttribute("uv")
            //only stretch is supported
            //if (this.textureMode === TextureMode.Stretch) {
                for (let i = 0; i < uvs.count; i++) {
                    const index = Math.floor(i % (positions.count / 2))
                    const t = index / (this.segments.length)
                    const normSide = i < positions.count / 2 ? 1 : 0

                    uvs.setXY(i, normSide, (1 - t) * this.textureLength)
                }
            //}

            positions.needsUpdate = true
            colors.needsUpdate = true
            uvs.needsUpdate = true
        }

        this.lastTime = this.time
    }

    moveLoose(vec: Vec3) {
        for (const segment of this.segments) {
            segment.cframe.Position = add(segment.cframe.Position, vec)
        }
    }
    
    dispose(_renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
        if (!this.results) return
        for (const result of this.results) {
            scene.remove(result)
        }
    }
}