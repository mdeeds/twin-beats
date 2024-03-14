class RecorderWorklet extends AudioWorkletProcessor {
    constructor() {
        super();        
        this.returnBuffer = null;
        this.returnIndex = 0;
        this.bufferPool = [];

        this.port.onmessage = (e) => {
            if (e.data.command === 'done') {
                this.bufferPool.push(new Float32Array(e.data.buffer));
            }
        };
    }
    
    static get parameterDescriptors() {
        return [];
    }

    process(inputs, outputs, parameters) {
        // Hard code the frame size.  It seems like this will never change.
        // See https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletGlobalScope/currentFrame
	      const frameSize = 128;
        for (let i = 0; i < frameSize; ++i) {
            if (!this.returnBuffer) {
                if (this.bufferPool.length > 0) {
                    this.returnBuffer = this.bufferPool.pop());
            } else {
                this.returnBuffer = new Float32Array(64 * 128);
            }
            if (inputs.length == 0) {
                this.returnBuffer.fill(/*value=*/0,
                    /*start=*/this.returnIndex,
                    /*end=*/ this.returnIndex + frameSize); 
            } else {
                this.returnBuffer.set(inputs[0][0], this.returnIndex);
            }
            this.returnIndex += frameSize;
            if (this.returnIndex >= this.returnBuffer.length) {
                const buffer = this.returnBuffer.buffer;
                this.returnBuffer = null;
                this.returnIndex = 0;
                this.port.postMessage(
                    {command: 'return', buffer: buffer}, [buffer]);
            }
        }
        return true;
    }
}

registerProcessor("recorder-worklet", RecorderWorklet);


// The mutable audio buffer source can be modified during playback. Also, unlike the AudioBufferSourceNode
// it can be triggered multiple times.
// The a-rate parameter `trigger` will restart playback when its value transitions from zero to one.
// The playback loop length can be set by posting a message {command: 'setLength', value: lengthInSamples}
// Data in the playback buffer can be modified by posting a message:
// {command: 'set', offset: startOffsetInSamples, buffer: arrayBufferOfFloat32}
// The MutableAudioBufferSource has no inputs and one single channel output.
class MutableAudioBufferSource extends AudioWorkletProcessor {
    constructor() {
        super();

        // Properties for buffer and playback state
        this.buffer = new Float32Array(Math.round(3 * sampleRate));
        this.playbackPosition = 0;
        this.writeOffset = 0;
        this.loopLength = 0;
        this.isPlaying = false;
        this.startTime = 0;
        this.previousTriggerValue = 0;
        
        this.port.onmessage = (event) => {
            const message = event.data;
            switch (message.command) {
            case 'setLoopSizeamples':
                this.loopLength = message.value;
                break;
            case 'append':
                this.appendBufferData(message.buffer);
                break;
            case 'play' :
                this.isPlaying = true;
                this.playbackPosition = -1;
                this.startTime = event.data.startTime;
                break;
            default:
                // Handle any other commands if needed
                break;
            }
        };
    }

    static get parameterDescriptors() {
        return [];
    }


    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const frameCount = output.length;
        const outputChannel = output[0];
        if (!this.isPlaying) {
            output.fill(0);
            return;
        }
        if (this.playbackPosition < 0) {
            this.playbackPosition = Math.floor((currentTime - this.startTime) * sampleRate);
        }
        for (let i = 0; i < frameCount; ++i) {
            if (this.playbackPosition >= 0) {
                outputChannel[i] = this.buffer[this.playbackPosition];
            }
            this.playbackPosition++;
            if (this.loopLength && this.playbackPosition > this.loopLength) {
                this.playbackPosition = this.playbackPosition - this.loopLength;
            }
        }
        return true;
    }
    
    appendBufferData(arrayBuffer) {
        const view = new Float32Array(arrayBuffer);
        if (this.writeOffset + view.length > this.buffer.length) {
            const newSize = this.writeOffset + view.length + sampleRate;
            const newBuffer = new Float32Array(newSize);
            newBuffer.set(this.buffer);
            this.buffer = newBuffer;
        }
        this.buffer.set(view, this.writeOffset);
        this.writeOffset += view.length;
    }
}

registerProcessor("mutable-audio-buffer-worklet", MutableAudioBufferSource);
