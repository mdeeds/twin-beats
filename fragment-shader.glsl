precision mediump float; // You can choose between lowp, mediump, or highp

varying vec2 v_position;

uniform float u_canvasWidth;
uniform float u_canvasHeight;
uniform vec4 u_bubbleLocations[16];

// 1024 pixels wide, 16 pixels tall.  Monochrome texture.
uniform sampler2D spectrogramTexture;

vec4 spectrogram(in vec2 posXY, in float panning, in float spectrogram[1024]) {
  return vec4(0.0);
}

#define BOTTOM_NOTE 21.0
#define TOP_NOTE 129.0
#define BIN_COUNT 1024.0
#define SAMPLE_RATE 44100.0
  
float GetHzFromNote(in float note) {
  return 440.0 * pow(2.0, ((note - 69.0) / 12.0));
}

float GetNoteFromHz(in float hz) {
  return 12.0 * log2(hz / 440.0) + 69.0;
}

float GetHzFromBin(in float bin) {
  // hz = k * bin
  // SAMPLE_RATE * 0.5 = k * BIN_COUNT  ... because the last bin is the Nyquist frequency.
  // k = SAMPLE_RATE * 0.5 / BIN_COUNT
  return SAMPLE_RATE * 0.5 / BIN_COUNT * bin;
}

float GetBinFromHz(in float hz) {
  return hz * BIN_COUNT * 2.0 / SAMPLE_RATE;
}

float GetNoteFromPx(in float px, in float pixelSpan) {
  return BOTTOM_NOTE + (TOP_NOTE - BOTTOM_NOTE) * (px / pixelSpan);
}

float GetPxFromNote(in float note, in float pixelSpan) {
  return (note - BOTTOM_NOTE) / (TOP_NOTE - BOTTOM_NOTE) * pixelSpan;
}

vec4 bg(in vec2 posPanNote) {
  float c = 0.9 + 0.05 * sin(posPanNote.y / 12.0 * 3.1415 * 2.0);
  return vec4(c, c, c, 1.0);
}

vec3 fg(in float note, in int bubble) {
  float mag = abs(5.0 * ((gl_FragCoord.x / u_canvasWidth) - 0.5));
  float bin = (GetBinFromHz(GetHzFromNote(note)) + 0.5) / BIN_COUNT;
  // float bin = gl_FragCoord.y / u_canvasHeight;
  float t = texture2D(spectrogramTexture, vec2(bin, (0.5 + float(bubble)) / 16.0)).r;
  if (t > mag) {
    float q = pow(t - mag, 0.2);
    return vec3(q, q, q);
  } else {
    return vec3(0.0, 0.0, 0.0);
  }
}

void main() {
  vec2 posXY = gl_FragCoord.xy;
  vec2 relXY = gl_FragCoord.xy - vec2(u_canvasWidth * 0.5, -0.5 * u_canvasHeight);

  vec2 originXY = vec2(u_canvasWidth * 0.5, -u_canvasHeight * 0.5);

  float note = GetNoteFromPx(length(posXY - originXY) - 0.5 * u_canvasHeight, u_canvasHeight);

  // Note: slope is defined opposite the usual way because dx could be zero, but dy will never be zero.
  float slope = relXY.x / relXY.y;
  float criticalSlope = (0.5 * u_canvasWidth) / (1.5 * u_canvasHeight);

  vec3 foreground = vec3(0.0, 0.0, 0.0);

  for (int i = 0; i < 16; ++i) {
    if (u_bubbleLocations[i].z > 0.0) {
      foreground += sphere(gl_FragCoord.xy, u_bubbleLocations[i].xy, u_bubbleLocations[i].z);
      foreground += fg(note, i);
    }
  }

  vec4 background;
  if ((slope > 0.0 && slope > criticalSlope) ||
      (slope < 0.0 && slope < -criticalSlope)) {
    background = vec4(0.9, 1.0, 1.0, 1.0);
  } else {
    vec2 posPanNote = vec2(0.0, note);
    background = bg(posPanNote);
  }
  gl_FragColor = background - vec4(foreground, 0.0);
}
