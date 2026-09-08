# Example on how to make multiple scenes rendered at the same time

```ts
//Scenes can be created at any time including before RBXRenderer.fullSetup()
const mainScene = RBXRenderer.addScene();
const itemHoverScene = RBXRenderer.addScene();

//Scenes created manually arent configured automatically like RBXRenderer.firstScene is
RBXRenderer.setupControls(mainScene); //create orbit controls for scene
RBXRenderer.setupScene(undefined, undefined, mainScene); //setup scene appearance
RBXRenderer.createEffectComposer(mainScene) //setup post processing for scene if flag is enabled (has to be after RBXRenderer.fullSetup())

//Scenes cover a specific area of the canvas, doing .noRect() makes them have no area and not render at all
RBXRenderer.firstScene.noRect(); //scene created by default, exists for simplicity (best practice to ignore it if you use multiple scenes)
mainScene.noRect();
itemHoverScene.noRect();

//One can set the area a scene covers by setting its bound (do note that the rect is relative to the canvas)
const mainSceneBounds = mainSceneContainer.getBoundingClientRect();
mainScene.setRect(mainSceneBounds);

//Many methods of RBXRenderer or other classes accept scenes as arguments, dont forget to specify this
new OutfitRenderer(auth, outfit, mainScene);
RBXRenderer.addInstance(instance, auth, mainScene);

//NOTE: It is recommended to have one canvas covering the entire window to be able to place scenes anywhere and setting pointer-events: none; while a scene isnt being hovered over
```