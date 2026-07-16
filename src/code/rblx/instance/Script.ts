import { mathRandom, Wait } from "../../misc/misc";
import { DataType } from "../constant";
import { Instance, Property } from "../rbx";
import { InstanceWrapper } from "./InstanceWrapper";
import type { ParticleEmitterWrapper } from "./ParticleEmitter";
import { SoundWrapper } from "./Sound";

class ScriptWrapperData {
    shouldStop: boolean = false
}

/**
 * @category InstanceWrapper
 */
export class ScriptWrapper extends InstanceWrapper {
    static className: string = "Script"
    static requiredProperties: string[] = ["Name", "_data"]

    setup() {
        //generic
        if (!this.instance.HasProperty("Name")) this.instance.addProperty(new Property("Name", DataType.String), this.instance.className)

        if (!this.instance.HasProperty("_data")) this.instance.addProperty(new Property("_data", DataType.NonSerializable), new ScriptWrapperData())
    }

    get data() {
        return this.instance.Prop("_data") as ScriptWrapperData
    }

    created(): void {
        this.Run()
    }

    Run() {
        switch (this.instance.Prop("Name") as string) {
            case "ChickenSounds":
            case "HarmonicaSounds":
            case "SoundPlayer":
                this.SoundPlayer(this.instance)
                break
            case "HatScript2.0": //found in https://www.roblox.com/catalog/169444515/Rbadams-Smokestack-Top-Hat
                this.HatScript20(this.instance)
                break
        }
    }

    //Scripts
    async SoundPlayer(script: Instance) {
        //Made by steintro

        let Handle = undefined
        if (script.parent && script.parent.Prop("Name") === "Handle") {
            Handle = script.parent
        } else if (script.parent && script.parent.FindFirstChild("Handle")) {
            Handle = script.parent.FindFirstChild("Handle")
        }

        if (!Handle) return

        const Hat = Handle.parent

        if (!Hat) return

        const Sounds = []

        for (const child of Handle.GetDescendants()) {
            if (child.className === "Sound") {
                Sounds.push(child)
            }
        }

        function IsBeingWorn() {
            return Hat?.parent?.FindFirstChild("Humanoid")
        }

        let maxTime = 20
        if (script.Prop("Name") === "SoundPlayer") {
            maxTime = 15
        }

        while (true) {
            await Wait(mathRandom(5,maxTime))
            if (this.instance.destroyed || this.data.shouldStop) return

            if (IsBeingWorn()) {
                const index = mathRandom(0, Sounds.length - 1)
                
                const Sound = Sounds[index]
                
                const soundWrapper = new SoundWrapper(Sound)
                soundWrapper.Play()
            }
        }
    }

    async HatScript20(script: Instance) {
        //Script by Mah_Bucket, fixed by s_nnys, ported by steintro

        const now = new Date()
        const month = now.getMonth()
        const day = now.getDay()

        const data = this.data

        let hw //= true
        let tg //= true
        let xm //= true
        let bd //= true
        let pt //= true
        let vt //= true
        let af //= true

        if (month == 10 && day > 21) { //Candy Day
            hw = true
        } else if (month == 11 && day > 19) { //Eating Too Much Day
            tg = true
        } else if (month == 12 && day > 17 && day < 28) { //Free Stuff Day
            xm = true
        } else if (month == 9 && day == 1) { //Roblox's Birthday!
            bd = true
        } else if (month == 3 && day > 11 && day < 20) { //Hunt Short Irishmen Day
            pt = true
        } else if (month == 2 && day > 8 && day < 17) { //Chocolate and Tears Day
            vt = true
        } else if (month == 4 && day == 1) { //April Fool's!
            af = true
        }

        let emitter = script.parent?.Child("ParticleEmitter") // default smoke emitter
        const burst = script.parent?.Child("Burst") // bursting emitter
        // holiday cheer
        async function snowBlower() {
            const snow1 = script.parent?.Child("Snowflake1")
            const snow2 = script.parent?.Child("Snowflake2")
            while (true) {
                await Wait(Math.random() * 5)
                if (script.destroyed || data.shouldStop) return
                snow1?.setProperty("Enabled", false)
                snow2?.setProperty("Enabled", true)
                await Wait(Math.random() * 5)
                if (script.destroyed || data.shouldStop) return
                snow1?.setProperty("Enabled", true)
                snow2?.setProperty("Enabled", false)
                
                // occasionally blow a ton of snow
                if (Math.random() > 0.97) {
                    snow1?.setProperty("Enabled", false)
                    await Wait(4)
                    if (script.destroyed || data.shouldStop) return;
                    (snow1?.w as ParticleEmitterWrapper).Emit(22)
                    await Wait(Math.random())
                    if (script.destroyed || data.shouldStop) return;
                    (snow2?.w as ParticleEmitterWrapper).Emit(22)
                    await Wait(2)
                    if (script.destroyed || data.shouldStop) return
                }
            }
        }

        // falliday cheer
        async function leafBlower() {
            const leaf1 = script.parent?.Child("Leaf1")
            const leaf2 = script.parent?.Child("Leaf2")
            while (true) {
                await Wait(Math.random() * 5)
                if (script.destroyed || data.shouldStop) return
                leaf1?.setProperty("Enabled", false)
                leaf2?.setProperty("Enabled", true)
                await Wait(Math.random() * 5)
                if (script.destroyed || data.shouldStop) return
                leaf1?.setProperty("Enabled", true)
                leaf2?.setProperty("Enabled", false)
                
                // occasionally blow a ton of leaves
                if (Math.random() > 0.97) {
                    leaf1?.setProperty("Enabled", false)
                    await Wait(4)
                    if (script.destroyed || data.shouldStop) return;
                    (leaf1?.w as ParticleEmitterWrapper).Emit(22)
                    await Wait(Math.random())
                    if (script.destroyed || data.shouldStop) return;
                    (leaf2?.w as ParticleEmitterWrapper).Emit(22)
                    await Wait(2)
                    if (script.destroyed || data.shouldStop) return
                }
            }
        }

        // irish pride
        async function cloverBlower() {
            const leaf1 = script.parent?.Child("Clover1")
            const leaf2 = script.parent?.Child("Clover2")
            while (true) {
                await Wait(Math.random() * 5)
                if (script.destroyed || data.shouldStop) return
                leaf1?.setProperty("Enabled", false)
                leaf2?.setProperty("Enabled", true)
                await Wait(Math.random() * 5)
                if (script.destroyed || data.shouldStop) return
                leaf1?.setProperty("Enabled", true)
                leaf2?.setProperty("Enabled", false)
                
                // occasionally blow a ton of clovers
                if (Math.random() > 0.97) {
                    leaf1?.setProperty("Enabled", false)
                    await Wait(4)
                    if (script.destroyed || data.shouldStop) return;
                    (leaf1?.w as ParticleEmitterWrapper).Emit(22)
                    await Wait(Math.random())
                    if (script.destroyed || data.shouldStop) return;
                    (leaf2?.w as ParticleEmitterWrapper).Emit(22)
                    await Wait(2)
                    if (script.destroyed || data.shouldStop) return
                }
            }
        }

        // check holidays
        if (hw) {
            emitter?.setProperty("Enabled", false)
            emitter = script.parent?.Child("Hallow") // use this orange smoke
            if (script.parent?.parent?.IsA("MeshPart")) {
                script.parent?.parent?.setProperty("TextureID", "rbxassetid://6991166143")
            } else {
                script.parent?.parent?.Child("Mesh")?.setProperty("TextureId",  "rbxassetid://6991166143") // halloween hat texture
            }
         } else if (tg) {
            if (script.parent?.parent?.IsA("MeshPart")) {
                script.parent?.parent?.setProperty("TextureID", "rbxassetid://6991393806")
            } else {
                script.parent?.parent?.Child("Mesh")?.setProperty("TextureId", "rbxassetid://6991393806") 	// thanksgiving hat texture
            }
            leafBlower()
        } else if (xm) {
            emitter?.setProperty("Enabled", false)
            emitter = script.parent?.Child("Snowflake3") // use this snow
            snowBlower()
        } else if (bd) {
            emitter?.setProperty("Enabled", false)
            emitter = script.parent?.Child("Confetti") // confetti is the hip way to pollute
            if (script.parent?.parent?.IsA("MeshPart")) {
                script.parent?.parent?.setProperty("TextureID", "rbxassetid://2399316028")
            } else {
                script.parent?.parent?.Child("Mesh")?.setProperty("TextureId", "rbxassetid://2399316028") // birthday hat texture
            }
            //sorry i was too lazy to port it its not like it was going to render anyway
            /*const age = new Instance("Part") // part showing Roblox's age
                age.setProperty("CanCollide", false)
                age.Transparency = 1
                age.TopSurface = 0
                age.BottomSurface = 0
                age.Size = Vector3.new(.6,.5,.1)
                age.CFrame = script.Parent.Parent.CFrame - Vector3.new(0,.175,.43)
                age.CustomPhysicalProperties = PhysicalProperties.new(0,.3,.5)
            local gui = Instance.new("SurfaceGui")
                gui.CanvasSize = Vector2.new(60,50)
                gui.LightInfluence = 1
            local text = Instance.new("TextLabel")
                text.BackgroundTransparency = 1
                text.Size = UDim2.new(1,0,1,0)
                text.TextScaled = true
                text.TextColor3 = Color3.fromRGB(210,45,32)
                text.Text = now.year - 2006 // Roblox's age. What an old guy!
            local weld = Instance.new("WeldConstraint")
                weld.Part0 = script.Parent.Parent
                weld.Part1 = age
            age.Parent = script.Parent.Parent
            gui.Parent = age
            text.Parent = gui
            weld.Parent = script.Parent.Parent*/
        } else if (pt) {
            if (script.Parent?.Parent?.IsA("MeshPart")) {
                script.parent?.parent?.setProperty("TextureID", "rbxassetid://2399447918")
            } else {
                script.parent?.parent?.Child("Mesh")?.setProperty("TextureId", "rbxassetid://2399447918") // pattie's hat texture
            }
            cloverBlower()
        } else if (vt) {
            emitter?.setProperty("Enabled", false)
            emitter = script.Parent?.Child("Heart") // use this lovely smoke
            if (script.Parent?.Parent?.IsA("MeshPart")) {
                script.parent?.parent?.setProperty("TextureID", "rbxassetid://2399448372")
            } else {
                script.parent?.parent?.Child("Mesh")?.setProperty("TextureId", "rbxassetid://2399448372") // valentine hat texture
            }
         } else if (af) {
            emitter?.setProperty("Enabled", false)
            emitter = script.Parent?.Child("Hats") // use this not smoke
            script.Parent?.Child("Smokescreen")?.setProperty("Enabled", true)
            script.Parent?.Parent?.setProperty("Transparency", 1)
        }

        // turn emitter off and on periodically for more variation
        while (true) {
            await Wait(1.3)
            if (script.destroyed || data.shouldStop) return
            emitter?.setProperty("Enabled", false)
            await Wait(.8)
            if (script.destroyed || data.shouldStop) return
            emitter?.setProperty("Enabled", true)
            
            // occasionally we like to burst some smoke for a different effect
            const rando = Math.random()
            if (rando > 0.97) {
                emitter?.setProperty("Enabled", false)
                await Wait(4)
                if (script.destroyed || data.shouldStop) return
                burst?.setProperty("Enabled", true)
                await Wait(2)
                if (script.destroyed || data.shouldStop) return
                burst?.setProperty("Enabled", false)
                emitter?.setProperty("Enabled", true)
             } else if (rando > 0.969) { //very rare effect just to give people something to be excited about
                emitter?.setProperty("Enabled", false)
                await Wait(4)
                if (script.destroyed || data.shouldStop) return
                for (const v of script.Parent?.GetChildren() || []) {
                    if (v.IsA("ParticleEmitter")) {
                        (v.w as ParticleEmitterWrapper).Emit(mathRandom(6,10))
                        await Wait(.5)
                        if (script.destroyed || data.shouldStop) return
                    }
                }
                await Wait(2)
                if (script.destroyed || data.shouldStop) return
                emitter?.setProperty("Enabled", true)
            }
        }
    }
}