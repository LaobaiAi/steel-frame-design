/**
 * Steel Frame 3D Viewer — CAIAO
 *
 * 基于 Three.js 的钢框架结构可视化：
 * - 线框模型 (EdgesGeometry + LineSegments)
 * - 管状截面 (BoxGeometry 近似 H 型钢)
 * - 变形叠加 (通过滑块控制放大系数)
 * - 颜色映射 (基于应力比的绿→黄→红渐变)
 * - OrbitControls (旋转/平移/缩放)
 * - Raycaster (点击构件显示属性)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── 全局状态 ──────────────────────────────────────────────────────

let scene, camera, renderer, controls;
let modelGroup, deformedGroup;
let elementMap = {};       // element_id → {wireframe, solid}
let modelData = null;
let animationId;

// ── 初始化 ────────────────────────────────────────────────────────

function init() {
  const container = document.getElementById('container');

  // 场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.Fog(0x1a1a2e, 50, 200);

  // 相机
  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.5, 500);
  camera.position.set(30, 25, 35);
  camera.lookAt(10, 8, 10);

  // 渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // 光源
  const ambient = new THREE.AmbientLight(0x404060, 1.2);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight.position.set(30, 50, 30);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 200;
  dirLight.shadow.camera.left = -60;
  dirLight.shadow.camera.right = 60;
  dirLight.shadow.camera.top = 60;
  dirLight.shadow.camera.bottom = -60;
  scene.add(dirLight);

  const hemiLight = new THREE.HemisphereLight(0x606080, 0x202040, 0.6);
  scene.add(hemiLight);

  // 网格地面
  const gridHelper = new THREE.GridHelper(40, 40, 0x333355, 0x222244);
  scene.add(gridHelper);

  // OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(10, 8, 10);
  controls.update();

  // 变形组（叠加层）
  modelGroup = new THREE.Group();
  deformedGroup = new THREE.Group();
  scene.add(modelGroup);
  scene.add(deformedGroup);
  deformedGroup.visible = false;

  // 事件
  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('click', onClick);

  // UI 绑定
  bindUI();

  // 自动加载示例数据
  autoLoad();

  // 启动渲染循环
  animate();
}

// ── 渲染循环 ──────────────────────────────────────────────────────

function animate() {
  animationId = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  const container = document.getElementById('container');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

// ── 加载数据 ──────────────────────────────────────────────────────

async function autoLoad() {
  // 尝试从默认路径加载
  try {
    const resp = await fetch('model_3d.json');
    if (resp.ok) {
      const data = await resp.json();
      loadModel(data);
      document.getElementById('drop-zone').style.display = 'none';
    }
  } catch {
    console.log('No default model_3d.json found. Drop a file to load.');
  }
}

async function loadFromFile(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.nodes || !data.elements) {
      alert('无效的 model_3d.json：缺少 nodes 或 elements 字段');
      return;
    }
    loadModel(data);
    document.getElementById('drop-zone').style.display = 'none';
  } catch (e) {
    alert('文件解析失败: ' + e.message);
  }
}

function loadModel(data) {
  modelData = data;
  clearModel();
  buildModel(data);
  updateDeformation();
}

function clearModel() {
  while (modelGroup.children.length > 0) {
    modelGroup.remove(modelGroup.children[0]);
  }
  while (deformedGroup.children.length > 0) {
    deformedGroup.remove(deformedGroup.children[0]);
  }
  elementMap = {};
}

// ── 构建 3D 模型 ──────────────────────────────────────────────────

function buildModel(data) {
  const nodes = data.nodes || [];
  const elements = data.elements || [];
  const colorMap = data.color_map || {};
  const sections = data.section_dimensions || {};

  // 生成节点坐标映射
  const nodeCoords = {};
  for (const n of nodes) {
    nodeCoords[n.id] = new THREE.Vector3(n.x, n.y, n.z);
  }

  for (const el of elements) {
    const ni = nodeCoords[el.node_i];
    const nj = nodeCoords[el.node_j];
    if (!ni || !nj) continue;

    const mid = new THREE.Vector3().addVectors(ni, nj).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(nj, ni);
    const length = dir.length();
    if (length < 0.001) continue;

    const cmap = colorMap[String(el.id)] || null;

    // ── 截面尺寸 ──────────────────────────────────────────
    let secH = 0.3, secB = 0.3;
    const sd = sections[el.section] || sections[el.section_id] || null;
    if (sd) {
      secH = sd.height || 0.3;
      secB = sd.width || 0.3;
    }

    // 颜色
    const baseColor = cmap
      ? new THREE.Color(cmap.color)
      : (el.type === 'column' ? new THREE.Color(0x4488cc) : new THREE.Color(0x44aa66));

    const color = document.getElementById('show-color')?.checked !== false
      ? baseColor
      : new THREE.Color(0x888888);

    // ── 实体截面（BoxGeometry 近似）────────────────────
    const geom = new THREE.BoxGeometry(secB, secH, length);
    const mat = new THREE.MeshPhongMaterial({
      color,
      specular: 0x111111,
      shininess: 30,
      transparent: true,
      opacity: 0.85,
    });
    const box = new THREE.Mesh(geom, mat);
    box.position.copy(mid);
    box.castShadow = true;
    box.receiveShadow = true;

    // 旋转到构件方向
    const quaternion = new THREE.Quaternion();
    const zAxis = new THREE.Vector3(0, 0, 1);
    quaternion.setFromUnitVectors(zAxis, dir.normalize());
    box.setRotationFromQuaternion(quaternion);

    box.userData = {
      elementId: el.id,
      type: el.type,
      section: el.section || el.section_id,
      stressRatio: cmap?.stress_ratio || 0,
      pass: cmap?.pass ?? true,
    };

    // ── 线框 ─────────────────────────────────────────────
    const edgeGeom = new THREE.EdgesGeometry(geom);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
    const wireframe = new THREE.LineSegments(edgeGeom, edgeMat);
    wireframe.position.copy(mid);
    wireframe.setRotationFromQuaternion(quaternion);

    elementMap[el.id] = { solid: box, wireframe, nodeI: ni, nodeJ: nj, length, dir: dir.normalize() };

    modelGroup.add(box);
    modelGroup.add(wireframe);
  }

  // 柱脚球体标记
  const groundZ = Math.min(...nodes.map(n => n.z));
  for (const n of nodes) {
    if (Math.abs(n.z - groundZ) < 0.05) {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 16, 16),
        new THREE.MeshPhongMaterial({ color: 0xff4444 })
      );
      sphere.position.set(n.x, n.y, n.z);
      modelGroup.add(sphere);
    }
  }

  // 调整相机
  fitCamera(data);
  document.getElementById('show-deformed').checked = false;
}

// ── 变形视图 ──────────────────────────────────────────────────────

function updateDeformation() {
  while (deformedGroup.children.length > 0) {
    deformedGroup.remove(deformedGroup.children[0]);
  }

  if (!modelData || !modelData.deformed_nodes) {
    deformedGroup.visible = false;
    return;
  }

  const showDeformed = document.getElementById('show-deformed').checked;
  if (!showDeformed) {
    deformedGroup.visible = false;
    return;
  }

  deformedGroup.visible = true;
  const scale = parseFloat(document.getElementById('def-scale').value) / 100;
  const defNodes = modelData.deformed_nodes;
  const defCoords = {};
  for (const n of defNodes) {
    defCoords[n.id] = new THREE.Vector3(n.x, n.y, n.z);
  }

  // 原始节点
  const origCoords = {};
  for (const n of modelData.nodes) {
    origCoords[n.id] = new THREE.Vector3(n.x, n.y, n.z);
  }

  for (const el of modelData.elements) {
    const info = elementMap[el.id];
    if (!info) continue;

    const origI = origCoords[el.node_i];
    const origJ = origCoords[el.node_j];
    const defI = defCoords[el.node_i];
    const defJ = defCoords[el.node_j];
    if (!origI || !origJ || !defI || !defJ) continue;

    // 绘制原始→变形的连线
    const lineGeom = new THREE.BufferGeometry().setFromPoints([origI, defI, defJ, origJ]);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.5 });
    const line = new THREE.Line(lineGeom, lineMat);
    deformedGroup.add(line);

    // 变形后的构件（半透明）
    const defMid = new THREE.Vector3().addVectors(defI, defJ).multiplyScalar(0.5);
    const defLen = defJ.distanceTo(defI);
    const defGeom = new THREE.CylinderGeometry(0.08, 0.08, defLen, 6);
    const defMat = new THREE.MeshPhongMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.4,
      wireframe: true,
    });
    const cyl = new THREE.Mesh(defGeom, defMat);
    cyl.position.copy(defMid);

    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(defJ, defI).normalize());
    cyl.setRotationFromQuaternion(quat);
    deformedGroup.add(cyl);
  }
}

// ── 相机适配 ──────────────────────────────────────────────────────

function fitCamera(data) {
  const nodes = data.nodes || [];
  if (nodes.length === 0) return;
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y), zs = nodes.map(n => n.z);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  controls.target.set(cx, cy, cz);
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), Math.max(...zs) - Math.min(...zs));
  camera.position.set(cx + size * 1.2, cy + size * 1.0, cz + size * 1.5);
  camera.lookAt(cx, cy, cz);
  controls.update();
}

// ── 视角预设 ──────────────────────────────────────────────────────

function resetCamera() {
  if (modelData) fitCamera(modelData);
}

function viewTop() {
  if (!modelData) return;
  const nodes = modelData.nodes;
  const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
  const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
  const cz = Math.max(...nodes.map(n => n.z)) + 5;
  animateCamera(new THREE.Vector3(cx, cz, cy), new THREE.Vector3(cx, cz * 0.5, cy));
}

function viewFront() {
  if (!modelData) return;
  const nodes = modelData.nodes;
  const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
  const cz = nodes.reduce((s, n) => s + n.z, 0) / nodes.length;
  const maxY = Math.max(...nodes.map(n => n.y));
  animateCamera(new THREE.Vector3(cx, cz, maxY + 15), new THREE.Vector3(cx, cz, 0));
}

function animateCamera(targetPos, targetLook) {
  const startPos = camera.position.clone();
  const startLook = controls.target.clone();
  const startTime = Date.now();
  const duration = 800;

  function step() {
    const elapsed = Date.now() - startTime;
    const t = Math.min(elapsed / duration, 1.0);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad
    camera.position.lerpVectors(startPos, targetPos, ease);
    controls.target.lerpVectors(startLook, targetLook, ease);
    controls.update();
    if (t < 1.0) requestAnimationFrame(step);
  }
  step();
}

// ── 点击拾取 ──────────────────────────────────────────────────────

function onClick(event) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const solids = Object.values(elementMap).map(e => e.solid);
  const intersects = raycaster.intersectObjects(solids);

  const tooltip = document.getElementById('tooltip');
  if (intersects.length > 0) {
    const obj = intersects[0].object;
    const ud = obj.userData;
    tooltip.innerHTML = `
      <b>构件 #${ud.elementId}</b><br>
      类型: ${ud.type}<br>
      截面: ${ud.section}<br>
      应力比: ${ud.stressRatio?.toFixed(4)}<br>
      结果: ${ud.pass ? '✅ 通过' : '❌ 不通过'}
    `;
    tooltip.style.display = 'block';
    tooltip.style.left = (event.clientX + 15) + 'px';
    tooltip.style.top = (event.clientY + 15) + 'px';
    setTimeout(() => { tooltip.style.display = 'none'; }, 3000);
  }
}

// ── UI 绑定 ───────────────────────────────────────────────────────

function bindUI() {
  const defScale = document.getElementById('def-scale');
  const defScaleVal = document.getElementById('def-scale-val');
  defScale.addEventListener('input', () => {
    const v = parseFloat(defScale.value) / 100;
    defScaleVal.textContent = v.toFixed(1) + '×';
    updateDeformation();
  });

  document.getElementById('show-deformed').addEventListener('change', updateDeformation);

  // 文件拖放
  const container = document.getElementById('container');
  container.addEventListener('dragover', e => { e.preventDefault(); });
  container.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) loadFromFile(file);
  });

  document.getElementById('file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) loadFromFile(file);
  });
}

// ── 启动 ──────────────────────────────────────────────────────────

init();
console.log('Steel Frame 3D Viewer — CAIAO Standard v2.0');
