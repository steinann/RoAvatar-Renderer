import { API } from "../../api";
import { FLAGS } from "../../misc/flags";
import { DataType } from "../constant";
import { Content, Property } from "../rbx";
import { InstanceWrapper } from "./InstanceWrapper";

class SoundWrapperData {
    audioContext: AudioContext | undefined
    gainNode: GainNode | undefined
    buffer: AudioBuffer | undefined
    playingSource: AudioBufferSourceNode | undefined
    analyser: AnalyserNode | undefined
    startedAt: number = 0
    playRequest: number = 0
}

/**
 * @category InstanceWrapper
 */
export class SoundWrapper extends InstanceWrapper {
    static className: string = "Sound"
    static requiredProperties: string[] = ["Name", "Looped", "Playing", "Volume", "_data"]

    setup() {
        //generic
        if (!this.instance.HasProperty("Name")) this.instance.addProperty(new Property("Name", DataType.String), this.instance.className)

        if (!this.instance.HasProperty("Looped")) this.instance.addProperty(new Property("Looped", DataType.Bool), false)
        if (!this.instance.HasProperty("Playing")) this.instance.addProperty(new Property("Playing", DataType.Bool), false)
        if (!this.instance.HasProperty("Volume")) this.instance.addProperty(new Property("Volume", DataType.Float32), false)

        if (!this.instance.HasProperty("_data")) this.instance.addProperty(new Property("_data", DataType.NonSerializable), new SoundWrapperData())
    }

    get data() {
        return this.instance.Prop("_data") as SoundWrapperData
    }

    created() {
        if (this.instance.Prop("Playing")) {
            this.Play()
        }

        this.instance.Destroying.Connect(() => {
            //cleanup audio
            this.Stop()
            void this.data.audioContext?.close().catch(() => {})
            this.data.audioContext = undefined
            this.data.gainNode = undefined
            this.data.analyser = undefined
            this.data.buffer = undefined
        })

        this.instance.Changed.Connect(() => {
            this._updateVolume()
            if (this.data.playingSource) this.data.playingSource.loop = this.instance.Prop("Looped") as boolean
        })
    }

    _updateVolume() {
        if (this.data.gainNode) {
            if (this.instance.HasProperty("Volume")) {
                const volume = this.instance.Prop("Volume") as number
                
                this.data.gainNode.gain.value = volume
            }
        }
    }

    setPlaying(value: boolean) {
        this.instance.setProperty("Playing", value)
    }

    playSource() {
        if (!this.data.audioContext || !this.data.gainNode || !this.data.buffer) return

        this.data.playingSource = this.data.audioContext.createBufferSource()
        this.data.playingSource.buffer = this.data.buffer
        this.data.playingSource.loop = this.instance.Prop("Looped") as boolean

        //connect audio
        this.data.playingSource.connect(this.data.analyser || this.data.gainNode)

        //update volume and play
        this._updateVolume()
        this.data.playingSource.start(0)
        this.data.startedAt = this.data.audioContext.currentTime
        this.data.playingSource.onended = (() => {
            this.Stop()
        })
    }

    /** Playback time follows the audio clock, including pause and looping */
    get timePosition(): number {
        if (!this.data.audioContext || !this.data.playingSource || !this.data.buffer) return 0
        const time = Math.max(0, this.data.audioContext.currentTime - this.data.startedAt)
        return this.data.playingSource.loop ? time % this.data.buffer.duration : Math.min(time, this.data.buffer.duration)
    }

    async Pause() {
        await this.data.audioContext?.suspend()
        this.setPlaying(false)
    }

    async Resume(): Promise<boolean> {
        if (!this.data.playingSource || !this.data.audioContext) return this.Play()
        await this.data.audioContext.resume()
        this.setPlaying(true)
        return true
    }

    /** Resolves false when audio is disabled, fails to load, or is cancelled. */
    async Play(): Promise<boolean> {
        if (!FLAGS.AUDIO_ENABLED || this.instance.destroyed) return false

        this.Stop()
        const request = this.data.playRequest
        this.setPlaying(true)
        try {
            // Resume synchronously from the user's play click before loading assets.
            this.data.audioContext ??= new AudioContext()
            const context = this.data.audioContext
            const resume = context.resume().then(() => true, () => false)
            if (!this.data.gainNode) {
                this.data.gainNode = context.createGain()
                this.data.analyser = context.createAnalyser()
                this.data.analyser.fftSize = 2048
                this.data.analyser.smoothingTimeConstant = 0.55
                // Analyse before volume so beat detection still works at low volume.
                this.data.analyser.connect(this.data.gainNode)
                this.data.gainNode.connect(context.destination)
            }
            if (!this.data.buffer) {
                let audioUrl = undefined
                if (this.instance.HasProperty("SoundId")) {
                    audioUrl = this.instance.Prop("SoundId") as string
                } else if (this.instance.HasProperty("AudioContent")) {
                    audioUrl = (this.instance.Prop("AudioContent") as Content).uri
                }

                if (!audioUrl) throw new Error("Sound is missing an audio source")
                const buffer = await API.Asset.GetAssetBuffer(audioUrl)
                if (buffer instanceof Response) throw new Error(`Audio request failed: ${buffer.status}`)
                const decoded = await context.decodeAudioData(buffer.slice(0))
                if (this.instance.destroyed || request !== this.data.playRequest) return false
                this.data.buffer = decoded
            }
            if (!await resume) throw new Error("Audio playback could not resume")
            if (this.instance.destroyed || request !== this.data.playRequest) return false
            this.playSource()
            return true
        } catch {
            if (!this.instance.destroyed && request === this.data.playRequest) this.Stop()
            return false
        }
    }

    Stop() {
        if (this.instance.destroyed) return
        this.data.playRequest++
        this.setPlaying(false)
        
        //stop audio
        if (this.data.playingSource) {
            this.data.playingSource.onended = null
            this.data.playingSource.stop()
            this.data.playingSource.disconnect()
            this.data.playingSource = undefined
        }
    }
}
