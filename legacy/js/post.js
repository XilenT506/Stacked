// Extra rendering for the key-art look, done in our own small pipeline (no add-ons):
//  1. the scene is drawn into an off-screen picture with its depth
//  2. bright parts (lamps, lit windows, sunlit edges) are blurred into a soft glow (bloom)
//  3. one final pass adds soft contact shadows from the depth (ambient occlusion), haze with distance,
//     the glow, a warm golden-hour grade, a vignette and a fine film grain, then tone maps to the screen.
import { T } from './config.js';

const quadVS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const brightFS = `
uniform sampler2D tColor; uniform float threshold; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tColor, vUv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  gl_FragColor = vec4(c * smoothstep(threshold, threshold + 0.6, l), 1.0);
}`;

const blurFS = `
uniform sampler2D tIn; uniform vec2 dir; varying vec2 vUv;
void main() {
  vec3 s = texture2D(tIn, vUv).rgb * 0.227;
  s += (texture2D(tIn, vUv + dir * 1.385).rgb + texture2D(tIn, vUv - dir * 1.385).rgb) * 0.316;
  s += (texture2D(tIn, vUv + dir * 3.231).rgb + texture2D(tIn, vUv - dir * 3.231).rgb) * 0.070;
  gl_FragColor = vec4(s, 1.0);
}`;

const finalFS = `
#include <common>
uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tBloom;
uniform vec2 texel; uniform float near; uniform float far; uniform float time;
uniform float ao; uniform float bloom; uniform vec3 haze; uniform float hazeStart; uniform float hazeEnd;
varying vec2 vUv;
float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
void main() {
  vec3 col = texture2D(tColor, vUv).rgb;
  float dRaw = texture2D(tDepth, vUv).r;
  float d = lin(dRaw);
  float sky = step(0.9999, dRaw);
  // ambient occlusion: look around in a small spiral; nearer neighbours darken this spot
  float occ = 0.0;
  if (ao > 0.0 && sky < 0.5) {
    float r = clamp(0.55 / d, 0.004, 0.05);
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 2.399 + rand(vUv) * 6.283;
      float rr = r * (0.25 + 0.75 * fract(float(i) * 0.618));
      vec2 o = vec2(cos(a), sin(a)) * rr * vec2(texel.y / texel.x, 1.0);
      float ds = lin(texture2D(tDepth, vUv + o).r);
      float diff = d - ds;
      occ += smoothstep(0.02, 0.25, diff) * (1.0 - smoothstep(0.6, 1.6, diff));
    }
    occ = occ / 12.0;
  }
  col *= 1.0 - occ * ao;
  // haze: far things melt into the warm evening air
  float h = smoothstep(hazeStart, hazeEnd, d) * (1.0 - sky) * 0.7;
  col = mix(col, haze, h);
  // glow
  col += texture2D(tBloom, vUv).rgb * bloom;
  // warm grade: keep the shadows neutral-warm, push the lights towards gold
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col * vec3(1.0, 0.97, 0.95), col * vec3(1.05, 1.0, 0.9), smoothstep(0.1, 0.8, l));
  col = mix(vec3(l), col, 1.1);
  // vignette and a fine grain
  vec2 v = vUv - 0.5; col *= 1.0 - dot(v, v) * 0.55;
  col += (rand(vUv * 731.0 + time) - 0.5) * 0.008;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Post {
  constructor(renderer) {
    this.r = renderer; this.on = true; this.ao = 0.85;
    this.cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new T.Mesh(new T.PlaneGeometry(2, 2)); this.sceneQ = new T.Scene(); this.sceneQ.add(this.quad); this.quad.frustumCulled = false;
    const mk = (fs, uniforms, toneMapped = false) => new T.ShaderMaterial({ vertexShader: quadVS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, toneMapped });
    this.bright = mk(brightFS, { tColor: { value: null }, threshold: { value: 1.05 } });
    this.blur = mk(blurFS, { tIn: { value: null }, dir: { value: new T.Vector2() } });
    this.final = mk(finalFS, {
      tColor: { value: null }, tDepth: { value: null }, tBloom: { value: null }, texel: { value: new T.Vector2() },
      near: { value: 0.05 }, far: { value: 90 }, time: { value: 0 }, ao: { value: this.ao }, bloom: { value: 0.7 },
      haze: { value: new T.Color(0xf6c9a4) }, hazeStart: { value: 16 }, hazeEnd: { value: 55 },
    }, true);
    this.w = 0; this.h = 0;
  }
  setSize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.main?.dispose(); this.a?.dispose(); this.b?.dispose();
    const depthTexture = new T.DepthTexture(w, h); depthTexture.type = T.UnsignedIntType;
    this.main = new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType, depthTexture, samples: 4 });
    const bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2);
    this.a = new T.WebGLRenderTarget(bw, bh, { type: T.HalfFloatType });
    this.b = new T.WebGLRenderTarget(bw, bh, { type: T.HalfFloatType });
    this.final.uniforms.texel.value.set(1 / w, 1 / h);
    this.bt = [1 / bw, 1 / bh];
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.sceneQ, this.cam); }
  render(scene, camera, time) {
    const r = this.r;
    if (!this.on) { r.setRenderTarget(null); r.render(scene, camera); return; }
    const size = r.getDrawingBufferSize(new T.Vector2()); this.setSize(size.x, size.y);
    r.setRenderTarget(this.main); r.render(scene, camera);
    this.bright.uniforms.tColor.value = this.main.texture; this.pass(this.bright, this.a);
    for (let k = 0; k < 2; k++) {
      this.blur.uniforms.tIn.value = this.a.texture; this.blur.uniforms.dir.value.set(this.bt[0] * (1 + k), 0); this.pass(this.blur, this.b);
      this.blur.uniforms.tIn.value = this.b.texture; this.blur.uniforms.dir.value.set(0, this.bt[1] * (1 + k)); this.pass(this.blur, this.a);
    }
    const u = this.final.uniforms;
    u.tColor.value = this.main.texture; u.tDepth.value = this.main.depthTexture; u.tBloom.value = this.a.texture;
    u.near.value = camera.near; u.far.value = camera.far; u.time.value = time % 100; u.ao.value = this.ao;
    this.pass(this.final, null);
  }
}
