import { GLTFLoader } from '../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const T = globalThis.THREE;
const r = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(1200, 600); document.body.appendChild(r.domElement);
r.toneMapping = T.ACESFilmicToneMapping;
const s = new T.Scene(); s.background = new T.Color(0xe8dccf);
s.add(new T.HemisphereLight(0xffffff, 0x886655, 1.6)); const d = new T.DirectionalLight(0xffe0c0, 2.5); d.position.set(2, 3, 3); s.add(d);
new GLTFLoader().load(new URLSearchParams(location.search).get('f'), (g) => {
  g.scene.traverse((o) => { if (o.isMesh) { if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals(); o.material.metalness = 0; } });
  const m = g.scene; const views = [0, Math.PI / 2, Math.PI, -0.6];
  views.forEach((a, i) => { const c = m.clone(); c.rotation.y = a; c.position.x = (i - 1.5) * 0.75; s.add(c); });
  const cam = new T.PerspectiveCamera(30, 2, 0.1, 50); cam.position.set(0, 0.05, 3.6); cam.lookAt(0, 0, 0);
  r.render(s, cam); window.done = true;
});
