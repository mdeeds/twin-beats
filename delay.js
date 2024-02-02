async function getAudioSourceNode() {
    const audioCtx = new AudioContext();
    // Request access to the default audio input and create the source node
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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


class DelayTrack {
    constructor(source) {
        // Create the DelayNode with an 8-second delay and 100% feedback
        const delayNode = new DelayNode(source.context, {
            delayTime: 8,
            maxDelayTime: 32,
        });

        source.connect(delayNode);

        createAnalyzerAndVisualizer(source)
            .then((node) => { document.body.appendChild(node); });
        
        delayNode.connect(delayNode);

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


