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
        this.panNode = this.audioCtx.createStereoPanner();
        this.maxHaasDelay = 0.18 / 343.0; // 343 = speed of sound 0.18 = distance between ears.
        this.source.connect(this.panNode);
        this.leftDelay = this.audioCtx.createDelay();
        this.rightDelay = this.audioCtx.createDelay();
        this.merger = this.audioCtx.createChannelMerger(2);
        this.leftDelay.connect(merger,0,0);
        this.rightDelay.connect(merger,0,1);
        this.epsilon = 1 / 60.0;
    }

    setPan(panValue) {
        // Set pan value (-1 to 1) on StereoPanNode
        this.panNode.pan.linearRampToValueAtTime(panValue, this.audioCtx.currentTime + this.epsilon);
        const panDelay = this.maxHaasDelay * Math.abs(panValue);

        // Apply Haas delay to opposite channel
        if (panValue > 0) {
            // Panned right, delay left channel
            this.leftDelay.linearRampToValueAtTime(panDelay, this.audioCtx.currentTime + this.epsilon);
            this.rightDelay.linearRampToValueAtTime(0.0, this.audioCtx.currentTime + this.epsilon);
        } else {
            // Panned left, delay right channel
            this.leftDelay.linearRampToValueAtTime(0, this.audioCtx.currentTime + this.epsilon);
            this.rightDelay.linearRampToValueAtTime(panDelay, this.audioCtx.currentTime + this.epsilon);
        }
    }

  connect(destination) {
      merger.connect(this.audioCtx.destination);
  }
}

class FilteredSource {
    constructor(source) {
        this.source = source;
        this.audioCtx = source.context;
        this.lpf = audioCtx.createBiquadFilter("lowpass", { frequency: 15000 });
        this.hpf = audioCtx.createBiquadFilter("highpass", { frequency: 20 });

        source.connect(this.lpf);
        this.lpf.connect(this.hpf);

        this.epsilon = 1/60;
    }

    setCutoff(low, high) {
        this.lpf.frequency.linearRampToValueAtTime(low, this.audioCtx.currentTime + this.epsilon);
        this.hpf.frequency.linearRampToValueAtTime(high, this.audioCtx.currentTime + this.epsilon);
    }

    connect(destination) {
        this.hpf.connect(destination);
    }

}


class Circles {
    constructor() {
        this.flatData = [];
        this.numCircles = 0;
        this.dragging = -1;
        this.dxy = [];
    }

    add(x, y, r) {
        this.flatData.push(x, y, r, 0);
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
            }
        }
    }
}

runRenderLoop = async function(analyser) {
    const canvas = document.getElementById('myCanvas');
    const gl = canvas.getContext('webgl');    
    const program = await loadAndCompilePrograms(gl);
    if (!program) return;

    await setUpGeometry(gl, program);
    const texture = await setUpTexture(gl, program);
    
    const bubbleLocations = gl.getUniformLocation(program, 'u_bubbleLocations');
    const circles = new Circles();
    circles.add(300, 300, 50);
    circles.add(500, 300, 40);
    canvas.addEventListener('mousedown', (event) => circles.handleMouse(event));
    canvas.addEventListener('mousemove', (event) => circles.handleMouse(event));
    canvas.addEventListener('mouseup', (event) => circles.handleMouse(event));

    // getByteFrequencyData: 330ms / 3647ms scripting
    // 52ms system
    // getFloatFrequencyData: 1030ms / 3530 ms scripting
    // 112ms system
    // Note: Most of the cost is due to the new code which converts dB to amplitude.
    // Calculating the FFTs is pretty quick.
    renderLoop = () => {
        // It's a tiny bit cheaper to put these here instead of outside of the loop.
        const spectrogramData = new Uint8Array(16 * 1024);
        const singleSpect = new Float32Array(1024);
        gl.uniform4fv(bubbleLocations, circles.flatData);

        for (let i = 0; i < 16; ++i) {
            analyser.getFloatFrequencyData(singleSpect);
            const offset = 1024 * i;
            for (let j = 0; j < 1024; ++j) {
                // "Decibels and Levels" by Audio Engineering Society (AES): https://aes2.org/
                // We use 20 here because we want amplitude, not power.
                const v = Math.pow(10, singleSpect[j] / 20);
                spectrogramData[offset + j] = Math.max(0, Math.min(255, 255 * v));
            }
        }
        // Update texture data
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

async function getAnalyser(live) {
    let source;
    if (live) {
        source = await getAudioSourceNode();
    } else {
        source = await getAudioChirpNode();
    }
    const analyser = source.context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);
    return analyser;
}

init = async function(live) {
    const analyser = await getAnalyser(live);
    await runRenderLoop(analyser);
}


go = async function() {
    const goButton = document.createElement('button');
    goButton.innerText = 'GO';
    document.body.appendChild(goButton);
    
    const liveButton = document.createElement('button');
    liveButton.innerText = 'Live';
    document.body.appendChild(liveButton);

    liveButton.addEventListener('click', () => {
        document.body.removeChild(goButton);
        document.body.removeChild(liveButton);
        init(true);
    });

    goButton.addEventListener('click', () => {
        document.body.removeChild(goButton);
        document.body.removeChild(liveButton);
        init(false);
    });
}
