/*import { API, Authentication } from "./api";
import { AccessoryAssetTypes, ActualBundleTypes, Asset, AssetMeta, AssetType, AssetTypeNameToId, AssetTypes, BundleTypes, CatalogBundleTypes, ItemInfo, LayeredAssetTypes, MaxOneOfAssetTypes, SpecialLayeredAssetTypes, ToRemoveBeforeBundleType, WearableAssetTypes } from "./avatar/asset";
import { BrickColors, defaultShirtAssetIds, defaultPantAssetIds, defaultShirtTemplateAssetIds, defaultPantTemplateAssetIds, minimumDeltaEBodyColorDifference, LayeredClothingAssetOrder, MaxPerAsset, OutfitOrigin, AvatarType, RegularBodyColors, FullBodyColors, accessoryRefinementTypes, accessoryRefinementLowerBounds, accessoryRefinementUpperBounds } from "./avatar/constant";
import { Outfit } from "./avatar/outfit";
import AnimatorWrapper from "./rblx/instance/Animator";
import HumanoidDescriptionWrapper from "./rblx/instance/HumanoidDescription";
import { CFrame, Instance, Property, RBX, Vector3, Event, Connection, ColorSequence, ColorSequenceKeypoint, NumberSequence, NumberSequenceKeypoint, Color3uint8, Color3, Vector2, NumberRange, Ray, UDim, UDim2 } from "./rblx/rbx";
import { mount, RBXRenderer } from "./render/renderer";

module.exports = {
    //api
    "Authentication": Authentication,
    "API": API,

    //rendering
    "RBXRenderer": RBXRenderer,
    "mountRenderer": mount,

    //avatar data
    "Outfit": Outfit,

    //asset data
    "Asset": Asset,
    "AssetMeta": AssetMeta,
    "AssetType": AssetType,

    "AssetTypes": AssetTypes,
    "WearableAssetTypes": WearableAssetTypes,
    "AccessoryAssetTypes": AccessoryAssetTypes,
    "LayeredAssetTypes": LayeredAssetTypes,
    "SpecialLayeredAssetTypes": SpecialLayeredAssetTypes,
    "MaxOneOfAssetTypes": MaxOneOfAssetTypes,
    "ToRemoveBeforeBundleType": ToRemoveBeforeBundleType,
    "AssetTypeNameToId": AssetTypeNameToId,
    "ActualBundleTypes": ActualBundleTypes,
    "BundleTypes": BundleTypes,
    "CatalogBundleTypes": CatalogBundleTypes,
    "ItemInfo": ItemInfo,
    "BrickColors": BrickColors,
    "defaultShirtAssetIds": defaultShirtAssetIds,
    "defaultPantAssetIds": defaultPantAssetIds,
    "defaultShirtTemplateAssetIds": defaultShirtTemplateAssetIds,
    "defaultPantTemplateAssetIds": defaultPantTemplateAssetIds,
    "minimumDeltaEBodyColorDifference": minimumDeltaEBodyColorDifference,
    "LayeredClothingAssetOrder": LayeredClothingAssetOrder,
    "MaxPerAsset": MaxPerAsset,
    "OutfitOrigin": OutfitOrigin,
    "AvatarType": AvatarType,
    "RegularBodyColors": RegularBodyColors,
    "FullBodyColors": FullBodyColors,
    "accessoryRefinementTypes": accessoryRefinementTypes,
    "accessoryRefinementLowerBounds": accessoryRefinementLowerBounds,
    "accessoryRefinementUpperBounds": accessoryRefinementUpperBounds,

    //rbx dom
    "RBX": RBX,
    "Instance": Instance,
    "Property": Property,
    "Event": Event,
    "Connection": Connection,

    //instance properties
    "CFrame": CFrame,
    "Vector3": Vector3,
    "Vector2": Vector2,
    "NumberRange": NumberRange,
    "ColorSequence": ColorSequence,
    "ColorSequenceKeypoint": ColorSequenceKeypoint,
    "NumberSequence": NumberSequence,
    "NumberSequenceKeypoint": NumberSequenceKeypoint,
    "Color3uint8": Color3uint8,
    "Color3": Color3,
    "Ray": Ray,
    "UDim": UDim,
    "UDim2": UDim2,

    //instance wrappers
    "HumanoidDescriptionWrapper": HumanoidDescriptionWrapper,
    "AnimatorWrapper": AnimatorWrapper,
}*/

export * from "./api"
export * from "./api-constant"
export * from "./browser"

export * from "./avatar/asset"
export * from "./avatar/constant"
export * from "./avatar/local-outfit"
export * from "./avatar/outfit"
export * from "./avatar/sorts"

export * from "./lib/simple-view"

export * from "./misc/flags"
export * from "./misc/misc"

export * from "./rblx/rbx"
export * from "./rblx/roavatar-data-parser"
export * from "./rblx/scale"
export * from "./rblx/wrapper-register"
export * from "./rblx/constant"
export * from "./rblx/animation"

export * from "./rblx/instance/AccessoryDescription"
export * from "./rblx/instance/Animator"
export * from "./rblx/instance/BodyPartDescription"
export * from "./rblx/instance/FaceControls"
export * from "./rblx/instance/HumanoidDescription"
export * from "./rblx/instance/MakeupDescription"
export * from "./rblx/instance/Model"
export * from "./rblx/instance/Script"
export * from "./rblx/instance/Sound"
export * from "./rblx/instance/Tool"

export * from "./render/renderer"