async function loadBackground() {
    return new Promise((resolve, reject) => {        
        const img = new Image();
        img.src = 'Monet_w1709.jpg';
        img.onload = () => { resolve(img); }
    });
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
    const source = audioCtx.createMediaStreamSource(stream);
    return source;
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
    fillMetronomeWithScale(channelData, context);
    fillMetronome(channelData, context);
    const bufferNode = context.createBufferSource({loop: true});
    bufferNode.buffer = buffer;
    bufferNode.loop = true;
    bufferNode.start();
    return bufferNode;
}


class Vizualizer {
    constructor(source, backgroundImage) {
        this.img = backgroundImage;
        this.audioCtx = source.context;
        this.leftAnalyzerNode = this.audioCtx.createAnalyser();
        this.leftAnalyzerNode.fftSize = 4096;
        this.rightAnalyzerNode = this.audioCtx.createAnalyser();
        this.rightAnalyzerNode.fftSize = 4096;

        const lowFilter = this.audioCtx.createBiquadFilter();
        lowFilter.type = "lowpass";
        lowFilter.frequency.setValueAtTime(256, this.audioCtx.currentTime);
        const highFilter = this.audioCtx.createBiquadFilter();
        highFilter.type = "highpass";
        highFilter.frequency.setValueAtTime(256, this.audioCtx.currentTime);

        source.connect(lowFilter);
        source.connect(highFilter);

        lowFilter.connect(this.leftAnalyzerNode);
        highFilter.connect(this.rightAnalyzerNode);
        
        // Get analyzer settings
        this.fftSize = this.leftAnalyzerNode.fftSize;
        this.frequencyBinCount = this.fftSize / 2;
        this.renderBins = 512;

        this.canvas = document.getElementById('canvas');
        // Get canvas context
        this.ctx = this.canvas.getContext('2d');
        // Get frequency data for each channel
        this.leftChannelData = new Uint8Array(this.frequencyBinCount);
        this.rightChannelData = new Uint8Array(this.frequencyBinCount);
        this.timeDomainData = new Uint8Array(this.frequencyBinCount);

        // Start the animation
        this.drawBarChart();
    }
    // Function to draw the bar chart

    drawImage() {
        const actualWidth = Math.round(
            this.img.height * canvas.width / canvas.height);
        this.ctx.drawImage(this.img, 0, 0, actualWidth, this.img.height,
                      0, 0, canvas.width, canvas.height);
    }
    
    drawBarChart() {
        // Clear the canvas
        this.drawImage();
        
        // Get frequency data for both channels
        this.leftAnalyzerNode.getByteFrequencyData(this.leftChannelData);
        this.rightAnalyzerNode.getByteFrequencyData(this.rightChannelData);
        this.leftAnalyzerNode.getByteTimeDomainData(this.timeDomainData);
        
        // Calculate bar width and spacing
        const barWidth = this.canvas.width / this.renderBins;
        const barSpacing = 0.5;

        // Find a rising edge
        let offset = 0;
        for (let i = 0; i < this.fftSize-1; ++i) {
            if (this.timeDomainData[i] < 128 && this.timeDomainData[i+1] >= 128) {
                offset = i;
                break;
            }
        }
        
        // Draw bars for the left channel
        for (let i = 0; i < this.renderBins; i++) {
            const barHeight = 0.2 * this.leftChannelData[i] * this.canvas.height / 255;
            this.ctx.fillStyle = '#515511';
            this.ctx.fillRect(
                i * (barWidth + barSpacing),
                this.canvas.height / 2 - barHeight +
                    0.25 * this.timeDomainData[(i + offset) % this.fftSize],
                barWidth, barHeight);
        }

        // Draw bars for the right channel
        for (let i = 0; i < this.renderBins; i++) {
            const barHeight = 0.2 * this.rightChannelData[i] * this.canvas.height / 255;
            this.ctx.fillStyle = '#6655dd';
            this.ctx.fillRect(
                i * (barWidth + barSpacing),
                this.canvas.height / 2 +
                    0.25 * this.timeDomainData[(i + offset) % this.fftSize],
                barWidth, barHeight);
        }
        
        // Schedule the next draw
        requestAnimationFrame(this.drawBarChart.bind(this));
    }
    
    connectDestination() {
        const merger = this.audioCtx.createChannelMerger(2);
        this.leftAnalyzerNode.connect(merger,0,0);
        this.rightAnalyzerNode.connect(merger,0,1);
        merger.connect(this.audioCtx.destination);
    }
    
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
    console.log(`Strem: ${stream.id}`);
    const source = audioCtx.createMediaStreamSource(stream);
    return source;
}


async function init(isLive) {
    const audioCtx = new AudioContext();
    const img = await loadBackground();
    if (isLive) {
        const viz = new Vizualizer(await getAudioSourceNode(), img);
        viz.connectDestination(audioCtx.desination);
    } else {
        const audioElement = document.getElementById('audioSource');
        const track = audioCtx.createMediaElementSource(audioElement);
        track.connect();
        const viz = new Vizualizer(track, img);
    }
}


function go() {
    {
        const button = document.createElement('button');
        button.innerText = 'GO';
        button.addEventListener('click', (e) => {
            document.body.removeChild(button);
            init(false);
        } );
        document.body.appendChild(button);
    }
    {
        const button = document.createElement('button');
        button.innerText = 'LIVE';
        button.addEventListener('click', (e) => {
            document.body.removeChild(button);
            init(true);
        } );
        document.body.appendChild(button);
    }
    
    
}
