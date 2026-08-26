import type { AvatarModel_Result, OutfitModel_Result } from "../api-constant";
import { Asset } from "./asset";
import { Outfit } from "./outfit";
import { ThumbnailCustomization } from "./thumbnailCustomization";

/**
 * Usually obtained from API, not to be confused with Outfit which cannot contain things such as backgrounds
 * @category Outfit
 */
export class OutfitModel {
    outfit: Outfit = new Outfit()
    emotes: Map<number,Asset> = new Map()
    background?: Asset
    thumbnailCustomizations?: ThumbnailCustomization[]
    profileFrame: undefined

    fromJson(outfitModel: AvatarModel_Result | OutfitModel_Result): OutfitModel {
        const config = "avatarConfigurations" in outfitModel ? outfitModel.avatarConfigurations : outfitModel.outfitConfigurations

        this.outfit.fromJson("avatarModel" in outfitModel ? outfitModel.avatarModel : outfitModel.outfitModel)
        
        if (config) {
            if (config.emotes) {
                for (const emote of config.emotes) {
                    const asset = new Asset()
                    asset.id = emote.assetId
                    asset.name = emote.assetName

                    this.emotes.set(emote.position, asset)
                }
            }

            if (config.background) {
                const asset = new Asset()
                asset.fromJson(config.background.backgroundAsset)
                this.background = asset
            }

            if (config.thumbnailCustomizations) {
                this.thumbnailCustomizations = []

                for (const json of config.thumbnailCustomizations) {
                    this.thumbnailCustomizations.push(new ThumbnailCustomization(json.thumbnailType).fromJson(json))
                }
            }
        }

        return this
    }

    clone(): OutfitModel {
        const copy = new OutfitModel()
        copy.outfit = this.outfit.clone()
        copy.emotes = new Map()

        for (const key of this.emotes.keys()) {
            copy.emotes.set(key, this.emotes.get(key)!)
        }

        copy.background = this.background?.clone()

        if (this.thumbnailCustomizations) {
            copy.thumbnailCustomizations = []
            for (const customization of this.thumbnailCustomizations) {
                copy.thumbnailCustomizations.push(customization.clone())
            }
        }

        copy.profileFrame = this.profileFrame

        return copy
    }
}