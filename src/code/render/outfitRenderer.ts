/**
 * This is a file that only exists to reduce boilerplate
 */
import * as THREE from 'three';
import { API, type Authentication } from "../api"
import { AvatarType } from "../avatar/constant"
import { Outfit } from "../avatar/outfit"
import { HumanoidDescriptionWrapper } from "../rblx/instance/HumanoidDescription"
import { Instance, RBX, Vector3, Event, Connection } from "../rblx/rbx"
import { RBXRenderer, RBXRendererScene } from "./renderer"
import { AnimatorWrapper } from '../rblx/instance/Animator';
import { EmitterGroupDesc } from './mainDescs/emitterGroupDesc';
import { BackgroundRenderer } from './backgroundRenderer';
import { OutfitModel } from '../avatar/outfitModel';

export type OutfitRendererErrorType = "rig" | "humanoidDescription"

/**
 * @category Renderer
 * @example
 * **Example on usage**
 * ```ts
 * const auth = new Authentication()
 * const outfit = new Outfit()
 * const renderScene = RBXRenderer.addScene()
 * 
 * const outfitRenderer = new OutfitRenderer(auth, outfit, renderScene)
 * outfitRenderer.startAnimating()
 * outfitRenderer.setMainAnimation("id.1234") //animation with id 1234, check documentation for other possible values
 * 
 * outfitRenderer.onRenderSuccess.Connect(() => {
 *     //handle Instance tree + renderDesc being successfuly
 * })
 * outfitRenderer.onError.Connect(() => {
 *     //handle Instance tree error
 * })
 * outfitRenderer.onRenderError.Connect(() => {
 *     //handle renderDesc error
 * })
 * 
 * //onRenderSuccess is fired once after some time
 * 
 * outfitRenderer.setOutfit(new Outfit())
 * 
 * //onRenderSuccess is fired again once after some time
 * 
 * //when we're done rendering
 * outfitRenderer.destroy()
 * renderScene.destroy()
 * ```
 */
export class OutfitRenderer {
    auth: Authentication
    outfitModel?: OutfitModel
    outfit: Outfit
    currentRig?: Instance /**Instance for the Model of the current outfit */
    currentRigType: AvatarType
    doCameraUpdateOnLoad: boolean = true /**Makes camera update when new avatar has loaded */
    doCameraUpdate: boolean = false /**Does camera update every frame */
    doAddInstance: boolean = true /**If outfitRenderer should call RBXRenderer.addInstance(), setting this to false will make OutfitRenderer return success early */
    forceAnimationLoop: boolean = true /**If future loaded animations should be set to loop */

    backgroundRenderer: BackgroundRenderer

    currentlyChangingRig: boolean = false
    currentlyUpdating: boolean = false
    hasNewUpdate: boolean = false
    private _queuedMainAnimation: string | undefined

    lastFrameTime: number = Date.now() / 1000
    animationInterval?: NodeJS.Timeout
    animationFPS: number = 60
    deltaTimeMultiplier: number = 1

    renderScene: RBXRendererScene = RBXRenderer.firstScene
    private _renderSceneCompiledConnection?: Connection
    private _renderSceneFailedConnection?: Connection

    hasFiredFullyRendered: boolean = false

    /**Event is fired if a new outfit failed to load (specifically the Instance tree, not the rendering part)
     * 
     * Simple: Fired when, Instance tree = fail
     * @returns OutfitRendererErrorType
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
     * 
     * NOTE: If FLAGS.LAYERED_CLOTHING_COOLDOWN > 0 (non-default), this may be fired too early and later fire again
     * @returns void
     */
    onRenderSuccess: Event = new Event()
    /**Event is fired if a renderDesc fails to compile, it can be fired multiple times
     * 
     * Simple: Fired when, Rendering = fail
     * @returns void
     */
    onRenderError: Event = new Event()

    get humanoid(): Instance | undefined {
        return this.currentRig?.FindFirstChildOfClass("Humanoid") as Instance | undefined
    }

    get animator(): Instance | undefined {
        return this.humanoid?.FindFirstChildOfClass("Animator") as Instance | undefined
    }

    get animatorW(): AnimatorWrapper | undefined {
        const animator = this.animator
        if (animator) return new AnimatorWrapper(animator)
    }

    /**
     * Creates a new OutfitRenderer which makes it easy to render outfits
     * @param auth The authentication object, you should have one you use for everything
     * @param outfit The outfit you want to render, it can be updated later by calling setOutfit()
     * @param renderScene The scene the outfit should be rendered in
     */
    constructor(auth: Authentication, outfit: Outfit | OutfitModel, renderScene: RBXRendererScene = RBXRenderer.firstScene) {
        this.auth = auth
        if (outfit instanceof OutfitModel) {
            this.outfitModel = outfit
        }
        this.outfit = outfit instanceof Outfit ? outfit : outfit.outfit
        this.currentRigType = this.outfit.playerAvatarType
        this.renderScene = renderScene
        this._renderSceneCompiledConnection = this.renderScene.compiledRenderDesc.Connect(() => {
            this.fireFullyRenderedIfNeeded()
        })
        this._renderSceneFailedConnection = this.renderScene.failedRenderDesc.Connect(() => {
            this.onRenderError.Fire()
        })

        this.backgroundRenderer = new BackgroundRenderer(auth, this.outfitModel?.background?.id, renderScene)

        this._updateOutfit()
    }

    /**
     * Updates the current rig, called internally by _updateOutfit()
     */
    _setRigTo(newRigType: AvatarType) {
        return new Promise<Instance | Response>((resolve) => {
            if (!this.currentlyChangingRig) {
                this.currentlyChangingRig = true

                ///destroy old rig
                if (this.currentRig) {
                    this.currentRig.Destroy()
                    this.currentRig = undefined
                }
                this.currentRigType = newRigType

                //gets rig
                API.Asset.GetRBX(`roavatar://Rig${this.currentRigType}.rbxm`, undefined).then(result => {
                    if (result instanceof RBX) {
                        const dataModel = result.generateTree()
                        const newRig = dataModel.GetChildren()[0]
                        newRig.setParent(undefined)
                        dataModel.Destroy()

                        this.currentRig = newRig
                        this.currentlyChangingRig = false
                        if (this.doAddInstance) RBXRenderer.addInstance(this.currentRig, this.auth, this.renderScene)

                        resolve(newRig)
                    } else {
                        this.onError.Fire("rig")
                        resolve(result)
                    }
                })
            }
        })
    }

    /**
     * Rerenders the current outfit, called internally by setOutfit() and constructor
     */
    _updateOutfit() {
        if (this.currentlyUpdating) {
            this.hasNewUpdate = true
            return
        }

        this.currentlyUpdating = true
        this.hasFiredFullyRendered = false

        //update rig
        const newRigType: AvatarType = this.outfit.playerAvatarType

        const promises: Promise<unknown | Response>[] = []
        if (newRigType !== this.currentRigType || !this.currentRig) {
            promises.push(this._setRigTo(newRigType))
        }

        Promise.all(promises).then(() => {
            //create humanoid description
            const hrp = new Instance("HumanoidDescription")
            const hrpWrapper = new HumanoidDescriptionWrapper(hrp)
            hrpWrapper.fromOutfit(this.outfit)
            
            if (this.currentRig) {
                //get humanoid
                const humanoid = this.currentRig.FindFirstChildOfClass("Humanoid")
                if (humanoid) {
                    //apply description
                    hrpWrapper.applyDescription(humanoid).then((result) => {
                        if (this._queuedMainAnimation) {
                            this.setMainAnimation(this._queuedMainAnimation)
                            this._queuedMainAnimation = undefined
                        }
                        this.currentlyUpdating = false

                        //add rig to renderer and center camera
                        if (this.currentRig) {
                            if (this.doAddInstance) {
                                RBXRenderer.addInstance(this.currentRig, this.auth, this.renderScene)
                                this.fireFullyRenderedIfNeeded()
                            }
                            if (this.doCameraUpdateOnLoad) {
                                this.centerCamera()
                            }
                        }
                        //update again if outfit was set during load
                        if (result instanceof Instance) {
                            this.onSuccess.Fire()

                            if (this.hasNewUpdate) {
                                this.hasNewUpdate = false
                                this._updateOutfit()
                            }
                        } else { //if failed
                            //mark it as dirty so next is full apply!
                            const oldHumanoidDescription = humanoid.FindFirstChildOfClass("HumanoidDescription")
                            oldHumanoidDescription?.Destroy()
                            this.onError.Fire("humanoidDescription")
                        }
                    })
                } else {
                    this.onError.Fire("rig")
                    this.currentlyUpdating = false
                }
            } else {
                this.onError.Fire("rig")
                this.currentlyUpdating = false
            }
        })
    }
    
    /**
     * Updates the current outfit being rendered
     */
    setOutfit(outfit: Outfit) {
        this.outfit = outfit
        this._updateOutfit()
    }

    /**
     * Updates the current outfitModel being rendered
     */
    setOutfitModel(outfitModel: OutfitModel) {
        this.outfitModel = outfitModel
        this.setOutfit(outfitModel.outfit)
        if (this.backgroundRenderer.backgroundId !== outfitModel.background?.id) {
            this.hasFiredFullyRendered = false
            this.backgroundRenderer.setBackground(outfitModel.background?.id)
        }
    }

    /**
     * Centers camera on avatar
     */
    centerCamera() {
        if (this.currentRig) {
            const upperTorso = this.currentRig.FindFirstChild("HumanoidRootPart")
            if (upperTorso) {
                const controls = this.renderScene.controls
                const camera = this.renderScene.camera

                const pos = upperTorso.Prop("Position") as Vector3

                if (controls) {
                    const offset = new THREE.Vector3().subVectors(camera.position, controls.target)

                    controls.target.set(pos.X, pos.Y + 0.5, pos.Z)
                    camera.position.set(pos.X + offset.x, pos.Y + 0.5 + offset.y, pos.Z + offset.z)
                    controls.update()
                }
            }
        }
    }

    /**
     * Starts updating the animation of the outfit per frame
     */
    startAnimating() {
        if (this.animationInterval !== undefined) return

        this.lastFrameTime = Date.now() / 1000

        this.animationInterval = setInterval(() => {
            //update camera position
            if (this.currentRig && this.doCameraUpdate) {
                this.centerCamera()
            }

            //update animation and instance renderables
            this.animateOnce()
        }, 1000 / this.animationFPS)
    }

    /**
     * Updates the animation once
     */
    animateOnce(deltaTimeOverride?: number) {
        if (this.currentRig && this.auth) {
            const humanoid = this.currentRig.FindFirstChildOfClass("Humanoid")
            if (humanoid) {
                const animator = humanoid.FindFirstChildOfClass("Animator")
                if (animator) {
                    const deltaTime = deltaTimeOverride !== undefined ? deltaTimeOverride : (Date.now() / 1000 - this.lastFrameTime) * this.deltaTimeMultiplier
                    this.lastFrameTime = Date.now() / 1000

                    const animatorW = new AnimatorWrapper(animator)
                    animatorW.renderAnimation(deltaTime)
                    
                    this.currentRig.preRender()

                    if (this.doAddInstance) RBXRenderer.addInstance(this.currentRig, this.auth, this.renderScene)
                }
            }
        }

        this.backgroundRenderer.animateOnce()
    }

    /**
     * Stops updating the animation of the outfit per frame
     */
    stopAnimating() {
        if (this.animationInterval) {
            clearInterval(this.animationInterval)
            this.animationInterval = undefined
        }
    }

    /**
     * Checks if the provided animation set is loaded
     * @param name The name of the animation, for example "idle", "run", but NOT "emote.1234" or "id.1234" as they are not in the animation set
     * @returns If the animation is loaded
     */
    hasAnimationSetAnimation(name: string): boolean {
        if (this.currentRig) {
            const humanoid = this.currentRig.FindFirstChildOfClass("Humanoid")
            if (humanoid) {
                const animator = humanoid.FindFirstChildOfClass("Animator")
                if (animator) {
                    const animatorW = new AnimatorWrapper(animator)
                    const entries = animatorW.data.animationSet[name]
                    if (entries) {
                        return entries.length > 0
                    }
                }
            }
        }

        return false
    }

    /**
     * Sets the current animation being played
     * @param name The name of the animation, for example "idle", "run", "emote.1234" or "id.1234"
     * @returns If the animation started playing, it may start playing later if it has been queued despite returning false
     */
    setMainAnimation(name: string): Promise<boolean> {
        return new Promise((resolve) => {
            if (this.currentRig) {
                const humanoid = this.currentRig.FindFirstChildOfClass("Humanoid")
                if (humanoid) {
                    const animator = humanoid.FindFirstChildOfClass("Animator")
                    if (animator) {
                        const animatorW = new AnimatorWrapper(animator)

                        //main animation
                        const successfullyPlayed = animatorW.playAnimation(name)
                        if (!successfullyPlayed && name.startsWith("emote.") && name) {
                            const emoteId = BigInt(name.split(".")[1])
                            animatorW.loadAvatarAnimation(emoteId, true, this.forceAnimationLoop).then(() => {
                                resolve(animatorW.playAnimation(name))
                            })
                        } else if (!successfullyPlayed && name.startsWith("id.") && name) {
                            const animId = BigInt(name.split(".")[1])
                            animatorW.loadAnimation(animId, this.forceAnimationLoop).then(() => {
                                resolve(animatorW.playAnimation(name))
                            })
                        } else {
                            resolve(false)
                        }
                    } else {
                        resolve(false)
                    }
                } else {
                    resolve(false)
                }
            } else {
                this._queuedMainAnimation = name
                resolve(false)
            }
        })
    }

    fireFullyRenderedIfNeeded() {
        if (!this.currentlyChangingRig && !this.currentlyUpdating && !this.hasNewUpdate && this.currentRig
            && this.renderScene.areInstancesCompiled(this.currentRig.GetDescendants())
            && this.backgroundRenderer.hasFiredFullyRendered
            && !this.hasFiredFullyRendered
        ) {
                this.onRenderSuccess.Fire()
                this.hasFiredFullyRendered = true
            }
        }

        /**
         * Prepares the OutfitRenderer to be used for a thumbnail, call IMMEDIATELY after creating the OutfitRenderer
         * @returns true on success
         */
        async prepareForThumbnail(): Promise<boolean> {
            const connections: Connection[] = []

            const result = await Promise.race([
                this._prepareForThumbnail(),
                new Promise<false>((resolve) => {
                    connections.push(this.onError.Connect(() => {
                        resolve(false)
                    }))
                }),
                new Promise<false>((resolve) => {
                    connections.push(this.onRenderError.Connect(() => {
                        resolve(false)
                    }))
                }),
        ])

        for (const connection of connections) {
            connection.Disconnect()
        }

        return result
    }

    private async _prepareForThumbnail(): Promise<true> {
        this.doAddInstance = false //done so that we dont do unneccesary calls + particles appear in right place instead of rest pose
        this.backgroundRenderer.affectSceneAppearance = false
        this.backgroundRenderer.cameraAffectsTransparency = false

        //make sure R6 idle animation doesnt progress
        if (this.outfit.playerAvatarType === AvatarType.R6) this.deltaTimeMultiplier = 0

        //wait for avatar to have the correct animation
        await new Promise((resolve) => {
            this.onSuccess.Connect(() => {
                //set animation transition to 0 so animations are at full instantly and first frame isnt at a low weight
                const animatorW = this.animatorW
                if (animatorW) {
                    animatorW.data.forceTransitionTime = 0
                }

                //regular animation
                if (!this.outfit.containsAssetType("Gear")) {
                    if (this.outfit.playerAvatarType === AvatarType.R15) { //r15
                        if (this.hasAnimationSetAnimation("pose")) {
                            //has pose
                            this.setMainAnimation("pose").then(() => { resolve(undefined) })
                        } else {
                            //no pose, default to idle
                            this.setMainAnimation("idle").then(() => { resolve(undefined) })
                        }
                    } else { //r6
                        this.setMainAnimation("idle").then(() => { resolve(undefined) })
                    }
                //gear animation
                } else {
                    this.setMainAnimation("toolnone").then(() => { resolve(undefined) })
                }
            })
        })

        //animate once (so animation pose is rendered)
        this.animateOnce(0)

        //animate into halfway if we have an idle animation
        if (!this.outfit.playerAvatarType === AvatarType.R6 && this.animatorW?.data.currentAnimation === "idle") this.animateOnce((this.animatorW?.data.currentAnimationTrack?.length || 0) / 2)

        //render instances
        if (this.currentRig) RBXRenderer.addInstance(this.currentRig, this.auth, this.renderScene)
        this.hasFiredFullyRendered = false

        //wait for instances to finish rendering
        await new Promise((resolve) => {
            const connection = this.onRenderSuccess.Connect(() => {
                resolve(undefined)
                connection.Disconnect()
            })
        })

        return true
    }

    /**
     * Updates rendered particles so they face the camera without simulating them (usually used when generating thumbnails)
     */
    updateParticleMatrix() {
        if (!this.currentRig) return

        for (const instance of this.currentRig.GetDescendants()) {
            const renderDesc = this.renderScene.renderDescs.get(instance)
            if (renderDesc && renderDesc instanceof EmitterGroupDesc) {
                renderDesc.updateResults(0)
            }
        }
    }

    /**Calls destroy on the rig, stops animating and disconnects connections. The OutfitRenderer should not be interacted with after this */
    destroy() {
        this.stopAnimating()
        if (this.currentRig) RBXRenderer.removeInstance(this.currentRig, this.renderScene)
        this.currentRig?.Destroy()
        this.currentRig = undefined
        this._renderSceneCompiledConnection?.Disconnect()
        this._renderSceneFailedConnection?.Disconnect()
        this.onError.Clear()
        this.onSuccess.Clear()
        this.onRenderError.Clear()
        this.onRenderSuccess.Clear()
        this.backgroundRenderer.destroy()
    }
}