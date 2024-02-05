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


class DraggableDiv {
  constructor(div) {
    this.div = div;
      this.initDrag();
      this.dragging = false;
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

function addBubble() {
    const div = document.createElement('div');
    div.innerHTML = 'o';
    div.classList.add('bubble');
    document.body.appendChild(div);
    new DraggableDiv(div);
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

    addBubble();
}


