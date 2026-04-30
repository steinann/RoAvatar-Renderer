# Documentation for FLAGS
## UI
```ts
HAIR_IS_BODYPART: boolean (true), //only used by RoAvatar UI
```

## DOM
```ts
AVATAR_JOINT_UPGRADE: boolean (false), //wip, do not enable
INSTANCE_GARBAGE_COLLECT: boolean (false), //wip, only for memory leak debugging
```

## API
```ts
BODYCOLOR3: boolean (true), //outfits returned by api use Color3 instead of BrickColor
ENABLE_API_CACHE: boolean (true), //allows API to cache data
ENABLE_API_MESH_CACHE: boolean (true), //allows API to cache mesh data
ENABLE_API_RBX_CACHE: boolean (true), //allows API to cache RBX data
ROAVATAR_DATA_URL: string ("rbxassetid://102463700065175"), //url of model to load that lists issues with specific versions (only used by RoAvatar)
ROAVATAR_TRYON_PLACE: number (135979364355750), //place try-on button sends you to (only used by RoAvatar)
ASSETDELIVERY_V2: boolean (true), //API uses assetdelivery v2 instead of v1
```

## Assets
```ts
ONLINE_ASSETS: boolean (false), //loads assets from assetdelivery instead of local files

//Flags below are ignored when ONLINE_ASSETS = true
ASSETS_PATH: string ("../assets/rbxasset/"), //path to rbxasset:// local files
RIG_PATH: string ("../assets/"), //path to RigR6.rbxm and RigR15.rbxm
```

## Layered Clothing
```ts
USE_WORKERS: boolean (true), //if WebWorkers (multithreading) can be used
ENABLE_LC_WEIGHT_CACHE: boolean (true), //makes linear algorithms cache weights
INFLATE_LAYERED_CLOTHING: number (0.05), //only used by linear algorithms
LAYERED_CLOTHING_ALGORITHM: "rbf" | "linear" | "linearnormal" ("rbf"), //algorithm, rbf is fastest
SHOW_CAGE: boolean (false), //renders cage mesh instead of actualy mesh
LAYERED_CLOTHING_COOLDOWN: number (0.6), //cooldown between mesh recompile
GET_WORKER_FUNC: Function (DefaultGetWorkerFunc), //function WorkerPool uses to create workers, replace with your own if workers cant be created using the default method

//detail quality
RBF_PATCH_COUNT: number (300), //amount of "patches" that are used for layered clothing, multiple verts share the same patch
RBF_PATCH_DETAIL_SAMPLES: number (32), //amount of nearby vertices each patch samples from
RBF_PATCH_SHAPE_SAMPLES: number (32), //amount of far-away vertices (importants) each patch samples from, this is done so that the overall mesh shape is preserved
```

## General Rendering
```ts
USE_VERTEX_COLOR: boolean (true), //forces vertex color to be white when false 
USE_POST_PROCESSING: boolean (false), //this is needed to enable bloom, but ugly since it disables anti aliasing...
POST_PROCESSING_IS_DOUBLE_SIZE: boolean (true), //doubles render resolution when using post processing
GEAR_ENABLED: boolean (true), //makes HumanoidDescription load gears
AUDIO_ENABLED: boolean (true), //makes Audio instances play sound when played
LEGACY_WELD_BEHAVIOR: boolean (false), //makes welds immediately update (bad for performance)
USE_RENDERTARGET: boolean (true), //enables full texture compilation using ThreeJS RenderTarget
```

## Skeleton
```ts
SHOW_SKELETON_HELPER: boolean (false), //shows ThreeJS SkeletonHelper
UPDATE_SKELETON: boolean (true), //skeleton is updated every frame
ANIMATE_SKELETON: boolean (true), //skeleton is animated every frame
AUTO_SKIN_EVERYTHING: boolean (false), //autoskin is applied even when its disabled
USE_LOCAL_SKELETONDESC: boolean (false), //skeleton is local instead of global (broken)
```

## HSR (Hidden Surface Removal)
```ts
ENABLE_HSR: boolean (true), //enables HSR
HSR_SHOW_RAY: boolean (false), //shows rays created by HSR
HIDE_LAYERED_CLOTHING: boolean (false), //hides layered clothing
HSR_RAY_COUNT: number (3), //rays per triangle
HSR_RAY_LENGTH: number (0.4), //length of each ray
CACHE_HSR_HITS: boolean (true), //caches amount of hits for each triangle
```

## Debug
```ts
VERBOSE_LOGGING: boolean (false), //enables logging for non-critical information
SEARCH_FOR_STRING: string? (undefined), //makes renderer print out strings in RBX that contain SEARCH_FOR_STRING
LOAD_TEST_PLACE: string? (undefined), //set this to a string to load a place file, for example "../assets/UniversalApp.rbxm"
```