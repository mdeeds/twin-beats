class RecorderWorklet extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = Math.round(sampleRate * 4);
        this.buffer = new Float32Array(this.bufferSize);
        this.writeIndex = 0;
        this.lastPlayValue = 0;
        this.lastRecordValue = 0;
        this.stopped = true;
        this.loopSizeSamples = 0;
        this.loopSizeSet = false;
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
                this.writeIndex = 0;
                this.lastRecordValue = 1;
            }
            if (currentRecordValue > 0) {
                for (const input of inputs) {
                    const inputChannel = input[0]; // TODO: Handle stereo inputs
                    this.buffer[this.writeIndex] += inputChannel[i];
                }
                this.loopSizeSamples++;
            }
            this.writeIndex = (this.writeIndex + 1) % this.buffer.length;
        }

        const playParam = parameters["play"];
        for (let i = 0; i < frameSize; ++i) {
            const currentPlayParam = playParam.length == 1 ? playParam[0] : playParam[i];
            if (this.lastPlayValue <= 0 && currentPlayParam > 0) {
                // Rising edge, set the loop length
                console.log('Start looping');
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
