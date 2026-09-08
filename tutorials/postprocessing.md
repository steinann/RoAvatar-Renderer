# Example on how to enable post processing
Post processing allows for effect such as Bloom and SSAO (Screen Space Ambient Occlusion) which results in better graphics but at a high performance cost, heres how to add it.
```ts
//before initializing renderer
FLAGS.USE_POST_PROCESSING = true
FLAGS.POST_PROCESSING_IS_DOUBLE_SIZE = true //if you want to avoid anti-aliasing atifcats and have a small resolution on the render

const mainScene = RBXRenderer.addScene() //does not have post processing by default

const success = await RBXRenderer.fullSetup()
if (!success) return

//has to be done after initialization
RBXRenderer.createEffectComposer(mainScene) //adds post processing to scene

//NOTE: RBXRenderer.firstScene has effect composer created automatically

//we can later disable post processing by doing (though there is still a slight overhead, ESPECIALLY if FLAGS.POST_PROCESSING_IS_DOUBLE_SIZE = true)
RBXRenderer.usePostProcessing = false
```