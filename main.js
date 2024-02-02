class SynchronizedClock {
    constructor(audioContext, peer) {
        this.audioContext = audioContext;
        this.syncTimestamp = null;
    }
    
    startSynchronization() {
	      this.peer.peer.on("message", this.handleMessage.bind(this));
	      this.syncTimestamp = this.audioContext.currentTime;
	      this.peer.peer.send({ type: "sync" });
    }
    
    handleMessage(message) {
        if (message.type == "sync") {
            this.peer.peer.send({ type: "ack", timestamp: this.audioContext.currentTime });
        } else if (message.type = "ack" && this.syncTimestamp) {
            const localTimestamp = this.audioContext.currentTime;
            this.latency = (localTimestamp - this.syncTimestamp) / 2;
            const remoteTimestamp = message.timestamp + this.latency;
            this.skew = remoteTimestamp - localTimestamp;
            console.log(`Latency: ${this.latency}; skew: ${this.skew}`);
        }
    }
}

async function populateAudioDevices() {
  var inputSelect = document.createElement('select');
  document.body.appendChild(inputSelect);
  var outputSelect = document.createElement('select');
  document.body.appendChild(outputSelect);
  
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

var bpm = 120;

class Tick {
  constructor(audioContext, options = {}) {
    this.audioCtx = audioContext;
    this.options = {
      type: "saw", // Default oscillator type
      frequency: 440, // Default frequency in Hz
      volume: 0.05, // Default volume between 0 and 1
      duration: 0.05, // Default duration in seconds
      ...options, // Merge user-provided options
    };

    this.oscillator = this.audioCtx.createOscillator();
    this.oscillator.type = this.options.type;
    this.oscillator.frequency.setValueAtTime(this.options.frequency, this.audioCtx.currentTime);

    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);

    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(this.audioCtx.destination);
    this.oscillator.start(this.audioCtx.currentTime);
  }

  play(startTime) {
    this.gainNode.gain.setValueAtTime(this.options.volume, startTime);
    this.gainNode.gain.setValueAtTime(0, nowTime + this.options.duration);
  }
}

var tick = null;

class KeyHandler {
  constructor() {
    this._pressedKeys = new Set(); // Track currently pressed keys
    this._keyCallbacks = {};      // Store key codes and their associated callbacks

    document.addEventListener("keydown", this._handleKeyDown);
    document.addEventListener("keyup", this._handleKeyUp);
  }

  register(key, callback) {
    this._keyCallbacks[key] = callback;
  }

  _handleKeyDown = (event) => {
    const key = event.key;

    if (!this._pressedKeys.has(key) && this._keyCallbacks[key]) {
      this._keyCallbacks[key]();
      this._pressedKeys.add(key);
    }
  };

  _handleKeyUp = (event) => {
    this._pressedKeys.delete(event.key);
  };
}

var keyHandler = new KeyHandler();

class TrackButton {
    constructor(keyLetter, buttonGroup, allButtonGroup) {
        this.state = 'stop';
        this.hasContent = false;
        this.buttonGroup = buttonGroup;
        this.allButtonGroup = allButtonGroup;
        this.buttonGroup.add(this);
        this.button = this.createCircularButton(
            keyLetter, () => { this.changeState(); });
    }

    changeState() {
        let nextState = {
            stop: 'record',
            record: 'overdub',
            overdub: 'play',
            play: 'stop',
        }[this.state];
        if (this.hasContent && nextState === 'record') {
            nextState = 'overdub';
        }
        if (nextState === 'record' || nextState === 'overdub') {
            this.allButtonGroup.stopRecording();
        }
        this.buttonGroup.stop();
        this.setState(nextState);
    }

    setState(nextState) {
        if (this.state === 'record') {
            this.button.classList.add('has-content');
            this.hasContent = true;
        }
        this.button.classList.remove(this.state);
        this.button.classList.add(nextState);
        this.state = nextState;
    }

    stop() {
        if (this.state === 'stop') { return; }
        this.setState('stop');
    }

    stopRecording() {
        if (this.state === 'record' || this.state === 'overdub') {
            this.setState('play');
        }
    }

    getButton() { return this.button; }

    createCircularButton(keyLetter, callback) {
        const button = document.createElement("button");
        button.classList.add("track-button");
        
        // Get the key code based on the letter
        const key = keyLetter.toLowerCase();
        
        // Set button text and style
        button.textContent = keyLetter.toUpperCase();
        
        // Add click event listener to the button
        button.addEventListener("click", callback);
        
        // Register the key code and callback with the KeyHandler
        keyHandler.register(key, callback);
        
        button.classList.add(this.state);
        
        return button;
    }
}

class TrackButtonGroup {
    constructor() {
        this.buttons = [];
    }
    add(trackButton) {
        this.buttons.push(trackButton);
    }
    stop() {
        for (const b of this.buttons) {
            b.stop();
        }
    }
    stopRecording() {
        for (const b of this.buttons) {
            b.stopRecording();
        }
    }
}

class AllButtonGroup {
    constructor() {
        this.buttonGroups = [];
    }
    add(trackButtonGroup) {
        this.buttonGroups.push(trackButtonGroup);
    }
    stop() {
        for (const tbg of this.buttonGroups) {
            tbg.stop();
        }
    }
    stopRecording() {
        for (const tbg of this.buttonGroups) {
            tbg.stopRecording();
        }        
    }
}


function connectGainNodeToPeerStream(gainNode, peerStream) {
  const audioContext = gainNode.context;
  const mediaStreamSource = audioContext.createMediaStreamSource(peerStream);

  // Connect the GainNode to the MediaStreamSource
  gainNode.connect(mediaStreamSource);

  // Create an AudioDestinationNode (virtual speaker) and connect the MediaStreamSource to it
  const audioDestination = audioContext.createMediaStreamDestination();
  mediaStreamSource.connect(audioDestination);

  // Return the MediaStream from the AudioDestinationNode
  return audioDestination.stream;
}

function connectPeerStreamToGainNode(peerStream, gainNode) {
  const audioContext = gainNode.context;
  const mediaStreamSource = audioContext.createMediaStreamSource(peerStream);

  // Connect the MediaStreamSource directly to the GainNode
  mediaStreamSource.connect(gainNode);
}

async function getPeerStream(peer) {
    // If not, request a stream from the peer
    return new Promise((resolve, reject) => {
        // Check if the peer has already sent a stream
        const existingStream = peer.streams.getAudioTracks()[0];
        if (existingStream) {
            resolve(existingStream.stream);
            return;
        }
        peer.call(peer.id, stream => {
            // Handle stream errors
            stream.on("error", reject);

            // Resolve with the received stream
            resolve(stream);
        });
    });
}

function makeTrackDiv(controlButtons, allButtonGroup) {
    const trackDiv = document.createElement("div");
    trackDiv.classList.add("track-div");
    trackDiv.style.display = "flex"; // Main container as flexbox
    trackDiv.style.flexDirection = "row";
    //trackDiv.style.width = "180px";
    
    // Create a container for the buttons to ensure vertical layout
    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.flexDirection = "column";
    buttonContainer.style.alignItems = "center"; // Center buttons vertically
    buttonContainer.style.flexGrow = 1;
    trackDiv.appendChild(buttonContainer);

    const buttonGroup = new TrackButtonGroup();
    allButtonGroup.add(buttonGroup);
    for (const key of controlButtons) {
        const tb = new TrackButton(key, buttonGroup, allButtonGroup);
        buttonContainer.appendChild(tb.getButton());
    }

    // Create the vertical slider
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = 0;
    slider.max = 1000;
    slider.value = 1000;
    slider.classList.add("track-slider");
    trackDiv.appendChild(slider);
    
    return trackDiv;
}

function addTrackDivs() {
  // Create the container div
  const containerDiv = document.createElement("div");
    containerDiv.classList.add("track-container");

    const allButtonGroup = new AllButtonGroup();

  // Loop through the number of tracks
  for (controls of ['1qaz','2wsx','3edc','4rfv', '5tgb']) {
    // Create a track div using the provided function
      const trackDiv = makeTrackDiv(controls, allButtonGroup);
    // Add the track div to the container
    containerDiv.appendChild(trackDiv);
  }

  // Add the container div to the document body
  document.body.appendChild(containerDiv);
}

async function addPeerHandlers(peer) {
    var outboundDataConnection = null;
    
    return new Promise((resolve, reject) => {
	      peer.on("open", (id) => {
	          console.log("Connected to PeerJS Server.  My ID is:", id);
	          resolve();
	      });

        // Connect to the peer with the session ID
	      peer.on("connection", (dataConnection) => {
	          if (!outboundDataConnection) {
		            peer.connect(dataConnection.peer);
	          }
  	        outboundDataConnection = dataConnection;
            console.log("Peer reached out to me:", dataConnection.peer);
            dataConnection.on("open", function() {
		            console.log("Data connection opened");
                dataConnection.send({message: 'Hello'});
	          });
            dataConnection.on("close", function() {
		            console.log("Data connection closed");
                dataConnection.send({message: 'Hello'});
	          });
            dataConnection.on("data", function(data) {
                console.log(`Recieved data: ${JSON.stringify(data)}`)
            });
            dataConnection.on("error", (err) => {
                console.error("Data connection error: ", err);
            });
	      });
        peer.on("call", (mediaConnection) => { console.log("Media connection!"); });
        peer.on("close", () => { console.log("close"); });
        peer.on("disconnected", () => { console.log("disconnected"); });

	      // Handle connection errors
	      peer.on("error", (err) => {
	          console.error("PeerJS connection error:", err);
	      });
    });
}

async function connectToSession(sessionId) {
    // Create a PeerJS instance with a server-generated session ID
    const peer = new Peer();
    await addPeerHandlers(peer);
    // Finally, make the connection.
    console.log(`Attempting to establish connection with ${sessionId}`);
    peer.connect(sessionId);
}

async function createSessionLinkAndPeer(sessionId) {
  // Create the text box and button
  const urlContainer = document.createElement("div");
  const urlInput = document.createElement("input");
  urlInput.type = "text";
    urlInput.value = new URL(window.location.href).href + `?sid=${sessionId}`;
  urlInput.readOnly = true; // Make it read-only
  const copyButton = document.createElement("button");
  copyButton.textContent = "Copy URL";
  copyButton.addEventListener("click", () => {
    navigator.clipboard.writeText(urlInput.value);
  });
  urlContainer.appendChild(urlInput);
  urlContainer.appendChild(copyButton);

  // Create the PeerJS instance and listen on the session ID
  const peer = new Peer(sessionId, {
    // Pass any necessary PeerJS configuration options here
  });
  await addPeerHandlers(peer);

  // Add the UI elements to the page
  document.body.appendChild(urlContainer);
}


class CircularAudioBuffer {
    constructor(context, duration = 180) {
        this.context = context;
        this.duration = duration;
        this.sampleRate = context.sampleRate;
        this.bufferSize = duration * this.sampleRate * 2; // Stereo
        this.buffer = new Float32Array(this.bufferSize);
        this.writeIndex = 0;

        this.customNode = this.context.createScriptProcessor(this.bufferSize, 2, 2);
        this.customNode.onaudioprocess = this.handleAudioProcess.bind(this);
    }

    handleAudioProcess(event) {
        const inputBuffer = event.inputBuffer;
        const outputBuffer = event.outputBuffer;

        // Copy input to buffer, wrapping around at the end
        const remaining = this.bufferSize - this.writeIndex;
        const toCopy = Math.min(remaining, inputBuffer.length);
        this.buffer.set(inputBuffer.getChannelData(0), this.writeIndex);
        this.buffer.set(inputBuffer.getChannelData(1), this.writeIndex + this.bufferSize / 2);
        this.writeIndex = (this.writeIndex + toCopy) % this.bufferSize;

        if (toCopy < inputBuffer.length) {
            // Wrap around to the beginning
            const remaining = inputBuffer.length - toCopy;
            this.buffer.set(inputBuffer.getChannelData(0).slice(toCopy), 0);
            this.buffer.set(inputBuffer.getChannelData(1).slice(toCopy), this.bufferSize / 2);
            this.writeIndex = remaining;
        }

        // Pass audio through to output
        outputBuffer.getChannelData(0).set(inputBuffer.getChannelData(0));
        outputBuffer.getChannelData(1).set(inputBuffer.getChannelData(1));
    }

    start() {
        this.customNode.connect(this.context.destination);
    }

    stop() {
        this.customNode.disconnect();
    }

    getBuffer() {
        return this.buffer;
    }
}

init = function() {
  // Clear the current document
  document.body.innerHTML = "";

  // Create a container element for the text field and button
  const container = document.createElement("div");
  container.classList.add("session-container");

  // Create the button
  const button = document.createElement("button");
  button.classList.add("lets-go-button");
  button.textContent = "Let's Go!";
  container.appendChild(button);

  // Add the container element to the body
  document.body.appendChild(container);

  // Add event listener for clicking the button
  button.addEventListener("click", () => {
    // Get the entered session name
    document.body.innerHTML = "<div style='display: flex; justify-content: center; align-items: center;'><span>-=- Twin Beats -=-</span></div>";
      // populateAudioDevices();

    // Extract the session ID from the URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("sid");
      if (sessionId) {
	  connectToSession(sessionId);
      } else {
	  createSessionLinkAndPeer(`TB${Math.round(Math.random()*10000)}`);
      }

      
    addTrackDivs();
  });
}

main = function() {
  init();
}
