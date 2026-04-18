export default class SimpleView {
    view: DataView
    viewOffset: number
    bitOffset: number = 0
    buffer: ArrayBuffer

    constructor (buffer: ArrayBuffer) {
        this.view = new DataView(buffer)
        this.buffer = buffer
        this.viewOffset = 0
    }

    readBits(n: number): number {
        let result = 0

        for (let i = 0; i < n; i++) {
            const byte = this.view.getUint8(this.viewOffset)
            const bit = (byte >> (7 - this.bitOffset)) & 1

            result = (result << 1) | bit

            this.bitOffset++

            if (this.bitOffset === 8) {
                this.bitOffset = 0
                this.viewOffset++
            }
        }

        return result
    }

    LEB128(): number {
        let result = 0
        let shift = 0

        while (true) {
            const byte = this.readUint8()

            result |= (byte & 0x7F) << shift

            if ((byte & 0x80) === 0) {
                break
            }

            shift += 7
        }

        return result
    }

    ResetBitReader() {
        this.bitOffset = 0
    }

    writeUtf8String(value: string) {
        const stringBuffer = new TextEncoder().encode(value).buffer
        const stringSimpleView = new SimpleView(stringBuffer)

        this.writeUint32(stringBuffer.byteLength)

        for (let i = 0; i < stringBuffer.byteLength; i++) {
            this.writeUint8(stringSimpleView.readUint8())
        }
    }

    readBuffer(bufferLength: number) {
        const buffer = new Uint8Array(this.view.buffer).slice(this.viewOffset, this.viewOffset + bufferLength)
        this.viewOffset += bufferLength

        return buffer
    }

    readUtf8String(stringLength?: number) {
        if (!stringLength) {
            stringLength = this.readUint32()
        }
        const string = new TextDecoder().decode(new Uint8Array(this.view.buffer).subarray(this.viewOffset, this.viewOffset + stringLength))
        
        this.viewOffset += stringLength

        return string
    }

    writeFloat32(value: number, littleEndian = true) {
        value = Math.max(value, -340282346638528859811704183484516925440.0)
        value = Math.min(value, 340282346638528859811704183484516925440.0)

        this.view.setFloat32(this.viewOffset, value, littleEndian)
        this.viewOffset += 4
    }

    readFloat32(littleEndian = true) {
        const value = this.view.getFloat32(this.viewOffset, littleEndian)
        this.viewOffset += 4
        
        return value
    }

    writeUint64(value: bigint, littleEndian = true) {
        this.view.setBigUint64(this.viewOffset, value, littleEndian)
        this.viewOffset += 8
    }

    readUint64(littleEndian = true): bigint {
        const value = this.view.getBigUint64(this.viewOffset, littleEndian)
        this.viewOffset += 8
        
        return value
    }

    writeInt32(value: number, littleEndian = true) {
        value = Math.max(value, -2147483648)
        value = Math.min(value, 2147483647)

        this.view.setInt32(this.viewOffset, value, littleEndian)
        this.viewOffset += 4
    }

    readInt32(littleEndian = true) {
        const value = this.view.getInt32(this.viewOffset, littleEndian)
        this.viewOffset += 4
        
        return value
    }

    writeUint32(value: number, littleEndian = true) {
        value = Math.max(value, 0)
        value = Math.min(value, 4294967295)

        this.view.setUint32(this.viewOffset, value, littleEndian)
        this.viewOffset += 4
    }

    readUint32(littleEndian = true) {
        const value = this.view.getUint32(this.viewOffset, littleEndian)
        this.viewOffset += 4
        
        return value
    }

    writeInt16(value: number, littleEndian = true) {
        value = Math.max(value, -32768)
        value = Math.min(value, 32767)

        this.view.setInt16(this.viewOffset, value, littleEndian)
        this.viewOffset += 2
    }

    readInt16(littleEndian = true) {
        const value = this.view.getInt16(this.viewOffset, littleEndian)
        this.viewOffset += 2
        
        return value
    }

    writeUint16(value: number, littleEndian = true) {
        value = Math.max(value, 0)
        value = Math.min(value, 65535)

        this.view.setUint16(this.viewOffset, value, littleEndian)
        this.viewOffset += 2
    }

    readUint16(littleEndian = true) {
        const value = this.view.getUint16(this.viewOffset, littleEndian)
        this.viewOffset += 2
        
        return value
    }

    writeInt8(value: number) {
        value = Math.max(value, -128)
        value = Math.min(value, 127)

        this.view.setInt8(this.viewOffset, value)
        this.viewOffset += 1
    }

    readInt8() {
        const value = this.view.getInt8(this.viewOffset)
        this.viewOffset += 1
        
        return value
    }

    writeUint8(value: number) {
        value = Math.max(value, 0)
        value = Math.min(value, 255)

        this.view.setUint8(this.viewOffset, value)
        this.viewOffset += 1
    }

    readUint8() {
        const value = this.view.getUint8(this.viewOffset)
        this.viewOffset += 1
        
        return value
    }
}