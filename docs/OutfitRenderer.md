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

    renderScene: RBXRendererScene = RBXRenderer.firstScene

    /**
     * Creates a new OutfitRenderer which makes it easy to render outfits
     * @param auth The authentication object, you should have one you use for everything
     * @param outfit The outfit you want to render, it can be updated later by calling setOutfit()
     * @param renderScene The scene the outfit should be rendered in
     */
    constructor(auth: Authentication, outfit: Outfit, renderScene: RBXRendererScene = RBXRenderer.firstScene) {
    
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