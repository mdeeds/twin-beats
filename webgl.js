getBody = async function(url) {
    const response = await fetch(url);
    return await response.text();
}


loadAndCompilePrograms = async function(gl) {
    // Vertex Shader
    const vertexShaderSource = await getBody('vertex-shader.glsl');
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    // Check for compilation errors
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error('Error compiling vertex shader:', gl.getShaderInfoLog(vertexShader));
        return;
    }
    // Fragment Shader
    const fragmentShaderSource = (
        await getBody('util.glsl') + await getBody('fragment-shader.glsl'));
    // Create and compile the fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    // Check for compilation errors
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error('Error compiling fragment shader:', gl.getShaderInfoLog(fragmentShader));
        return;
    }    
    // Create the shader program
    const program = gl.createProgram();
    gl.attachShader(program, fragmentShader);
    gl.attachShader(program, vertexShader);
    gl.linkProgram(program);
    
    // Check for linking errors
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Error linking shader program:', gl.getProgramInfoLog(program));
        return;
    }
    return program;
}

setUpEnvironmentMap = function(gl, program) {
    // Common settings for all faces
    const level = 0; 
    const internalFormat = gl.RGBA;
    const border = 0;
    const type = gl.UNSIGNED_BYTE;
    
    // Cubemap face definitions
    const faceTargets = [
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_X, color: [0.5, 0.5, 0.5, 1] }, // slate grey
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, color: [0.5, 0.5, 0.5, 1] }, // slate grey
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, color: [1.0, 1.0, 1.0, 1] },      // white
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, color: [0.5, 0.5, 0.5, 1] }, // slate grey
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, color: [0.5, 0.5, 0.5, 1] }, // slate grey
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, color: [0.5, 0.5, 0.5, 1] }, // slate grey
    ];

    // Reference: https://webglfundamentals.org/webgl/lessons/webgl-2-textures.html
    const cubeMap = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMap);

    // Temporary canvas for drawing the faces.
    const canvas = document.createElement('canvas'); 
    const ctx = canvas.getContext('2d');  
    canvas.width = 128; 
    canvas.height = 128;

    // Configure each face of the cubemap
    faceTargets.forEach(({ target, color }) => {
        ctx.fillStyle = `rgba(${color.map(c => c * 255).join(',')})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(64, 64, 60, -Math.PI, Math.PI);
        ctx.fill();
        
        // Send image to the cubemap face
        gl.texImage2D(target, level, internalFormat,
                      canvas.width, canvas.height, border, internalFormat,
                      type, ctx.getImageData(0, 0, canvas.width, canvas.height));
    });

    // Mipmap and filtering
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    const uCubeLocation = gl.getUniformLocation(program, 'u_environment');
    gl.uniform1i(uCubeLocation, 1); // Bind to unit 1
}

setUpGeometry = async function(gl, program) {
    // Quad for rendering
    const vertices = new Float32Array([
        -1, -1,
        1, -1,
        1, 1,
        -1, 1,
    ]);
    
    // Create a vertex buffer object (VBO)
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Set attribute pointer for vertex positions
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Set viewport and clear color
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    // Use the program and set up data connections;
    gl.useProgram(program);
    const widthLocation = gl.getUniformLocation(program, 'u_canvasWidth');
    const heightLocation = gl.getUniformLocation(program, 'u_canvasHeight');
    gl.uniform1f(widthLocation, gl.canvas.width);
    gl.uniform1f(heightLocation, gl.canvas.height);
}

setUpTexture = async function(gl, program) {
    // Create a texture for storing data
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const textureWidth = 1024; // Size of the FFT frequency data
    const textureHeight = 16;  // Maximum number of tracks
    // Monochrome texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, textureWidth, textureHeight,
                  0, gl.LUMINANCE, gl.UNSIGNED_BYTE, null);

    const uniformLocation = gl.getUniformLocation(program, "spectrogramTexture");
    gl.uniform1i(uniformLocation, 0); // Assuming texture unit 0
    return texture;
}

class PannedSound {
    constructor(source) {
        this.source = source;
        this.audioCtx = source.context;
        this.epsilon = 1 / 60.0;

        this.splitter = this.audioCtx.createChannelSplitter(2);
        this.source.connect(this.splitter);
        this.maxHaasDelay = 0.18 / 343.0; // 343 = speed of sound 0.18 = distance between ears.
        this.leftDelay = this.audioCtx.createDelay();
        this.rightDelay = this.audioCtx.createDelay();
        this.splitter.connect(this.leftDelay, 0); // Left channel to left delay
        this.splitter.connect(this.rightDelay, 1); // Right channel to right delay
        this.merger = this.audioCtx.createChannelMerger(2);
        this.leftDelay.connect(this.merger, 0, 0);
        this.rightDelay.connect(this.merger, 0, 1);
        this.panNode = this.audioCtx.createStereoPanner();
        this.merger.connect(this.panNode);
    }

    setPan(panValue) {
        // Set pan value (-1 to 1) on StereoPanNode
        this.panNode.pan.linearRampToValueAtTime(panValue, this.audioCtx.currentTime + this.epsilon);
        const panDelay = this.maxHaasDelay * Math.abs(panValue);

        // Apply Haas delay to opposite channel
        if (panValue > 0) {
            // Panned right, delay left channel
            this.leftDelay.delayTime.linearRampToValueAtTime(
                panDelay, this.audioCtx.currentTime + this.epsilon);
            this.rightDelay.delayTime.linearRampToValueAtTime(
                0.0, this.audioCtx.currentTime + this.epsilon);
        } else {
            // Panned left, delay right channel
            this.leftDelay.delayTime.linearRampToValueAtTime(
                0.0, this.audioCtx.currentTime + this.epsilon);
            this.rightDelay.delayTime.linearRampToValueAtTime(
                panDelay, this.audioCtx.currentTime + this.epsilon);
        }
    }
    
    connect(destination) {
        this.merger.connect(destination);
    }
}

class FilteredSource {
    constructor(source) {
        this.source = source;
        this.audioCtx = source.context;
        this.epsilon = 1/60;
        this.canvas = document.createElement('canvas');
        this.canvas.width = 128;
        this.canvas.height = 512;
        document.body.appendChild(this.canvas);
        
        this.lpf = this.audioCtx.createBiquadFilter();
        this.lpf.frequency.setValueAtTime(100, this.audioCtx.currentTime);
        this.lpf.type = "lowpass";
        this.lpf.Q.setValueAtTime(0.5, this.audioCtx.currentTime);
        this.hpf = this.audioCtx.createBiquadFilter();
        this.hpf.type = "highpass"
        this.hpf.frequency.setValueAtTime(100, this.audioCtx.currentTime);
        this.hpf.Q.setValueAtTime(0.1, this.audioCtx.currentTime);
        this.setCutoffNote(60);  // Middle C
        
        source.connect(this.lpf);
        this.lpf.connect(this.hpf);

        setTimeout(() => { this.updateCanvas(); }, 100);
    }

    setCutoffHz(low, high) {
        // If we try to set a cutoff above 24,000 Hz, the AudioAPI gets mad at us.
        this.lpf.frequency.linearRampToValueAtTime(
            Math.min(24000, low),
            this.audioCtx.currentTime + this.epsilon);
        this.hpf.frequency.linearRampToValueAtTime(
            Math.min(24000, high),
            this.audioCtx.currentTime + this.epsilon);
        this.updateCanvas();
    }

    updateCanvas() {
        const hz = new Float32Array(129);
        for (let note = 0; note < hz.length; ++note) {
            const f = 440 * Math.pow(2, (note - 69)/12);
            hz[note] = f;
        }
        const mag = new Float32Array(hz.length);
        const pha = new Float32Array(hz.length);
        this.hpf.getFrequencyResponse(hz, mag, pha);
        
        const totalMag = new Float32Array(mag);
        const totalPha = new Float32Array(pha);
        this.lpf.getFrequencyResponse(hz, mag, pha);
        for (let note = 0; note < hz.length; ++note) {
            totalMag[note] *= mag[note];
            totalPha[note] += pha[note];
        }
        
        const ctx = this.canvas.getContext('2d');
        ctx.fillStyle = '#999';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.beginPath();
        ctx.strokeStyle = '#455';
        ctx.lineWidth = 1;
        ctx.moveTo(this.canvas.width * 3 / 5, 0);
        ctx.lineTo(this.canvas.width * 3 / 5, this.canvas.height);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.moveTo(0, 0);
        for (let note = 0; note < hz.length; ++note) {
            const x = totalMag[note] * (this.canvas.width * 3 / 5);
            const y = (1.0 - note / (hz.length - 1)) * this.canvas.height;
            if (note == 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x,y);
            }
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#922';
        for (let note = 0; note < hz.length; ++note) {
            const x = totalPha[note] / Math.PI * (this.canvas.width * 0.5) + this.canvas.width * 0.5;
            const y = (1.0 - note / (hz.length - 1)) * this.canvas.height;
            if (note == 0) {
                ctx.moveTo(x,y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }

    setCutoffNote(note) {
        // We display 9 octaves of notes, so I'll set the cutoff at +/- 3 octaves.
        // We set the low pass filter at the higher frequency.
        const noteHz = 440 * Math.pow(2, (note - 69) / 12);
        const lowHz = noteHz * Math.pow(2, 3);
        const highHz = noteHz * Math.pow(2, -3);
        // console.log(`Note: ${note}; low: ${lowHz}; high: ${highHz}`);
        this.setCutoffHz(lowHz, highHz);
    }

    connect(destination) {
        this.hpf.connect(destination);
    }
}


class Circles {
    constructor(maxNumCircles) {
        this.flatData = new Float32Array(4 * maxNumCircles);
        this.numCircles = 0;
        this.dragging = -1;
        this.dxy = [];
        this.changed = new Uint8ClampedArray(maxNumCircles);
    }

    add(x, y, r) {
        const offset = this.numCircles * 4;
        this.flatData[offset + 0] = x;
        this.flatData[offset + 1] = y;
        this.flatData[offset + 2] = r;
        this.flatData[offset + 3] = 0;
        return ++this.numCircles;
    }

    move(i, dx, dy) {
        this.flatData[i * 4] += dx;
        this.flatData[i * 4 + 1] += dy;
    }
    
    set(i, x, y) {
        this.flatData[i * 4] = x;
        this.flatData[i * 4 + 1] = y;
    }

    getX(i) {
        return this.flatData[i * 4];
    }
    
    getY(i) {
        return this.flatData[i * 4 + 1];
    }
    
    hasChanged(i) {
        const result = !!this.changed[i];
        this.changed[i] = 0;
        return result;
    }

    // Returns true if x,y intersects circle i.
    _checkCollision(i, x, y) {
        const dx = x - this.flatData[i * 4];
        const dy = y - this.flatData[i * 4 + 1];
        const r = this.flatData[i * 4 + 2];
        return (r * r) > (dx * dx + dy * dy);
    }
    
    handleMouse(event) {
        if (event.type == 'mousedown') {
            const rect = event.target.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = rect.bottom - event.clientY;
            for (let i = 0; i < this.numCircles; ++i) {
                if (this._checkCollision(i, x, y)) {
                    this.dragging = i;
                    this.dxy = [x - this.flatData[i * 4 + 0],
                                y - this.flatData[i * 4 + 1]];
                    break;
                }
            }
        } else if (event.type == 'mouseup') {
            this.dragging = -1;
        } else  if (event.type == 'mousemove') {
            if (this.dragging >=0) {
                const rect = event.target.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = rect.bottom - event.clientY;
                this.set(this.dragging, x - this.dxy[0], y - this.dxy[1]);
                this.changed[this.dragging] = 1;
            }
        }
    }
}

getPanFromXY = function(x, y, rect) {
  // This is the percentage of the way up the screen
    const q = y / rect.height;
    // This is the percentage of the way down.
    const p = 1.0 - q;
    // The width of the view region at pos.y
    const width = q * rect.width + p * rect.width / 3.0;
    const dx = x - (0.5 * rect.width);
    const pan = dx / (width * 0.5);
    return pan;
}

const BOTTOM_NOTE = 21.0;
const TOP_NOTE = 129.0;

getNoteFromPx = function(px, pixelSpan) {
  return BOTTOM_NOTE + (TOP_NOTE - BOTTOM_NOTE) * (px / pixelSpan);
}

getNoteFromXY = function(x, y, rect) {
    const originX = rect.width / 2;
    const originY = -rect.height / 2;
    const dx = x - originX;
    const dy = y - originY;
    const px = Math.sqrt(dx * dx + dy * dy);
    return getNoteFromPx(px + originY, rect.height);
}

class Tracks {
    constructor(maxNumTracks) {
        this.filters = [];
        this.analysers = [];
        this.panners = [];
    }
    
    add(source) {
        // Connect source to new Filter
        const filter = new FilteredSource(source);
        this.filters.push(filter);
       // Connect filter to a new analyser
        const analyser = source.context.createAnalyser();
        filter.connect(analyser);
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.4;
        this.analysers.push(analyser);
        // Connect analyser to new Panner  // Some weirdness happens HERE!!
        const panner = new PannedSound(analyser);
        this.panners.push(panner);
        // Connect to speakers
        analyser.connect(source.context.destination);
    }

    getAnalyser(i) {
        return this.analysers[i];
    }

    setParams(i, x, y, rect) {
        this.panners[i].setPan(getPanFromXY(x, y, rect));
        this.filters[i].setCutoffNote(getNoteFromXY(x, y, rect));
    }
}

function findPeaks(audioData, sampleRate) {
    const decayTime = 1 / 20; // 1/20th of a second
    const decayFactor = Math.pow(0.01, 1 / (decayTime * sampleRate)); // Calculate decay factor
    const highPassDelay = Math.floor(decayTime * sampleRate); // Delay for high pass filter
    
    const processedData = new Float32Array(audioData.length);
    let lowPassAverage = 0;
    let highPassDelayLine = new Float32Array(highPassDelay);

    let maxOutput = 0;
    for (let i = 0; i < audioData.length; i++) {
        // Low pass filter with decay
        lowPassAverage = decayFactor * lowPassAverage + (1 - decayFactor) * Math.abs(audioData[i]);
        processedData[i] = lowPassAverage;
        
        // High pass filter
        if (i >= highPassDelay) {
            processedData[i] -= highPassDelayLine[i % highPassDelay]; // Subtract delayed low pass value
        }
        maxOutput = Math.max(processedData[i], maxOutput);
        highPassDelayLine[i % highPassDelay] = lowPassAverage; // Update delay line
    }
    
    // Normalize the output between 0 and 1.
    const scale = 1.0 / maxOutput;
    for (let i = 0; i < processedData.length; ++i) {
        if (processedData[i] < 0) {
            processedData[i] = 0;
        } else {
            processedData[i] *= scale;
        }
    }
    return processedData;
}

// An input which continuously listens to an audio signal and saves
// the entire stream.  Eventually this will clean up after itself with
// some sort of LRU policy.  In float32 format an hour of recording
// time is 635,040,000 bytes. It's less than a gig, so I think we are
// probably safe to do this without any expulsion policy for now.
class Microphone {
    constructor(source) {
        this.source = source;
        this.setUp();
        this.lastKey = '';
        this.recordStartTime = -1;
    }

    async setUp() {
        await this.source.context.audioWorklet.addModule("work-worker.js");
        this.workletRecorder = new AudioWorkletNode(
            this.source.context, "recorder-worklet");
        
        this.workletRecorder.port.onmessage = (event) => {
            // console.log(event.data);
            switch (event.data.command) {
            default:
                console.error(`Unknown command: ${event.data.command}`);
            }
        };
        // Create a new messaging buffer and release it to the worker.
        const buffer = new Float32Array(64 * 128);
        const nextBuffer = new Float32Array(64 * 128);
        this.source.connect(this.workletRecorder);

        // TODO: run this through a bubble.
        this.workletRecorder.connect(this.source.context.destination);
        
        
        this.state = 'paused';
        const transitionMap = { paused: 'record', record: 'overdub', overdub: 'play', play: 'overdub' };
        
        document.body.addEventListener('keydown', (event) => {
            if (this.lastKey == event.code) return;
            this.lastKey = event.code;
            if (event.code == 'Space') {
                if (!transitionMap.hasOwnProperty(this.state)) return;
                this.state = transitionMap[this.state];
            } else {
                return;
            }
            switch (this.state) {
            case 'record':
                this.recordStartTime = this.source.context.currentTime;
                console.log('Entering record state.');
                break;
            case 'overdub':
                console.log('Entering overdub state.');
                // TODO: Start the current playback node with the current time.
                const playbackStartTime = this.source.context.currentTime;
                const loopLength = playbackStartTime - this.recordStartTime;
                this.workletRecorder.port.postMessage(
                    {command: 'loop', index: 0,
                     startTime: this.recordStartTime, endTime: this.recordStartTime + loopLength});
                break;
            case 'play':
                console.log('Entering play state.');
                // TODO: stop creating new playback nodes.
                break;
            case 'paused': break;
            default:
                console.error(`Invalid state: ${this.state}`);
                break;
            }
        });
        
        document.body.addEventListener('keyup', () => { this.lastKey = ''; });
    }
    getOutput(outputIndex) {
        const gainNode = this.source.context.createGain();
        this.workletRecorder.connect(gainNode, outputIndex);
        return gainNode;
    }
}

runRenderLoop = async function(source, mic) {
    const canvas = document.getElementById('myCanvas');
    const gl = canvas.getContext('webgl');    
    const program = await loadAndCompilePrograms(gl);
    if (!program) return;

    await setUpGeometry(gl, program);
    const texture = await setUpTexture(gl, program);
    
    const bubbleLocations = gl.getUniformLocation(program, 'u_bubbleLocations');
    const circles = new Circles(16);
    const tracks = new Tracks(16);
    tracks.add(source);
    tracks.add(mic.getOutput(0));
    circles.add(canvas.width / 2, 300, 50);
    circles.add(canvas.width / 2, 200, 50);
    
    canvas.addEventListener('mousedown', (event) => circles.handleMouse(event));
    canvas.addEventListener('mousemove', (event) => circles.handleMouse(event));
    canvas.addEventListener('mouseup', (event) => circles.handleMouse(event));

    // getByteFrequencyData: 330ms / 3647ms scripting
    // 52ms system
    // getFloatFrequencyData: 1030ms / 3530 ms scripting
    // 112ms system
    // Note: Most of the cost is due to the new code which converts dB to amplitude.
    // Calculating the FFTs is pretty quick.

    // Need to do this right and also maybe update when the screen resizes???
    const rect = canvas.getBoundingClientRect();

    renderLoop = () => {
        // It's a tiny bit cheaper to put these here instead of outside of the loop.
        const spectrogramData = new Uint8Array(16 * 1024);
        const singleSpect = new Float32Array(1024);
        gl.uniform4fv(bubbleLocations, circles.flatData);

        for (let i = 0; i < 16; ++i) {
            const analyser = tracks.getAnalyser(i);
            if (!analyser) { continue; }
            analyser.getFloatFrequencyData(singleSpect);
            const offset = 1024 * i;
            for (let j = 0; j < 1024; ++j) {
                // If we wanted amplitude, we would divide by 20. Instead we are plotting
                // power, so divide by 10.  Multiply by j because the vizualization makes
                // the lower buckets wider, so to get the number of pixels proportaionl to
                // the power we need to multiply by the frequency.
                // (I.e. d_bucket / d_note has a linear relationship with frequency)
                const v = Math.pow(10, singleSpect[j] / 10) * j;
                spectrogramData[offset + j] = Math.max(0, Math.min(255, 255 * v));
            }
            if (circles.hasChanged(i)) {
                tracks.setParams(i, circles.getX(i), circles.getY(i), rect);
            }
        }
        // Update texture data
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1024, 16, gl.LUMINANCE, gl.UNSIGNED_BYTE, spectrogramData);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1024, 16, 0,
                      gl.LUMINANCE, gl.UNSIGNED_BYTE, spectrogramData);

        // gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        
        requestAnimationFrame(renderLoop);
    }
    renderLoop();
}

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
    console.log(`Stream: ${stream.id}`);
    const source = audioCtx.createMediaStreamSource(stream);
    return source;
}

async function getAudioChirpNode() {
    const audioCtx = new AudioContext();

    const osc = audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(1200, audioCtx.currentTime);
    const lfo = audioCtx.createOscillator();
    lfo.frequency.setValueAtTime(0.5, audioCtx.currentTime);
    lfo.connect(gain);
    gain.connect(osc.detune);

    osc.start(audioCtx.currentTime);
    lfo.start(audioCtx.currentTime);
    return osc;
}


class KeyboardSynth {
    constructor(audioContext) {
        this.audioCtx = audioContext;
        // Create oscillator
        this.oscillator = this.audioCtx.createOscillator();
        this.oscillator.type = 'square';
        // Create gain node with initial gain set to 0 (silent)
        this.gainNode = this.audioCtx.createGain();
        this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
        this.oscillator.connect(this.gainNode);
        this.oscillator.start();
        // The last key pressed.  This prevents us from triggering repeatedly when a key is held down.
        this.keyDown = false;

        // Map keyboard keys to MIDI notes
        this.keyMap = {
            'A': 60, // C
            'W': 61, // C#
            'S': 62, // D
            'E': 63, // D#
            'D': 64, // E
            'F': 65, // F
            'T': 66, // F#
            'G': 67, // G
            'Y': 68, // G#
            'H': 69, // A  440Hz
            'U': 70, // A#
            'J': 71, // B
            'K': 72, // C
            'O': 73, // C#
            'L': 74, // D
        };

        // Initial octave.  We set this to -1 so the sound is a little less annoying.
        // Middle C will initially be on the 'K' key.
        this.octave = -1;

        // Attach keyboard event listeners
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    // Handle keydown events
    handleKeyDown(event) {
        const key = event.key.toUpperCase();
        if (this.keyDown == key) { return; }
        if (this.keyMap.hasOwnProperty(key)) {
            const midiPitch = this.keyMap[key] + (this.octave * 12);
            this.playNote(midiPitch);
            this.keyDown = key;
        } else if (key === 'ARROWUP') {
            this.octave++;
        } else if (key === 'ARROWDOWN') {
            this.octave--;
        }
    }

    // Handle keyup events
    handleKeyUp(event) {
        this.keyDown = false;
        const key = event.key.toUpperCase();
        if (this.keyMap.hasOwnProperty(key)) {
            this.stopNote();
        }
    }

    // Play a note with a specific MIDI pitch
    playNote(midiPitch) {
        const targetFrequency = Math.pow(2, ((midiPitch - 69) / 12)) * 440;
        // Update oscillator frequency and apply gain ramp
        this.oscillator.frequency.setValueAtTime(targetFrequency, this.audioCtx.currentTime);
        this.gainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
        // Attack and initial decay to a sustain level of 0.2
        this.gainNode.gain.linearRampToValueAtTime(1, this.audioCtx.currentTime + 0.1);
        this.gainNode.gain.linearRampToValueAtTime(0.2, this.audioCtx.currentTime + 0.2);
    }

    // Stop playing the note (ramps gain down)
    stopNote() {
        this.gainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
        // Release 0.5 seconds
        this.gainNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.5);
    }

    // Connect the gain node to the audio output
    connect(destination) {
        this.gainNode.connect(destination);
    }
    getSource() {
        return this.gainNode;
    }
}


async function getSynthNode() {
    const s = new KeyboardSynth(new AudioContext());
    return s.getSource();
}

async function getSource(type) {
    let source;
    switch (type) {
    case 'live':
        source = await getAudioChirpNode();
        break;
    case 'internal':
        source = await getAudioSourceNode();
        break;
    case 'keys':
        source = await getSynthNode();
        break;
    default:
        console.error(`Unsupported type: ${type}`);
        break;
    }
    return source;
}

init = async function(type) {
    const source = await getSource(type);
    const mic = new Microphone(source);
    await runRenderLoop(source, mic);
}


go = async function() {
    const goButton = document.createElement('button');
    goButton.innerText = 'GO';
    document.body.appendChild(goButton);
    
    const liveButton = document.createElement('button');
    liveButton.innerText = 'Live';
    document.body.appendChild(liveButton);

    const keyButton = document.createElement('button');
    keyButton.innerText = 'Keys';
    document.body.appendChild(keyButton);

    liveButton.addEventListener('click', () => {
        document.body.removeChild(goButton);
        document.body.removeChild(liveButton);
        document.body.removeChild(keyButton);
        init('internal');
    });

    goButton.addEventListener('click', () => {
        document.body.removeChild(goButton);
        document.body.removeChild(liveButton);
        document.body.removeChild(keyButton);
        init('live');
    });

    keyButton.addEventListener('click', () => {
        document.body.removeChild(goButton);
        document.body.removeChild(liveButton);
        document.body.removeChild(keyButton);
        init('keys');
    });
}
