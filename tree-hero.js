import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const mount = document.getElementById("treeScene");
const preview = document.getElementById("previewHack");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const largeScreenQuery = window.matchMedia("(min-width: 961px)");
const interactiveSceneEnabled =
  largeScreenQuery.matches && !reducedMotionQuery.matches;

if (!mount) {
  throw new Error("Missing #treeScene container");
}

if (preview) {
  preview.classList.add("is-loading");
}

const leavesVS = /* glsl */ `
uniform sampler2D uNoiseMap;
uniform vec3 uBoxMin, uBoxSize, uRaycast;
uniform float uTime;
varying vec3 vObjectPos, vNormal, vWorldNormal;
varying float vCloseToGround;

vec4 getTriplanar(sampler2D tex){
  vec4 xPixel = texture(tex, (vObjectPos.xy + uTime) / 3.);
  vec4 yPixel = texture(tex, (vObjectPos.yz + uTime) / 3.);
  vec4 zPixel = texture(tex, (vObjectPos.zx + uTime) / 3.);
  vec4 combined = (xPixel + yPixel + zPixel) / 6.0;
  combined.xyz = combined.xyz * vObjectPos;
  return combined;
}

void main(){
  mat4 mouseDisplace = mat4(1.);
  vec3 vWorldPos = vec3(modelMatrix * instanceMatrix * mouseDisplace * vec4(position, 1.));
  vCloseToGround = clamp(vWorldPos.y, 0., 1.);
  float offset = clamp(0.8 - distance(uRaycast, instanceMatrix[3].xyz), 0., 999.);
  offset = (pow(offset, 0.8) / 2.0) * vCloseToGround;
  mouseDisplace[3].xyz = vec3(offset);
  vNormal = normalMatrix * mat3(instanceMatrix) * mat3(mouseDisplace) * normalize(normal);
  vWorldNormal = vec3(modelMatrix * instanceMatrix * mouseDisplace * vec4(normal, 0.));
  vObjectPos = ((vWorldPos - uBoxMin) * 2.) / uBoxSize - vec3(1.0);
  vec4 noiseOffset = getTriplanar(uNoiseMap) * vCloseToGround;
  vec4 newPos = instanceMatrix * mouseDisplace * vec4(position, 1.);
  newPos.xyz = newPos.xyz + noiseOffset.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * newPos;
}
`;

const leavesFS = /* glsl */ `
#include <common>
#include <lights_pars_begin>
uniform vec3 uColorA, uColorB, uColorC;
varying vec3 vObjectPos, vNormal, vWorldNormal;
varying float vCloseToGround;

vec3 mix3(vec3 v1, vec3 v2, vec3 v3, float fa){
  vec3 m;
  fa > 0.7 ? m = mix(v2, v3, (fa - .5) * 2.) : m = mix(v1, v2, fa * 2.);
  return m;
}

float getPosColors(){
  float p = 0.;
  p = smoothstep(0.2, 0.8, distance(vec3(0.), vObjectPos));
  p = p * (-(vWorldNormal.g / 2.) + 0.5) * (-vObjectPos.y / 9. + 0.5);
  return p;
}

float getDiffuse(){
  float intensity = 0.;
  for (int i = 0; i < directionalLights.length(); i++){
    intensity = dot(directionalLights[i].direction, vNormal);
    intensity = smoothstep(0.55, 1., intensity) * 0.2
      + pow(smoothstep(0.55, 1., intensity), 0.5);
  }
  return intensity;
}

void main(){
  float gradMap = (getPosColors() + getDiffuse()) * vCloseToGround / 2.;
  vec4 c = vec4(mix3(uColorA, uColorB, uColorC, gradMap), 1.0);
  gl_FragColor = vec4(pow(c.xyz, vec3(0.454545)), c.w);
}
`;

const scene = new THREE.Scene();
const loader = new GLTFLoader();
const camera = new THREE.PerspectiveCamera(35, 1, 0.001, 1000);
const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: false,
  powerPreference: "low-power"
});
const controls = new OrbitControls(camera, renderer.domElement);
const dummy = new THREE.Object3D();
const matrix = new THREE.Matrix4();
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const dlight01 = new THREE.DirectionalLight(0xcccccc, 1.8);
const tree = { group: new THREE.Group(), deadID: [], leavesCount: 0 };
const noiseMap = new THREE.TextureLoader().load("https://raw.githubusercontent.com/ceramicSoda/treeshader/main/assets/noise.png");
const rayPlane = new THREE.Mesh(new THREE.PlaneGeometry(100, 100, 1, 1));
let animationFrameId = 0;
let heroIsVisible = true;
let hasDocumentFocus = document.visibilityState === "visible";
let lastLeafDropAt = 0;
let lastRenderAt = 0;

const leavesMat = new THREE.ShaderMaterial({
  lights: true,
  side: THREE.DoubleSide,
  uniforms: {
    ...THREE.UniformsLib.lights,
    uTime: { value: 0.0 },
    uColorA: { value: new THREE.Color(0xb45252) },
    uColorB: { value: new THREE.Color(0xd3a068) },
    uColorC: { value: new THREE.Color(0xede19e) },
    uBoxMin: { value: new THREE.Vector3(0, 0, 0) },
    uBoxSize: { value: new THREE.Vector3(10, 10, 10) },
    uRaycast: { value: new THREE.Vector3(0, 0, 0) },
    uNoiseMap: { value: noiseMap }
  },
  vertexShader: leavesVS,
  fragmentShader: leavesFS
});

mount.appendChild(renderer.domElement);

function resize() {
  const w = Math.max(1, mount.clientWidth);
  const h = Math.max(1, mount.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

resize();
dlight01.position.set(3, 6, -3);
dlight01.lookAt(0, 2.4, 0);
rayPlane.visible = false;
camera.position.set(-7, 1, -12);
controls.target = new THREE.Vector3(0, 2.4, 0);
controls.maxPolarAngle = Math.PI * 0.5;
controls.enableDamping = interactiveSceneEnabled;
controls.autoRotate = interactiveSceneEnabled;
controls.autoRotateSpeed = 0.18;
controls.enableZoom = false;
controls.enablePan = false;
controls.touches = { TWO: THREE.TOUCH.ROTATE };

scene.add(dlight01, tree.group, rayPlane);
noiseMap.wrapS = THREE.RepeatWrapping;
noiseMap.wrapT = THREE.RepeatWrapping;

function shouldAnimate() {
  return interactiveSceneEnabled && heroIsVisible && hasDocumentFocus;
}

function dropRandomLeaf(now) {
  if (tree.leavesCount <= 0) {
    return;
  }

  if (!lastLeafDropAt || now - lastLeafDropAt > 1800) {
    tree.deadID.push(Math.floor(Math.random() * tree.leavesCount));
    lastLeafDropAt = now;
  }
}

function renderFrame(now = performance.now()) {
  animationFrameId = 0;

  if (!shouldAnimate()) {
    return;
  }

  if (now - lastRenderAt < 33) {
    animationFrameId = window.requestAnimationFrame(renderFrame);
    return;
  }
  lastRenderAt = now;

  leavesMat.uniforms.uTime.value += 0.005;
  dropRandomLeaf(now);

  if (tree.leaves && tree.deadID.length) {
    tree.deadID = tree.deadID
      .map((i) => {
        if (typeof i !== "number") return undefined;
        tree.leaves.getMatrixAt(i, matrix);
        matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        if (dummy.position.y > 0) {
          dummy.position.y -= 0.03;
          dummy.position.x += Math.random() / 7 - 0.07;
          dummy.position.z += Math.random() / 7 - 0.07;
          dummy.rotation.x += 0.12;
          dummy.updateMatrix();
          tree.leaves.setMatrixAt(i, dummy.matrix);
          return i;
        }
        return undefined;
      })
      .filter((v) => typeof v === "number");
    tree.leaves.instanceMatrix.needsUpdate = true;
  }

  controls.update();
  renderer.render(scene, camera);
  animationFrameId = window.requestAnimationFrame(renderFrame);
}

function ensureAnimationState() {
  if (shouldAnimate()) {
    if (!animationFrameId) {
      animationFrameId = window.requestAnimationFrame(renderFrame);
    }
    return;
  }

  if (animationFrameId) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
  }
}

loader
  .loadAsync("https://raw.githubusercontent.com/ceramicSoda/treeshader/main/assets/tree.glb")
  .then((obj) => {
    tree.pole = obj.scene.getObjectByName("Pole");
    tree.crown = obj.scene.getObjectByName("Leaves");
    const leafProto = obj.scene.getObjectByName("Leaf");
    if (!tree.pole || !tree.crown || !leafProto) {
      return;
    }

    tree.pole.material = new THREE.MeshToonMaterial({ map: tree.pole.material.map });
    tree.bbox = new THREE.Box3().setFromObject(tree.crown);
    leavesMat.uniforms.uBoxMin.value.copy(tree.bbox.min);
    leavesMat.uniforms.uBoxSize.value.copy(tree.bbox.getSize(new THREE.Vector3()));

    tree.leavesCount = tree.crown.geometry.attributes.position.count;
    tree.leafGeometry = leafProto.geometry;
    tree.leaves = new THREE.InstancedMesh(tree.leafGeometry, leavesMat, tree.leavesCount);

    for (let i = 0; i < tree.leavesCount; i += 1) {
      dummy.position.x = tree.crown.geometry.attributes.position.array[i * 3];
      dummy.position.y = tree.crown.geometry.attributes.position.array[i * 3 + 1];
      dummy.position.z = tree.crown.geometry.attributes.position.array[i * 3 + 2];
      dummy.lookAt(
        dummy.position.x + tree.crown.geometry.attributes.normal.array[i * 3],
        dummy.position.y + tree.crown.geometry.attributes.normal.array[i * 3 + 1],
        dummy.position.z + tree.crown.geometry.attributes.normal.array[i * 3 + 2]
      );
      dummy.scale.setScalar(Math.random() * 0.2 + 0.8);
      dummy.updateMatrix();
      tree.leaves.setMatrixAt(i, dummy.matrix);
    }

    tree.group.add(tree.pole, tree.leaves);
    for (let i = 0; i < 24; i += 1) {
      tree.deadID.push(Math.floor(Math.random() * tree.leavesCount));
    }
    if (preview) {
      preview.style.display = "none";
    }

    renderer.render(scene, camera);
    ensureAnimationState();
  })
  .catch(() => {
    if (preview) {
      preview.classList.remove("is-loading");
    }
  });

function pointerMove(e) {
  if (!interactiveSceneEnabled || !heroIsVisible) {
    return;
  }

  const rect = mount.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  pointer.set(x * 2 - 1, -(y * 2) + 1);
  raycaster.setFromCamera(pointer, camera);
  const targets = tree.leaves ? [tree.leaves, rayPlane] : [rayPlane];
  const intersects = raycaster.intersectObjects(targets);
  if (!intersects[0]) return;

  rayPlane.position.copy(intersects[0].point);
  rayPlane.position.multiplyScalar(0.9);
  rayPlane.lookAt(camera.position);
  leavesMat.uniforms.uRaycast.value = intersects[0].point;
  if (
    tree.leaves &&
    typeof intersects[0].instanceId === "number" &&
    Math.random() * 5 > 3
  ) {
    tree.deadID.push(intersects[0].instanceId);
  }
}

const resizeObserver = new ResizeObserver(() => resize());
resizeObserver.observe(mount);
window.addEventListener("resize", resize);

if (interactiveSceneEnabled) {
  mount.addEventListener("mousemove", pointerMove, { passive: true });
}

document.addEventListener("visibilitychange", () => {
  hasDocumentFocus = document.visibilityState === "visible";
  ensureAnimationState();
});

const intersectionObserver = new IntersectionObserver(
  ([entry]) => {
    heroIsVisible = Boolean(entry?.isIntersecting);
    ensureAnimationState();
  },
  { threshold: 0.15 }
);

intersectionObserver.observe(mount);
renderer.render(scene, camera);
