class RecorderWorklet extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = Math.round(sampleRate * 8); // 8 seconds of buffer
        this.buffer = new Float32Array(this.bufferSize);
        this.playIndex = 0;
        this.readIndex = 0;
        this.writeIndex = 0;
        this.lastPlayValue = 0;
        this.lastRecordValue = 0;
        this.skipSamples = 0; // New variable to track samples to skip
        this.stopped = true;
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

        const playParam = parameters["play"];

        for (let i = 0; i < frameSize; ++i) {
            const currentPlayParam = playParam.length == 1 ? playParam[0] : playParam[i];
            if (this.lastPlayValue <= 0 && currentPlayParam > 0) {
                // Rising edge, reset the play head.
                console.log('Start playing');
                this.readIndex = 0;
            }
            this.lastPlayValue = currentPlayParam;
            if (currentPlayParam > 0) {
                for (const output of outputs) {
                    for (const outputChannel of output) {
                        outputChannel[i] = this.buffer[this.readIndex];
                    }
                }
                this.readIndex = (this.readIndex + 1) % this.buffer.length;
            }
        }        

        const recordParam = parameters["record"];
        for (let i = 0; i < frameSize; ++i) {
            const currentRecordValue = recordParam.length == 1 ? recordParam[0] : recordParam[i];
            if (currentRecordValue > 0 && this.lastRecordValue <= 0) {
                console.log(`Start recording`);
                this.writeIndex = 0;
                this.lastRecordValue = 1;
            }
            if (currentRecordValue > 0) {
                for (const input of inputs) {
                    const inputChannel = input[0]; // TODO: Handle stereo inputs
                    this.buffer[this.writeIndex] += inputChannel[i];
                }
            }
            this.writeIndex = (this.writeIndex + 1) % this.buffer.length;
        }
        return true;
    }
}

registerProcessor("recorder-worklet", RecorderWorklet);
