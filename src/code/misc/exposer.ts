/* eslint-disable @typescript-eslint/no-explicit-any */
import { API, CACHE as APICACHE, Authentication } from "../api"
import { fileMeshToTHREEGeometry } from "../render/subDescs/meshDesc";

export function exposeAPI() {
    (globalThis as any).API = API;
    (globalThis as any).APICACHE = APICACHE;
    (globalThis as any).Authentication = Authentication;
}

export function exposeMesh() {
    (globalThis as any).fileMeshToTHREEGeometry = fileMeshToTHREEGeometry;
}