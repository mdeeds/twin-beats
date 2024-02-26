precision mediump float; // You can choose between lowp, mediump, or highp

varying vec2 v_position;

uniform float u_canvasWidth;
uniform float u_canvasHeight;
uniform vec4 u_bubbleLocations[64];

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

void main() {
  vec2 posXY = gl_FragCoord.xy;

  vec2 originXY = vec2(u_canvasWidth * 0.5, -u_canvasHeight * 0.5);
  
  vec2 posPanNote = vec2(0.0, GetNoteFromPx(length(posXY - originXY), u_canvasHeight));  
  vec4 background = bg(posPanNote);
  
  vec3 foreground = vec3(0.0);

  foreground += sphere(gl_FragCoord.xy, u_bubbleLocations[0].xy, u_bubbleLocations[0].z);
  foreground += sphere(gl_FragCoord.xy, u_bubbleLocations[1].xy, u_bubbleLocations[1].z);

  gl_FragColor = background - vec4(foreground, 0.0);
}
