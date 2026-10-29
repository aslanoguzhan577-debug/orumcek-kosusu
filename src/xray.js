// xray.js — the player stays trackable behind trains: the parts of him hidden behind other
// geometry are drawn as a flat bright silhouette with a darker rim.
//
// How: every (non-outline, opaque) mesh of the player's models gets a child that shares its
// geometry and draws with depthFunc = GreaterDepth, no depth write. The player's whole tree
// is moved to a later render group, so the order is: world -> x-ray -> player. The x-ray
// only sees the world's depth (it shows where the world is in front of him); the player,
// drawn right after, covers it wherever he is visible, so it never doubles up.
// One shared material: xray.enabled toggles it (off in the intro clip and catch cam).

import * as THREE from 'three';
import { CONFIG } from './config.js';

const ORDER = 10; // render group of the player's tree (world objects stay at 0)

const VERT = /* glsl */`
uniform float uPull;
varying float vRim;
void main() {
  vec4 mv = viewMatrix * curveWorld( modelMatrix * vec4( position, 1.0 ) );
  vec3 toCam = normalize( -mv.xyz );
  vRim = 1.0 - abs( dot( normalize( normalMatrix * normal ), toCam ) );
  mv.xyz += toCam * uPull; // an occluder must be this far in front (rails at the feet, coins)
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */`
uniform vec3 uColor;
uniform vec3 uEdge;
varying float vRim;
void main() {
  gl_FragColor = vec4( mix( uColor, uEdge, smoothstep( 0.45, 0.85, vRim ) ), 1.0 );
}`;

export function createXray(root) {
  const X = CONFIG.xray;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(X.color) },
      uEdge: { value: new THREE.Color(X.edge) },
      uPull: { value: X.pull },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthFunc: THREE.GreaterDepth,
    depthWrite: false,
    fog: false,
  });

  const meshes = [];
  root.traverse((o) => {
    if (o.isGroup) o.renderOrder = ORDER;
    else if (o.isMesh && !o.userData.isOutline && !o.material.transparent && o.geometry.attributes.normal) meshes.push(o);
  });
  for (const m of meshes) {
    const x = new THREE.Mesh(m.geometry, material);
    x.name = 'xray';
    x.renderOrder = m.renderOrder - 1; // inside the player's group: before the mesh itself
    x.raycast = () => {};
    m.add(x);
  }

  return {
    material,
    count: meshes.length,
    set enabled(on) { material.visible = on; },
    get enabled() { return material.visible; },
  };
}
