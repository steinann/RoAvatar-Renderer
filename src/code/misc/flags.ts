import { DefaultGetWorkerFunc } from "./worker-functions"

/**
 * @category FLAGS
 */
export const FLAGS: {
    /** Only used by RoAvatar UI */
    HAIR_IS_BODYPART: boolean,
    
    /**wip, do not enable */
    AVATAR_JOINT_UPGRADE: boolean,
    /**wip, only for memory leak debugging */
    INSTANCE_GARBAGE_COLLECT: boolean,
    /**makes welds immediately update (bad for performance) */
    LEGACY_WELD_BEHAVIOR: boolean,
    /**caches hierarchy of joints and removes directionality (required for AVATAR_JOINT_UPGRADE)*/
    USE_ASSEMBLY: boolean,

    /**outfits returned by api use Color3 instead of BrickColor */
    BODYCOLOR3: boolean,
    /**allows API to cache data */
    ENABLE_API_CACHE: boolean,
    /**allows API to cache mesh data */
    ENABLE_API_MESH_CACHE: boolean,
    /**allows API to cache RBX data */
    ENABLE_API_RBX_CACHE: boolean,
    /**url of model to load that lists issues with specific versions (only used by RoAvatar) */
    ROAVATAR_DATA_URL: string,
    /**the place try-on button sends you to (only used by RoAvatar) */
    ROAVATAR_TRYON_PLACE: number,
    /**API uses assetdelivery v2 instead of v1 */
    ASSETDELIVERY_V2: boolean,
    /**request priority given to fetch for assetdelivery */
    ASSET_REQUEST_PRIORITY: RequestPriority | undefined,
    /**the domain all api requests go through */
    API_DOMAIN: string,
    /**prefix to add before all api requests */
    API_REQUEST_PREFIX: string,
    /**credentials request type when fetching from API_DOMAIN and credentials are usually include */
    INCLUDE_REQUEST_CREDENTIALS_OVERRIDE: RequestCredentials,
    API_REQUEST_RETRY: boolean,

    /**loads assets from assetdelivery instead of local files */
    ONLINE_ASSETS: boolean,
    /**path to rbxasset:// local files*/
    ASSETS_PATH: string,
    /**path to RigR6.rbxm and RigR15.rbxm*/
    RIG_PATH: string,

    /**if WebWorkers (multithreading) can be used */
    USE_WORKERS: boolean,
    /**makes linear algorithms cache weights */
    ENABLE_LC_WEIGHT_CACHE: boolean,
    /**only used by linear algorithms */
    INFLATE_LAYERED_CLOTHING: number,
    /**algorithm, rbf (default) is fastest, others are deprecated */
    LAYERED_CLOTHING_ALGORITHM: "linear" | "linearnormal" | "linearnormal2" | "rbf",
    /**renders cage mesh instead of actual mesh */
    SHOW_CAGE: boolean,
    /**cooldown between mesh recompile */
    LAYERED_CLOTHING_COOLDOWN: number,
    /**function WorkerPool uses to create workers, replace with your own if workers cant be created using the default method */
    GET_WORKER_FUNC: () => Worker,

    /**amount of "patches" that are used for layered clothing, multiple verts share the same patch */
    RBF_PATCH_COUNT: number,
    /**amount of nearby vertices each patch samples from */
    RBF_PATCH_DETAIL_SAMPLES: number,
    /**amount of far-away vertices (importants) each patch samples from, this is done so that the overall mesh shape is preserved */
    RBF_PATCH_SHAPE_SAMPLES: number,

    /**forces vertex color to be white when false */
    USE_VERTEX_COLOR: boolean
    /**this is needed to enable bloom, but ugly since it disables anti aliasing... */
    USE_POST_PROCESSING: boolean,
    /**doubles render resolution when using post processing */
    POST_PROCESSING_IS_DOUBLE_SIZE: boolean,
    /**makes HumanoidDescription load gears */
    GEAR_ENABLED: boolean,
    /**makes Audio instances play sound when played */
    AUDIO_ENABLED: boolean,
    /**enables full texture compilation using ThreeJS RenderTarget */
    USE_RENDERTARGET: boolean,
    /**the renderer will attempt to restore the webgl context when it is lost */
    AUTO_RESTORE_CONTEXT: boolean,
    /**RenderTarget textures are converted to CanvasTextures which can be exported */
    RENDERTARGET_TO_CANVASTEXTURE: boolean,
    /**Amount of time thumbnail generator will wait after no assets are being loaded to resolve, should be a little time at least so particles can render */
    THUMBNAIL_TIMEOUT: number,
    /**Always render attachments even when theyre set to not be visible */
    ALWAYS_SHOW_ATTACHMENTS: boolean,

    /**shows ThreeJS SkeletonHelper */
    SHOW_SKELETON_HELPER: boolean,
    /**skeleton is updated every frame */
    UPDATE_SKELETON: boolean,
    /**skeleton is animated every frame */
    ANIMATE_SKELETON: boolean,
    /**autoskin is applied even when its disabled */
    AUTO_SKIN_EVERYTHING: boolean,
    /**skeleton is local instead of global (broken)
     * @deprecated No longer does anything
     */
    USE_LOCAL_SKELETONDESC: boolean,

    /**enables HSR (hidden surface removal) */
    ENABLE_HSR: boolean,
    /**shows rays created by HSR */
    HSR_SHOW_RAY: boolean,
    /**hides layered clothing */
    HIDE_LAYERED_CLOTHING: boolean,
    /**rays per triangle */
    HSR_RAY_COUNT: number,
    /**length of each ray */
    HSR_RAY_LENGTH: number,
    /**caches amount of hits for each triangle */
    CACHE_HSR_HITS: boolean,

    /**enables logging for non-critical information */
    VERBOSE_LOGGING: boolean,
    /**makes renderer print out strings in RBX that contain SEARCH_FOR_STRING */
    SEARCH_FOR_STRING: string | undefined,
    /**only used by RoAvatar, set this to a string to load a place file, for example "../assets/UniversalApp.rbxm" */
    LOAD_TEST_PLACE: string | undefined,
} = {
    //ui
    HAIR_IS_BODYPART: true,

    //dom
    AVATAR_JOINT_UPGRADE: false,
    INSTANCE_GARBAGE_COLLECT: false,
    LEGACY_WELD_BEHAVIOR: false,
    USE_ASSEMBLY: true,

    //api
    BODYCOLOR3: true,
    ENABLE_API_CACHE: true,
    ENABLE_API_MESH_CACHE: true,
    ENABLE_API_RBX_CACHE: true,
    ROAVATAR_DATA_URL: "rbxassetid://102463700065175", //url of model to load that lists issues with specific versions
    ROAVATAR_TRYON_PLACE: 122920847927474,
    ASSETDELIVERY_V2: true,
    ASSET_REQUEST_PRIORITY: "high",
    API_DOMAIN: "roblox.com",
    API_REQUEST_PREFIX: "",
    INCLUDE_REQUEST_CREDENTIALS_OVERRIDE: "include",
    API_REQUEST_RETRY: true,

    //assets
    ONLINE_ASSETS: false,
    ASSETS_PATH: "../assets/rbxasset/",
    RIG_PATH: "../assets/",

    //layered clothing
    USE_WORKERS: true,
    ENABLE_LC_WEIGHT_CACHE: true,
    INFLATE_LAYERED_CLOTHING: 0.05, //only used by linear algorithms
    LAYERED_CLOTHING_ALGORITHM: "rbf",
    SHOW_CAGE: false,
    LAYERED_CLOTHING_COOLDOWN: 0.25,
    GET_WORKER_FUNC: DefaultGetWorkerFunc,

    RBF_PATCH_COUNT: 300, //amount of "patches" that are used for layered clothing, multiple verts share the same patch
    RBF_PATCH_DETAIL_SAMPLES: 32, //amount of nearby vertices each patch samples from
    RBF_PATCH_SHAPE_SAMPLES: 32, //amount of far-away vertices (importants) each patch samples from, this is done so that the overall mesh shape is preserved

    //general rendering
    USE_VERTEX_COLOR: true,
    USE_POST_PROCESSING: false, //this is needed to enable bloom, but ugly since it disables anti aliasing...
    POST_PROCESSING_IS_DOUBLE_SIZE: true, //does this count as anti aliasing?
    GEAR_ENABLED: true,
    AUDIO_ENABLED: true,
    USE_RENDERTARGET: true,
    AUTO_RESTORE_CONTEXT: true,
    RENDERTARGET_TO_CANVASTEXTURE: false,
    THUMBNAIL_TIMEOUT: 500,
    ALWAYS_SHOW_ATTACHMENTS: false,

    //skeleton
    SHOW_SKELETON_HELPER: false,
    UPDATE_SKELETON: true,
    ANIMATE_SKELETON: true,
    AUTO_SKIN_EVERYTHING: false,
    USE_LOCAL_SKELETONDESC: false,

    //HSR
    ENABLE_HSR: true,
    HSR_SHOW_RAY: false,
    HIDE_LAYERED_CLOTHING: false,
    HSR_RAY_COUNT: 3,
    HSR_RAY_LENGTH: 0.4,
    CACHE_HSR_HITS: true,

    //debug
    VERBOSE_LOGGING: false,
    SEARCH_FOR_STRING: undefined, //"requestparams" //"looks/" //this is useful if you want to find api endpoints
    LOAD_TEST_PLACE: undefined, //"../assets/UniversalApp.rbxm" //"../assets/WrapDeformerTest.rbxm" //"../assets/DecalTest2.rbxm" //"../assets/TransparentDominus.rbxm" //"../assets/EmissiveTest.rbxm" //"../assets/Mesh Deformation Test.rbxl" //set this to a string to load a place file
}