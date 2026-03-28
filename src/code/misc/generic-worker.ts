import { getWorkerOnMessage } from "./worker-functions"

onmessage = getWorkerOnMessage()