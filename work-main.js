async function getAudioSourceNode() {
    const audioCtx = new AudioContext();
    // Request access to the default audio input and create the source node
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            // Other desired audio constraints
            mandatory: {
                // Disable specific processing features
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false, // Not guaranteed to work in all browsers
            },
        },
    });
    const source = audioCtx.createMediaStreamSource(stream);
    return source;
}

function getNumberFromURL(name, defaultValue) {
    const urlParams = new URLSearchParams(window.location.search);
    const val = urlParams.get(name);
    
    if (val) {
	      return Number(val);
    } else {
        return defaultValue;
    }
}

function getLatencyFromURL() {
	  return getNumberFromURL('latency', 0.0);
}

function getBPMFromURL() {
	  return getNumberFromURL('bpm', 120.0);
}

async function startRecordingWithWorklet(audioNode) {
	  return new Promise(async (resolve, reject) => {
        try {
            const audioCtx = audioNode.context;
	          await audioCtx.audioWorklet.addModule("work-worker.js");
            const workletNode = new AudioWorkletNode(audioCtx, "recorder-worklet");
            audioNode.connect(workletNode);
            
            //// Set up a port to receive messages from the worklet
            //const port = new MessagePort();
            //workletNode.port.postMessage({ port });
            
            // Set the "startRecording" parameter at the desired time
            startParameter = workletNode.parameters.get("startRecording");
	          startParameter.setValueAtTime(1, audioCtx.currentTime + 4.0); // Trigger recording
	          
	          resolve(workletNode);
        } catch (error) {
            reject(error);
        }
	  });
}

function getCenterFrequencyForBinIndex(binIndex, numBins, audioCtx) {
    const nyquist = audioCtx.sampleRate / 2; // Nyquist frequency
    const binWidth = nyquist / numBins; // Frequency range covered by each bin
    const binStartFrequency = binIndex * binWidth; // Start frequency of the bin
    const binCenterFrequency = binStartFrequency + binWidth / 2; // Center frequency of the bin
    return binCenterFrequency;
}

function getMidiNoteFromFrequency(frequency) {
  const A4_FREQUENCY = 440; // Reference frequency for A4 (MIDI note 69)
  // Calculate half steps from A4
  const halfStepsFromA4 = Math.log2(frequency / A4_FREQUENCY) * 12;
  // Round to nearest integer (MIDI note number)
    const midiNoteNumber = halfStepsFromA4 + 69;
    return midiNoteNumber;
}
    
function interpolateColor(colorMap, value) {
    const numColors = colorMap.length;
    
    // Normalize value to the range [0, numColors), wrapping around
    const normalizedValue = value % numColors;
    
    // Get indices of the two colors to interpolate between
    const index1 = Math.floor(normalizedValue);
    const index2 = (index1 + 1) % numColors;
    
    // p2 is the percentage of color 2 to use.  This will be zero when
    // our index is equal to the normalized value
    const p2 = normalizedValue - index1;
    const p1 = 1 - p2;

    // Interpolate each color component
    const interpolatedColor = [
        Math.round(p1 * colorMap[index1][0] + p2 * colorMap[index2][0]),
        Math.round(p1 * colorMap[index1][1] + p2 * colorMap[index2][1]),
        Math.round(p1 * colorMap[index1][2] + p2 * colorMap[index2][2]),
    ];

  return interpolatedColor;
}


function getColorForBucket(binIndex, numBins, audioCtx) {
    const colorMap = [
        [255,   0,   0], // C
        [225,  40,   0], // C#
        [200,  75,   0], // D
        [150, 150,   0], // D#
        [255, 175,   0], // E
        [ 75, 200,   0], // F
        [  0, 255,   0], // F#
        [  0, 200, 100], // G
        [  0, 100, 200], // G#
        [  0,   0, 255], // A
        [ 75,   0, 200], // A#
        [200,   0, 150], // B
    ];
    const freq = getCenterFrequencyForBinIndex(binIndex, numBins, audioCtx);
    const note = getMidiNoteFromFrequency(freq);
    return interpolateColor(colorMap, note);
}

function makeColorMapping(numBins, audioCtx) {
    const colors = [];
    for (let i = 0; i < numBins; ++i) {
        const color = getColorForBucket(i, numBins, audioCtx);
        color[0] = Math.round(color[0]);
        color[1] = Math.round(color[1]);
        color[2] = Math.round(color[2]);
        colors.push(color);
    }
    return colors;
}

class AnalyzerCanvas {
    constructor(canvas, source) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.source = source;
        this.analyzer = source.context.createAnalyser();
        this.analyzer.fftSize = 2048;
        source.connect(this.analyzer);
        this.x = 0;
        this.colorMapping = makeColorMapping(this.analyzer.frequencyBinCount, source.context);
        this.frequencyData = new Float32Array(this.analyzer.frequencyBinCount);

        this.renderFrame();
    }

    renderFrame() {
        this.analyzer.getFloatFrequencyData(this.frequencyData);
        const height = this.canvas.height;
        
        // Create or update ImageData buffer (optimize for reuse)
        let imageData = this.ctx.getImageData(this.x, 0, 1, height);
        if (!imageData) {
            imageData = this.ctx.createImageData(1, height);
        }

        // Get data buffer from ImageData
        const data = imageData.data;

        let y = height - 1;
        let targetY = y;
        // Fill data buffer efficiently based on colors and frequencies
        for (let i = 0; i < this.frequencyData.length; i++) {
            // frequencyData is in decibels, so exponentiate to get positive values
            targetY -= Math.pow(2, this.frequencyData[i] / 10) * 5;
            const color = this.colorMapping[i];
            while (y > targetY && y >= 0) {
                const offset = y * 4;
                data[offset + 0] = color[0];
                data[offset + 1] = color[1];
                data[offset + 2] = color[2];
                data[offset + 3] = 255;
                --y;
            }
        }
        while (y > 0) {
            const offset = y * 4;
            data[offset + 0] = 255;
            data[offset + 1] = 255;
            data[offset + 2] = 255;
            data[offset + 3] = 255;
            --y;
        }
        // Put the updated data back onto the canvas
        this.ctx.putImageData(imageData, this.x, 0);
        this.x = (this.x + 1) % this.canvas.width;
        requestAnimationFrame(this.renderFrame.bind(this));
    }
}



class DraggableDiv {
    constructor(div, context) {
        this.div = div;
        this.initDrag();
        this.dragging = false;
        this.filterNode = new BiquadFilterNode(context, {
            type: 'lowpass',
            Q: 1,
            frequency: 20000,
        });
        this.panNode = new StereoPannerNode(context, {
            pan: 0
        });

        this.filterNode.connect(this.panNode);
    }

    connectSource(source) {
        source.connect(this.filterNode);
    }

    connectTarget(target) {
        this.panNode.connect(target);
    }

  initDrag() {
    this.div.addEventListener('mousedown', (event) => {
      this.startX = event.clientX;
        this.startY = event.clientY;
        this.dragging = true;
      this.div.style.position = 'absolute';
        document.addEventListener('mousemove', this.moveDiv.bind(this));
        document.addEventListener('mouseup', this.stopDrag.bind(this));
    });
  }

    moveDiv(event) {
        if (!this.dragging) return;
    const deltaX = event.clientX - this.startX;
        const deltaY = event.clientY - this.startY;
        this.startX = event.clientX;
        this.startY = event.clientY;
    this.div.style.left = `${this.div.offsetLeft + deltaX}px`;
    this.div.style.top = `${this.div.offsetTop + deltaY}px`;
  }

    stopDrag() {
        this.dragging = false;
  }

  getRelativeX() {
    const rect = this.div.getBoundingClientRect();
    const width = window.innerWidth;
    return (rect.left + rect.width / 2) / width;
  }

  getRelativeY() {
    const rect = this.div.getBoundingClientRect();
    const height = window.innerHeight;
    return (rect.top + rect.height / 2) / height;
  }
}

function addBubble(context) {
    const div = document.createElement('div');
    div.innerHTML = 'o';
    div.classList.add('bubble');
    document.body.appendChild(div);
    return new DraggableDiv(div, context);
}

async function init() {
	  document.body.innerHTML = "";
    const source = await getAudioSourceNode();
	  const recordingNode = await startRecordingWithWorklet(source);
    const bubble = addBubble(source.context);
    bubble.connectSource(recordingNode);
	  bubble.connectTarget(source.context.destination);


    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 100;
    document.body.appendChild(canvas);
    // TODO: better if we can get the output node of the recording bubble.
    new AnalyzerCanvas(canvas, source);
}

async function go() {
    const button = document.createElement('button');
    button.innerText = 'GO';
    document.body.appendChild(button);
    button.addEventListener('click', init);

}


