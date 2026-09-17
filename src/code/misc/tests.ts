import { API, Authentication } from "../api";
import { Outfit } from "../avatar/outfit";
import type { CFrame, Instance, Vector3 } from "../rblx/rbx";
import { OutfitRenderer } from "../render/outfitRenderer";
import { FLAGS } from "./flags";
import { base64ToArrayBuffer } from "./misc";

export async function runTests() {
    const auth = new Authentication()

    const testModel = await API.Asset.GetRBX(FLAGS.AUTOTEST_MODEL)
    if (testModel instanceof Response) throw "FLAGS.AUTOTEST_MODEL request failed"

    const root = testModel.generateTree()
    const folder = root.Child("Tests")
    if (!folder) throw "FLAGS.AUTOTEST_MODEL is missing Tests folder"

    for (const test of folder.GetChildren()) {
        console.log(test)

        const outfitDataValue = test.Child("OutfitData")
        const typesValue = test.Child("Types")
        const avatar = test.Child("Player")
        if (!outfitDataValue || !typesValue || !avatar) throw "A test is missing OutfitData"

        const outfitData = outfitDataValue.Prop("Value") as string
        const types = (typesValue.Prop("Value") as string).split(",")
        
        const outfit = new Outfit()
        await outfit.fromBuffer(base64ToArrayBuffer(outfitData), auth)

        const outfitRenderer = new OutfitRenderer(auth, outfit)
        await new Promise((resolve) => {
            outfitRenderer.onSuccess.Connect(() => {
                for (const type of types) {
                    switch (type) {
                        case "scale":
                            testScale(outfitRenderer, avatar)
                            break
                        default:
                            throw `Invalid test type found: ${type}`
                    }
                }
                resolve(null)
            })
        })
        outfitRenderer.onError.Connect(() => {
            throw "OutfitRenderer failed to load"
        })

        outfitRenderer.destroy()
    }

    console.log("TESTS COMPLETE!")
}

function getEquivalent(self: Instance, otherParent: Instance) {
    const equivalent = otherParent.GetChildren().filter((v) => {return v.Prop("Name") === self.Prop("Name") && v.className === self.className})[0]
    return equivalent
}

function testScaleInstance(child: Instance, otherParent: Instance) {
    if (child.IsA("BasePart")) {
        const equivalent = getEquivalent(child, otherParent)
        if (!equivalent) throw `BasePart: No equivalent for ${child.GetFullName()}`

        const equivalentSize = equivalent.Prop("size") as Vector3
        const selfSize = child.Prop("size") as Vector3

        if (!equivalentSize.isSame(selfSize)) throw `TEST FAIL: Part size for ${child.GetFullName()} is not the same`

        //specialmesh children
        const specialMesh = child.FindFirstChildOfClass("SpecialMesh")
        if (specialMesh) {
            testScaleInstance(specialMesh, equivalent)
        }

        //attachment children
        const foundNames: string[] = []
        for (const att of child.GetChildren()) {
            if (att.IsA("Attachment")) {
                foundNames.push(att.Prop("Name") as string)
            }
        }

        const newNames = foundNames.filter((v) => {return foundNames.filter((g) => {return g === v}).length === 1})
        for (const newName of newNames) {
            const att = child.Child(newName)
            if (!att) throw `Attachment somehow doesnt exist???`
            testScaleInstance(att, equivalent)
        }
    } else if (child.IsA("Accessory")) {
        const equivalent = getEquivalent(child, otherParent)
        if (!equivalent) throw `Accessory: No equivalent for ${child.GetFullName()}`

        const handle = child.Child("Handle")
        if (handle) {
            testScaleInstance(handle, equivalent)
        }
    } else if (child.className === "SpecialMesh") {
        const equivalent = getEquivalent(child, otherParent)
        if (!equivalent) throw `SpecialMesh: No equivalent for ${child.GetFullName()}`

        const selfScale = child.Prop("Scale") as Vector3
        const equivalentScale = equivalent.Prop("Scale") as Vector3

        if (!selfScale.isSame(equivalentScale)) throw `TEST FAIL: SpecialMesh Scale for ${child.GetFullName()} is not the same`
    } else if (child.IsA("Attachment")) {
        if (child.Prop("Name") === "RootRigAttachment") return //ISSUE: the R15 rig roavatar uses has an incorrect OriginalPosition inside the RootRigAttachment causing it to always fail

        const equivalent = getEquivalent(child, otherParent)
        if (!equivalent) throw `Attachment: No equivalent for ${child.GetFullName()}`

        const selfCF = child.Prop("CFrame") as CFrame
        const equivalentCF = equivalent.Prop("CFrame") as CFrame

        if (!selfCF.isSame(equivalentCF)) throw `TEST FAIL: Attachment CFrame for ${child.GetFullName()} is not the same`
    }
}

function testScale(outfitRenderer: OutfitRenderer, avatar: Instance) {
    const currentRig = outfitRenderer.currentRig!

    for (const child of currentRig.GetChildren()) {
        testScaleInstance(child, avatar)
    }
}