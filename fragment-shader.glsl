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


vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec4 bg(in vec2 canvasPos) {
  vec2 origin = vec2(0.5, -0.5);
  float len = length(canvasPos - origin);

  float bottom = 1.0;
  float top = 1.3;
  float height = top - bottom;
  
  if (len < bottom || len > top) return vec4(1.0, 1.0, 1.0, 1.0);
  
  return vec4(hsv2rgb(vec3(-2.0 * (len - bottom) / height, 0.5, 1.0)), 1.0);
}

void main() {
  vec2 canvasPos = gl_FragCoord.xy / vec2(u_canvasWidth, u_canvasHeight);
  
  vec4 background = bg(canvasPos); // vec4(1.0, 1.0, 1.0, 1.0);
  
  vec3 foreground = sphere(gl_FragCoord.xy, vec2(300.0, 300.0), 50.0);

  gl_FragColor = background - vec4(foreground, 0.0);
}
