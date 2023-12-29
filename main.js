class SyrenchronizedClock {
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
      duration: 0.03, // Default duration in seconds
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

  play(duration = this.options.duration) {
  const nowTime = this.audioCtx.currentTime;
    this.gainNode.gain.linearRampToValueAtTime(
    this.options.volume, nowTime+0.01);
    this.gainNode.gain.linearRampToValueAtTime(
    this.options.volume, nowTime + this.options.duration - 0.01);
    this.gainNode.gain.setValueAtTime(
    0, nowTime + this.options.duration);
  }
}

var tick = null;

beatEvent = function() {
  setTimeout(beatEvent, 60 / bpm * 1000);
  if (tick) {
    // tick.play();
  }
}
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

function createCircularButton(keyLetter, callback) {
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
  
  button.classList.add('stop');

  return button;
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

function getPeerStream(peer) {
  // Check if the peer has already sent a stream
  const existingStream = peer.streams.getAudioTracks()[0];
  if (existingStream) {
    return existingStream.stream;
  }

  // If not, request a stream from the peer
  return new Promise((resolve, reject) => {
    peer.call(peer.id, stream => {
      // Handle stream errors
      stream.on("error", reject);

      // Resolve with the received stream
      resolve(stream);
    });
  });
}

function createPeerConnection(sessionName) { 
  var sessionId = "hicup-" + sessionName;
  var peer = new Peer();
  // Return the created Peer object for further use
  var conn = peer.connect(sessionId);
  // on open will be launch when you successfully connect to PeerServer
  conn.on('open', function(){
  // here you have conn.id
  var idDiv = document.createElement('div');
  idDiv.innerHTML = "Id: " + conn.id;
  document.body.appendChild(idDiv);
  conn.send('hi!');
  });
}

function makeTrackDiv(controlButtons) {
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

  for (const key of controlButtons) {
    const button = createCircularButton(key, () => {
      console.log(`Pressed: ${key}`);
    });
    buttonContainer.appendChild(button);
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

  // Loop through the number of tracks
  for (controls of ['1qaz','2wsx','3edc','4rfv', '5tgb']) {
    // Create a track div using the provided function
    const trackDiv = makeTrackDiv(controls);
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
		console.log("Connection opened");
                dataConnection.send({message: 'Hello'});
	    });
            dataConnection.on("data", function(data) { console.log(`Recieved data: ${JSON.stringify(data)}`) });
            dataConnection.on("error", (err) => { console.error("Data connection error: ", err); });
	});

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
    // tick = new Tick(new AudioContext());
    beatEvent();
  });
}

main = function() {
  init();
}
