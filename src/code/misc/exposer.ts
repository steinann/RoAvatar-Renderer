/* eslint-disable @typescript-eslint/no-explicit-any */
import { API, CACHE as APICACHE, Authentication } from "../api"
import { fileMeshToTHREEGeometry } from "../render/subDescs/meshDesc";
import { FLAGS } from "./flags";
import { generateModelThumbnail, generateOutfitThumbnail, setupThumbnailScene } from "./thumbnail-generator";

export function exposeAPI() {
    (globalThis as any).API = API;
    (globalThis as any).APICACHE = APICACHE;
    (globalThis as any).Authentication = Authentication;
}

export function exposeMesh() {
    (globalThis as any).fileMeshToTHREEGeometry = fileMeshToTHREEGeometry;
}

export function exposeFLAGS() {
    (globalThis as any).FLAGS = FLAGS;
}

export function exposeThumbnailGenerator() {
    (globalThis as any).generateOutfitThumbnail = generateOutfitThumbnail;
    (globalThis as any).generateModelThumbnail = generateModelThumbnail;
    (globalThis as any).setupThumbnailScene = setupThumbnailScene;
}