import { RenderDesc } from "../renderDesc";

/* eslint-disable @typescript-eslint/no-explicit-any */
const modules = import.meta.glob('./*', { eager: true });

export function RegisterRenderDescs() {
    for (const module of Object.values(modules)) {
        for (const exprt of Object.values(module as any)) {
            //go up hierarchy until we directly inherit RenderDesc
            let prototype = Object.getPrototypeOf(exprt as any)
            while (prototype) {
                if (prototype === RenderDesc) {
                    (exprt as typeof RenderDesc).register()
                    break
                }

                prototype = Object.getPrototypeOf(prototype)
            }
        }
    }
}