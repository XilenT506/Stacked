import * as THREE from 'three';
globalThis.THREE = THREE;
globalThis.document ||= { createElement: () => ({ getContext: () => null, width: 0, height: 0 }) };
