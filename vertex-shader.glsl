// precision mediump float; // You can choose between lowp, mediump, or highp
attribute vec4 a_position;
varying vec2 v_position;

void main() {
  gl_Position = a_position;
  v_position = a_position.xy;
}
