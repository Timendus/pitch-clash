
function average(arr) {
  return arr.reduce((sum, item) => sum + item, 0) / arr.length;
}

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

function lerp(a, b, t) {
  if (t === 0) {
    return a;
  }
  if (t === 1) {
    return b;
  }
  return t * b + (1 - t) * a;
}

function autoCorrelate(buf, sampleRate) {
  // Implements the ACF2+ algorithm
  var SIZE = buf.length;
  var rms = 0;

  for (var i = 0; i < SIZE; i++) {
    var val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01)
    // not enough signal
    return null;

  var r1 = 0,
    r2 = SIZE - 1,
    thres = 0.2;
  for (var i = 0; i < SIZE / 2; i++)
    if (Math.abs(buf[i]) < thres) {
      r1 = i;
      break;
    }
  for (var i = 1; i < SIZE / 2; i++)
    if (Math.abs(buf[SIZE - i]) < thres) {
      r2 = SIZE - i;
      break;
    }

  buf = buf.slice(r1, r2);
  SIZE = buf.length;

  var c = new Array(SIZE).fill(0);
  for (var i = 0; i < SIZE; i++)
    for (var j = 0; j < SIZE - i; j++) {
      c[i] = c[i] + buf[j] * buf[j + i];
    }

  var d = 0;
  while (c[d] > c[d + 1]) d++;
  var maxval = -1,
    maxpos = -1;
  for (var i = d; i < SIZE; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  var T0 = maxpos;

  var x1 = c[T0 - 1],
    x2 = c[T0],
    x3 = c[T0 + 1];
  let a = (x1 + x3 - 2 * x2) / 2;
  let b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
}

export default class AudioInput {
  constructor() {
    this.pitches = [];
    this.currentY = 0;
    this.playerY = 0;
  }

  async start() {
    this.audioCtx = new window.AudioContext();
    this.analyser = this.audioCtx.createAnalyser();

    this.analyser.fftSize = 2048;
    const bufferLength = this.analyser.frequencyBinCount;
    this.uint8TimeDomain = new Uint8Array(bufferLength);
    this.uint8FrequencyData = new Uint8Array(bufferLength);
    this.floatTimeDomain = new Float32Array(bufferLength);

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);
  }

  async stop() {
    this.source.disconnect(this.analyser);
    for (const track of this.stream.getTracks()) {
      track.stop();
    }
  }

  getPitch() {
    this.analyser.getFloatTimeDomainData(this.floatTimeDomain);
    return autoCorrelate(this.floatTimeDomain, this.audioCtx.sampleRate);
  }

  getPlayerY() {
    const pitch = this.getPitch();
    this.pitches.push(pitch);
    while (this.pitches.length > 20) {
      this.pitches.shift();
    }

    const cleanPitches = this.pitches.filter((pitch) => pitch !== null);
    function pitchToY(pitch) {
      const height = 1333;
      const pitchMin = 20;
      const pitchMax = 600;
      const fraction = (pitch - pitchMin) / (pitchMax - pitchMin);
      const yMax = 0;
      const yMin = height;
      return fraction * (yMax - yMin) + yMin;
    }
    if (cleanPitches.length >= 10) {
      const avgPitch = average(cleanPitches);
      const pitchNoise = average(
        cleanPitches.map((pitch) => {
          return Math.abs(avgPitch - pitch);
        })
      );
      const pitchWeight = clamp(1 / pitchNoise, 0, 1);

      if (isFinite(avgPitch)) {
        const y = pitchToY(avgPitch);
        this.currentY = lerp(this.currentY, y, pitchWeight);
      }
      this.playerY = lerp(this.playerY, this.currentY, 0.9);
    }

    return this.playerY;
  }

  setPlayerY(y) {
    this.currentY = y;
    this.playerY = y;
  }

  getByteFrequencyData() {
    this.analyser.getByteFrequencyData(this.uint8FrequencyData);
    return this.uint8FrequencyData;
  }

  getByteTimeDomainData() {
    this.analyser.getByteTimeDomainData(this.uint8TimeDomain);
    return this.uint8TimeDomain;
  }
}
