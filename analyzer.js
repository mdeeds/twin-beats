    
// Usage:
// new AnalyzerCanvas(canvas, source);

function getCenterFrequencyForBinIndex(binIndex, numBins, audioCtx) {
    const nyquist = audioCtx.sampleRate / 2; // Nyquist frequency
    const binWidth = nyquist / numBins; // Frequency range covered by each bin
    const binStartFrequency = binIndex * binWidth; // Start frequency of the bin
    const binCenterFrequency = binStartFrequency + binWidth / 2; // Center frequency of the bin
    return binCenterFrequency;
}

function getMidiNoteFromFrequency(frequency) {
    const A4_FREQUENCY = 440; // Reference frequency for A4 (MIDI note 69)
    // Calculate half steps from A4
    const halfStepsFromA4 = Math.log2(frequency / A4_FREQUENCY) * 12;
    // Round to nearest integer (MIDI note number)
    const midiNoteNumber = halfStepsFromA4 + 69;
    if (midiNoteNumber < 0) { return 0; }
    return midiNoteNumber;
}
    
function interpolateColor(colorMap, value) {
    const numColors = colorMap.length;
    
    // Normalize value to the range [0, numColors), wrapping around
    const normalizedValue = value % numColors;
    
    // Get indices of the two colors to interpolate between
    const index1 = Math.floor(normalizedValue);
    const index2 = (index1 + 1) % numColors;
    
    // p2 is the percentage of color 2 to use.  This will be zero when
    // our index is equal to the normalized value
    const p2 = normalizedValue - index1;
    const p1 = 1 - p2;

    // Interpolate each color component
    const interpolatedColor = [
        Math.round(p1 * colorMap[index1][0] + p2 * colorMap[index2][0]),
        Math.round(p1 * colorMap[index1][1] + p2 * colorMap[index2][1]),
        Math.round(p1 * colorMap[index1][2] + p2 * colorMap[index2][2]),
    ];

  return interpolatedColor;
}


function getColorForBucket(binIndex, numBins, audioCtx) {
    const colorMap = [
        [255,   0,   0], // C
        [225,  40,   0], // C#
        [200,  75,   0], // D
        [150, 150,   0], // D#
        [255, 175,   0], // E
        [ 75, 200,   0], // F
        [  0, 255,   0], // F#
        [  0, 200, 100], // G
        [  0, 100, 200], // G#
        [  0,   0, 255], // A
        [ 75,   0, 200], // A#
        [200,   0, 150], // B
    ];
    const freq = getCenterFrequencyForBinIndex(binIndex, numBins, audioCtx);
    const note = getMidiNoteFromFrequency(freq);
    return interpolateColor(colorMap, note);
}

function makeColorMapping(numBins, audioCtx) {
    console.log(`Number of bins: ${numBins}`);
    const colors = [];
    for (let i = 0; i < numBins; ++i) {
        const color = getColorForBucket(i, numBins, audioCtx);
        color[0] = Math.round(color[0]);
        color[1] = Math.round(color[1]);
        color[2] = Math.round(color[2]);
        colors.push(color);
    }
    return colors;
}

class AnalyzerCanvas {
    constructor(canvas, source) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        this.source = source;
        this.analyzer = source.context.createAnalyser();
        this.analyzer.fftSize = 2048 * 4;
        this.analyzer.smoothingTimeConstant = 0.1;
        source.connect(this.analyzer);
        this.x = 0;
        this.colorMapping = makeColorMapping(this.analyzer.frequencyBinCount, source.context);
        this.frequencyData = new Float32Array(this.analyzer.frequencyBinCount);

        this.renderFrame();
    }

    renderFrame() {
        this.analyzer.getFloatFrequencyData(this.frequencyData);
        const height = this.canvas.height;
        
        // Create or update ImageData buffer (optimize for reuse)
        let imageData = this.ctx.getImageData(this.x, 0, 1, height);
        if (!imageData) {
            imageData = this.ctx.createImageData(1, height);
        }

        // Get data buffer from ImageData
        const data = imageData.data;

        let y = height - 1;
        let targetY = y;
        // let biggestBin = 0;
        // Fill data buffer efficiently based on colors and frequencies

        let sum = 0;
        for (let i = 0; i < this.frequencyData.length; i++) {
            sum += Math.pow(2, this.frequencyData[i] / 10);
        }
        const k = this.canvas.height / (sum + 1);

        
        for (let i = 0; i < this.frequencyData.length; i++) {
            //if (this.frequencyData[i] > this.frequencyData[biggestBin]) {
            //    biggestBin = i;
            //}
            // frequencyData is in decibels, so exponentiate to get positive values
            targetY -= Math.pow(2, this.frequencyData[i] / 10) * k;
            const color = this.colorMapping[i];
            while (y > targetY && y >= 0) {
                const offset = y * 4;
                data[offset + 0] = color[0];
                data[offset + 1] = color[1];
                data[offset + 2] = color[2];
                data[offset + 3] = 255;
                --y;
            }
        }
        //if (this.x % 16 == 0) {
        //    console.log(`Biggest bin: ${biggestBin}`);
        //}
        // Put the updated data back onto the canvas
        this.ctx.putImageData(imageData, this.x, 0);
        this.x = (this.x + 1) % this.canvas.width;
        requestAnimationFrame(this.renderFrame.bind(this));
    }
}
