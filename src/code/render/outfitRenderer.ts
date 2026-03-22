/**
 * This is a file that only exists to reduce boilerplate
 */
import * as THREE from 'three';
import { API, type Authentication } from "../api"
import type { AvatarType } from "../avatar/constant"
import type { Outfit } from "../avatar/outfit"
import { HumanoidDescriptionWrapper } from "../rblx/instance/HumanoidDescription"
import { Instance, RBX, Vector3 } from "../rblx/rbx"
import { RBXRenderer } from "./renderer"
import { AnimatorWrapper } from '../rblx/instance/Animator';

export class OutfitRenderer {
    auth: Authentication
    outfit: Outfit
    currentRig?: Instance /**Instance for the Model of the current outfit */
    currentRigType: AvatarType
    rigPath: string
    doCameraUpdateOnLoad: boolean = true /**Makes camera update when new avatar has loaded */
    doCameraUpdate: boolean = false /**Does camera update every frame */

    currentlyChangingRig: boolean = false
    currentlyUpdating: boolean = false
    hasNewUpdate: boolean = false

    lastFrameTime: number = Date.now() / 100
    animationInterval?: NodeJS.Timeout

    /**
     * Creates a new OutfitRenderer which makes it easy to render outfits
     * @param auth The authentication object, you should have one you use for everything
     * @param outfit The outfit you want to render, it can be updated later by calling setOutfit()
     * @param rigPath The path that contains RigR6.rbxm and RigR15.rbxm, for example "../assets/"
     */
    constructor(auth: Authentication, outfit: Outfit, rigPath: string) {
        this.auth = auth
        this.outfit = outfit
        this.currentRigType = outfit.playerAvatarType
        this.rigPath = rigPath
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
                API.Asset.GetRBX(`${this.rigPath}Rig${this.currentRigType}.rbxm`, undefined).then(result => {
                    if (result instanceof RBX) {
                        const newRig = result.generateTree().GetChildren()[0]

                        this.currentRig = newRig
                        this.currentlyChangingRig = false
                        RBXRenderer.addInstance(this.currentRig, this.auth)

                        resolve(newRig)
                    } else {
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
                        this.currentlyUpdating = false

                        //add rig to renderer and center camera
                        if (this.currentRig) {
                            RBXRenderer.addInstance(this.currentRig, this.auth)
                            if (this.doCameraUpdateOnLoad) {
                                this.centerCamera()
                            }
                        }
                        //update again if outfit was set during load
                        if (result instanceof Instance) {
                            if (this.hasNewUpdate) {
                                this.hasNewUpdate = false
                                this._updateOutfit()
                            }
                        } else { //if failed
                            //mark it as dirty so next is full apply!
                            const oldHumanoidDescription = humanoid.FindFirstChildOfClass("HumanoidDescription")
                            oldHumanoidDescription?.Destroy()
                        }
                    })
                } else {
                    this.currentlyUpdating = false
                }
            } else {
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
     * Centers camera on avatar
     */
    centerCamera() {
        if (this.currentRig) {
            const upperTorso = this.currentRig.FindFirstChild("HumanoidRootPart")
            if (upperTorso) {
                const controls = RBXRenderer.getRendererControls()
                const camera = RBXRenderer.getRendererCamera()

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

        this.lastFrameTime = Date.now() / 100

        this.animationInterval = setInterval(() => {
            //update camera position
            if (this.currentRig && this.doCameraUpdate) {
                this.centerCamera()
            }

            //update animation and instance renderables
            if (this.currentRig && this.auth) {
                const humanoid = this.currentRig.FindFirstChildOfClass("Humanoid")
                if (humanoid) {
                    const animator = humanoid.FindFirstChildOfClass("Animator")
                    if (animator) {
                        const deltaTime = Date.now() / 1000 - this.lastFrameTime
                        this.lastFrameTime = Date.now() / 1000

                        const animatorW = new AnimatorWrapper(animator)
                        animatorW.renderAnimation(deltaTime)
                        
                        this.currentRig.preRender()

                        RBXRenderer.addInstance(this.currentRig, this.auth)
                    }
                }
            }
        }, 1000 / 60)
    }

    /**
     * Stops updating the animation of the outfit per frame
     */
    stopAnimating() {
        if (this.animationInterval) {
            clearInterval(this.animationInterval)
        }
    }

    /**
     * Sets the current animation being played
     * @param name The name of the animation, for example "idle", "run" or "emote.1234"
     */
    setMainAnimation(name: string) {
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
                        animatorW.loadAvatarAnimation(emoteId, true, true).then(() => {
                            animatorW.playAnimation(name)
                        })
                    }

                    //mood animation
                    if (this.outfit.containsAssetType("MoodAnimation") && !name.startsWith("emote.")) {
                        animatorW.playAnimation("mood", "mood")
                    } else {
                        animatorW.stopMoodAnimation()
                    }
                }
            }
        }
    }
}