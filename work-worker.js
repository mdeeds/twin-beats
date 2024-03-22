class InfiniteBuffer {
    constructor() {
        this.bufferSize = 1024 * 16;
        this.buffers = [];
        this.bufferPeaks = [];
        this.bufferIndex = 0;
        this.writeIndex = 0;
        this.currentMax = 0;
        this.lastReadIndex = -1;
    }

    append(buffer) {
        if (this.bufferSize % buffer.length !== 0) {
            console.error(`Invalid buffer size: ${buffer.length}`); 
        }
        for (let i = 0; i < buffer.length; ++i) {
            this.currentMax = Math.max(this.currentMax, Math.abs(buffer[i]));
        }
        while (this.buffers.length <= this.bufferIndex) {
            if (this.buffers.length > 0) {
                const i = this.buffers.length - 1;
                if (this.currentMax > 0) {
                    console.log(`Peak in ${i} is ${this.currentMax}`);
                }
            }
            this.bufferPeaks.push(this.currentMax);
            this.currentMax = 0;
            this.buffers.push(new Float32Array(this.bufferSize));
        }
        this.buffers[this.bufferIndex].set(buffer, this.writeIndex);
        this.writeIndex += buffer.length;
        if (this.writeIndex >= this.bufferSize) {
            this.writeIndex = 0;
            ++this.bufferIndex;
        }
    }
    
    size() {
        return (this.buffers.length - 1) * this.bufferSize + this.writeIndex;
    }

    // Fills `targetBuffer` with data from the infinite buffer starting from
    // `readOffset`.  Missing data in the source results in zeros written to the output.
    writeInto(targetBuffer, readOffset) {
        const readBufferIndex = Math.floor(readOffset / this.bufferSize);
        if (this.lastReadIndex != readBufferIndex) {
            console.log(`readBufferIndex: ${readBufferIndex}`);
            this.lastReadIndex = readBufferIndex;
        }
        const readBufferOffset = readOffset % this.bufferSize;
        const targetLength = targetBuffer.length;

        let totalBytesRead = 0;
        let remainingBytesToRead = targetLength;
        let currentBufferIndex = readBufferIndex;
        let currentBufferOffset = readBufferOffset;

        // Loop until all data is read or the end of buffers is reached
        while (remainingBytesToRead > 0 &&
               currentBufferIndex < this.buffers.length) {
            const bytesAvailableInCurrentBuffer =
                  Math.min(this.bufferSize - currentBufferOffset, remainingBytesToRead);
            const bytesToReadFromCurrentBuffer = Math.min(
                bytesAvailableInCurrentBuffer, targetLength - totalBytesRead);
            const targetSubarray = targetBuffer.subarray(
                totalBytesRead, totalBytesRead + bytesToReadFromCurrentBuffer);
            if (currentBufferIndex >= this.buffers.length ||
                !this.buffers[currentBufferIndex]) {
                targetSubarray.fill(0, bytesToReadFromCurrentBuffer);
            } else {
                targetSubarray.set(
                    this.buffers[currentBufferIndex].subarray(
                        currentBufferOffset, currentBufferOffset + bytesToReadFromCurrentBuffer));
            }
            totalBytesRead += bytesToReadFromCurrentBuffer;
            remainingBytesToRead -= bytesToReadFromCurrentBuffer;

            // Start again at the beginning of the next buffer.
            currentBufferOffset = 0;
            currentBufferIndex++;
        }
    }
}

// A circular looper which loops data specified by the loop offsets.
class Loop {
    constructor(infiniteBuffer) {
        this.infiniteBuffer = infiniteBuffer;
        this.isPlaying = false;
        this.playIndex = 0;
        this.startOffset = 0;
        this.endOffset = 0;
    }
    play(startOffset, endOffset) {
        this.isPlaying = true;
        this.startOffset = startOffset;
        this.endOffset = endOffset;
        this.playIndex = this.startOffset;

        console.log(`startOffset: ${startOffset} endOffset: ${endOffset}`);
        console.log(`Recorded ${this.infiniteBuffer.size()} samples`);
    }
    // Writes data from the infinite buffer into the target
    writeInto(targetBuffer) {
        if (!this.isPlaying) {
            targetBuffer.fill(0);
            return;
        }
        const remainingToRead = this.endOffset - this.playIndex;
        // If the remaining data to read is less than the target buffer size,
        // read up to the endOffset and then loop back to the startOffset.
        if (remainingToRead < targetBuffer.length) {
            this.infiniteBuffer.writeInto(targetBuffer.subarray(0, remainingToRead), this.playIndex);
            this.infiniteBuffer.writeInto(targetBuffer.subarray(remainingToRead), this.startOffset);
            this.playIndex += targetBuffer.length;
        } else {
            // Read directly from playIndex to targetBuffer.
            this.infiniteBuffer.writeInto(targetBuffer, this.playIndex);
            this.playIndex += targetBuffer.length;
            if (this.playIndex == this.endOffset) {
                this.playIndex = this.startOffset;
            }
        }
    }
}

class RecorderWorklet extends AudioWorkletProcessor {
    constructor() {
        super();

        this.infiniteBuffer = new InfiniteBuffer();
        this.loops = [];
        for (let i = 0; i < 16; ++i) {
            this.loops.push(new Loop(this.infiniteBuffer));
        }
        this.outputCount = -1;

        this.firstSampleStartTime = -1;
        
        this.port.onmessage = (e) => {
            // TODO: Handle adding loops.
            // {command: 'loop',
            //   index: loopIndexNumber,
            //   startTime: startTimeSeconds,
            //   endTime: endTimeSeconds }
            if (e.data.command === 'loop') {
                if (e.data.index < 0 || e.data.index >= this.loops.length) {
                    console.error(`Invalid loop number: ${e.data.index}`);
                    return;
                }
                console.log(e.data);
                console.log(`First sample start time: ${this.firstSampleStartTime}`);
                // There might be a bug here that can result in us accumulating error
                // when there are two loops that are the same length, but rounding makes
                // one of them a sample shorter than the other.
                const startIndex = Math.round(
                    (e.data.startTime - this.firstSampleStartTime) * sampleRate);
                const endIndex = Math.round(
                    (e.data.endTime - this.firstSampleStartTime) * sampleRate);
                this.loops[e.data.index].play(startIndex, endIndex);

            }
        };
    }
    
    static get parameterDescriptors() {
        return [];
    }
    
    process(inputs, outputs, parameters) {
        if (this.firstSampleStartTime < 0) {
            this.firstSampleStartTime = currentTime;
        }
        this.infiniteBuffer.append(inputs[0][0]);

        if (this.outputCount != outputs.length) {
            this.outputCount = outputs.length;
            console.log(`Number of outputs: ${this.outputCount}`);
        }
        
        for (let i = 0; i < this.loops.length; ++i) {
            const loop = this.loops[i];
            if (outputs.length > i && outputs[i].length > 0) {
                loop.writeInto(outputs[i][0]);
            }
        }
        return true;
    }
}

registerProcessor("recorder-worklet", RecorderWorklet);
