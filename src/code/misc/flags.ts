export const FLAGS: {
    HAIR_IS_BODYPART: boolean,
    
    BODYCOLOR3: boolean,
    ENABLE_API_CACHE: boolean,
    ROAVATAR_DATA_URL: string,
    ROAVATAR_TRYON_PLACE: number,
    ASSETS_PATH: string,
    ASSETDELIVERY_V2: boolean,

    USE_WORKERS: boolean,
    ENABLE_LC_WEIGHT_CACHE: boolean,
    INFLATE_LAYERED_CLOTHING: number,
    LAYERED_CLOTHING_ALGORITHM: "linear" | "linearnormal" | "linearnormal2" | "rbf",

    RBF_PATCH_COUNT: number,
    RBF_PATCH_DETAIL_SAMPLES: 48,
    RBF_PATCH_SHAPE_SAMPLES: 32,

    USE_VERTEX_COLOR: boolean
    USE_POST_PROCESSING: boolean,
    POST_PROCESSING_IS_DOUBLE_SIZE: boolean,
    GEAR_ENABLED: boolean,

    SHOW_SKELETON_HELPER: boolean,
    UPDATE_SKELETON: boolean,
    ANIMATE_SKELETON: boolean,
    AUTO_SKIN_EVERYTHING: boolean,
    USE_LOCAL_SKELETONDESC: boolean,

    SEARCH_FOR_STRING: string | undefined,
    LOAD_TEST_PLACE: string | undefined,
} = {
    //ui
    HAIR_IS_BODYPART: true,

    //api
    BODYCOLOR3: true,
    ENABLE_API_CACHE: true,
    ROAVATAR_DATA_URL: "rbxassetid://102463700065175", //url of model to load that lists issues with specific versions
    ROAVATAR_TRYON_PLACE: 135979364355750,
    ASSETS_PATH: "../assets/rbxasset/",
    ASSETDELIVERY_V2: true,

    //layered clothing
    USE_WORKERS: true,
    ENABLE_LC_WEIGHT_CACHE: true,
    INFLATE_LAYERED_CLOTHING: 0.05, //only used by linear algorithms
    LAYERED_CLOTHING_ALGORITHM: "rbf",

    RBF_PATCH_COUNT: 300, //amount of "patches" that are used for layered clothing, multiple verts share the same patch
    RBF_PATCH_DETAIL_SAMPLES: 48, //amount of nearby vertices each patch samples from
    RBF_PATCH_SHAPE_SAMPLES: 32, //amount of far-away vertices (importants) each patch samples from, this is done so that the overall mesh shape is preserved

    //general rendering
    USE_VERTEX_COLOR: true,
    USE_POST_PROCESSING: false, //this is needed to enable bloom, but ugly since it disables anti aliasing...
    POST_PROCESSING_IS_DOUBLE_SIZE: true, //does this count as anti aliasing?
    GEAR_ENABLED: true,

    //skeleton
    SHOW_SKELETON_HELPER: false,
    UPDATE_SKELETON: true,
    ANIMATE_SKELETON: true,
    AUTO_SKIN_EVERYTHING: false,
    USE_LOCAL_SKELETONDESC: false,

    //debug
    SEARCH_FOR_STRING: undefined, //"requestparams" //"looks/" //this is useful if you want to find api endpoints
    LOAD_TEST_PLACE: undefined, //"../assets/UniversalApp.rbxm" //"../assets/WrapDeformerTest.rbxm" //"../assets/DecalTest2.rbxm" //"../assets/TransparentDominus.rbxm" //"../assets/EmissiveTest.rbxm" //"../assets/Mesh Deformation Test.rbxl" //set this to a string to load a place file
}