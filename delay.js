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

function getLatencyFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const latency = urlParams.get('latency');

  if (latency) {
	return Number(latency);
  } else {
    return 0.0;
  }
}

class DelayTrack {
    constructor(source) {
		console.log(`Estimated output latency: ${source.context.outputLatency}`);
		
		let latency = (2.0 * source.context.outputLatency) + getLatencyFromURL();
		
		let latencyInSamples = source.context.sampleRate * latency;
		console.log(`Number of samples: ${latencyInSamples}`);
		
		latencyInSamples = Math.round(latencyInSamples);
		latency = latencyInSamples / source.context.sampleRate;
		
        const delayNode = new DelayNode(source.context, {
            delayTime: 8 - latency,
            maxDelayTime: 32,
        });

		
	 const internalDelay = new DelayNode(source.context, {
		 delayTime: latency,
	 maxDelayTime: latency});

        source.connect(delayNode);	

        createAnalyzerAndVisualizer(source)
            .then((node) => { document.body.appendChild(node); });
        
        delayNode.connect(internalDelay);
		internalDelay.connect(delayNode);

        delayNode.connect(source.context.destination);

        createAnalyzerAndVisualizer(delayNode)
            .then((node) => { document.body.appendChild(node); });
    }
}

async function init() {
    const source = await getAudioSourceNode();
    const dt = new DelayTrack(source, new AudioContext());
}

async function go() {
    const button = document.createElement('button');
    button.innerText = 'GO';
    document.body.appendChild(button);
    button.addEventListener('click', init);
}


