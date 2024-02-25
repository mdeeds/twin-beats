precision mediump float; // You can choose between lowp, mediump, or highp

varying vec2 v_position;

uniform float u_canvasWidth;
uniform float u_canvasHeight;
uniform vec4 u_bubbleLocations[64];

// TODO: We either need to cap this at ~900 or send this as a texture.
// uniform float u_spectrograms[16 * 1024];
uniform float u_panning[16];


vec4 spectrogram(in float panning, in float spectrogram[1024]) {
  return vec4(0.0);
}


vec4 bg(in vec2 posPanNote, in vec2 originPanNote) {
  float c = 0.9 + 0.05 * sin(length(posPanNote - originPanNote) / 12.0 * 3.1415 * 2.0);
  return vec4(c, c, c, 1.0);
}

#define BOTTOM_NOTE 21.0
#define TOP_NOTE 129.0

void main() {
  vec2 posXY = gl_FragCoord.xy;

  vec2 bottomCenterPanNote = vec2(0.0, BOTTOM_NOTE);
  vec2 topCenterPanNote = vec2(0.0, TOP_NOTE);
  vec2 originPanNote = vec2(0.0, BOTTOM_NOTE - 0.5 * (TOP_NOTE - BOTTOM_NOTE));
  
  vec2 bottomCenterXY = vec2(u_canvasWidth / 2.0, 0.0);
  vec2 topCenterXY = vec2(u_canvasWidth / 2.0, u_canvasHeight);
  vec2 originXY = vec2(u_canvasWidth / 2.0, -u_canvasHeight / 2.0);

  vec2 relXY = posXY - originXY;
  vec2 posPanNote = relXY / length(topCenterXY - bottomCenterXY) * length(topCenterPanNote - bottomCenterPanNote);
  
  
  
  vec4 background = bg(posPanNote, originPanNote);
  
  vec3 foreground = vec3(0.0);

  foreground += sphere(gl_FragCoord.xy, u_bubbleLocations[0].xy, u_bubbleLocations[0].z);
  foreground += sphere(gl_FragCoord.xy, u_bubbleLocations[1].xy, u_bubbleLocations[1].z);

  gl_FragColor = background - vec4(foreground, 0.0);
}
