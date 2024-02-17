precision mediump float; // You can choose between lowp, mediump, or highp

varying vec2 v_position;

uniform float u_canvasWidth;
uniform float u_canvasHeight;

vec3 sphere(in vec2 look, in vec2 pos, in float radius) {
  vec2 delta = look - pos;
  if (length(delta) < radius) {
    vec3 surface = vec3(delta.xy, sqrt(abs(radius * radius - delta.x * delta.x - delta.y * delta.y)));
    surface = normalize(surface);
    return vec3(0.05  / (surface.z + 0.001));
  } else {
    return vec3(0.0, 0.0, 0.0);
  }
}

vec4 bg(in vec2 canvasPos) {
  return vec4(canvasPos.xy, 1.0, 1.0);
}

void main() {
  vec2 canvasPos = gl_FragCoord.xy / vec2(u_canvasWidth, u_canvasHeight);
  
  vec4 background = bg(canvasPos); // vec4(1.0, 1.0, 1.0, 1.0);
  
  vec3 foreground = sphere(gl_FragCoord.xy, vec2(300.0, 300.0), 50.0);

  gl_FragColor = background - vec4(foreground, 0.0);
}
