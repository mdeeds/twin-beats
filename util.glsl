precision mediump float; // You can choose between lowp, mediump, or highp

uniform samplerCube u_environment;

vec3 sphere(in vec2 look, in vec2 pos, in float radius) {
  vec2 delta = look - pos;
  if (length(delta) < radius) {
    vec3 surface = vec3(delta.xy, sqrt(abs(radius * radius - delta.x * delta.x - delta.y * delta.y)));
    surface = normalize(surface);
    vec3 base = vec3(0.05  / (surface.z + 0.001));
    vec3 reflection = reflect(vec3(0.0, 0.0, 1.0), surface);
    // Reference: https://webglfundamentals.org/webgl/lessons/webgl-2-textures.html
    // return base - textureCube(u_environment, reflection).rgb;
    // return textureCube(u_environment, reflection).rgb;
    // return reflection;
    return base;
  } else {
    return vec3(0.0, 0.0, 0.0);
  }
}


vec3 noiseG(in vec3 p) {
  return vec3(0.123 * sin(p.y + 193.2) + 0.312 * sin(p.z * 2.0 + 482.1),
              0.234 * sin(p.z + 412.3) + 0.731 * sin(p.x * 2.0 + 846.1),
              0.521 * sin(p.x + 438.1) + 0.132 * sin(p.y * 2.0 + 174.1));
}

vec3 noise1(in vec3 p) {
  p = p * 3.1415;
  return vec3(sin(2.0 * p.y + 312.3) + sin(3.0 * p.z + 842.1),
              sin(2.0 * p.z + 432.1) + sin(3.0 * p.x + 492.2),
              sin(2.0 * p.x + 531.7) + sin(3.0 * p.y + 573.3));
}

vec3 noise2(in vec3 p) {
  return noise1(noise1(noise1(p)));
}


vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
