# Structure of the OutfitRenderer class

```ts
class OutfitRenderer {
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
    animationFPS: number = 60
    deltaTimeMultiplier: number = 1

    /**
     * Creates a new OutfitRenderer which makes it easy to render outfits
     * @param auth The authentication object, you should have one you use for everything
     * @param outfit The outfit you want to render, it can be updated later by calling setOutfit()
     * @param rigPath The path that contains RigR6.rbxm and RigR15.rbxm, should always be "roavatar://" as rig path is now controlled by FLAGS
     */
    constructor(auth: Authentication, outfit: Outfit, rigPath: string = "roavatar://")
    
    /**
     * Updates the current outfit being rendered
     */
    setOutfit(outfit: Outfit)

    /**
     * Centers camera on avatar
     */
    centerCamera()

    /**
     * Starts updating the animation of the outfit per frame
     */
    startAnimating()

    /**
     * Stops updating the animation of the outfit per frame
     */
    stopAnimating()

    /**
     * Sets the current animation being played
     * @param name The name of the animation, for example "idle", "run" or "emote.1234"
     */
    setMainAnimation(name: string)
}
```