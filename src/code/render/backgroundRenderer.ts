import { API, type Authentication } from "../api"
import { dot } from "../mesh/mesh-deform"
import { specialClamp } from "../misc/misc"
import { RBX, type Instance, Event, Connection, Color3, CFrame } from "../rblx/rbx"
import { RBXRenderer, type RBXRendererScene } from "./renderer"

export type BackgroundRendererErrorType = "avatarCyclorama" | "backgroundData"

/**
 * Used internally by OutfitRenderer to render backgrounds
 * @category Renderer
 */
export class BackgroundRenderer {
    auth: Authentication

    avatarCyclorama?: Instance
    backgroundData?: Instance
    backgroundId?: number
    lastLoadedBackgroundId?: number

    currentlyUpdating: boolean = false
    hasNewUpdate: boolean = false

    affectSceneAppearance: boolean = true
    cameraAffectsTransparency: boolean = true
    cameraAffectsRotation: boolean = false

    lastFrameTime: number = Date.now() / 1000
    animationInterval?: NodeJS.Timeout
    animationFPS: number = 60

    originalPartCFrames: Map<Instance, CFrame> = new Map()

    renderScene: RBXRendererScene = RBXRenderer.firstScene
    private _renderSceneCompiledConnection?: Connection
    private _renderSceneFailedConnection?: Connection

    hasFiredFullyRendered: boolean = false

    /**Event is fired if a new outfit failed to load (specifically the Instance tree, not the rendering part)
     * 
     * Simple: Fired when, Instance tree = fail
     * @returns BackgroundRendererErrorType
     */
    onError: Event = new Event()
    /**Event is fired if a new outfit successfully loaded (specifically the Instance tree, not the rendering part)
     * 
     * Simple: Fired when, Instance tree = done
     * @returns void
     */
    onSuccess: Event = new Event()
    /**Event is fired when all the renderDescs have been compiled, if any renderDescs fail to render this wil never be fired (can only be fired after Instance tree is done)
     * 
     * Simple: Fired when, Instance tree = done & Rendering = done (AKA everything)
     * @returns void
     */
    onRenderSuccess: Event = new Event()
    /**Event is fired if a renderDesc fails to compile, it can be fired multiple times
     * 
     * Simple: Fired when, Rendering = fail
     * @returns void
     */
    onRenderError: Event = new Event()

    constructor(auth: Authentication, backgroundId?: number, renderScene: RBXRendererScene = RBXRenderer.firstScene) {
        this.auth = auth
        this.renderScene = renderScene

        this._renderSceneCompiledConnection = this.renderScene.compiledRenderDesc.Connect((instance) => {
            if (this.avatarCyclorama && (instance as Instance).IsDescendantOf(this.avatarCyclorama)) {
                this.fireFullyRenderedIfNeeded()
            }
        })
        this._renderSceneFailedConnection = this.renderScene.failedRenderDesc.Connect(() => {
            this.onRenderError.Fire()
        })

        this.setBackground(backgroundId)
    }

    /**Updates background to match the set id */
    setBackground(id?: number) {
        this.backgroundId = id
        this._updateBackground()
    }

    async _updateBackground() {
        if (this.lastLoadedBackgroundId === this.backgroundId) return

        if (this.currentlyUpdating) {
            this.hasNewUpdate = true
            return
        }

        this.hasFiredFullyRendered = false

        this.currentlyUpdating = true
        this.lastLoadedBackgroundId = this.backgroundId

        if (this.backgroundId) await this._loadAvatarCyclorama()
        await this._loadBackgroundData()
        this._applyBackgroundData()

        this.currentlyUpdating = false

        if (this.hasNewUpdate) {
            this.hasNewUpdate = false
            this._updateBackground()
        }
    }

    async _loadBackgroundData() {
        if (this.backgroundId) {
            const rbx = await API.Asset.GetRBX(`rbxassetid://${this.backgroundId}`)
            if (rbx instanceof RBX) {
                const root = rbx.generateTree()
                const folder = root.GetChildren()[0]
                this.backgroundData = folder

                folder.setParent(null)
                root.Destroy()
            } else {
                this.onError.Fire("backgroundData")
            }
        } else {
            this.backgroundData?.Destroy()
            this.backgroundData = undefined
        }
    }

    async _loadAvatarCyclorama() {
        if (this.avatarCyclorama) return

        const rbx = await API.Asset.GetRBX("roavatar://AvatarCyclorama.rbxm")
        if (rbx instanceof RBX) {
            const root = rbx.generateTree()
            this.avatarCyclorama = root.GetChildren()[0]
            this.avatarCyclorama.setParent(null)

            for (const child of this.avatarCyclorama.GetChildren()) {
                if (child.IsA("BasePart")) {
                    const childCF = child.Prop("CFrame") as CFrame
                    this.originalPartCFrames.set(child, childCF)
                }
            }

            root.Destroy()
        } else {
            this.onError.Fire("avatarCyclorama")
        }
    }

    _applyBackgroundData() {
        if (this.affectSceneAppearance) {
            if (RBXRenderer.plane) {
                RBXRenderer.plane.position.set(0,-0.01,0)
            }
            if (RBXRenderer.shadowPlane) {
                RBXRenderer.shadowPlane.position.set(0,-0.01,0)
            }
        }

        if (this.avatarCyclorama && this.backgroundData) {
            const cameraDirTransparency = specialClamp((dot(RBXRenderer.getCameraCFrame(this.renderScene).lookVector(), [0,0,-1]) + 0.5) * 2, 0, 1)
            const targetTransparency = this.cameraAffectsTransparency ? cameraDirTransparency : 0

            const cyclorama = this.avatarCyclorama
            const backgroundData = this.backgroundData

            cyclorama.Child("color_mesh")!.setProperty("Transparency", targetTransparency)
            cyclorama.Child("texture_mesh")!.setProperty("Transparency", Math.max(0.05, targetTransparency))

            if (backgroundData) {
                const colorValue = backgroundData.Child("Color")
                const imageIdValue = backgroundData.Child("ImageId")

                if (colorValue && imageIdValue) {
                    const color = colorValue.Prop("Value") as Color3
                    const imageId = imageIdValue.Prop("Value") as number

                    //RBXRenderer.setBackgroundColor(new THREE.Color(color.R, color.G, color.B).convertSRGBToLinear())

                    cyclorama.Child("color_mesh")!.setProperty("Color", color.toColor3uint8())
                    cyclorama.Child("texture_mesh")!.setProperty("TextureID", `rbxassetid://${imageId}`)
                }
            } else {
                cyclorama.Child("color_mesh")!.setProperty("Transparency", 1)
                cyclorama.Child("texture_mesh")!.setProperty("Transparency", 1)
            }

            cyclorama.preRender()
            RBXRenderer.addInstance(cyclorama, this.auth, this.renderScene)
        } else if (this.avatarCyclorama) {
            RBXRenderer.removeInstance(this.avatarCyclorama, this.renderScene)
        }

        this.fireFullyRenderedIfNeeded()
    }

    _applyBackgroundRotation() {
        if (this.avatarCyclorama && this.cameraAffectsRotation) {
            const cameraCF = RBXRenderer.getCameraCFrame(this.renderScene)
            const cameraLook = cameraCF.lookVector()
            cameraLook[0] = -cameraLook[0]
            cameraLook[1] = 0
            cameraLook[2] = -cameraLook[2]
            const cameraAngle = CFrame.lookAt([0,0,0], cameraLook)
            
            for (const child of this.avatarCyclorama.GetChildren()) {
                if (child.IsA("BasePart")) {
                    const ogChildCF = this.originalPartCFrames.get(child)
                    if (ogChildCF) {
                        const newChildCF = cameraAngle.multiply(ogChildCF)
                        child.setProperty("CFrame", newChildCF)
                    }
                }
            }
        }
    }

    /**
     * Starts updating the animation of the background per frame
     */
    startAnimating() {
        if (this.animationInterval !== undefined) return

        this.lastFrameTime = Date.now() / 1000

        this.animationInterval = setInterval(() => {
            //update animation and instance renderables
            this.animateOnce()
        }, 1000 / this.animationFPS)
    }

    /**
     * Updates the animation once
     */
    animateOnce() {
        this._applyBackgroundRotation()
        this._applyBackgroundData()
    }

    /**
     * Stops updating the animation of the background per frame
     */
    stopAnimating() {
        if (this.animationInterval) {
            clearInterval(this.animationInterval)
            this.animationInterval = undefined
        }
    }

    fireFullyRenderedIfNeeded() {
        if (this.hasFiredFullyRendered) return

        if (!this.currentlyUpdating && !this.hasNewUpdate) {
            if (!this.avatarCyclorama || (this.avatarCyclorama && this.renderScene.areInstancesCompiled(this.avatarCyclorama.GetDescendants()))) {
                this.onRenderSuccess.Fire()
                this.hasFiredFullyRendered = true
            }
        }
    }

    /**Calls destroy on the background, stops animating and disconnects connections. The OutfitRenderer should not be interacted with after this */
    destroy() {
        this.stopAnimating()
        if (this.avatarCyclorama) RBXRenderer.removeInstance(this.avatarCyclorama, this.renderScene)
        this.avatarCyclorama?.Destroy()
        this.avatarCyclorama = undefined
        this.backgroundData?.Destroy()
        this.backgroundData = undefined
        this._renderSceneCompiledConnection?.Disconnect()
        this._renderSceneFailedConnection?.Disconnect()
        this.onError.Clear()
        this.onSuccess.Clear()
        this.onRenderError.Clear()
        this.onRenderSuccess.Clear()
    }
}