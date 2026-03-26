import { API } from "../../api";
import { getRandomBetweenInclusive } from "../../misc/misc";
import { AnimationTrack } from "../animation";
import { DataType, FaceControlNames, type AnimationSet, type AnimationSetEntry } from "../constant";
import { CFrame, Connection, Instance, Property, RBX } from "../rbx";
import { InstanceWrapper } from "./InstanceWrapper";

class AnimatorWrapperData {
    animationSet: AnimationSet = {}
    emotes = new Map<bigint,AnimationSetEntry>()

    animationTracks = new Map<bigint,AnimationTrack>()

    currentAnimation?: string = "idle"
    currentAnimationTrack?: AnimationTrack

    currentToolAnimation?: string
    currentToolAnimationTrack?: AnimationTrack

    currentMoodAnimation?: string = "mood"
    currentMoodAnimationTrack?: AnimationTrack
    
    moodTracks: AnimationTrack[] = []
    toolTracks: AnimationTrack[] = []

    toolAddedConnection?: Connection
    toolRemovedConnection?: Connection
}


export class AnimatorWrapper extends InstanceWrapper {
    static className: string = "Animator"
    static requiredProperties: string[] = ["Name", "_data", "_HasLoadedAnimation"]

    setup() {
        if (!this.instance.HasProperty("Name")) this.instance.addProperty(new Property("Name", DataType.String), "Animator")

        if (!this.instance.HasProperty("_data")) this.instance.addProperty(new Property("_data", DataType.NonSerializable), new AnimatorWrapperData())
        if (!this.instance.HasProperty("_HasLoadedAnimation")) this.instance.addProperty(new Property("_HasLoadedAnimation", DataType.NonSerializable), false)
    }

    created(): void {
        if (this.instance.parent) {
            this.updateToolConnections()
        }
        const ancestryChangedConnection = this.instance.AncestryChanged.Connect(() => {
            this.updateToolConnections()
        })

        const destroyingConection = this.instance.Destroying.Connect(() => {
            ancestryChangedConnection.Disconnect()
            destroyingConection.Disconnect()
        })
    }

    get data() {
        return this.instance.Prop("_data") as AnimatorWrapperData
    }

    updateToolAnimation(rig: Instance) {
        if (rig.FindFirstChildOfClass("Tool")) {
            this._switchToolAnimation("toolnone")
        } else {
            this.stopToolAnimation()
        }
    }

    updateToolConnections(): void {
        this.data.toolAddedConnection?.Disconnect()
        this.data.toolRemovedConnection?.Disconnect()
        this.data.toolAddedConnection = undefined
        this.data.toolRemovedConnection = undefined

        const humanoid = this.instance.parent
        const rig = humanoid?.parent

        console.log(humanoid, rig)
        if (humanoid && rig) {
            this.data.toolAddedConnection = rig.ChildAdded.Connect(() => {this.updateToolAnimation(rig)})
            this.data.toolRemovedConnection = rig.ChildRemoved.Connect(() => {this.updateToolAnimation(rig)})
        }
    }

    _pickRandom(entries: AnimationSetEntry[]) {
        let totalWeight = 0
        for (const entry of entries) {
            totalWeight += entry.weight
        }

        if (totalWeight > 0) {
            let accumulatedWeight = 0
            const weight = getRandomBetweenInclusive(1, totalWeight)
            for (const entry of entries) {
                accumulatedWeight += entry.weight
                if (accumulatedWeight >= weight) {
                    return entry
                }
            }
        }

        return entries[0]
    }

    _getTrack(id: string) {
        const realId = BigInt(API.Misc.idFromStr(id))
        return this.data.animationTracks.get(realId)
    }

    _switchAnimation(name: string) {
        let transitionTime = 0.2
        if (name === this.data.currentAnimation) {
            transitionTime = 0.15
        }

        this.data.currentAnimation = name

        //get appropriate track
        let toPlayTrack: AnimationTrack | undefined = undefined

        if (!name.startsWith("emote.")) {
            const entries = this.data.animationSet[name]
            if (entries && entries.length > 0) {
                const entry = this._pickRandom(entries)
                if (entry) {
                    toPlayTrack = this._getTrack(entry.id)
                }
            }
        } else {
            const emoteId = BigInt(name.split(".")[1])
            const entry = this.data.emotes.get(emoteId)
            if (entry) {
                toPlayTrack = this._getTrack(entry.id)
            }
        }

        //if oldTrack !== newTrack
        if (toPlayTrack !== this.data.currentAnimationTrack) {
            //if new track
            if (toPlayTrack) {
                //stop old track
                if (this.data.currentAnimationTrack) {
                    this.data.currentAnimationTrack.Stop(transitionTime)
                }

                this.data.currentAnimationTrack = undefined

                //play new track
                this.data.currentAnimationTrack = toPlayTrack
                toPlayTrack.Play(transitionTime)
            }
        }

        return !!toPlayTrack
    }

    stopMoodAnimation() {
        if (this.data.currentMoodAnimationTrack) {
            this.data.currentMoodAnimationTrack.Stop()
        }
        this.data.currentMoodAnimationTrack = undefined
        this.data.currentMoodAnimation = undefined
    }

    _switchMoodAnimation(name: string) {
        let transitionTime = 0.2
        if (name === this.data.currentMoodAnimation) {
            transitionTime = 0.15
        }

        this.data.currentMoodAnimation = name

        //get appropriate track
        let toPlayTrack: AnimationTrack | undefined = undefined

        const entries = this.data.animationSet[name]
        if (entries && entries.length > 0) {
            const entry = this._pickRandom(entries)
            if (entry) {
                toPlayTrack = this._getTrack(entry.id)
            }
        }

        //if oldTrack !== newTrack
        if (toPlayTrack !== this.data.currentMoodAnimationTrack) {
            //if new track
            if (toPlayTrack) {
                //stop old track
                if (this.data.currentMoodAnimationTrack) {
                    this.data.currentMoodAnimationTrack.Stop(transitionTime)
                }

                this.data.currentMoodAnimationTrack = undefined

                //set new track as mood animation
                if (!this.data.moodTracks.includes(toPlayTrack)) {
                    this.data.moodTracks.push(toPlayTrack)
                }

                //play new track
                this.data.currentMoodAnimationTrack = toPlayTrack
                toPlayTrack.Play(transitionTime)
            }
        }

        return !!toPlayTrack
    }

    stopToolAnimation() {
        if (this.data.currentToolAnimationTrack) {
            this.data.currentToolAnimationTrack.Stop()
        }
        this.data.currentToolAnimationTrack = undefined
        this.data.currentToolAnimation = undefined
    }

    _switchToolAnimation(name: string) {
        let transitionTime = 0.2
        if (name === this.data.currentToolAnimation) {
            transitionTime = 0.15
        }

        this.data.currentToolAnimation = name

        //get appropriate track
        let toPlayTrack: AnimationTrack | undefined = undefined

        const entries = this.data.animationSet[name]
        if (entries && entries.length > 0) {
            const entry = this._pickRandom(entries)
            if (entry) {
                toPlayTrack = this._getTrack(entry.id)
            }
        }

        //if oldTrack !== newTrack
        if (toPlayTrack !== this.data.currentToolAnimationTrack) {
            //if new track
            if (toPlayTrack) {
                //stop old track
                if (this.data.currentToolAnimationTrack) {
                    this.data.currentToolAnimationTrack.Stop(transitionTime)
                }

                this.data.currentToolAnimationTrack = undefined

                //set new track as tool animation
                if (!this.data.toolTracks.includes(toPlayTrack)) {
                    this.data.toolTracks.push(toPlayTrack)
                }

                //play new track
                this.data.currentToolAnimationTrack = toPlayTrack
                toPlayTrack.Play(transitionTime)
            }
        }

        return !!toPlayTrack
    }

    isValidTrackForSet(track: AnimationTrack, name: string) {
        if (this.data.animationSet[name]) {
            for (const entry of this.data.animationSet[name]) {
                if (this._getTrack(entry.id) === track) {
                    return true
                }
            }
        }

        return false
    }

    _fixUnloaded() {
        if ((this.data.currentAnimation && !this.data.currentAnimationTrack) || (this.data.currentAnimation && this.data.currentAnimationTrack && !this.isValidTrackForSet(this.data.currentAnimationTrack, this.data.currentAnimation))) {
            this._switchAnimation(this.data.currentAnimation)
        }
        if ((this.data.currentMoodAnimation && !this.data.currentMoodAnimationTrack) || (this.data.currentMoodAnimation && this.data.currentMoodAnimationTrack && !this.isValidTrackForSet(this.data.currentMoodAnimationTrack, this.data.currentMoodAnimation))) {
            this._switchMoodAnimation(this.data.currentMoodAnimation)
        }
        if ((this.data.currentToolAnimation && !this.data.currentToolAnimationTrack) || (this.data.currentToolAnimation && this.data.currentToolAnimationTrack && !this.isValidTrackForSet(this.data.currentToolAnimationTrack, this.data.currentToolAnimation))) {
            this._switchToolAnimation(this.data.currentToolAnimation)
        }
    }

    restPose(includeMotors: boolean = true, includeFACS: boolean = true) {
        const rig = this.instance.parent?.parent

        if (!rig) {
            return
        }

        const descendants = rig.GetDescendants()

        for (const child of descendants) {
            if (child.className === "Motor6D" && includeMotors) {
                child.setProperty("Transform", new CFrame(0,0,0), true)
            } else if (child.className === "FaceControls" && includeFACS) {
                const propertyNames = child.getPropertyNames()
                for (const propertyName of propertyNames) {
                    if (FaceControlNames.includes(propertyName)) {
                        child.setProperty(propertyName, 0)
                    }
                }
            }
        }
    }

    renderAnimation(addTime: number = 1 / 60) {
        const humanoid = this.instance.parent
        if (!humanoid) {
            throw new Error("Parent is missing from Animator")
        }

        this.restPose()
        this._fixUnloaded()

        //play regular tracks
        for (const track of this.data.animationTracks.values()) {
            if (this.data.moodTracks.includes(track)) continue
            if (this.data.toolTracks.includes(track)) continue

            const looped = track.tick(addTime)
            if (this.data.currentAnimationTrack === track && looped && this.data.currentAnimation) {
                this._switchAnimation(this.data.currentAnimation)
            }
        }

        const humanoidDescription = humanoid.FindFirstChildOfClass("HumanoidDescription")
        let staticFacialAnimation = false

        if (humanoidDescription) {
            staticFacialAnimation = humanoidDescription.Prop("StaticFacialAnimation") as boolean

            if (staticFacialAnimation) {
                this.restPose(false, true)
            }
        }

        if (staticFacialAnimation && this.data.currentMoodAnimation !== "mood") {
            this.playAnimation("mood", "mood")
        } else if (!staticFacialAnimation && this.data.currentAnimation?.startsWith("emote.") && this.data.currentMoodAnimation) {
            this.stopMoodAnimation()
        }

        //play mood tracks
        for (const track of this.data.animationTracks.values()) {
            if (!this.data.moodTracks.includes(track)) continue

            const looped = track.tick(addTime)
            if (this.data.currentMoodAnimationTrack === track && looped && this.data.currentMoodAnimation) {
                this._switchMoodAnimation(this.data.currentMoodAnimation)
            }
        }

        //play tool tracks
        for (const track of this.data.animationTracks.values()) {
            if (!this.data.toolTracks.includes(track)) continue

            const looped = track.tick(addTime)
            if (this.data.currentToolAnimationTrack === track && looped && this.data.currentToolAnimation) {
                this._switchToolAnimation(this.data.currentToolAnimation)
            }
        }


        //const hasMood = this.data.currentMoodAnimation && this.data.currentMoodAnimation.length > 0
        //const isEmote = this.data.currentAnimation?.startsWith("emote.")

        /*if (isEmote) {
            this.restPose(false, true)
        }*/

        const rig = this.instance.parent?.parent
        if (rig) {
            //Recalculate motor6Ds, this is neccessary due to an ISSUE: that needs TODO: be fixed
            const descedants = rig.GetDescendants()
            for (let i = 0; i < 2; i++) {
                for (const child of descedants) {
                    if (child.className === "Motor6D" || child.className === "Weld") {
                        child.Changed.Fire("C0")
                    }
                }
            }
        }
    }

    async loadAvatarAnimation(id: bigint, isEmote: boolean = false, forceLoop: boolean = false): Promise<Response | undefined> {
        const humanoid = this.instance.parent
        if (!humanoid) {
            throw new Error("Parent is missing from Animator")
        }

        const animationInfo = await API.Asset.GetRBX(`rbxassetid://${id}`, undefined)
        if (!(animationInfo instanceof RBX)) {
            return animationInfo
        }

        const root = animationInfo.generateTree().GetChildren()[0]

        const promises: Promise<Response | undefined>[] = []

        if (!isEmote) {
            //for every main animation
            for (const anim of root.GetChildren()) { 
                const animName = anim.Prop("Name") as string
                this.data.animationSet[animName] = []

                //for every sub animation
                for (const subAnim of anim.GetChildren()) {
                    const subAnimIdStr = subAnim.Prop("AnimationId") as string
                    let subWeight = 0
                    const subWeightChild = subAnim.FindFirstChild("Weight")
                    if (subWeightChild && subWeightChild.className === "NumberValue" && subWeightChild.HasProperty("Value")) {
                        subWeight = subWeightChild.Prop("Value") as number
                    }

                    if (subAnimIdStr.length > 0) {
                        const subAnimId = BigInt(API.Misc.idFromStr(subAnimIdStr))
                        const foundAnimTrack = this.data.animationTracks.get(subAnimId)

                        if (foundAnimTrack) {
                            if (forceLoop) {
                                foundAnimTrack.looped = true
                            }

                            if (!this.data.animationSet[animName]) {
                                this.data.animationSet[animName] = []
                            }

                            this.data.animationSet[animName].push({
                                id: `rbxassetid://${subAnimId}`,
                                weight: subWeight,
                            })
                        } else {
                            //load sub animation
                            promises.push(new Promise(resolve => {
                                API.Asset.GetRBX(`rbxassetid://${subAnimId}`, undefined).then(result => {
                                    if (result instanceof RBX) {
                                        //get and parse animation track
                                        console.log("loading anim", subAnimId)

                                        const animTrackInstance = result.generateTree().GetChildren()[0]
                                        if (animTrackInstance && humanoid.parent) {
                                            const animTrack = new AnimationTrack().loadAnimation(humanoid.parent, animTrackInstance);
                                            if (forceLoop) {
                                                animTrack.looped = true
                                            }
                                            
                                            if (!this.data.animationSet[animName]) {
                                                this.data.animationSet[animName] = []
                                            }
                                            
                                            this.data.animationSet[animName].push({
                                                id: `rbxassetid://${subAnimId}`,
                                                weight: subWeight,
                                            })
                                            if (this.data.animationTracks.get(subAnimId)) {
                                                throw new Error("Animation was already loaded")
                                            }
                                            this.data.animationTracks.set(subAnimId, animTrack)

                                            this.instance.setProperty("_HasLoadedAnimation",true)
                                        }

                                        resolve(undefined)
                                    } else {
                                        resolve(result)
                                    }
                                })
                            }))
                        }
                    }
                }
            }
        } else {
            const animIdStr = root.Prop("AnimationId") as string
            const animId = BigInt(API.Misc.idFromStr(animIdStr))

            if (animIdStr.length > 0) {
                const foundAnimTrack = this.data.animationTracks.get(animId)
                if (foundAnimTrack) {
                    if (forceLoop) {
                        foundAnimTrack.looped = true
                    }

                    this.data.emotes.set(id, {
                        id: `rbxassetid://${animId}`,
                        weight: 1,
                    })
                } else {
                    //load emote animation
                    promises.push(new Promise(resolve => {
                        API.Asset.GetRBX(`rbxassetid://${animId}`, undefined).then(result => {
                            if (result instanceof RBX) {
                                //get and parse animation track
                                const animTrackInstance = result.generateTree().GetChildren()[0]
                                if (animTrackInstance && humanoid.parent) {
                                    const animTrack = new AnimationTrack().loadAnimation(humanoid.parent, animTrackInstance);
                                    if (forceLoop) {
                                        animTrack.looped = true
                                    }
                                    
                                    this.data.emotes.set(id, {
                                            id: `rbxassetid://${animId}`,
                                            weight: 1,
                                        })
                                    this.data.animationTracks.set(animId, animTrack)

                                    this.instance.setProperty("_HasLoadedAnimation",true)
                                }

                                resolve(undefined)
                            } else {
                                resolve(result)
                            }
                        })
                    }))
                }
            }
        }
    }

    playAnimation(name: string, type: "main" | "mood" | "tool" = "main"): boolean {
        const humanoid = this.instance.parent
        if (!humanoid) {
            throw new Error("Parent is missing from Animator")
        }

        const humanoidDescription = humanoid.FindFirstChildOfClass("HumanoidDescription")
        let staticFacialAnimation = false

        if (humanoidDescription) {
            staticFacialAnimation = humanoidDescription.Prop("StaticFacialAnimation") as boolean

            if (staticFacialAnimation) {
                this.restPose(false, true)
            }
        }

        switch (type) {
            case "main":
                if (this.data.currentAnimation !== name) {
                    if (!name.startsWith("emote.") || staticFacialAnimation) {
                        this.playAnimation("mood", "mood")
                    } else {
                        this.stopMoodAnimation()
                    }
                    console.log("playing", name)
                    return this._switchAnimation(name)
                } else {
                    return true
                }
                break
            case "mood":
                if (this.data.currentMoodAnimation !== name) {
                    console.log("playing", name)
                    return this._switchMoodAnimation(name)
                } else {
                    return true
                }
                break
            case "tool":
                if (this.data.currentToolAnimation !== name) {
                    console.log("playing", name)
                    return this._switchToolAnimation(name)
                } else {
                    return true
                }
        }

        return false
    }
}