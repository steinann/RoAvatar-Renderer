import type { Authentication } from "../api";
import { arrayBufferToBase64, base64ToArrayBuffer } from "../misc/misc"
import { Outfit } from "./outfit"
import { OutfitModel } from "./outfitModel";

export interface LocalOutfitJson {
    name: string;
    id: number;
    creator: number | undefined;
    date: number;
    image: string | undefined;
    buffer: string;
    bg?: number;
}

export class LocalOutfit {
    name: string
    id: number
    creator?: number
    date: number

    image?: string

    buffer: string

    bg: number = 0

    constructor(outfit: Outfit) {
        this.name = outfit.name
        this.id = outfit.id
        this.creator = outfit.creatorId
        this.date = Date.now()

        this.buffer = arrayBufferToBase64(outfit.toBuffer())
    }

    toJson(): LocalOutfitJson {
        return {
            name: this.name,
            id: this.id,
            creator: this.creator,
            date: this.date,

            image: this.image,

            buffer: this.buffer,

            bg: this.bg,
        }
    }

    fromJson(data: LocalOutfitJson) {
        this.name = data.name
        this.id = data.id
        this.creator = data.creator

        this.image = data.image

        this.buffer = data.buffer

        this.bg = data.bg || 0

        return this
    }

    update(outfit: Outfit) {
        this.buffer = arrayBufferToBase64(outfit.toBuffer())
        this.image = undefined
    }

    /**
     * @deprecated Use toOutfitModel() instead
     */
    async toOutfit(auth: Authentication): Promise<Outfit> {
        const outfit = new Outfit()
        outfit.name = this.name
        outfit.id = this.id
        outfit.creatorId = this.creator

        await outfit.fromBuffer(base64ToArrayBuffer(this.buffer), auth)

        return outfit
    }

    async toOutfitModel(auth: Authentication): Promise<OutfitModel> {
        const outfitModel = new OutfitModel()

        const outfit = outfitModel.outfit
        outfit.name = this.name
        outfit.id = this.id
        outfit.creatorId = this.creator

        await outfit.fromBuffer(base64ToArrayBuffer(this.buffer), auth)

        if (this.bg) {
            await outfit.addAssetId(this.bg, auth)

            const assetIndex = outfit.assets.findIndex((v) => {return v.id === this.bg})
            if (assetIndex >= 0) {
                const asset = outfit.assets[assetIndex]
                outfitModel.background = asset
                outfit.removeAsset(this.bg)
            }
        }

        return outfitModel
    }
}