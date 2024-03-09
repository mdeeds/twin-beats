class RecorderWorklet extends AudioWorkletProcessor {
    constructor() {
        super();        
        this.lastPlayValue = 0;
        this.lastRecordValue = 0;
        this.stopped = true;
        this.loopSizeSamples = 0;
        this.loopSizeSet = false;
        
        this.returnBuffer = null;
        this.nextBuffer = null;
        this.returnIndex = 0;

        this.port.onmessage = (e) => {
            // console.log(e.data.command);
            if (e.data.command === 'ready' && this.returnBuffer == null) {
                this.returnBuffer = new Float32Array(e.data.buffer);
                this.nextBuffer = new Float32Array(e.data.nextBuffer);
                this.returnIndex = 0;
            } else if (e.data.command === 'done' && this.nextBuffer == null) {
                this.nextBuffer = new Float32Array(e.data.buffer);
            }
        };
    }
    
    static get parameterDescriptors() {
        return [
            {
                name: "record",
                defaultValue: 0,
                minValue: 0,
                maxValue: 1,
                automationRate: "a-rate",
            },
            {
                name: "play",
                defaultValue: 0,
                minValue: 0,
                maxValue: 1,
                automationRate: "a-rate",
            },
        ];
    }

    process(inputs, outputs, parameters) {
        // Hard code the frame size.  It seems like this will never change.
        // See https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletGlobalScope/currentFrame
	      const frameSize = 128;

        const recordParam = parameters["record"];
        for (let i = 0; i < frameSize; ++i) {
            const currentRecordValue = recordParam.length == 1 ? recordParam[0] : recordParam[i];
            if (currentRecordValue > 0 && this.lastRecordValue <= 0) {
                console.log(`Start recording`);
                this.lastRecordValue = 1;
            }
            if (currentRecordValue > 0) {
                if (!!this.returnBuffer) {
                    this.returnBuffer[this.returnIndex] = 0;
                    for (const input of inputs) {
                        const inputChannel = input[0]; // TODO: Handle stereo inputs
                        this.returnBuffer[this.returnIndex] += inputChannel[i];
                    }
                    this.returnIndex++;
                    if (this.returnIndex >= this.returnBuffer.length) {
                        const buffer = this.returnBuffer.buffer;
                        this.returnBuffer = this.nextBuffer;
                        this.nextBuffer = null;
                        this.returnIndex = 0;
                        this.port.postMessage({command: 'return',
                                               buffer: buffer},
                                              [buffer]);
                    }
                    
                }
                this.loopSizeSamples++;
            }
        }

        const playParam = parameters["play"];
        for (let i = 0; i < frameSize; ++i) {
            const currentPlayParam = playParam.length == 1 ? playParam[0] : playParam[i];
            if (this.lastPlayValue <= 0 && currentPlayParam > 0) {
                // Rising edge, set the loop length
                console.log(`Start looping ${this.lastPlayValue} -> ${currentPlayParam}`);
                this.loopSizeSet = true;
                this.loopSizeSamples -= (frameSize - i);
                const message = { command: "loopSizeSamples", value: this.loopSizeSamples };
                console.log(message);
                this.port.postMessage(message);
            }
            this.lastPlayValue = currentPlayParam;
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
            default:
                // Handle any other commands if needed
                break;
            }
        };
    }

    static get parameterDescriptors() {
        return [
            {
                name: "trigger",
                defaultValue: 0,
                minValue: 0,
                maxValue: 1,
                automationRate: "a-rate",
            },
            {
                name: "stop",
                defaultValue: 0,
                minValue: 0,
                maxValue: 1,
                automationRate: "k-rate",
            },
        ];
    }


    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const frameCount = output.length;
        const outputChannel = output[0];
        const triggerParameter = parameters.trigger;
        // TODO: handle k-rate stop.
        
        for (let i = 0; i < frameCount; ++i) {
            const currentTriggerValue =
                  (triggerParameter.length == 1) ? triggerParameter[0] : triggerParameter[i];
            if (currentTriggerValue > 0 && this.previousTriggerValue <= 0) {
                this.playbackPosition = 0;
                this.isPlaying = true;
            }
            this.previousTriggerValue = currentTriggerValue;
            if (this.isPlaying) {
                if (!this.loopLength || this.playbackPosition < this.loopLength) {
                    const sample = this.buffer[this.playbackPosition];
                    outputChannel[i] = sample;
                } else {
                    outputChannel[i] = 0;
                }
                this.playbackPosition++;
            }
        }
        return true;
    }
    
    setBufferData(arrayBuffer) {
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
