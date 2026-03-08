# Renderer for RoAvatar
This is the Roblox avatar renderer made for https://github.com/steinann/RoAvatar

It was originally a part of that repository but has now gained independence

Also available on npm: https://www.npmjs.com/package/roavatar-renderer

IMPORTANT: Assets are NOT included in the npm module or this repository, you have to get them from the main RoAvatar repository

Basic (not really) example on how to load an avatar, that is also untested:
```ts
//setup instance wrappers and renderer
RegisterWrappers()
RBXRenderer.fullSetup() //you can alternatively choose to only setup specific parts and do some yourself

//get avatar data for the user with id 1
const outfit = API.Avatar.GetAvatarDetails(1)
if (!(outfit instanceof Outfit)) throw new Error("Failed to get outfit")

//get rig
let currentRig: Instance | undefined = undefined
const result = API.Asset.GetRBX(`../assets/RigR15.rbxm`, undefined)
if (result instanceof RBX) {
    const newRig = result.generateTree().GetChildren()[0]

    currentRig = newRig
    RBXRenderer.addInstance(currentRig, auth) //adds instances to the 3d viewport and updates them if theyve changed
}

//store success state of last humanoid description, if one fails and we dont apply from scratch alot of stuff breaks
let failedLastDescription = false

//create humanoid description
const hrp = new Instance("HumanoidDescription")
const hrpWrapper = new HumanoidDescriptionWrapper(hrp)
hrpWrapper.fromOutfit(outfit)

if (currentRig) {
    const humanoid = currentRig.FindFirstChildOfClass("Humanoid")
    if (humanoid) {
        //destroy last description if it failed to apply, this will force the new one to apply from scratch
        if (failedLastDescription) {
            const ogDesc = humanoid.FindFirstChildOfClass("HumanoidDescription")
            if (ogDesc) {
                ogDesc.Destroy()
            }
        }

        //apply humanoid description
        hrpWrapper.applyDescription(humanoid).then((result) => {
            if (currentRig) {
                RBXRenderer.addInstance(currentRig, auth) //render instances
            }

            //mark last humanoiddescription as failing to apply, this is important
            if (result instanceof Instance) {
                failedLastDescription = false
            } else {
                failedLastDescription = true
            }
        })
    }
}
```

See the RoAvatar source code to know more, especially avatarPreview.tsx is useful
