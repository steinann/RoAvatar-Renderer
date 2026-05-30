import * as THREE from "three"
import { RenderDesc, setTHREEObjectCF } from "../renderDesc";
import { CFrame, Color3, Instance } from "../../rblx/rbx";
import { NormalId } from "../../rblx/constant";
import { rad } from "../../misc/misc";
import { AttachmentWrapper } from "../../rblx/instance/Attachment";

export type LightType = "point" | "spot" | "surface"

function disposeLight(scene: THREE.Scene, light: THREE.Light) {
    if (light.shadow && light.shadow.map) {
        light.shadow.map.dispose()
    }
    scene.remove(light)
}

export class LightDesc extends RenderDesc {
    static classTypes: string[] = ["PointLight", "SpotLight", "SurfaceLight"]

    enabled: boolean = true

    cframe: CFrame = new CFrame()
    shadows: boolean = false
    color: Color3 = new Color3(1,1,1)
    brightness: number = 1
    range: number = 8

    lightType: LightType = "point"

    //spot and face only
    angle: number = 90
    face: number = NormalId.Front

    isSame(other: LightDesc): boolean {
        return this.enabled === other.enabled &&
                this.shadows === other.shadows &&
                this.color.isSame(other.color) &&
                this.brightness === other.brightness &&
                this.range === other.range &&
                this.lightType === other.lightType &&
                this.angle === other.angle &&
                this.face === other.face &&
                this.cframe.isSame(other.cframe)
    }

    needsRegeneration(other: LightDesc): boolean {
        return this.lightType !== other.lightType
    }

    virtualFromRenderDesc(other: LightDesc) {
        this.enabled = other.enabled
        this.shadows = other.shadows
        this.color = other.color.clone()
        this.brightness = other.brightness
        this.range = other.range
        this.angle = other.angle
        this.face = other.face
        this.cframe = other.cframe.clone()
    }

    fromInstance(child: Instance) {
        switch (child.className) {
            case "PointLight":
                this.lightType = "point"
                break
            case "SpotLight":
                this.lightType = "spot"
                break
            case "SurfaceLight":
                this.lightType = "surface"
                break
        }

        if (child.parent) {
            if (child.parent.className === "Attachment") {
                const attachmentW = new AttachmentWrapper(child.parent)
                this.cframe = attachmentW.getWorldCFrame()
            } else {
                this.cframe = (child.parent.PropOrDefault("CFrame", this.cframe) as CFrame).clone()
            }
        }

        this.enabled = child.PropOrDefault("Enabled", this.enabled) as boolean
        //this.shadows = child.PropOrDefault("Shadows", this.shadows) as boolean
        this.color = child.PropOrDefault("Color", this.color) as Color3
        this.brightness = child.PropOrDefault("Brightness", this.brightness) as number
        this.range = child.PropOrDefault("Range", this.range) as number
        this.angle = child.PropOrDefault("Angle", this.angle) as number
        this.face = child.PropOrDefault("Face", this.face) as number
    }

    async compileResults(_renderer: THREE.WebGLRenderer, scene: THREE.Scene): Promise<THREE.Object3D[] | Response | undefined> {
        if (this.results) {
            for (const light of this.results) {
                disposeLight(scene, light as THREE.Light)
            }
        }

        this.results = []

        switch (this.lightType) {
            case "point":
            {
                const pointLight = new THREE.PointLight()
                pointLight.name = this.instance?.PropOrDefault("Name", undefined) as string | undefined || this.instance?.className || "Light"
                //const pointLightHelper = new THREE.PointLightHelper(pointLight)
                this.results.push(pointLight/*, pointLightHelper*/)
                break
            }
            case "spot":
            case "surface": //three js has nothing equivalent :()
            {
                const spotLight = new THREE.SpotLight()
                spotLight.add(spotLight.target)
                spotLight.name = this.instance?.PropOrDefault("Name", undefined) as string | undefined || this.instance?.className || "Light"
                this.results.push(spotLight)
                break
            }
        }

        this.updateResults()

        return this.results
    }

    updateResults() {
        if (!this.results) return
        for (const light of this.results) {
            if (light instanceof THREE.PointLight || light instanceof THREE.SpotLight) {
                light.decay = 0.4
                light.visible = this.enabled
                light.intensity = this.brightness
                light.distance = this.range + 0.5
                light.castShadow = this.shadows
                light.shadow.intensity = 0.5
                light.color = new THREE.Color().setRGB(this.color.R, this.color.G, this.color.B)

                const resultCF = this.cframe
                const targetCF = new CFrame()

                if (light instanceof THREE.SpotLight) {
                    light.angle = rad(this.angle)
                    switch (this.face) {
                        case NormalId.Front:
                            targetCF.Position = [0,0,-1]
                            break
                        case NormalId.Back:
                            targetCF.Position = [0,0,1]
                            break
                        case NormalId.Right:
                            targetCF.Position = [1,0,0]
                            break
                        case NormalId.Left:
                            targetCF.Position = [-1,0,0]
                            break
                        case NormalId.Top:
                            targetCF.Position = [0,1,0]
                            break
                        case NormalId.Bottom:
                            targetCF.Position = [0,-1,0]
                            break
                    }

                    light.target.position.set(...targetCF.Position)
                }

                setTHREEObjectCF(light, resultCF)
            }
        }
    }
    
    dispose(_renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
        if (this.results) {
            for (const result of this.results) {
                disposeLight(scene, result as THREE.Light)
            }
        }
    }
}