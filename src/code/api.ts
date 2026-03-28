import type { AvatarInventory_Result, BundleDetails_Result, GetSubscription_Result, GetTopics_Payload, GetTopics_Result, ItemDetail_Result, ItemDetails_Result, Look_Result, MarketplaceWidgets_Result, NavigationMenuItems, Search_Payload, Search_Result, ThumbnailsCustomization_Payload, UserLooks_Result } from "./api-constant"
import { OutfitOrigin } from "./avatar/constant"
import { LocalOutfit, type LocalOutfitJson } from "./avatar/local-outfit"
import { BodyColors, Outfit } from "./avatar/outfit"
import { ItemSort } from "./avatar/sorts"
import { generateUUIDv4 } from "./misc/misc"
import { FileMesh } from "./mesh/mesh"
import { Event, RBX } from "./rblx/rbx"
import { RoAvatarData, type RoAvatarBrowser } from "./rblx/roavatar-data-parser"
import { FLAGS } from "./misc/flags"

declare const browser: typeof chrome;

export class Authentication {
    TOKEN?: string
    SessionUUID?: string

    info?: {id: number, name: string, displayName: string}

    lastRefreshed = new Date().getTime()

    async getUserInfo() {
        if (this.info) {
            return this.info
        }

        const info = await API.Users.GetUserInfo()
        this.info = info
        return info
    }

    async getToken() {
        throw new Error("Deprecated member function auth.getToken() was called!")
    }

    getCachedToken() {
        return this.TOKEN
    }

    getSessionUUID() {
        if (!this.SessionUUID) {
            this.SessionUUID = generateUUIDv4()
        }

        return this.SessionUUID
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function RBLXPost(url: string, auth: Authentication, body: any, attempt = 0, method = "POST"): Promise<Response> {
    if ((typeof body) !== "string") {
        body = JSON.stringify(body)
    }

    let xCsrfToken = ""

    if (auth) {
        xCsrfToken = auth.getCachedToken() || ""

        if (!xCsrfToken) {
            xCsrfToken = ""
        }
    }

    return new Promise((resolve) => {
        const fetchHeaders = new Headers({
            "Content-Type": "application/json",
            "X-CSRF-TOKEN": xCsrfToken,
        })

        try {
            fetch(url, {
                method: method,
                credentials: "include",
                headers: fetchHeaders,
                body: body
            }).then(response => {
                if (response.status !== 200) {
                    if (response.status === 403 && attempt < 1) { //refresh token
                        const responseToken = response.headers.get("x-csrf-token")
                        if (responseToken) {
                            auth.TOKEN = responseToken
                        }
                        resolve(RBLXPost(url, auth, body, attempt + 1, method))
                    } else {
                        resolve(response)
                    }
                } else {
                    resolve(response)
                }
            }).catch((error) => {
                console.warn(error)
                resolve(new Response(JSON.stringify({"error": error}), {status: 500}))
            })
        } catch (error) {
            console.warn(error)
            resolve(new Response(JSON.stringify({"error": error}), {status: 500}))
        }
    })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function RBLXGet(url: string, headers?: any, includeCredentials: boolean = true): Promise<Response> {
    return new Promise((resolve) => {
        let newHeaders: HeadersInit = {
            "Content-Type": "application/json",
        }

        if (headers) {
            newHeaders = {...newHeaders, ...headers}
        }

        if (url.includes("rbxcdn.com")) {
            includeCredentials = false
        }

        const fetchHeaders = new Headers(newHeaders)

        try {
            fetch(url, {
                credentials: includeCredentials ? "include" : undefined,
                headers: fetchHeaders,
            }).then(response => {
                resolve(response)
            }).catch((error) => {
                console.warn(error)
                resolve(new Response(JSON.stringify({"error": error}), {status: 500}))
            })
        } catch (error) {
            console.warn(error)
            resolve(new Response(JSON.stringify({"error": error}), {status: 500}))
        }
    })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function RBLXDelete(url: string, auth: Authentication, body: any, attempt = 0): Promise<Response> {
    return RBLXPost(url, auth, body, attempt, "DELETE")
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function RBLXPatch(url: string, auth: Authentication, body: any, attempt = 0): Promise<Response> {
    return RBLXPost(url, auth, body, attempt, "PATCH")
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAssetBufferInternal(url: string, headers: any, extraStr?: string) {
    API.Misc.startCurrentlyLoadingAssets()

    const fetchStr = await API.Misc.assetURLToCDNURL(url, headers, extraStr)
    if (fetchStr instanceof Response) {
        API.Misc.stopCurrentlyLoadingAssets()
        return fetchStr
    }

    const response = await RBLXGet(fetchStr, undefined, false)
    API.Misc.stopCurrentlyLoadingAssets()
    if (response.status === 200) {
        const data = await response.arrayBuffer()
        /*if (FLAGS.ENABLE_API_CACHE) {
            CACHE.AssetBuffer.set(cacheStr, data)
        }*/
        return data
    } else {
        return response
    }
}

let isCurrentlyLoading = false
let currentlyLoadingAssets = 0

function _updateCurrentlyLoadingAssets() {
    const newCurrentlyLoading = currentlyLoadingAssets > 0
    if (isCurrentlyLoading !== newCurrentlyLoading) {
        API.Events.OnLoadingAssets.Fire(newCurrentlyLoading)
    }
    isCurrentlyLoading = newCurrentlyLoading
}

type UserInfo = {id: number, name: string, displayName: string}

const CACHE = {
    "AssetBuffer": new Map<string,Promise<Response | ArrayBuffer>>(),
    "RBX": new Map<string,RBX>(),
    "Mesh": new Map<string,FileMesh>(),
    "Image": new Map<string,Promise<HTMLImageElement | undefined> | HTMLImageElement | undefined>(),
    "Thumbnails": new Map<string,string | undefined>(),
    "ItemOwned": new Map<string,[boolean,number]>(),
    "IsLayered": new Map<number,boolean>(),
    "AvatarInventoryItem": new Map<string,AvatarInventory_Result>(),
    "ItemDetails": new Map<string,ItemDetail_Result>(),
    "UserInfo": undefined,
}

const ContentMap = new Map<string,string>()
ContentMap.set("rbxasset://fonts/BaseballCap.mesh",	"12220916")
ContentMap.set("rbxasset://fonts/clonewand.mesh", "12221344")
ContentMap.set("rbxasset://fonts/fusedgirl.mesh", "12221423")
ContentMap.set("rbxasset://fonts/girlhair.mesh", "12221431")
ContentMap.set("rbxasset://fonts/hammer.mesh", "12221451")
ContentMap.set("rbxasset://fonts/NinjaMask.mesh", "12221524")
ContentMap.set("rbxasset://fonts/paintballgun.mesh", "11900867")
ContentMap.set("rbxasset://fonts/pawn.mesh", "12221585")
ContentMap.set("rbxasset://fonts/PirateHat.mesh", "12221595")
ContentMap.set("rbxasset://fonts/PoliceCap.mesh", "12221603")
ContentMap.set("rbxasset://fonts/rocketlauncher.mesh", "12221651")
ContentMap.set("rbxasset://fonts/slingshot.mesh", "12221682")
ContentMap.set("rbxasset://fonts/sombrero.mesh", "12221705")
ContentMap.set("rbxasset://fonts/sword.mesh", "12221720")
ContentMap.set("rbxasset://fonts/timebomb.mesh", "12221733")
ContentMap.set("rbxasset://fonts/tophat.mesh", "12221750")
ContentMap.set("rbxasset://fonts/tree.mesh", "12221787")
ContentMap.set("rbxasset://fonts/trowel.mesh", "12221793")
ContentMap.set("rbxasset://fonts/VikingHelmet.mesh", "12221815")

let CachedRoAvatarData: undefined | RoAvatarData = undefined

type ThumbnailInfo = {
    auth: Authentication,
    type: string,
    id: number | string,
    size: string,
    resolves: ((url: string | undefined) => void)[],
    attempt: number,
    lastTryTimestamp: number,
    headShape?: string,
}
let ThumbnailsToBatch: ThumbnailInfo[] = []

export const API = {
    "Misc": {
        "startCurrentlyLoadingAssets": function () {
            currentlyLoadingAssets += 1
            _updateCurrentlyLoadingAssets()
        },
        "stopCurrentlyLoadingAssets": function() {
            currentlyLoadingAssets -= 1
            _updateCurrentlyLoadingAssets()
        },
        "idFromStr": function(str: string) {
            const numStrs = str.match(/\d+(\.\d+)?/g) || []
            return numStrs.length > 0 ? Number(numStrs[numStrs.length - 1]) : NaN
        },
        "parseAssetString": function(str: string) {
            let url = str

            const contentUrl = ContentMap.get(str)
            if (contentUrl) {
                console.log("contentUrl", contentUrl)
                str = contentUrl
                url = str
            }

            //get fetch str/url
            if (!isNaN(Number(str))) {
                url = `https://assetdelivery.roblox.com/v1/asset?id=${str}`
            } else if (str.startsWith("rbxassetid://")) {
                url = `https://assetdelivery.roblox.com/v1/asset?id=${str.slice(13)}`
            } else if (str.startsWith("rbxasset://")) {
                str = str.replaceAll("\\","/")
                url = FLAGS.ASSETS_PATH + str.slice(11)
            } else if (str.includes("roblox.com/asset")) { //i am tired of the 1 million variants of https://www.roblox.com/asset/?id=
                url = `https://assetdelivery.roblox.com/v1/asset?id=${API.Misc.idFromStr(str)}`
            } else if (str.startsWith("https://assetdelivery.roblox.com/v1/asset/?id=")) {
                url = `https://assetdelivery.roblox.com/v1/asset?id=${str.slice(46)}`
            } else if (str.includes("assetdelivery.roblox.com")) {
                url = `https://assetdelivery.roblox.com/v1/asset?id=${API.Misc.idFromStr(str)}`
            } else if (str.startsWith(".")) { //local file
                url = str
            } else {
                console.warn(`Failed to parse path of ${str}`)
            }

            //use v2 instead if enabled
            if (FLAGS.ASSETDELIVERY_V2) {
                if (url.includes("/v1/")) {
                    url = url.replace("/v1/","/v2/")
                }
            }

            return url
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "getCDNURLFromAssetDelivery": async function(url: string, headers?: any): Promise<string | Response> {
            if (!FLAGS.ASSETDELIVERY_V2 || !url.includes("assetdelivery.roblox.com/v2/")) {
                return url
            } else {
                const response = await RBLXGet(url, headers)
                if (response.status !== 200) {
                    return response
                }

                const data = await response.json()

                return data.locations[0].location
            }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "assetURLToCDNURL": async function(url: string | number | bigint, headers?: any, extraStr?: string): Promise<string | Response> {
            url = String(url)
            if (url.includes("rbxcdn.com")) return extraStr ? url + extraStr : url

            let fetchStr = API.Misc.parseAssetString(url) || url
            if (extraStr) {
                fetchStr += extraStr
            }
            const cdnURL = await API.Misc.getCDNURLFromAssetDelivery(fetchStr, headers)
            return cdnURL
        }
    },
    "Events": {
        "OnLoadingAssets": new Event()
    },
    "Generic": {
        LoadImage: async function(url: string): Promise<HTMLImageElement | undefined> {
            return new Promise((resolve) => {
                const cacheURL = API.Misc.parseAssetString(url) || url

                const cachedImage = CACHE.Image.get(cacheURL)

                if (cachedImage) {
                    resolve(cachedImage)
                } else {
                    CACHE.Image.set(cacheURL, new Promise((cacheResolve) => {
                        API.Misc.assetURLToCDNURL(url).then((fetchStr) => {
                            if (fetchStr instanceof Response) {
                                resolve(undefined)
                                return
                            }
                            const image = new Image()
                            image.onload = () => {
                                cacheResolve(image)
                                resolve(image)
                                CACHE.Image.set(cacheURL, image)
                            }
                            image.onerror = () => {
                                cacheResolve(image)
                                resolve(undefined)
                                CACHE.Image.set(cacheURL, undefined)
                            }
                            image.crossOrigin = "anonymous"
                            image.src = fetchStr
                        })
                    }))
                }
            })
        },
        GetManifestVersion: function(): string {
            return (chrome || browser).runtime.getManifest().version
        },
        IsDevMode: function(): boolean {
            return !("update_url" in (chrome || browser).runtime.getManifest())
        },
        GetBrowser: function(): RoAvatarBrowser {
            if (API.Generic.IsDevMode()) {
                return "Dev"
            }

            if (navigator.userAgent.toLowerCase().indexOf("firefox") > -1) {
                return "Firefox"
            }

            if (navigator.userAgent.indexOf("Edg") > -1) {
                return "Edge"
            }

            return "Chrome"
        },
        GetRoAvatarData: async function(): Promise<RoAvatarData | Response | undefined> {
            if (CachedRoAvatarData) {
                return CachedRoAvatarData
            }

            const rbx = await API.Asset.GetRBX(FLAGS.ROAVATAR_DATA_URL)
            if (rbx instanceof Response) {
                console.warn("Failed to get RoAvatarData", rbx)
                return rbx
            }

            const root = rbx.generateTree()
            const data = root.FindFirstChild("RoAvatarData")
            if (data) {
                const roavatarData = new RoAvatarData()
                roavatarData.fromInstance(data)
                CachedRoAvatarData = roavatarData
                return roavatarData
            }

            return undefined
        },
        JoinPlace: function(placeId: number) {
            window.location.href = `roblox://placeId=${placeId}`
        }
    },
    "Auth": {
        GetAuth: async function() {
            const auth = new Authentication()

            return auth
        }
    },
    "Economy": {
        GetAssetDetails: async function(assetId: number) {
            return RBLXGet("https://economy.roblox.com/v2/assets/" + assetId + "/details")
        }
    },
    "Avatar": {
        WearOutfit: async function(auth: Authentication, outfit: Outfit, onlyItems: boolean): Promise<[boolean, boolean]> {
            return new Promise((returnResolve) => {
                const promises: Promise<Response>[] = []

                if (!onlyItems) {
                    //scale
                    promises.push(new Promise((resolve) => {
                        RBLXPost("https://avatar.roblox.com/v1/avatar/set-scales", auth, outfit.scale.toJson()).then(response => {
                            resolve(response)
                        })
                    }))

                    //bodyColors
                    const isBrickColor = outfit.bodyColors.colorType == "BrickColor"
                    promises.push(new Promise((resolve) => {
                        RBLXPost(`https://avatar.roblox.com/${isBrickColor ? "v1" : "v2"}/avatar/set-body-colors`, auth, outfit.bodyColors.toJson()).then(response => {
                            resolve(response)
                        })
                    }))

                    //playerAvatarType
                    promises.push(new Promise((resolve) => {
                        RBLXPost("https://avatar.roblox.com/v1/avatar/set-player-avatar-type", auth, {"playerAvatarType": outfit.playerAvatarType}).then(response => {
                            resolve(response)
                        })
                    }))
                }

                //assets
                promises.push(new Promise((resolve) => {
                    let ogResponse: Response | undefined = undefined

                    RBLXPost("https://avatar.roblox.com/v2/avatar/set-wearing-assets", auth, {"assets": outfit.getAssetsJson()}).then(response => {
                        ogResponse = response
                        return response.json()
                    }).then(body => {
                        if (body.success == false) {
                            const currentAssets = outfit.getAssetsJson()

                            for (let i = 0; i < body.invalidAssetIds.length; i++) {
                                for (let j = 0; j < currentAssets.length; j++) {
                                    if (currentAssets[j].id == body.invalidAssetIds[i]) {
                                        currentAssets.splice(j,1)
                                    }
                                }
                            }

                            RBLXPost("https://avatar.roblox.com/v2/avatar/set-wearing-assets", auth, {"assets": currentAssets}).then(() => {
                                resolve(new Response("", {status:201}))
                            })
                        } else {
                            resolve(ogResponse || new Response("", {status: 200}))
                        }
                    })
                }))

                Promise.all<Response>(promises).then(values => {
                    let isSuccess = true
                    let failedToWearAll = false

                    for (const value of values) {
                        console.log(value)
                        if (value.status !== 200 && value.status !== 201) {
                            isSuccess = false
                        }
                        if (value.status === 201) {
                            failedToWearAll = true
                        }
                    }

                    returnResolve([isSuccess, failedToWearAll])
                })
            })
        },
        SaveOutfitNoRetry: async function(auth: Authentication, outfit: Outfit) {
            const requestUrl = `https://avatar.roblox.com/${FLAGS.BODYCOLOR3 ? "v3" : "v2"}/outfits/create`

            return RBLXPost(requestUrl, auth, outfit.toCleanJson())
        },
        GetAvatarDetails: async function GetAvatarDetails(userId: number) {
            let requestUrl = "https://avatar.roblox.com/v1/users/"
            
            if (FLAGS.BODYCOLOR3) {
                requestUrl = "https://avatar.roblox.com/v2/avatar/users/"
            }

            const response = await RBLXGet(requestUrl + userId + "/avatar")

            if (response.status == 200) {
                const responseBody = await response.json()

                const outfit = new Outfit()
                outfit.fromJson(responseBody)
                outfit.id = userId
                outfit.creatorId = userId
                outfit.origin = OutfitOrigin.WebAvatar

                return outfit
            } else {
                return response
            }
        },
        GetHeadShapes: async function(pageToken: string | null | undefined): Promise<AvatarInventory_Result | Response> {
            const itemSort = new ItemSort(1, "headshape")
            
            return API.Avatar.GetAvatarInventory("1", pageToken, [itemSort])
        },
        GetAvatarInventory: async function (sortOption: string, pageToken: string | null | undefined, itemInfos: ItemSort[] = []): Promise<AvatarInventory_Result | Response> {
            let requestUrl = "https://avatar.roblox.com/v1/avatar-inventory?"
            let needsAnd = false

            if (pageToken) {
                requestUrl += `${needsAnd?"&":""}pageToken=${pageToken}`
                needsAnd = true
            }

            if (sortOption) {
                requestUrl += `${needsAnd?"&":""}sortOption=${sortOption}`
                needsAnd = true
            }

            for (let i = 0; i < itemInfos.length; i++) {
                const itemInfo = itemInfos[i]
                requestUrl += `${needsAnd?"&":""}itemCategories[${i}].ItemSubType=${itemInfo.subType}&itemCategories[${i}].ItemType=${itemInfo.itemType}`
                needsAnd = true
            }

            if (pageToken) {
                const cache = CACHE.AvatarInventoryItem.get(requestUrl)
                if (cache !== undefined) {
                    return cache
                }
            }

            const response = await RBLXGet(requestUrl)
            if (response.status !== 200) {
                return response
            } else {
                const result = await response.json()

                //we dont cache for outfits because it can change easily without updating page token (you can change their names)
                if (pageToken && !requestUrl.includes("ItemType=Outfit")) {
                    CACHE.AvatarInventoryItem.set(requestUrl, result)
                }

                return result
            }
        },
        GetOutfitDetails: async function(outfitId: number | string, userId: number): Promise<Response | Outfit> {
            let requestUrl = "https://avatar.roblox.com/v1/outfits/"

            if (FLAGS.BODYCOLOR3) {
                requestUrl = "https://avatar.roblox.com/v3/outfits/"
            }

            const response = await RBLXGet(requestUrl + outfitId + "/details")

            if (response.status == 200) {
                const responseJson = await response.json()

                const outfit = new Outfit()
                outfit.fromJson(responseJson)
                outfit.origin = OutfitOrigin.WebOutfit
                outfit.creatorId = userId

                return outfit
            } else {
                return response
            }
        },
        SaveOutfit: async function(auth: Authentication, outfit: Outfit) {
            const requestUrl = `https://avatar.roblox.com/${FLAGS.BODYCOLOR3 ? "v3" : "v2"}/outfits/create`

            const response = await RBLXPost(requestUrl, auth, outfit.toCleanJson())

            if (response.status === 200) {
                //AlertMessage("Successfully saved outfit to Roblox", false, 3000)
                return response
            } else if (response.status === 403) {
                //AlertMessage("Max outfits limit reached", true, 3000)
                return response
            } else {
                console.log("Trying without unowned assets...")

                const response = await RBLXPost(requestUrl, auth, outfit.toCleanJson(true))
                /*if (response.status != 200) {
                    let body = response.json()
                    if (body) {
                        if (body.errors) {
                            if (body.errors[0]) {
                                if (body.errors[0].code == 0) {
                                    AlertMessage("Invalid outfit (Invalid assets)", true, 3000)
                                } else if (body.errors[0].code == 4) {
                                    AlertMessage("Invalid outfit (Invalid Name)", true, 3000)
                                } else {
                                    AlertMessage("Invalid outfit", true, 3000)
                                }
                            } else {
                                AlertMessage("Invalid outfit", true, 3000)
                            }
                        } else {
                            AlertMessage("Invalid outfit", true, 3000)
                        }
                    } else {
                        AlertMessage("Invalid outfit", true, 3000)
                    }
                } else {
                    AlertMessage("Successfully saved outfit to Roblox", false, 3000)
                }*/
                return response
            }

            return response
        },
        UpdateOutfit: async function(auth: Authentication, outfitId: number | string, newOutfit: Outfit) {
            let requestUrl = "https://avatar.roblox.com/v1/outfits/"

            if (FLAGS.BODYCOLOR3) {
                requestUrl = "https://avatar.roblox.com/v3/outfits/"
            }
            
            requestUrl += outfitId

            const response = RBLXPatch(requestUrl, auth, JSON.stringify(newOutfit.toCleanJson()))

            return response
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        PatchOutfit: async function(auth: Authentication, outfitId: number | string, patchData: any) {
            let requestUrl = "https://avatar.roblox.com/v1/outfits/"

            if (FLAGS.BODYCOLOR3) {
                requestUrl = "https://avatar.roblox.com/v3/outfits/"
            }
            
            requestUrl += outfitId

            const response = RBLXPatch(requestUrl, auth, JSON.stringify(patchData))

            return response
        },
        DeleteOutfit: async function(auth: Authentication, outfitId: number | string) {
            return await RBLXPost(`https://avatar.roblox.com/v1/outfits/${outfitId}/delete`, auth, "")
        },
        GetEmotes: async function(): Promise<Response> {
            return await RBLXGet("https://avatar.roblox.com/v1/emotes")
        },
        EquipEmote: async function(auth: Authentication, assetId: number | string, slot: number): Promise<Response> {
            return await RBLXPost(`https://avatar.roblox.com/v1/emotes/${assetId}/${slot}`, auth, "")
        },
        UnequipEmote: async function(auth: Authentication, slot: number): Promise<Response> {
            return await RBLXDelete(`https://avatar.roblox.com/v1/emotes/${slot}`, auth, "")
        },
        GetAvatarRules: async function(): Promise<Response> {
            return await RBLXGet("https://avatar.roblox.com/v1/avatar-rules")
        },
        RedrawThumbnail: async function(auth: Authentication): Promise<Response> {
            return await RBLXPost("https://avatar.roblox.com/v1/avatar/redraw-thumbnail", auth, "")
        },
        GetThumbnailCustomization: async function(): Promise<Response> {
            return await RBLXGet("https://avatar.roblox.com/v1/avatar/thumbnail-customizations")
        },
        SetThumbnailCustomization: async function(auth: Authentication, body: ThumbnailsCustomization_Payload): Promise<Response> {
            return await RBLXPost("https://avatar.roblox.com/v1/avatar/thumbnail-customization", auth, body)
        },
        ResetThumbnailCustomization: async function(auth: Authentication, thumbnailType: number): Promise<Response> {
            return API.Avatar.SetThumbnailCustomization(auth, {
                thumbnailType: thumbnailType,
                emoteAssetId: 0,
                camera: {
                    fieldOfViewDeg: 30,
                    yRotDeg: 0,
                    distanceScale: -1,
                }
            })
        }
    },
    "Asset": {
        GetAssetBuffer: async function(url: string, headers?: HeadersInit, extraStr?: string): Promise<Response | ArrayBuffer> {
            let cacheStr = API.Misc.parseAssetString(url) || url
            if (headers) {
                cacheStr += JSON.stringify(headers)
            }
            if (extraStr) {
                cacheStr += extraStr
            }

            const cachedBuffer = CACHE.AssetBuffer.get(cacheStr)
            if (cachedBuffer) {
                return cachedBuffer
            } else {
                const promise = new Promise<ArrayBuffer | Response>((resolve) => {
                    getAssetBufferInternal(url, headers, extraStr).then((result) => {
                        resolve(result)
                    })
                })

                if (FLAGS.ENABLE_API_CACHE) {
                    CACHE.AssetBuffer.set(cacheStr, promise)
                }

                return promise
            }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        GetRBX: async function(url: string, headers?: HeadersInit, contentRepresentationPriorityList?: any): Promise<Response | RBX> {
            const fetchStr = url

            let cacheStr = fetchStr
            if (headers) {
                cacheStr += JSON.stringify(headers)
            }
            const contentRepresentationPriorityListBASE64 = contentRepresentationPriorityList ? btoa(JSON.stringify(contentRepresentationPriorityList)) : undefined
            if (contentRepresentationPriorityListBASE64) {
                cacheStr += contentRepresentationPriorityListBASE64
            }

            const cachedRBX = CACHE.RBX.get(cacheStr)
            if (cachedRBX) {
                return cachedRBX.clone()
            } else {
                let extraStr = ""
                if (contentRepresentationPriorityListBASE64) {
                    extraStr += `&contentRepresentationPriorityList=${contentRepresentationPriorityListBASE64}`
                }

                const response = await this.GetAssetBuffer(fetchStr, headers, extraStr)
                if (response instanceof ArrayBuffer) {
                    const buffer = response
                    const rbx = new RBX()
                    rbx.fromBuffer(buffer)
                    if (FLAGS.ENABLE_API_CACHE && FLAGS.ENABLE_API_RBX_CACHE) {
                        CACHE.RBX.set(cacheStr, rbx.clone())
                    }
                    return rbx
                } else {
                    return response
                }
            }
        },
        GetMesh: async function(url: string, headers?: HeadersInit, readOnly: boolean = false): Promise<FileMesh | Response> {
            const fetchStr = url

            let cacheStr = fetchStr
            if (headers) {
                cacheStr += JSON.stringify(headers)
            }

            const cachedMesh = CACHE.Mesh.get(cacheStr)
            if (cachedMesh) {
                if (readOnly) {
                    return cachedMesh
                } else {
                    return cachedMesh.clone()
                }
            } else {
                const response = await this.GetAssetBuffer(fetchStr, headers)
                if (response instanceof ArrayBuffer) {
                    const buffer = response
                    const mesh = new FileMesh()
                    await mesh.fromBuffer(buffer)
                    if (FLAGS.ENABLE_API_CACHE && FLAGS.ENABLE_API_MESH_CACHE) {
                        CACHE.Mesh.set(cacheStr, mesh.clone())
                    }
                    return mesh
                } else {
                    return response
                }
            }
        },
        IsLayered: async function(id: number): Promise<boolean | Response> {
            const cached = CACHE.IsLayered.get(id)
            if (cached !== undefined) {
                return cached
            }

            const result = await API.Asset.GetRBX(`rbxassetid://${id}`, undefined)
            if (result instanceof RBX) {
                const dataModel = result.generateTree()
                const descendants = dataModel.GetDescendants()
                let hasWrapLayer = false

                for (const child of descendants) {
                    if (child.className === "WrapLayer") {
                        hasWrapLayer = true
                    }
                }

                CACHE.IsLayered.set(id, hasWrapLayer)

                return hasWrapLayer
            } else {
                console.warn("Failed to get accessory")
                return result
            }
        }
    },
    "Catalog": {
        GetNavigationMenuItems: async function() {
            const response = await RBLXGet("https://catalog.roblox.com/v1/search/navigation-menu-items")

            if (response.status !== 200) {
                return response
            }

            return (await response.json()) as NavigationMenuItems
        },
        GetTopics: async function(auth: Authentication, body: GetTopics_Payload) {
            const response = await RBLXPost("https://catalog.roblox.com/v1/search/navigation-menu-items", auth, body)

            if (response.status !== 200) {
                return response
            }

            return (await response.json()) as GetTopics_Result
        },
        Search: async function({taxonomy, salesTypeFilter = 1, sortType, categoryFilter, keyword, topics, creatorName, minPrice, maxPrice, includeNotForSale, limit = 120}: Search_Payload, cursor?: string) {
            /*https://catalog.roblox.com/v2/search/items/details?
            keyword=mariah&
            TriggeredByTopicDiscovery=true&
            topics=steven&
            taxonomy=u5jaNLyf2ZhvR95GS37ui5&
            creatorName=roblox&
            minPrice=1&
            salesTypeFilter=2&
            sortType=3&
            includeNotForSale=true&
            limit=120*/
            let url = `https://catalog.roblox.com/v2/search/items/details?taxonomy=${taxonomy}&salesTypeFilter=${salesTypeFilter}&`
            if (sortType !== undefined) url += `sortType=${sortType}&`
            if (categoryFilter !== undefined) url += `categoryFilter=${categoryFilter}&`
            if (keyword !== undefined) url += `keyword=${keyword}&`
            if (topics !== undefined) {
                let topicsStr = ""

                for (const topic of topics) {
                    if (topicsStr.length < 1) {
                        topicsStr += topic
                    } else {
                        topicsStr += " " + topic
                    }
                }

                url += `topics=${topicsStr}&`
            }
            if (creatorName !== undefined) url += `creatorName=${creatorName}&`
            if (minPrice !== undefined) url += `minPrice=${minPrice}&`
            if (maxPrice !== undefined) url += `maxPrice=${maxPrice}&`
            if (includeNotForSale !== undefined) url += `includeNotForSale=${includeNotForSale}&`
            if (cursor !== undefined) url += `cursor=${cursor}&`
            url += `limit=${limit}`

            const response = await RBLXGet(url)

            if (response.status !== 200) {
                return response
            }

            return (await response.json()) as Search_Result
        },
        GetBundleDetails: async function(bundleId: number | string) {
            const response = await RBLXGet(`https://catalog.roblox.com/v1/catalog/items/${bundleId}/details?itemType=Bundle`)

            if (response.status !== 200) {
                return response
            }

            return (await response.json()) as BundleDetails_Result
        },
        GetItemDetails: async function(auth: Authentication, items: {itemType: "Asset" | "Bundle", id: number}[]) {
            const finalResult: ItemDetails_Result = {
                data: []
            }

            for (let i = items.length - 1; i >= 0; i--) {
                const item = items[i]

                const cacheDetail = CACHE.ItemDetails.get(item.itemType + item.id)
                if (cacheDetail) {
                    finalResult.data.push(cacheDetail)
                    items.splice(items.indexOf(item), 1)
                }
            }

            if (items.length > 0) {
                const response = await RBLXPost(`https://catalog.roblox.com/v1/catalog/items/details`, auth, {
                    items
                })

                if (response.status !== 200) {
                    return response
                }

                const result = await response.json() as ItemDetails_Result

                for (const itemDetail of result.data) {
                    CACHE.ItemDetails.set(itemDetail.itemType + itemDetail.id, itemDetail)
                }

                finalResult.data = finalResult.data.concat(result.data)
            }

            return finalResult
        },
        GetMarketplaceWidgetsSearch: async function(query: string) {
            const response = await RBLXGet(`https://apis.roblox.com/marketplace-widgets/v1/widgets/search?query=${query}`)

            if (response.status !== 200) {
                return response
            }

            return (await response.json()) as MarketplaceWidgets_Result
        },
        GetMarketplaceWidgets: async function(context?: string) { //context=catalog-tab:avatars (doesnt work? weird...)
            let url = `https://apis.roblox.com/marketplace-widgets/v1/widgets`
            if (context) {
                url += `?context=${context}`
            }

            const response = await RBLXGet(url)

            if (response.status !== 200) {
                return response
            }

            return (await response.json()) as MarketplaceWidgets_Result
        },
        //https://apis.roblox.com/marketplace-widgets/v1/pills
    },
    "Inventory": {
        GetInventory: async function(userId: number, assetType: number, cursor?: string): Promise<Response> {
            let requestUrl = `https://inventory.roblox.com/v2/users/${userId}/inventory/${assetType}?sortOrder=Desc&limit=100`

            if (cursor) {
                requestUrl += `&cursor=${cursor}`
            }

            return RBLXGet(requestUrl)
        },
        IsItemOwned: async function(userId: number, itemType: string, assetId: number) {
            const cacheResult = CACHE.ItemOwned.get(`${userId}.${itemType}.${assetId}`)
            if (cacheResult) {
                if (cacheResult[0]) return true

                if ((new Date().getTime() - cacheResult[1]) < 5) return false
            }

            const response = await RBLXGet(`https://inventory.roblox.com/v1/users/${userId}/items/${itemType}/${assetId}/is-owned`)
         
            if (response.status !== 200) {
                return response
            }

            const responseBool = await response.json()

            if (responseBool) {
                CACHE.ItemOwned.set(`${userId}.${itemType}.${assetId}`, [true, 0])
            } else {
                CACHE.ItemOwned.set(`${userId}.${itemType}.${assetId}`, [false, new Date().getTime() / 1000])
            }

            return responseBool
        }
    },
    "Users": {
        GetUserInfo: async function() {
            if (CACHE.UserInfo) {
                return CACHE.UserInfo as UserInfo
            }

            const response = await RBLXGet("https://users.roblox.com/v1/users/authenticated")
            
            if (response.status == 200) {
                const result = await response.json() as UserInfo
                (CACHE.UserInfo as unknown) = result
                return result
            } else {
                console.warn("Failed to get user info: GetUserInfo(auth)")
                return undefined
            }
        }
    },
    "Thumbnails": {
        GetThumbnail: function(auth: Authentication, type: string, id: number | string, size: string = "150x150", headShape?: string): Promise<string | undefined> {
            const thisThumbnailInfo: ThumbnailInfo = {
                auth: auth,
                type: type,
                id: id,
                size: size,
                attempt: 0,
                resolves: [],
                lastTryTimestamp: 0,
                headShape: headShape,
            }

            const cachedThumbnail = CACHE.Thumbnails.get(requestIdFromThumbnailInfo(thisThumbnailInfo))
            if (CACHE.Thumbnails.has(requestIdFromThumbnailInfo(thisThumbnailInfo))) {
                return new Promise(resolve => {
                    resolve(cachedThumbnail)
                })
            }
            
            for (const thumbnailInfo of ThumbnailsToBatch) {
                if (requestIdFromThumbnailInfo(thumbnailInfo) === requestIdFromThumbnailInfo(thisThumbnailInfo)) {
                    return new Promise(resolve => {
                        thumbnailInfo.resolves.push(resolve)
                    })
                }
            }

            return new Promise(resolve => {
                ThumbnailsToBatch.push({
                    auth: auth,
                    type: type,
                    id: id,
                    size: size,
                    resolves: [resolve],
                    attempt: 0,
                    lastTryTimestamp: 0,
                    headShape: headShape,
                })
            })
        },
        UncacheThumbnail: function(type: string, id: number | string, size: string = "150x150", headShape?: string) {
            const thisThumbnailInfo: ThumbnailInfo = {
                auth: new Authentication(),
                type: type,
                id: id,
                size: size,
                attempt: 0,
                resolves: [],
                lastTryTimestamp: 0,
                headShape: headShape
            }

            CACHE.Thumbnails.delete(requestIdFromThumbnailInfo(thisThumbnailInfo))
        },
        RenderOutfit: async function(auth: Authentication, outfit: Outfit, size: string = "150x150", thumbnailType: string = "2dWebp", attempt: number = 0): Promise<string | undefined> {
            return new Promise((resolve) => {
                if (attempt > 3) {
                    resolve(undefined)
                    return
                }

                const bodyToUse = {
                    "thumbnailConfig":{
                        "thumbnailId": 3,
                        "thumbnailType": thumbnailType,
                        "size": size
                    },
                    "avatarDefinition":{
                        "assets": outfit.getAssetsJson(),
                        "bodyColors":outfit.bodyColors.toHexJson(),
                        "scales":outfit.scale.toJson(),
                        "playerAvatarType":{
                            "playerAvatarType":outfit.playerAvatarType
                        }
                    }
                }

                RBLXPost("https://avatar.roblox.com/v1/avatar/render", auth, bodyToUse).then(data => {
                    return data.json()
                }).then(body => {
                    if (body.state != "Pending") {
                        resolve(body.imageUrl)
                    } else {
                        setTimeout(() => {
                            resolve(API.Thumbnails.RenderOutfit(auth, outfit, size, thumbnailType, attempt + 1))
                        }, 1000 + attempt * 1000)
                    }
                })
            })
        }
    },
    "LocalOutfit": {
        GetLocalOutfits: async function(): Promise<LocalOutfit[]> {
            const data = await (chrome || browser).storage.local.get(["localOutfits"])
            const localOutfitJsons = data["localOutfits"] as LocalOutfitJson[]
            if (!localOutfitJsons) {
                return []
            }

            const localOutfits: LocalOutfit[] = []
            for (const json of localOutfitJsons) {
                localOutfits.push(new LocalOutfit(new Outfit()).fromJson(json))
            }
            return localOutfits
        },
        SetLocalOutfits: async function(localOutfits: LocalOutfit[]): Promise<undefined> {
            const localOutfitsJson: LocalOutfitJson[] = []
            for (const localOutfit of localOutfits) {
                localOutfitsJson.push(localOutfit.toJson())
            }
            await (chrome || browser).storage.local.set({"localOutfits": localOutfitsJson})
        }
    },
    "Looks": {
        GetLook: async function(lookId: string): Promise<Response | Look_Result> {
            const response = await RBLXGet(`https://apis.roblox.com/look-api/v2/looks/${lookId}`)

            if (response.status !== 200) {
                return response
            }

            return (await response.json()) as Look_Result
        },
        GetUserLooks: async function(userId: number, cursor?: string): Promise<Response | UserLooks_Result> {
            let url = `https://apis.roblox.com/look-api/v1/users/${userId}/looks?limit=50`

            if (cursor) {
                url += `&cursor=${cursor}`
            }

            const response = await RBLXGet(url)

            if (response.status !== 200) {
                return response
            }

            return (await response.json()) as UserLooks_Result
        },
        CreateLook: async function(auth: Authentication, outfit: Outfit, name: string, description: string): Promise<Response> {
            let bodyColors = outfit.bodyColors
            if (bodyColors instanceof BodyColors) {
                bodyColors = bodyColors.toColor3()
            }

            const body = {
                name,
                description,
                displayProperties: null,
                avatarProperties: {
                    playerAvatarType: outfit.playerAvatarType,
                    scale: outfit.scale.toJson(),
                    bodyColor3s: bodyColors.toJson()
                },
                assets: outfit.getAssetsJson(),
            }
            console.log(body)

            const response = await RBLXPost("https://apis.roblox.com/look-api/v1/looks/create", auth, body)

            return response
        },
        DeleteLook: async function(auth: Authentication, lookId: string): Promise<Response> {
            const response = await RBLXDelete(`https://apis.roblox.com/look-api/v1/looks/${lookId}`, auth, {})

            return response
        }
    },
    "PremiumFeatures": {
        GetSubscription: async function(userId: number): Promise<Response | GetSubscription_Result> {
            const response = await RBLXGet(`https://premiumfeatures.roblox.com/v1/users/${userId}/subscriptions`)

            if (response.status !== 200) {
                return response
            }

            return (await response.json()) as GetSubscription_Result
        }
    }
}

let currentLoadingThumbnails = false
function requestIdFromThumbnailInfo(thumbnailInfo: ThumbnailInfo) {
    let requestId = thumbnailInfo.id + ":undefined:" + thumbnailInfo.type + ":" + thumbnailInfo.size + ":webp:regular"
    if (thumbnailInfo.headShape) {
        requestId += `:${thumbnailInfo.headShape}`
    }
    return requestId
}

function PurgeFailedThumbnails() {
    ThumbnailsToBatch = ThumbnailsToBatch.filter((val) => {
        const cachedThumbnail = CACHE.Thumbnails.get(requestIdFromThumbnailInfo(val))
        const shouldPurge = val.attempt > 3 || cachedThumbnail
        if (shouldPurge && !cachedThumbnail) {
            if (FLAGS.ENABLE_API_CACHE) {
                CACHE.Thumbnails.set(requestIdFromThumbnailInfo(val), undefined)
            }

            for (const resolve of val.resolves) {
                resolve(undefined)
            }
        }

        return val.attempt <= 3 && !CACHE.Thumbnails.get(requestIdFromThumbnailInfo(val))
    })
}

function BatchThumbnails() {
    let auth: Authentication | undefined = undefined
    const body = []
    for (const thumbnailInfo of ThumbnailsToBatch) {
        if (Date.now() / 1000 - thumbnailInfo.lastTryTimestamp < 1 + thumbnailInfo.attempt) {
            continue
        }

        body.push({
            "format": "webp",
            "requestId": requestIdFromThumbnailInfo(thumbnailInfo),
            "size": thumbnailInfo.size,
            "targetId": thumbnailInfo.id,
            "type": thumbnailInfo.type,
            "headShape": thumbnailInfo.headShape,
        })

        auth = thumbnailInfo.auth

        thumbnailInfo.lastTryTimestamp = Date.now() / 1000
        thumbnailInfo.attempt++

        if (body.length >= 30) {
            break
        }
    }

    if (body.length > 0 && auth) {
        currentLoadingThumbnails = true
        RBLXPost("https://thumbnails.roblox.com/v1/batch", auth, body).then((response) => {
            if (response.status === 200) {
                response.json().then(body => {
                    for (const result of body.data) {
                        for (const thumbnailInfo of ThumbnailsToBatch) {
                            if (requestIdFromThumbnailInfo(thumbnailInfo) === result.requestId) {
                                if (result.state === "Completed") {
                                    for (const resolve of thumbnailInfo.resolves) {
                                        if (FLAGS.ENABLE_API_CACHE) {
                                            CACHE.Thumbnails.set(result.requestId, result.imageUrl)
                                        }
                                        resolve(result.imageUrl)
                                        thumbnailInfo.attempt = 999
                                    }
                                } else if (result.state !== "Pending") {
                                    thumbnailInfo.attempt = 999
                                }
                            }
                        }
                    }
                })
            }
        }).finally(() => {
            PurgeFailedThumbnails()
            currentLoadingThumbnails = false
        })
    }
}

setInterval(() => {
    if (!currentLoadingThumbnails) {
        BatchThumbnails()
    }
},10)

// Extend the Window interface to include the API property
declare global {
    interface Window {
        API: typeof API;
        APICACHE: typeof CACHE;
        Authentication: typeof Authentication;
    }
}

window.API = API
window.APICACHE = CACHE
window.Authentication = Authentication