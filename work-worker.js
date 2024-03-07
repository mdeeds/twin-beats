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
