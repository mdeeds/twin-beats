precision mediump float; // You can choose between lowp, mediump, or highp

varying vec2 v_position;

void main() {
  // gl_FragColor = vec4(0.0, 1.0, 0.2, 1.0);
  gl_FragColor = vec4(v_position.x, v_position.y, 0.5, 1.0);
}
