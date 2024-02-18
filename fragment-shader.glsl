precision mediump float; // You can choose between lowp, mediump, or highp

varying vec2 v_position;

uniform float u_canvasWidth;
uniform float u_canvasHeight;
uniform vec4 u_bubbleLocations[64];

  
vec4 bg(in vec2 canvasPos) {
  vec2 origin = vec2(0.5, -1.0);
  vec2 relPos = (canvasPos - origin);
  if (abs(relPos.y / relPos.x) < 4.0) {
    // return vec4(noise1(vec3(canvasPos, 0.0)), 1.0);
    return vec4(0.0, 0.0, 0.0, 1.0);
    // return vec4(hsv2rgb(vec3(length(noise2(vec3(canvasPos.xy, 0.0))), 0.05, 1.0)), 1.0);
  }
  
  float len = length(relPos);

  float bottom = 1.5;
  float top = 1.8;
  float height = top - bottom;
  
  if (len < bottom || len > top) return vec4(1.0, 1.0, 1.0, 1.0);
  
  return vec4(hsv2rgb(vec3(-2.0 * (len - bottom) / height, 0.1, 1.0)), 1.0);
}

void main() {
  vec2 canvasPos = gl_FragCoord.xy / vec2(u_canvasWidth, u_canvasHeight);
  
  vec4 background = bg(canvasPos); // vec4(1.0, 1.0, 1.0, 1.0);
  
  vec3 foreground = vec3(0.0);

  foreground += sphere(gl_FragCoord.xy, u_bubbleLocations[0].xy, u_bubbleLocations[0].z);
  foreground += sphere(gl_FragCoord.xy, u_bubbleLocations[1].xy, u_bubbleLocations[1].z);

  gl_FragColor = background - vec4(foreground, 0.0);
}
