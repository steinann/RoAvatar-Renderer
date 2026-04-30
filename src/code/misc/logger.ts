/* eslint-disable @typescript-eslint/no-explicit-any */
import { FLAGS } from "./flags";

export function log(critical: boolean, ...args: any[]) {
    if (critical || FLAGS.VERBOSE_LOGGING) {
        console.log(...args)
    }
}

export function warn(critical: boolean, ...args: any[]) {
    if (critical || FLAGS.VERBOSE_LOGGING) {
        console.warn(...args)
    }
}

export function error(...args: any[]) {
    console.error(...args)
}

export function time(label: string) {
    if (FLAGS.VERBOSE_LOGGING) {
        console.time(label)
    }
}

export function timeEnd(label: string) {
    if (FLAGS.VERBOSE_LOGGING) {
        console.timeEnd(label)
    }
}