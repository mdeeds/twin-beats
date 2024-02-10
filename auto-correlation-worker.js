let processor = null;

class AutoCorrelation {
    constructor(wavelengthSamples) {
        this.wavelengthSamples = wavelengthSamples;
        this.buffer = new Float32Array(Math.ceil(wavelengthSamples));
        this.offset = 0;
        this.offsetFloat = 0;
        this.total = 0;
        this.attenuation = 0.8;
    }

    addSamples(channelData) {
        for (const v of channelData) {
            const oldVal = this.buffer[this.offset];
            const newVal = this.attenuation * oldVal + v;

            this.buffer[this.offset] = newVal;
            this.offset++;
            this.offsetFloat += 1;
            if (this.offsetFloat > this.wavelengthSamples) {
                this.offsetFloat -= this.wavelengthSamples;
                this.offset = Math.floor(this.offsetFloat);
            }
            this.total -= oldVal * oldVal;
            this.total += newVal * newVal;
        }
    }
    getTotal() { return this.total; }
}

class CircularAverager {
    constructor(size) {
        this.size = size;
        this.units = [];
        for (let i = 0; i < size; ++i) {
            const theta = Math.PI * 2 * i / size;
            this.units.push({x: Math.cos(theta), y: Math.sin(theta)});
        }
    }
    reset() {
        this.x = 0;
        this.y = 0;
        this.max = 0;
        this.total = 0;
    }
    add(v, weight) {
        const i = v % this.size;
        this.x += this.units[i].x * weight;
        this.y += this.units[i].y * weight;
        this.total += weight;
        this.max = Math.max(this.max, weight);
    }
    getMean() {
        let theta = Math.atan2(this.x, this.y);
        if (theta < 0) { theta += Math.PI * 2 }
        return this.size * theta / Math.PI / 2;
    }
    getMag() {
        return Math.sqrt(this.x * this.x + this.y * this.y) / this.total;
    }
    getMax() {
        return this.max;
    }
}


class AutoProcessor {
    constructor(sampleRate) {
        this.sampleRate = sampleRate;
        this.processors = [];
        for (let i = 0; i < 12; ++i) {
            const f = 55 * Math.pow(2, i/12);
            const wavelength = sampleRate / f;
            this.processors.push(new AutoCorrelation(wavelength));
        }
        this.averager = new CircularAverager(12);
    }
    
    runAutoCorrelation(buffer) {
        const result = new Float32Array(12);
        for (let i = 0; i < this.processors.length; ++i) {
            const ac = this.processors[i];
            ac.addSamples(buffer);
        }
    }

    circularAverage() {
        this.averager.reset();
        for (let i = 0; i < this.processors.size; ++i) {
            const p = this.processors[i];
            this.averager.add(i, p.getTotal());
        }
        return { note: Math.round(this.averager.getMean()) % 12,
                 magnitude: this.averager.getMag(),
                 max: this.averager.getMax() };
    }
}


let samplesPerCallback = 0;
let samplesConsumed = 0;

onmessage = function(event) {
    if (!processor) {
        processor = new AutoProcessor(event.data.sampleRate);
        samplesPerCallback = event.data.sampleRate * event.data.secondsPerCallback;
    }
    // Get the data from the main thread
    const buffer = event.data.buffer;
    if (!buffer) return;

    processor.runAutoCorrelation(buffer);
    samplesConsumed += buffer.length;
    // TODO: process the buffer in chunks and possibly make several callbacks.
    if (samplesConsumed > samplesPerCallback) {
        postMessage(processor.circularAverage());
        samplesConsumed -= samplesPerCallback;
    }
};
