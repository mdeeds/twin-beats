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
            recordParameter = workletNode.parameters.get("record");
	          recordParameter.setValueAtTime(1, audioCtx.currentTime + 4.0); // Trigger recording
	          recordParameter.setValueAtTime(0, audioCtx.currentTime + 12.0); // End recording

            playParameter = workletNode.parameters.get("play");
	          playParameter.setValueAtTime(1, audioCtx.currentTime + 12.0); // Trigger playback
	          
	          resolve(workletNode);
        } catch (error) {
            reject(error);
        }
	  });
}

function writeTone(buffer, freq, startSeconds, durationSeconds, context) {
    let t = startSeconds;
    const endSeconds = startSeconds + durationSeconds;
    let i = startSeconds * context.sampleRate;
    while (t < endSeconds && i < buffer.length) {
        let y = Math.sin(t * freq * (2 * Math.PI));
        y = y * y * y;
        buffer[i] = y;
        ++i;
        t += 1.0 / context.sampleRate;
    }
}

function fillMetronomeWithScale(buffer, context) {
    let freq = 220;
    for (let i = 0; i < 13; ++i) {
        console.log(freq);
        writeTone(buffer, freq, i * 0.5, 0.3, context);
        freq *= Math.pow(2.0, 1/12);
    }
}

function fillMetronome(buffer, context) {
    for (let i = 0; i < 16; ++i) {
        writeTone(buffer, 220, i * 0.5, 0.05, context);
    }
    for (let i = 0; i < 4; ++i) {
        writeTone(buffer, 440, i * 2.0, 0.05, context);
    }
}


function makeMetronome(context) {
    const buffer = context.createBuffer(1, context.sampleRate * 8, context.sampleRate);
    const channelData = buffer.getChannelData(0);
    fillMetronome(channelData, context);
    const bufferNode = context.createBufferSource({loop: true});
    bufferNode.buffer = buffer;
    bufferNode.loop = true;
    bufferNode.start();
    return bufferNode;
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
        this.context = context;
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
        this.div.moveCallback = () => {
            this.updatePan();
            this.updateFilter();
        }
    }
    
    moveDiv(event) {
        if (!this.dragging) return;
        const deltaX = event.clientX - this.startX;
        const deltaY = event.clientY - this.startY;
        this.startX = event.clientX;
        this.startY = event.clientY;
        this.div.style.left = `${this.div.offsetLeft + deltaX}px`;
        this.div.style.top = `${this.div.offsetTop + deltaY}px`;
        this.updatePan();
        this.updateFilter();
    }

    updatePan() {
        let pan = this.getRelativeX() * 2.0 - 1.0;
        // console.log(`pan: ${pan}`);
        pan = Math.min(Math.max(pan, -1), 1.0);
        this.panNode.pan.linearRampToValueAtTime(pan, this.context.currentTime + 1/60);
    }
    
    updateFilter() {
        let cutoffNote = (1.0 - this.getRelativeY()) * 120 - 45;
        let cutoffHz = Math.pow(2.0, cutoffNote / 12) * 440;
        // console.log(`cutoff: ${cutoffHz}`);
        cutoffHz = Math.min(Math.max(1, cutoffHz), 24000);
        this.filterNode.frequency.linearRampToValueAtTime(cutoffHz, this.context.currentTime + 1/60);
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
    div.style.left = '50vw';
    div.style.top = '5vh';
    document.body.appendChild(div);
    return new DraggableDiv(div, context);
}

function moveBubbles() {
    const bubbles = document.querySelectorAll('.bubble');

    // Function to check collision between two circles
    const checkCollision = function(rect1, rect2) {
        const meanDiameter = (rect1.width + rect1.height + rect2.width + rect2.height) / 4;
        const x1 = rect1.left + rect1.width * 0.5;
        const y1 = rect1.top + rect1.height * 0.5;
        const x2 = rect2.left + rect2.width * 0.5;
        const y2 = rect2.top + rect2.height * 0.5;
        const dx = x2 - x1;
        const dy = y2 - y1;
        return (dx * dx + dy * dy <= meanDiameter * meanDiameter);
    }

    for (let i = 0; i < bubbles.length; i++) {
        const bubble1 = bubbles[i];
        const rect1 = bubble1.getBoundingClientRect();

        for (let j = i + 1; j < bubbles.length; j++) {
            const bubble2 = bubbles[j];
            const rect2 = bubble2.getBoundingClientRect();
            // Check if bubbles are touching
            if (checkCollision(rect1, rect2)) {
                const dx = rect2.x - rect1.x + Math.random() - 0.5;
                const dy = rect2.y - rect1.y + Math.random() - 0.5;
                
                // Calculate a normalized movement vector away from each other
                const distance = Math.sqrt(dx**2 + dy**2);
                const movementX = dx / distance;
                const movementY = dy / distance;
                
                // Move each bubble slightly away from the other
                bubble1.style.left = `${rect1.left - movementX}px`;
                bubble2.style.left = `${rect2.left + movementX}px`;
                bubble1.style.top = `${rect1.top - movementY}px`;
                bubble2.style.top = `${rect2.top + movementY}px`;

                if (bubble1.moveCallback) {
                    bubble1.moveCallback();
                }
                if (bubble2.moveCallback) {
                    bubble2.moveCallback();
                }
            }
        }
    }
    requestAnimationFrame(moveBubbles);
}

async function startRecordingInNewBubble(source, startTime) {
	  const recordingNode = await startRecordingWithWorklet(source);
    recordingNode.connect(source.context.destination);
    const bubble = addBubble(source.context);
    bubble.connectSource(recordingNode);
    bubble.connectTarget(source.context.destination);
}

function demonstrateAutocorrelation(context) {
    const worker = new Worker('auto-correlation-worker.js');
    const buffer = new Float32Array(context.sampleRate * 8);
    fillMetronome(buffer, context);
    
    worker.onmessage = function(e) { console.log(e.data); };
    worker.postMessage({sampleRate: 44100});
    worker.postMessage({buffer: buffer});
}

async function init() {
	  document.body.innerHTML = "";
    const source = await getAudioSourceNode();
    await startRecordingInNewBubble(source, source.context.currentTime + 0.1);
    
    moveBubbles();
    
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 100;
    document.body.appendChild(canvas);
    
    const metronome = makeMetronome(source.context);
    const bubble = addBubble(source.context);
    bubble.connectSource(metronome);
    bubble.connectTarget(source.context.destination);
    
    demonstrateAutocorrelation(source.context);
}
 
async function go() {
     const button = document.createElement('button');
     button.innerText = 'GO';
     document.body.appendChild(button);
     button.addEventListener('click', init);
}
