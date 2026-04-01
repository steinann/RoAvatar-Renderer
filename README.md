# Renderer for RoAvatar
This is the Roblox avatar renderer made for https://github.com/steinann/RoAvatar

It was originally a part of that repository but has now gained independence

Also available on npm: https://www.npmjs.com/package/roavatar-renderer

IMPORTANT: Assets are NOT included in the npm module or this repository, you have to get them from the main RoAvatar repository OR set FLAGS.ONLINE_ASSETS = true

Basic example on how to load an avatar, that is also untested:
```html
<!--I know this is kind of terrible but... it has to be included-->
<script src="/draco_decoder.js"></script>
```
```ts
//setup flags that are compatible with you environment
    FLAGS.ONLINE_ASSETS = false //set this to true if you want assets to be loaded from roblox instead of locally

    if (!FLAGS.ONLINE_ASSETS) {
        //path to asset files from RoAvatar
        FLAGS.ASSETS_PATH = chrome.runtime.getURL("assets/rbxasset/")
        FLAGS.RIG_PATH = chrome.runtime.getURL("assets/")
    }
    //if layered assets dont work set this to false (workers improve performance)
    FLAGS.USE_WORKERS = true

//setup RBXRenderer
    //actually creating renderer
    const includeScene = true
    const includeControls = true
    const success = await RBXRenderer.fullSetup(includeScene, includeControls)
    if (!success) {
        //roavatar-renderer automatically displays an error, but your own behavior can be included here (like a fallback)
    }
    //renderer customization
    RBXRenderer.setBackgroundColor( 0xffffff )
    RBXRenderer.setRendererSize(1000,500)
    RBXRenderer.setBackgroundTransparent(false)
    //add renderer to document
    document.body.appendChild(RBXRenderer.getRendererElement())

//get avatar data for the user with id 1
const outfit = API.Avatar.GetAvatarDetails(1)
if (!(outfit instanceof Outfit)) throw new Error("Failed to get outfit")

//create renderer for outfit
    //used by api
    const auth = new Authentication()
    //manages outfit rendering for you
    const outfitRenderer = new OutfitRenderer(auth, outfit, "roavatar://")
    outfitRenderer.startAnimating()
    outfitRenderer.setMainAnimation("idle")
```

See the RoAvatar source code to know more, especially avatarPreview.tsx is useful
