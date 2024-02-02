class TrackChannel {
  constructor(durationSeconds) {
    this.buffer = new Float32Array(Math.round(sampleRate * durationSeconds));
    this.readIndex = 0;
    this.writeOffset = 0;
  }

    reset() {
        this.readIndex = 0;
        this.writeOffset = 0;
    }
    
    addData(channel, offset, count) {
        if (this.writeOffset >= this.buffer.length) {
            return;
        }
    const remaining = this.buffer.length - this.writeOffset;
    const toCopy = Math.min(remaining, count);
    // Copy as much as we can fit into our buffer
    this.buffer.set(channel.slice(offset, toCopy), this.writeOffset);
    this.writeOffset += count;
  }

    // TODO: need to set a loop length and respect it here for playback.
    sendData(channel, offset, count) {
        if (this.readIndex >= this.buffer.length) {
            return;
        }
    const outputLength = Math.min(count, this.buffer.length - this.readIndex);
        channel.set(this.buffer.slice(this.readIndex, this.readIndex + outputLength),
                   offset);
    this.readIndex += count;
  }
}

class TrackBufferProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.state = "pause";
        this.left = new TrackChannel(sampleRate, 3 * 60 /* 3 minutes */);
        this.right = new TrackChannel(sampleRate, 3 * 60 /* 3 minutes */);
    }

    // @inputBuffer is an array of Float32Array.
    processRecord(inputChannels, outputChannels, offset, count) {
    if (inputChannels.length > 0) {
        this.left.addData(inputChannels[0], offset, count);
    }
    if (inputChannels.length > 1) {
        this.right.addData(inputChannels[1], offset, count);
    }

    // Pass through data to output.
    if (inputBuffer.numberOfChannels > 0 && outputBuffer.numberOfChannels > 0) {
      outputBuffer.getChannelData(0).set(inputBuffer.getChannelData(0));
    }
    if (inputBuffer.numberOfChannels > 1 && outputBuffer.numberOfChannels > 1) {
      outputBuffer.getChannelData(1).set(inputBuffer.getChannelData(1));
    }

    // Consider sending a message back to the main thread:
    // this.port.postMessage(this.buffer);

    return true;
  }

    processPlay(inputBuffer, outputBuffer, offset, count) {
    if (outputBuffer.length > 0) {
        this.left.sendData(outputBuffer[0], offset, count);
    }
    if (outputBuffer.length > 1) {
        this.right.sendData(outputBuffer[1], offset, count);
    }
  }


    // TODO: Add an a-rate parameter for the state.
    // 0: pause
    // 1: record
    // 2: overdub
    // 3: play
  process(inputs, outputs, parameters) {
    if (inputs.length === 0 || inputs[0].length === 0) {
      return;
    }
    const inputBuffer = inputs[0];
      const outputBuffer = outputs[0];

      let state = 'pause';
      const stateParam = parameters['state'];

      let offset = 0;
      let count = 0;
      while (offset < inputBuffer[0].length) {
          if (stateParam.length == 1) {
              count = inputBuffer[0].length;
          } else {
              let index = offset;
              const currentState = stateParam[index];
              while (index < stateParam.length) {
                  if (stateParam[index] != currentState) {
                      break;
                  }
                  ++count;
                  ++index;
              }
          }
          if (stateParam[offset] < 0.5) {
              processPause(inputBuffer, outputBuffer, offset, count);
          } else if (stateParam[offset] < 1.5) {
              processRecord(inputBuffer, outputBuffer, offset, count);
          } else if (stateParam[offset] < 2.5) {
              processOverdub(inputBuffer, outputBuffer, offset, count);
          } else {
              processPlay(inputBuffer, outputBuffer, offset, count);
          }
          offset += count;
      }
      // TODO: copy outputs[0] to outputs[1 ...]
  }
}

registerProcessor("track-buffer-node", TrackBufferProcessor);
