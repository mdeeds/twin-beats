class RecorderWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = Math.round(sampleRate * 8); // 8 seconds of buffer
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.recording = false;
    this.skipSamples = 0; // New variable to track samples to skip
  }
  
    static get parameterDescriptors() {
    return [
      {
        name: "startRecording",
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: "a-rate",
      },
    ];
  }

  copyFromBuffer(offset, buffer, outputChannel) {
	  let sourceIndex = offset;
	  for (let i = 0; i < outputChannel.length; ++i) {
		  outputChannel[i] = buffer[sourceIndex];
		  sourceIndex = (sourceIndex + 1) % buffer.length;
	  }
  }

  addIntoBuffer(offset, buffer, inputChannel) {
	  let targetIndex = offset;
	  for (let i = 0; i < inputChannel.length; ++i) {
		  buffer[targetIndex] += inputChannel[i];
		  targetIndex = (targetIndex + 1) % buffer.length;
	  }
  }


  process(inputs, outputs, parameters) {
	let frameSize = 128;
	// For now, the buffer is monophonic.  We copy it to every channel of every output.
	for(const output of outputs) {
	  for (const outputChannel of output) {
    	this.copyFromBuffer(this.writeIndex, this.buffer, outputChannel);
	  }
	}

    for (const input of inputs) {
	  // For now, just use the left channel of the input - we're doing this monophonically.
	  const inputChannel = input[0];
	  this.addIntoBuffer(this.writeIndex, this.buffer, inputChannel);
	  frameSize = inputChannel.length;
	}
	
	this.writeIndex = (this.writeIndex + frameSize) % this.bufferSize;

    return true;
  }
}

registerProcessor("recorder-worklet", RecorderWorklet);