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

async function init() {
	document.body.innerHTML = "";
    const source = await getAudioSourceNode();
	const recordingNode = await startRecordingWithWorklet(source);
	recordingNode.connect(source.context.destination);
}

async function go() {
    const button = document.createElement('button');
    button.innerText = 'GO';
    document.body.appendChild(button);
    button.addEventListener('click', init);
}


