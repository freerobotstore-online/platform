import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

await RAPIER.init();

// --- Scene setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);
scene.fog = new THREE.Fog(0x0a0a0a, 20, 40);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(8, 6, 12);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').prepend(renderer.domElement);

// --- Lights ---
const ambient = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 30;
dirLight.shadow.camera.left = -10;
dirLight.shadow.camera.right = 10;
dirLight.shadow.camera.top = 10;
dirLight.shadow.camera.bottom = -10;
scene.add(dirLight);

const pointLight = new THREE.PointLight(0xf97316, 0.6, 20);
pointLight.position.set(-3, 5, -2);
scene.add(pointLight);

// --- Physics world ---
let gravity = { x: 0, y: -9.81, z: 0 };
let world = new RAPIER.World(gravity);

// --- Ground ---
const groundGeo = new THREE.PlaneGeometry(20, 20);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
world.createCollider(
  RAPIER.ColliderDesc.cuboid(10, 0.01, 10).setRestitution(0.6),
  groundBody
);

// --- Grid lines ---
const grid = new THREE.GridHelper(20, 20, 0x262626, 0x1f1f1f);
grid.position.y = 0.005;
scene.add(grid);

// --- Walls (invisible, keep balls in) ---
function addWall(hx, hy, hz, px, py, pz) {
  const wallBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(px, py, pz)
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(hx, hy, hz).setRestitution(0.5),
    wallBody
  );
}
addWall(10, 5, 0.1, 0, 5, -10); // back
addWall(10, 5, 0.1, 0, 5, 10);  // front
addWall(0.1, 5, 10, -10, 5, 0); // left
addWall(0.1, 5, 10, 10, 5, 0);  // right

// --- Ramp (to make physics more interesting) ---
const rampGeo = new THREE.BoxGeometry(4, 0.15, 3);
const rampMat = new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.6 });
const ramp = new THREE.Mesh(rampGeo, rampMat);
ramp.position.set(-3, 0.8, 2);
ramp.rotation.z = -0.3;
ramp.castShadow = true;
ramp.receiveShadow = true;
scene.add(ramp);

const rampBody = world.createRigidBody(
  RAPIER.RigidBodyDesc.fixed()
    .setTranslation(-3, 0.8, 2)
    .setRotation({ x: 0, y: 0, z: Math.sin(-0.15), w: Math.cos(-0.15) })
);
world.createCollider(
  RAPIER.ColliderDesc.cuboid(2, 0.075, 1.5).setRestitution(0.4),
  rampBody
);

// --- Ball colors ---
const ballColors = [0xf97316, 0x3b82f6, 0x10b981, 0xef4444, 0xa855f7, 0xeab308, 0x06b6d4, 0xec4899];
let colorIdx = 0;

// --- Track balls ---
const balls = [];

function dropBall(x = 0, z = 0) {
  const radius = 0.3 + Math.random() * 0.2;
  const color = ballColors[colorIdx % ballColors.length];
  colorIdx++;

  const geo = new THREE.SphereGeometry(radius, 24, 24);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.3,
    metalness: 0.1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  scene.add(mesh);

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x + (Math.random() - 0.5) * 2, 8 + Math.random() * 3, z + (Math.random() - 0.5) * 2)
      .setLinvel(Math.random() - 0.5, 0, Math.random() - 0.5)
  );
  world.createCollider(
    RAPIER.ColliderDesc.ball(radius).setRestitution(0.7).setFriction(0.3).setDensity(1.0),
    body
  );

  balls.push({ mesh, body, radius });
}

function clearAll() {
  for (const b of balls) {
    scene.remove(b.mesh);
    b.mesh.geometry.dispose();
    b.mesh.material.dispose();
    world.removeRigidBody(b.body);
  }
  balls.length = 0;
}

// --- Camera orbit ---
let isDragging = false;
let prevMouse = { x: 0, y: 0 };
let cameraAngle = 0.9;
let cameraHeight = 6;
let cameraDistance = 14;

renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.target === renderer.domElement) {
    isDragging = true;
    prevMouse = { x: e.clientX, y: e.clientY };
  }
});
window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - prevMouse.x;
  const dy = e.clientY - prevMouse.y;
  cameraAngle += dx * 0.005;
  cameraHeight = Math.max(1, Math.min(15, cameraHeight - dy * 0.05));
  prevMouse = { x: e.clientX, y: e.clientY };
});
window.addEventListener('mouseup', () => { isDragging = false; });

// Click to drop ball at random position
renderer.domElement.addEventListener('dblclick', () => {
  dropBall((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
});

// --- Controls ---
document.getElementById('btn-drop').addEventListener('click', () => {
  for (let i = 0; i < 5; i++) {
    dropBall((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
  }
});

document.getElementById('btn-clear').addEventListener('click', clearAll);

const gravities = [
  { label: 'Earth', y: -9.81 },
  { label: 'Moon', y: -1.62 },
  { label: 'Mars', y: -3.72 },
  { label: 'Jupiter', y: -24.79 },
  { label: 'Zero-G', y: -0.01 },
];
let gravIdx = 0;
document.getElementById('btn-gravity').addEventListener('click', () => {
  gravIdx = (gravIdx + 1) % gravities.length;
  const g = gravities[gravIdx];
  world.gravity = { x: 0, y: g.y, z: 0 };
  document.getElementById('btn-gravity').textContent = `Gravity: ${g.label}`;
});

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Drop initial balls ---
for (let i = 0; i < 8; i++) {
  dropBall((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
}

// --- Animation loop ---
const countEl = document.getElementById('count');
const fpsEl = document.getElementById('fps');
let lastTime = performance.now();
let frameCount = 0;

function animate() {
  requestAnimationFrame(animate);

  // Step physics
  world.step();

  // Sync Three.js meshes with Rapier bodies
  for (let i = balls.length - 1; i >= 0; i--) {
    const { mesh, body } = balls[i];
    const pos = body.translation();
    const rot = body.rotation();

    // Remove balls that fell below the ground (shouldn't happen with walls, but safety)
    if (pos.y < -5) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      world.removeRigidBody(body);
      balls.splice(i, 1);
      continue;
    }

    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  }

  // Orbit camera
  camera.position.x = Math.sin(cameraAngle) * cameraDistance;
  camera.position.z = Math.cos(cameraAngle) * cameraDistance;
  camera.position.y = cameraHeight;
  camera.lookAt(0, 1, 0);

  renderer.render(scene, camera);

  // FPS counter
  frameCount++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    fpsEl.textContent = frameCount;
    countEl.textContent = balls.length;
    frameCount = 0;
    lastTime = now;
  }
}

animate();
