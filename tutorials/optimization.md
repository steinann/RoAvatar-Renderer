# How to optimize
Various parts of the renderer can be disabled/enabled and have a large effect on performance. Usually you want to keep these parts optional.

Here's a few:

1. Lights - each light the scene contains makes the performance worse, especially on low end devices. You can easily disable some non-important lights.
    - ```RBXRendererScene.directionalLight2 = false```, disables a light that lights up the dark parts of the scene
    - ```OutfitRenderer.backgroundRenderer.affectsSceneLighting = false```, disables an ambient light that matches the background color

2. API Cache - depending on your scenario the API cache may either benefit performance or worsen it, generally if you have an OutfitRenderer that never updates you can turn off parts of the API Cache
    - ```js
        //general cache for everything api related
        FLAGS.ENABLE_API_CACHE = ...
        //cache for decoded meshes, decoding is expensive
        FLAGS.ENABLE_API_MESH_CACHE = ..
        //cache for decoded rbxm files (instance trees), decoding is cheap
        FLAGS.ENABLE_API_RBX_CACHE = ...
        ```

3. Workers - workers despite their name are quite difficult to get working as they need be compatible with the CORS policy. But you have the ability to override the default constructor if they don't work, here's the default behavior:
    - ```ts
        //generic-worker.ts
        import { getWorkerOnMessage } from "roavatar-renderer"

        onmessage = getWorkerOnMessage()
        ```
    - ```ts
        //worker-functions.ts
        import GenericWorker from "./generic-worker?worker&inline"

        function DefaultGetWorkerFunc() {
            return new GenericWorker()
        }

        FLAGS.GET_WORKER_FUNC = DefaultGetWorkerFunc
        ```

4. Layered clothing detail - if you haven't gotten workers working you can try adjusting the detail of layered clothing instead by using these flags (values shown are the defaults)
    - ```js
        //amount of "deformation patches" that are used for layered clothing, multiple verts share the same deformation patch, layered clothing usually has (3000 vertices)
        FLAGS.RBF_PATCH_COUNT = 300
        //amount of nearby vertices each patch samples from
        FLAGS.RBF_PATCH_DETAIL_SAMPLES = 32
        //amount of far-away vertices (importants) each patch samples from, this is done so that the overall mesh shape is preserved
        FLAGS.RBF_PATCH_SHAPE_SAMPLES = 32
        ````