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

#define BOTTOM_NOTE 16.0
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

// Human vocal range: MIDI 41 (G2 = 97.99Hz)
// MIDI 79 (G5 = 783.99Hz)
  
vec4 bg(in vec2 posPanNote) {
  if (posPanNote.y < 41.0 || posPanNote.y > 79.0) {
    return vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    return vec4(0.1, 0.1, 0.1, 1.0);
  }
  //  
  // float c = 0.9 + 0.05 * sin(posPanNote.y / 12.0 * 3.1415 * 2.0);
  // float d = 0.9 + 0.05 * cos(3.14 * 10.0 * posPanNote.x);
  // return vec4(c, c*d, d, 1.0);
}

float GetPanFromXY(in vec2 pos) {
  // This is the percentage of the way up the screen
  float q = pos.y / u_canvasHeight;
  // This is the percentage of the way down.
  float p = 1.0 - q;
  // The width of the view region at pos.y
  float width = q * u_canvasWidth + p * 0.33333 * u_canvasWidth;
  float dx = pos.x - (0.5 * u_canvasWidth);
  float pan = dx / (width * 0.5);
  return pan;
}

float GetXFromPanAndY(in float pan, in float y) {
  float q = y / u_canvasHeight;
  float p = 1.0 - q;
  float width = q * u_canvasWidth + p * 0.33333 * u_canvasWidth;
  float dx = pan * width * 0.5;
  float posX = dx + (0.5 * u_canvasWidth);
  return posX;
}

vec3 fg(in float note, in int bubble, in float pan, in vec2 bubbleXY) {
  float bPan = GetPanFromXY(bubbleXY);
  float bX = GetXFromPanAndY(bPan, gl_FragCoord.y);
  float mag = 0.001 * abs(bX - gl_FragCoord.x);
  
  float bin = (GetBinFromHz(GetHzFromNote(note)) + 0.5) / BIN_COUNT;
  float t = texture2D(spectrogramTexture, vec2(bin, (0.5 + float(bubble)) / 16.0)).r;
  if (t > mag) {
    float q = pow(t - mag, 0.1);
    return vec3(q, 0.4 * q, q);
  } else if (t * 10.0 > mag) {
    float q = pow((t * 10.0) - mag, 0.2);
    return vec3(q, 0.3 * q, 0.1 * q);
  } else if (t * 100.0 > mag) {
    float q = pow((t * 100.0) - mag, 0.2);
    return vec3(0.2 * q, 0.2 * q, q);
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
  bool isActiveArea = ((slope > 0.0 && slope > criticalSlope) ||
                       (slope < 0.0 && slope < -criticalSlope));

  float posPan = GetPanFromXY(gl_FragCoord.xy);
  for (int i = 0; i < 16; ++i) {
    if (u_bubbleLocations[i].z > 0.0) {
      foreground += sphere(gl_FragCoord.xy, u_bubbleLocations[i].xy, u_bubbleLocations[i].z);
      if (!isActiveArea) {
        float pan = GetPanFromXY(u_bubbleLocations[i].xy);
        foreground += fg(note, i, pan, u_bubbleLocations[i].xy);
      }
    }
  }

  vec4 background;
  if (isActiveArea) {
    background = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    vec2 posPanNote = vec2(posPan, note);
    background = bg(posPanNote);
  }
  gl_FragColor = background + vec4(foreground, 0.0);
}
