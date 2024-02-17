precision mediump float; // You can choose between lowp, mediump, or highp

varying vec2 v_position;



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


void main() {
  // gl_FragColor = vec4(0.0, 1.0, 0.2, 1.0);
  // vec4 background = vec4(v_position.x + 1.0, v_position.y + 1.0, 1.0, 1.0);
  vec4 background = vec4(1.0, 1.0, 1.0, 1.0);

  vec3 foreground = sphere(v_position, vec2(0, 0), 0.5);

  gl_FragColor = background - vec4(foreground, 0.0);
}
