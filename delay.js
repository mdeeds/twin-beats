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

async function createAnalyzerAndVisualizer(sourceNode) {
  const audioCtx = sourceNode.context;
  // Create the analyzer node
  const analyzer = audioCtx.createAnalyser();
  analyzer.fftSize = 2048; // Adjust the FFT size as needed

  // Connect the source node to the analyzer
  sourceNode.connect(analyzer);

  // Create a canvas for visualization
  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 50;
  const ctx = canvas.getContext("2d");

  // Function to draw the visualization based on the current frequency data
  function drawVisualization() {
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyzer.getByteFrequencyData(dataArray);

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "green";
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = dataArray[i] / 256 * canvas.height;
        ctx.fillRect(i * (canvas.width / bufferLength),
                     canvas.height - barHeight,
                     canvas.width / bufferLength, barHeight);
    }
    requestAnimationFrame(drawVisualization); // Schedule the next frame
  }

  drawVisualization(); // Start the visualization
  return canvas; // Return the canvas element for display
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

class DelayTrack {
    constructor(source) {
		console.log(`Estimated output latency: ${source.context.outputLatency}`);
		
		let latency = (2.0 * source.context.outputLatency) + getLatencyFromURL();
		
		let latencyInSamples = source.context.sampleRate * latency;
		console.log(`Number of samples: ${latencyInSamples}`);
		
		latencyInSamples = Math.round(latencyInSamples);
		latency = latencyInSamples / source.context.sampleRate;
		
		const bpm = getBPMFromURL();
		const duration = 4 * 4 * 60 / bpm;
		console.log(`Duration: ${duration}`);
		
        const delayNode = new DelayNode(source.context, {
            delayTime: duration - latency,
            maxDelayTime: 32,
        });

		if (latency > 0) {
			const internalDelay = new DelayNode(source.context, {
				delayTime: latency,
				maxDelayTime: latency});
			delayNode.connect(internalDelay);
			internalDelay.connect(delayNode);
		} else {
			delayNode.connect(delayNode);
		}
		
        source.connect(delayNode);	

        createAnalyzerAndVisualizer(source)
            .then((node) => { document.body.appendChild(node); });
        delayNode.connect(source.context.destination);

        createAnalyzerAndVisualizer(delayNode)
            .then((node) => { document.body.appendChild(node); });
    }
}

async function populateAudioDevices() {
	var div = document.createElement('div');
	div.innerText = 'These selectors only list your devices.  They do not change the device used.';
	document.body.appendChild(div);
    var inputSelect = document.createElement('select');
	div.appendChild(inputSelect);
	var outputSelect = document.createElement('select');
	div.appendChild(outputSelect);
  
  try {
    navigator.mediaDevices.enumerateDevices()
    .then((devices) => {
      devices.forEach((device) => {
        console.log(`${device.kind}: ${device.label} id = ${device.deviceId}`);
      });
    });
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === "audioinput");    
    const audioOutputs = devices.filter(device => device.kind === "audiooutput");

    // Add options for input devices
    for (const input of audioInputs) {
      const option = document.createElement("option");
      option.value = input.deviceId;
      option.textContent = input.label || `Input Device ${audioInputs.indexOf(input) + 1}`;
      inputSelect.appendChild(option);
    }

    // Add options for output devices
    for (const output of audioOutputs) {
      const option = document.createElement("option");
      option.value = output.deviceId;
      option.textContent = output.label || `Output Device ${audioOutputs.indexOf(output) + 1}`;
      outputSelect.appendChild(option);
    }

    // Select the default devices if available
    if (navigator.mediaDevices.defaultAudioDevice) {
      inputSelect.value = navigator.mediaDevices.defaultAudioDevice.deviceId;
    }
    if (navigator.mediaDevices.defaultAudioOutputDevice) {
      outputSelect.value = navigator.mediaDevices.defaultAudioOutputDevice.deviceId;
    }
  } catch (error) {
    console.error("Error getting audio devices:", error);
  }
}


async function init() {
	populateAudioDevices();
    const source = await getAudioSourceNode();
    const dt = new DelayTrack(source, new AudioContext());
}

async function go() {
    const button = document.createElement('button');
    button.innerText = 'GO';
    document.body.appendChild(button);
    button.addEventListener('click', init);
}


