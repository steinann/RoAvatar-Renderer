import type { ThumbnailsCustomization_Payload } from "../api-constant"

/**
 * @category Outfit
 */
export class ThumbnailCustomization {
    thumbnailType: number
    emoteAssetId: number = 0
    fieldOfViewDeg: number = 28.751935958862305
    yRotDeg: number = 0
    distanceScale: number = 1

    constructor(thumbnailType: number) {
        this.thumbnailType = thumbnailType
    }

    fromJson(json: ThumbnailsCustomization_Payload) {
        this.emoteAssetId = json.emoteAssetId
        this.fieldOfViewDeg = json.camera.fieldOfViewDeg
        this.yRotDeg = json.camera.yRotDeg
        this.distanceScale = json.camera.distanceScale

        return this
    }

    toJson(): ThumbnailsCustomization_Payload {
        return {
            thumbnailType: this.thumbnailType,
            emoteAssetId: this.emoteAssetId,
            camera: {
                fieldOfViewDeg: this.fieldOfViewDeg,
                yRotDeg: this.yRotDeg,
                distanceScale: this.distanceScale,
            }
        }
    }

    clone(): ThumbnailCustomization {
        const copy = new ThumbnailCustomization(this.thumbnailType)
        copy.emoteAssetId = this.emoteAssetId
        copy.fieldOfViewDeg = this.fieldOfViewDeg
        copy.yRotDeg = this.yRotDeg
        copy.distanceScale = this.distanceScale

        return copy
    }
}