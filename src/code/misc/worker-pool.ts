import { WorkerTypeToFunction } from "./worker-functions"
import { FLAGS } from "./flags"
import { error } from "./logger"
let idCounter = 0

type ResolveInfo = [number, (a: unknown) => void]

export class WorkerPool {
    static instance: WorkerPool

    workers: Worker[] = []
    workersActiveTasks: number[] = []
    workersResolves: ResolveInfo[][] = []

    constructor() {
        //create workers if possible
        if (globalThis.Worker && FLAGS.USE_WORKERS) {
            const workerCount = navigator.hardwareConcurrency || 4

            for (let i = 0; i < workerCount; i++) {
                const worker = FLAGS.GET_WORKER_FUNC()
                this.workers.push(worker)
                this.workersActiveTasks.push(0)
                this.workersResolves.push([])

                worker.onmessage = (e: MessageEvent) => {
                    const [id, data]: [number, unknown] = e.data
                    //console.log("Halfway recieved message: ", [id, data])

                    this._onMessage(i, id, data)
                }
                worker.onerror = (e: ErrorEvent) => {
                    error(e)
                    const index = this.workers.indexOf(worker)
                    this.workers.splice(index, 1)
                    this.workersActiveTasks.splice(index, 1)
                    this.workersResolves.splice(index, 1)
                    throw new Error("Failed to create worker, try disabling workers by setting FLAGS.USE_WORKERS = false but do note doing so will degrade performance")
                }

                //console.log("Created worker", this)
            }
        }
    }

    _onMessage(i: number, id: number, data: unknown) {
        const promiseInfos = this.workersResolves[i]
        for (const info of promiseInfos) {
            if (info[0] == id) {
                info[1](data)
                this.workersResolves[i].splice(this.workersResolves[i].indexOf(info),1)
                this.workersActiveTasks[i] -= 1
                break
            }
        }
    }

    _getAvailableWorker() {
        let lowestWork = 0

        for (let i = 0; i < this.workers.length; i++) {
            if (this.workersActiveTasks[lowestWork] > this.workersActiveTasks[i]) {
                lowestWork = i
            }
        }

        return lowestWork
    }

    _emulateWorker(type: string, data: unknown) {
        const func = WorkerTypeToFunction[type]
        return func(data)
    }

    async work(type: string, data: unknown, transferables?: Transferable[]): Promise<unknown> {
        const taskId = idCounter
        idCounter += 1

        //use actual worker
        if (this.workers.length > 0) {
            const workerIndex = this._getAvailableWorker()
            this.workersActiveTasks[workerIndex] += 1
            const promise = new Promise((resolve) => {
                this.workersResolves[workerIndex].push([taskId, resolve])
            })
            if (transferables) {
                this.workers[workerIndex].postMessage([taskId, type, data], transferables)
            } else {
                this.workers[workerIndex].postMessage([taskId, type, data])
            }
            //console.log("Sent worker message", [taskId, type, data])
            return promise
        } else { //emulate worker
            return this._emulateWorker(type, data)
        }
    }
}

export function setupWorkerPool() {
    WorkerPool.instance = new WorkerPool()
}