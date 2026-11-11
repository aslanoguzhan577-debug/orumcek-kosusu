// city-boards.js — fixed board instances; atlas choices stay with a segment until release.
import * as THREE from 'three';

export function createBoards(atlasTexture, capacity) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const aUv = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  geometry.setAttribute('aUv', aUv);
  const material = new THREE.MeshBasicMaterial({ map: atlasTexture });
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv = aUv.xy + uv * aUv.zw;\n#endif');
  };
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.count = 0; mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); aUv.setUsage(THREE.DynamicDrawUsage);
  const entries = Array.from({ length: capacity }, () => ({ seg: null, local: new THREE.Matrix4() }));
  const position = new THREE.Vector3(), scale = new THREE.Vector3(), axis = new THREE.Vector3(0, 1, 0);
  const rotation = new THREE.Quaternion(), matrix = new THREE.Matrix4();
  let uvDirty = false;
  return {
    mesh,
    take(seg, anchor, rect = anchor.rect, W = anchor.W, H = anchor.H) {
      if (mesh.count === capacity) throw new Error('City board capacity exceeded');
      const i = mesh.count++, entry = entries[i];
      entry.seg = seg;
      position.set(anchor.x, anchor.y, anchor.z); scale.set(anchor.w, anchor.h, 1);
      rotation.setFromAxisAngle(axis, anchor.ry);
      entry.local.compose(position, rotation, scale);
      aUv.setXYZW(i, rect[0] / W, 1 - (rect[1] + rect[3]) / H, rect[2] / W, rect[3] / H);
      uvDirty = true;
    },
    release(seg) {
      for (let i = mesh.count - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry.seg !== seg) continue;
        const last = --mesh.count;
        entries[i] = entries[last]; entries[last] = entry; entry.seg = null;
        aUv.array.copyWithin(i * 4, last * 4, last * 4 + 4);
        uvDirty = true;
      }
    },
    update() {
      for (let i = 0; i < mesh.count; i++) {
        const entry = entries[i];
        matrix.copy(entry.local); matrix.elements[14] += entry.seg.group.position.z;
        mesh.setMatrixAt(i, matrix);
      }
      mesh.visible = mesh.count > 0;
      if (mesh.count) mesh.instanceMatrix.needsUpdate = true;
      if (uvDirty) { aUv.needsUpdate = true; uvDirty = false; }
    },
  };
}
