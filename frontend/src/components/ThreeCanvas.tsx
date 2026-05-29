import React, { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Billboard, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import { createHBeamGeometry } from '../utils/beamGeometry';

// ── Types ──────────────────────────────────────────────────────

interface EngParams {
  grid_x?: number[]; grid_y?: number[]; num_stories?: number; story_heights?: number[];
  column_section?: string; beam_section?: string; name?: string;
}
interface MockNode { id: number; x: number; y: number; z: number }
interface MockElement { id: number; node_i: number; node_j: number; type: string; section: string }
interface MockColorEntry { color: string; stress_ratio: number; stability_ratio: number; deflection_ratio: number; slenderness_ratio: number; pass: boolean }
interface MockSupport { node_id: number; dof: [boolean, boolean, boolean, boolean, boolean, boolean] }
interface MockArrow { position: [number, number, number]; direction: [number, number, number]; magnitude: number; type: string }
interface MockData {
  nodes: MockNode[]; elements: MockElement[]; deformed_nodes: MockNode[];
  color_map: Record<string, MockColorEntry>;
  section_dimensions: Record<string, { height: number; width: number }>;
  bounding_box: { min: [number, number, number]; max: [number, number, number]; center: [number, number, number] };
  load_arrows: MockArrow[]; supports: MockSupport[];
}

// ── Generate model from params ─────────────────────────────────

function generateModel(params: EngParams): MockData {
  const nx = (params.grid_x?.length ?? 3);
  const ny = (params.grid_y?.length ?? 2);
  const nz = params.num_stories ?? 3;
  const spansX = params.grid_x ?? [6, 6, 6];
  const spansY = params.grid_y ?? [6, 6];
  const heights = params.story_heights ?? [4.0, 3.5, 3.5];

  // Compute cumulative positions
  const posX = [0]; for (let i = 0; i < spansX.length; i++) posX.push(posX[i] + spansX[i]);
  const posY = [0]; for (let i = 0; i < spansY.length; i++) posY.push(posY[i] + spansY[i]);
  const posZ = [0]; for (let i = 0; i < nz; i++) posZ.push(posZ[i] + (heights[i] ?? 3.5));
  const totalZ = posZ[posZ.length - 1];

  const nodes: MockNode[] = [];
  const elements: MockElement[] = [];
  let nid = 0, eid = 0;

  for (let k = 0; k <= nz; k++)
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx; i++)
        nodes.push({ id: nid++, x: posX[i], y: posY[j], z: posZ[k] });

  const idx = (i: number, j: number, k: number) => k * (nx + 1) * (ny + 1) + j * (nx + 1) + i;

  for (let k = 1; k <= nz; k++) {
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i < nx; i++)
        elements.push({ id: eid++, node_i: idx(i, j, k), node_j: idx(i + 1, j, k), type: 'beam', section: params.beam_section ?? 'HM390x300x10x16' });
    for (let j = 0; j < ny; j++)
      for (let i = 0; i <= nx; i++)
        elements.push({ id: eid++, node_i: idx(i, j, k), node_j: idx(i, j + 1, k), type: 'beam', section: params.beam_section ?? 'HM390x300x10x16' });
  }
  for (let k = 0; k < nz; k++)
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx; i++)
        elements.push({ id: eid++, node_i: idx(i, j, k), node_j: idx(i, j, k + 1), type: 'column', section: params.column_section ?? 'HW400x400x13x21' });

  // Deformed nodes: only deform if we have real data, otherwise keep original
  const deformedNodes = nodes.map(n => ({ ...n }));

  // Color map: deterministic mock stress ratios based on position
  // Lower floors and outer columns get higher ratios for realism
  const colorMap: Record<string, MockColorEntry> = {};
  elements.forEach(el => {
    const ni = nodes[el.node_i], nj = nodes[el.node_j];
    const midZ = ni && nj ? (ni.z + nj.z) / 2 : 0;
    const maxZ = posZ[nz] || 1;
    // Floor factor: lower floors = higher stress
    const floorFactor = 1 - midZ / maxZ * 0.7;
    // Position jitter for variety
    const jitter = ((el.id * 7 + el.type.length * 13) % 100) / 500;
    const mockRatio = Math.min(1.05, Math.max(0.08, floorFactor * 0.7 + jitter));
    const stab = Math.max(0, mockRatio * 0.85);
    const defl = Math.max(0, mockRatio * 0.4);
    const slen = Math.max(10, mockRatio * 80);
    colorMap[String(el.id)] = {
      color: stressToColor(mockRatio),
      stress_ratio: mockRatio,
      stability_ratio: stab,
      deflection_ratio: defl,
      slenderness_ratio: slen,
      pass: mockRatio <= 1.0,
    };
  });

  // Supports on ground floor
  const supports: MockSupport[] = [];
  for (let i = 0; i <= nx; i++)
    for (let j = 0; j <= ny; j++)
      supports.push({ node_id: idx(i, j, 0), dof: [true, true, true, true, true, true] });

  // ── Representative load arrows — one clean arrow per type ──
  const deadVal = (params as any).dead_load ?? 2.0;
  const liveVal = (params as any).live_load ?? 3.0;
  const windVal = (params as any).wind_pressure ?? 0.45;
  const seismicVal = (params as any).seismic_intensity ?? 0.08;
  const load_arrows: MockArrow[] = [];
  const centerX = (posX[0] + posX[nx]) / 2;
  const centerY = (posY[0] + posY[ny]) / 2;

  // Dead: arrow tip points at roof center
  load_arrows.push({
    position: [centerX, centerY, posZ[nz] + 2.9],
    direction: [0, 0, -1], magnitude: deadVal, type: 'dead'
  });
  // Live: arrow tip points at roof, offset further to the side
  load_arrows.push({
    position: [centerX + 3.0, centerY + 3.0, posZ[nz] + 2.9],
    direction: [0, 0, -1], magnitude: liveVal, type: 'live'
  });
  // Wind & seismic are shown via animated effects only, no static arrows

  return {
    nodes, elements, deformed_nodes: deformedNodes, color_map: colorMap,
    section_dimensions: {
      'HW400x400x13x21': { height: 0.40, width: 0.40 }, 'HW350x350x12x19': { height: 0.35, width: 0.35 }, 'HW300x300x10x15': { height: 0.30, width: 0.30 },
      'HM390x300x10x16': { height: 0.39, width: 0.30 }, 'HM340x250x9x14': { height: 0.34, width: 0.25 }, 'HM244x175x7x11': { height: 0.24, width: 0.175 },
    },
    bounding_box: { min: [posX[0], posY[0], 0], max: [posX[nx], posY[ny], totalZ], center: [(posX[0] + posX[nx]) / 2, (posY[0] + posY[ny]) / 2, totalZ / 2] },
    load_arrows, supports,
  };
}

function generateDefaultData(): MockData {
  return generateModel({ grid_x: [6, 6, 6], grid_y: [6, 6, 6], num_stories: 4, story_heights: [4.5, 3.6, 3.6, 3.6] });
}

const DEFAULT_DATA = generateDefaultData();

// ── Stress-to-Color mapping ───────────────────────────────────

function stressToColor(ratio: number, safeLimit = 0.8, criticalLimit = 1.0): string {
  if (ratio > criticalLimit)        return '#FF4400';
  if (ratio > criticalLimit - 0.15) return '#FF8800';
  if (ratio > safeLimit + 0.05)     return '#FFCC00';
  if (ratio > safeLimit - 0.15)     return '#AADD00';
  return '#32CC66';
}

// ── Animated Beam Component ───────────────────────────────────

const _v = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function AnimatedBeam({ ni, nj, color, secH = 0.35, secB = 0.3, opacity = 1, emissive = false, delay = 0, animationType = 'drop', displayMode = 'shaded', section = '', isSelected = false, onSelect }: {
  ni: THREE.Vector3; nj: THREE.Vector3; color: string; secH?: number; secB?: number;
  opacity?: number; emissive?: boolean; delay?: number; animationType?: 'drop' | 'slide' | 'rise' | 'lift' | 'none';
  displayMode?: string; section?: string; isSelected?: boolean; onSelect?: (mods: { ctrlKey: boolean; shiftKey: boolean }) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const phaseInit = animationType === 'none' ? 'placed' as const : 'entering' as const;
  const [phase, setPhase] = useState<'entering' | 'placed'>(phaseInit);
  const startPos = useMemo(() => {
    const mid = _v.copy(ni).add(nj).multiplyScalar(0.5);
    const ni_z = ni.z, nj_z = nj.z;
    if (animationType === 'rise') {
      // 柱子从底部升起
      const baseZ = Math.min(ni_z, nj_z);
      return new THREE.Vector3(mid.x, mid.y, baseZ);
    }
    if (animationType === 'lift') {
      // 梁从楼层下方升起（模拟吊装）
      const floorZ = Math.min(ni_z, nj_z);
      return new THREE.Vector3(mid.x, mid.y, floorZ - 2.5);
    }
    if (animationType === 'drop') return new THREE.Vector3(mid.x, mid.y, mid.z + 18 + delay * 0.5);
    if (animationType === 'slide') return new THREE.Vector3(mid.x + 10, mid.y, mid.z);
    return mid.clone();
  }, [animationType, ni.x, ni.y, ni.z, nj.x, nj.y, nj.z]);

  const targetPos = useMemo(() => _v.copy(ni).add(nj).multiplyScalar(0.5).clone(), []);
  const dir = useMemo(() => new THREE.Vector3().subVectors(nj, ni), []);
  const len = dir.length();
  const quat = useMemo(() => {
    if (len < 0.01) return new THREE.Quaternion();
    return new THREE.Quaternion().setFromUnitVectors(_up, dir.clone().normalize());
  }, [dir, len]);

  // Custom H-beam geometry
  // 'rise' 动画：初始 scale.y=0，避免柱子渲染后到动画开始前闪一下全高
  useEffect(() => {
    if (animationType === 'rise' && ref.current) {
      ref.current.scale.y = 0;
    }
  }, []);

  const beamGeom = useMemo(() => {
    if (len < 0.01) return null;
    return createHBeamGeometry(section, secH, secB, len);
  }, [section, secH, secB, len]);

  const animationRef = useRef({ progress: 0, started: false, startTime: 0, wasZero: true });
  const col = useMemo(() => new THREE.Color(color), [color]);

  // For 'rise': beams grow from base upward. Translate geometry so origin is at bottom.
  const offsetGeom = useMemo(() => {
    if (animationType !== 'rise' || !beamGeom) return null;
    const g = beamGeom.clone();
    g.translate(0, len / 2, 0);
    g.computeVertexNormals();
    return g;
  }, [beamGeom, animationType, len]);
  const renderGeom = (animationType === 'rise' ? offsetGeom : beamGeom);

  const edgesGeom = useMemo(() => {
    if (!renderGeom) return null;
    return new THREE.EdgesGeometry(renderGeom);
  }, [renderGeom]);

  useFrame(({ clock }) => {
    if (phase !== 'entering') return;
    const anim = animationRef.current;
    if (!anim.started) { anim.started = true; anim.startTime = clock.elapsedTime + delay; }
    const elapsed = clock.elapsedTime - anim.startTime;
    if (elapsed < 0) {
      // 动画尚未开始：柱子不可见，梁在起点等待
      if (animationType === 'rise' && ref.current) ref.current.scale.y = 0;
      return;
    }

    anim.progress = Math.min(1, elapsed / 0.8);
    const ease = 1 - Math.pow(1 - anim.progress, 3);
    if (ref.current) {
      if (animationType === 'rise') {
        // 柱子从柱底向上生长（scale Y）
        ref.current.scale.y = ease;
      } else if (animationType !== 'none') {
        ref.current.position.lerpVectors(startPos, targetPos, ease);
      }
    }
    if (anim.progress >= 1) setPhase('placed');
  });

  if (len < 0.01 || !renderGeom) return null;

  const isXray = displayMode === 'xray';
  const isWireframe = displayMode === 'wireframe';

  // Animated opacity: fade in during first 0.15s of animation
  const [currentOpacity, setCurrentOpacity] = useState(0);
  useFrame(({ clock }) => {
    if (phase !== 'entering') {
      if (currentOpacity !== 1) setCurrentOpacity(1);
      return;
    }
    const anim = animationRef.current;
    const elapsed = clock.elapsedTime - anim.startTime;
    if (elapsed < 0) { setCurrentOpacity(0); return; }
    setCurrentOpacity(Math.min(1, elapsed / 0.15));
  });

  const matOpacity = Math.min(opacity, currentOpacity);

  // Selection pulse animation
  const pulseRef = useRef(0);
  const [glowIntensity, setGlowIntensity] = useState(0);
  useFrame(({ clock }) => {
    if (!isSelected) { if (glowIntensity !== 0) setGlowIntensity(0); return; }
    pulseRef.current = 0.7 + Math.sin(clock.elapsedTime * 3) * 0.3;
    setGlowIntensity(pulseRef.current);
  });

  const selOpacity = isSelected ? 1 : matOpacity;
  const SEL_COLOR = '#9C27B0';
  const selEmissive = isSelected ? new THREE.Color(SEL_COLOR) : (emissive ? col : '#000000');
  const selEmissiveIntensity = isSelected ? glowIntensity : (emissive ? 0.3 : 0);

  return (
    <group ref={ref} position={startPos} quaternion={quat}>
      {!isXray && (
        <mesh
          castShadow={!isWireframe} receiveShadow={!isWireframe}
          geometry={renderGeom}
          onClick={(e) => { e.stopPropagation(); onSelect?.({ ctrlKey: (e as any).nativeEvent?.ctrlKey ?? false, shiftKey: (e as any).nativeEvent?.shiftKey ?? false }); }}
        >
          {isWireframe ? (
            <meshStandardMaterial color="#00D4FF" wireframe metalness={0} roughness={0.8} transparent opacity={0.4} />
          ) : (
            <meshStandardMaterial color={col} metalness={0.4} roughness={0.6}
              transparent opacity={selOpacity}
              emissive={selEmissive} emissiveIntensity={selEmissiveIntensity} />
          )}
        </mesh>
      )}
      {/* Edges / wireframe */}
      {(isXray || isWireframe) ? (
        <lineSegments>
          <edgesGeometry args={[renderGeom]} />
          <lineBasicMaterial color={isXray ? '#4488ff' : '#00D4FF'} transparent opacity={isXray ? 0.3 : 0.6} />
        </lineSegments>
      ) : (
        <lineSegments geometry={edgesGeom!}>
          <lineBasicMaterial color={isSelected ? SEL_COLOR : '#ffffff'} transparent opacity={isSelected ? 0.9 : 0.12 * selOpacity} />
        </lineSegments>
      )}
      {/* X-ray transparent fill */}
      {isXray && (
        <mesh geometry={renderGeom} onClick={(e) => { e.stopPropagation(); onSelect?.({ ctrlKey: (e as any).nativeEvent?.ctrlKey ?? false, shiftKey: (e as any).nativeEvent?.shiftKey ?? false }); }}>
          <meshStandardMaterial color={col} transparent opacity={0.08 * selOpacity} depthWrite={false} />
        </mesh>
      )}
      {/* Selection glow halo — scaled-up transparent outline */}
      {isSelected && !isXray && !isWireframe && renderGeom && (
        <group scale={[1.06, 1.06, 1.06]}>
          <mesh geometry={renderGeom}>
            <meshBasicMaterial color={SEL_COLOR} transparent opacity={0.2 + glowIntensity * 0.12} depthWrite={false} />
          </mesh>
          <lineSegments geometry={edgesGeom!}>
            <lineBasicMaterial color={SEL_COLOR} transparent opacity={1.0} />
          </lineSegments>
        </group>
      )}
    </group>
  );
}

// ── Frame Model ────────────────────────────────────────────────

function FrameModel({ data, showColorMap, currentStep, buildPhase, animate = false, displayMode = 'shaded', explodeFactor = 0 }: {
  data: MockData; showColorMap: boolean; currentStep: string; buildPhase: number; animate?: boolean;
  displayMode?: string; explodeFactor?: number;
}) {
  const colorMode = useStore(s => s.colorMode);
  const selectedElements = useStore(s => s.selectedElements);
  const setSelectedElements = useStore(s => s.setSelectedElements);
  const addSelectedElement = useStore(s => s.addSelectedElement);
  const removeSelectedElement = useStore(s => s.removeSelectedElement);
  const nodeMap = useMemo(() => new Map(data.nodes.map((n: MockNode) => [n.id, new THREE.Vector3(n.x, n.y, n.z)])), [data]);

  // 获取所有楼层高度
  const floorLevels = useMemo(() => {
    const zSet = new Set<number>();
    data.nodes.forEach(n => zSet.add(n.z));
    return Array.from(zSet).sort((a, b) => a - b);
  }, [data]);

  // 按楼层分组：柱子（本层到上层）和梁（本层顶面）
  const floorGroups = useMemo(() => {
    const groups: { floorIdx: number; columns: MockElement[]; beams: MockElement[] }[] = [];
    for (let f = 0; f < floorLevels.length - 1; f++) {
      const zBottom = floorLevels[f];
      const zTop = floorLevels[f + 1];
      const columns = data.elements.filter(el => {
        if (el.type !== 'column') return false;
        const ni = nodeMap.get(el.node_i), nj = nodeMap.get(el.node_j);
        if (!ni || !nj) return false;
        return Math.abs(Math.min(ni.z, nj.z) - zBottom) < 0.01;
      });
      const beamsNextFloor = data.elements.filter(el => {
        if (el.type !== 'beam') return false;
        const ni = nodeMap.get(el.node_i), nj = nodeMap.get(el.node_j);
        if (!ni || !nj) return false;
        return Math.abs((ni.z + nj.z) / 2 - zTop) < 0.01;
      });
      groups.push({ floorIdx: f, columns, beams: beamsNextFloor });
    }
    return groups;
  }, [data, floorLevels]);

  const bbox = useMemo(() => data.bounding_box, [data]);

  // 动画时序参数（秒）
  const COLUMN_TIME = 0.6;    // 柱子升起用时
  const BEAM_LIFT = 0.5;      // 梁吊装用时
  const FLOOR_GAP = 0.4;      // 楼层间隔

  const maxZ = data.bounding_box.max[2];
  const elementsToShow = animate
    ? data.elements.filter(el => {
        const ni = nodeMap.get(el.node_i), nj = nodeMap.get(el.node_j);
        if (!ni || !nj) return false;
        return (ni.z + nj.z) / 2 / (maxZ || 1) <= buildPhase;
      })
    : data.elements;

  const elementSet = new Set(elementsToShow.map(el => el.id));

  // 楼层配色方案：建模动画阶段使用，每层不同颜色便于区分
  const FLOOR_COLORS = [
    '#4FC3F7', '#81C784', '#FFB74D', '#E57373',
    '#BA68C8', '#4DD0E1', '#FFF176', '#A1887F',
  ];

  function renderEl(el: MockElement, ni: THREE.Vector3, nj: THREE.Vector3, isColumn: boolean, floorIdx: number) {
    const cmap = data.color_map?.[String(el.id)];
    const raw = cmap ? (cmap as any)[colorMode] ?? 0.5 : 0.5;
    const ratio = colorMode === 'slenderness_ratio' ? raw / 150 : raw;
    const isHighStress = ratio > 0.8;
    // 建模阶段：按楼层配色（视觉分层清晰）；其余阶段：应力比配色或构件类型默认色
    const isModeling = currentStep === 'modeling';
    const color = isModeling
      ? FLOOR_COLORS[floorIdx % FLOOR_COLORS.length]
      : (cmap && showColorMap) ? stressToColor(ratio) : isColumn ? '#4488cc' : '#44aa66';
    const sd = data.section_dimensions[el.section];
    const secH = isColumn ? (sd?.height ?? 0.4) : (sd?.height ?? 0.34);
    const secB = isColumn ? (sd?.width ?? 0.4) : (sd?.width ?? 0.28);
    // Dim non-selected elements when something is selected
    const isThisSelected = selectedElements.includes(el.id);
    const hasSelection = selectedElements.length > 0;
    const dimOpacity = hasSelection && !isThisSelected ? 0.65 : 1;

    if (animate) {
      const floorBaseDelay = floorIdx * (COLUMN_TIME + BEAM_LIFT + FLOOR_GAP);
      if (isColumn) {
        // 柱子从底部升起（同时）
        return (
          <AnimatedBeam key={el.id} ni={ni} nj={nj} color={color} secH={secH} secB={secB}
            opacity={dimOpacity} emissive={isHighStress && currentStep === 'check'}
            delay={floorBaseDelay} animationType="rise" displayMode={displayMode} section={el.section}
            isSelected={isThisSelected} onSelect={(mods) => {
              if (mods.ctrlKey) addSelectedElement(el.id);
              else if (mods.shiftKey) removeSelectedElement(el.id);
              else setSelectedElements([el.id]);
            }} />
        );
      } else {
        // 梁从下方向上吊装（从左到右、从下到上扫描）
        const beamX = (ni.x + nj.x) / 2;
        const beamY = (ni.y + nj.y) / 2;
        const minX = bbox.min[0], maxX = bbox.max[0];
        const minY = bbox.min[1], maxY = bbox.max[1];
        const xNorm = maxX > minX ? (beamX - minX) / (maxX - minX) : 0.5;
        const yNorm = maxY > minY ? (beamY - minY) / (maxY - minY) : 0.5;
        // 混合 X 和 Y 排序：主方向 X，次方向 Y
        const sweepNorm = xNorm * 0.7 + yNorm * 0.3;
        const beamDelay = floorBaseDelay + COLUMN_TIME + sweepNorm * BEAM_LIFT;
        const eo = explodeFactor > 0 ? floorIdx * explodeFactor * 4 : 0;
        const eni = new THREE.Vector3(ni.x, ni.y, ni.z + eo);
        const enj = new THREE.Vector3(nj.x, nj.y, nj.z + eo);
        return (
          <AnimatedBeam key={el.id} ni={eni} nj={enj} color={color} secH={secH} secB={secB}
            opacity={dimOpacity} emissive={isHighStress && currentStep === 'check'}
            delay={beamDelay} animationType="lift" displayMode={displayMode} section={el.section}
            isSelected={isThisSelected} onSelect={(mods) => {
              if (mods.ctrlKey) addSelectedElement(el.id);
              else if (mods.shiftKey) removeSelectedElement(el.id);
              else setSelectedElements([el.id]);
            }} />
        );
      }
    }

    const eo = explodeFactor > 0 ? floorIdx * explodeFactor * 4 : 0;
    const eni = new THREE.Vector3(ni.x, ni.y, ni.z + eo);
    const enj = new THREE.Vector3(nj.x, nj.y, nj.z + eo);
    return (
      <AnimatedBeam key={el.id} ni={eni} nj={enj} color={color} secH={secH} secB={secB}
        opacity={dimOpacity} emissive={isHighStress && currentStep === 'check'}
        delay={0} animationType="none" displayMode={displayMode} section={el.section}
        isSelected={isThisSelected} onSelect={(mods) => {
          if (mods.ctrlKey) addSelectedElement(el.id);
          else if (mods.shiftKey) removeSelectedElement(el.id);
          else setSelectedElements([el.id]);
        }} />
    );
  }

  return (
    <group>
      {floorGroups.map(group => {
        return (
          <group key={group.floorIdx}>
            {group.columns.filter(el => elementSet.has(el.id)).map(el => {
              const ni = nodeMap.get(el.node_i), nj = nodeMap.get(el.node_j);
              if (!ni || !nj) return null;
              return renderEl(el, ni, nj, true, group.floorIdx);
            })}
            {group.beams
              .filter(el => elementSet.has(el.id))
              .sort((a, b) => {
                const na_i = nodeMap.get(a.node_i), na_j = nodeMap.get(a.node_j);
                const nb_i = nodeMap.get(b.node_i), nb_j = nodeMap.get(b.node_j);
                const ax = na_i && na_j ? (na_i.x + na_j.x) / 2 : 0;
                const bx = nb_i && nb_j ? (nb_i.x + nb_j.x) / 2 : 0;
                const ay = na_i && na_j ? (na_i.y + na_j.y) / 2 : 0;
                const by = nb_i && nb_j ? (nb_i.y + nb_j.y) / 2 : 0;
                return ay - by || ax - bx;
              })
              .map(el => {
              const ni = nodeMap.get(el.node_i), nj = nodeMap.get(el.node_j);
              if (!ni || !nj) return null;
              return renderEl(el, ni, nj, false, group.floorIdx);
            })}
          </group>
        );
      })}
    </group>
  );
}

// ── Supports ──────────────────────────────────────────────────

function Supports({ supports, nodes }: { supports: MockSupport[]; nodes: MockNode[] }) {
  const nodeMap = useMemo(() => new Map(nodes.map((n: MockNode) => [n.id, new THREE.Vector3(n.x, n.y, n.z)])), [nodes]);
  return (
    <group>
      {supports.map((s: MockSupport, i: number) => {
        const pos = nodeMap.get(s.node_id);
        if (!pos) return null;
        return (
          <group key={i} position={[pos.x, pos.y, pos.z]}>
            <mesh position={[0, 0, -0.05]}><boxGeometry args={[0.5, 0.5, 0.1]} /><meshStandardMaterial color="#ff4444" metalness={0.6} roughness={0.3} /></mesh>
            <mesh position={[0, 0, 0.08]}><coneGeometry args={[0.15, 0.2, 8]} /><meshStandardMaterial color="#ff6644" emissive="#ff4444" emissiveIntensity={0.2} /></mesh>
            <mesh position={[0, 0, 0]}><ringGeometry args={[0.2, 0.35, 32]} /><meshBasicMaterial color="#ff4444" transparent opacity={0.2} /></mesh>
          </group>
        );
      })}
    </group>
  );
}

// ── Load Arrows ────────────────────────────────────────────────

function LoadArrows({ arrows }: { arrows: MockArrow[] }) {
  const typeColors: Record<string, string> = { dead: '#4488ff', live: '#44ff88', wind: '#66ddff', seismic: '#ff8844' };
  const typeLabels: Record<string, string> = { dead: '恒载', live: '活载', wind: '风荷载', seismic: '地震作用' };
  const typeUnits: Record<string, string> = { dead: 'kN/m²', live: 'kN/m²', wind: 'kN/m²', seismic: 'α' };
  return (
    <group>
      {arrows.map((a: MockArrow, i: number) => {
        const dir = new THREE.Vector3(...a.direction).normalize();
        const origin = new THREE.Vector3(...a.position);
        const color = typeColors[a.type] || '#ffffff';
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const arrowLen = 3.5;
        const shaftLen = arrowLen * 0.7;
        return (
          <group key={i}>
            {/* Pulsing glow ring at origin */}
            <mesh position={origin} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.5, 1.0, 32]} />
              <meshBasicMaterial color={color} transparent opacity={0.15} side={THREE.DoubleSide} />
            </mesh>
            {/* Arrow shaft */}
            <mesh position={origin.clone().add(dir.clone().multiplyScalar(shaftLen / 2))} quaternion={quat}>
              <cylinderGeometry args={[0.08, 0.15, shaftLen, 8]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
            </mesh>
            {/* Arrow head */}
            <mesh position={origin.clone().add(dir.clone().multiplyScalar(shaftLen + 0.1))} quaternion={quat}>
              <coneGeometry args={[0.4, 0.7, 12]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
            </mesh>
            {/* Load label — Billboard keeps it facing screen */}
            <Billboard position={origin.clone().add(dir.clone().multiplyScalar(-1.0))}>
              <Text fontSize={0.55} color={color} anchorX="center" anchorY="middle" fontWeight={700}>
                {`${typeLabels[a.type]}`}
              </Text>
            </Billboard>
            <Billboard position={origin.clone().add(dir.clone().multiplyScalar(-1.8))}>
              <Text fontSize={0.38} color={color} anchorX="center" anchorY="middle" transparent opacity={0.7}>
                {`${a.magnitude} ${typeUnits[a.type]}`}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}

// ── Wind Particle Animation ────────────────────────────────────

function WindAnimation({ bbox }: { bbox: MockData['bounding_box'] }) {
  const ref = useRef<THREE.Points>(null);
  const numParticles = 2000;

  const { initPos, velocities } = useMemo(() => {
    const pos = new Float32Array(numParticles * 3);
    const vel = new Float32Array(numParticles);
    const minX = bbox.min[0] - 10;
    const rangeX = bbox.max[0] - bbox.min[0] + 28;
    for (let i = 0; i < numParticles; i++) {
      pos[i * 3] = minX + Math.random() * rangeX;
      pos[i * 3 + 1] = bbox.min[1] - 5 + Math.random() * (bbox.max[1] - bbox.min[1] + 10);
      pos[i * 3 + 2] = 0.5 + Math.random() * bbox.max[2] * 1.5;
      vel[i] = 0.4 + Math.random() * 0.6;
    }
    return { initPos: pos, velocities: vel };
  }, [bbox]);

  const velRef = useRef(velocities);
  const minX = bbox.min[0] - 10;
  const maxX = bbox.max[0] + 12;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const attr = ref.current.geometry.attributes.position;
    const arr = attr.array as Float32Array;
    const t = clock.elapsedTime;
    for (let i = 0; i < numParticles; i++) {
      arr[i * 3] += velRef.current[i] * 0.08;
      arr[i * 3 + 1] += Math.sin(t * 0.6 + i * 0.3) * 0.004;
      arr[i * 3 + 2] += Math.cos(t * 0.5 + i * 0.5) * 0.003;
      if (arr[i * 3] > maxX) {
        arr[i * 3] = minX;
        arr[i * 3 + 1] = bbox.min[1] - 5 + Math.random() * (bbox.max[1] - bbox.min[1] + 10);
        arr[i * 3 + 2] = 0.5 + Math.random() * bbox.max[2] * 1.5;
      }
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={numParticles} array={initPos} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.12} color="#66ddff" transparent opacity={0.5} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// ── Seismic Animation — underground source + spherical waves ──

function SeismicAnimation({ bbox }: { bbox: MockData['bounding_box'] }) {
  const wavesRef = useRef<THREE.Group>(null);
  const numWaves = 5;
  const cx = bbox.center[0];
  const cy = bbox.center[1];
  const sourceZ = -10; // underground source
  const maxRadius = Math.max(
    bbox.max[0] - bbox.min[0],
    bbox.max[1] - bbox.min[1],
    bbox.max[2]
  ) * 1.5;

  useFrame(({ clock }) => {
    if (!wavesRef.current) return;
    const t = clock.elapsedTime * 0.25;
    wavesRef.current.children.forEach((child, i) => {
      const phase = ((t + i * 1.0) % 3) / 3; // 0→1 per cycle
      const r = 0.5 + phase * maxRadius;
      const opacity = Math.max(0, 1 - phase * 1.3);
      child.scale.set(r, r, r);
      const mesh = child as THREE.Mesh;
      (mesh.material as THREE.MeshBasicMaterial).opacity = opacity * 0.18;
    });
  });

  return (
    <group position={[cx, cy, sourceZ]}>
      {/* Glowing source core */}
      <mesh>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshBasicMaterial color="#ff8844" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color="#ff8844" transparent opacity={0.25} />
      </mesh>
      {/* "地震源" label */}
      <Text position={[0, 0, -1.2]} fontSize={0.55} color="#ff8844" anchorX="center" anchorY="middle" fontWeight={700}>
        地震源
      </Text>
      <Text position={[0, 0, -1.9]} fontSize={0.28} color="#ff8844" anchorX="center" anchorY="middle" transparent opacity={0.5}>
        Epicenter
      </Text>
      {/* Expanding spherical shockwaves */}
      <group ref={wavesRef}>
        {Array.from({ length: numWaves }).map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 32, 24]} />
            <meshBasicMaterial color="#ff8844" transparent opacity={0.18} wireframe depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ── Deformed Model ────────────────────────────────────────────

function DeformedModel({ data, scale }: { data: MockData; scale: number }) {
  const nodeMap = useMemo(() => new Map(data.nodes.map((n: MockNode) => [n.id, new THREE.Vector3(n.x, n.y, n.z)])), [data]);
  const defMap = useMemo(() => new Map(data.deformed_nodes.map((n: MockNode) => [n.id, new THREE.Vector3(n.x, n.y, n.z)])), [data]);
  return (
    <group>
      {data.elements.map((el: MockElement) => {
        const oi = nodeMap.get(el.node_i), oj = nodeMap.get(el.node_j), di = defMap.get(el.node_i), dj = defMap.get(el.node_j);
        if (!oi || !oj || !di || !dj) return null;
        const vi = new THREE.Vector3().lerpVectors(oi, di, scale), vj = new THREE.Vector3().lerpVectors(oj, dj, scale);
        const mid = new THREE.Vector3().addVectors(vi, vj).multiplyScalar(0.5);
        const dir = new THREE.Vector3().subVectors(vj, vi); const len = dir.length();
        if (len < 0.01) return null;
        const quat = new THREE.Quaternion().setFromUnitVectors(_up, dir.clone().normalize());
        return (
          <group key={`def-${el.id}`} position={mid} quaternion={quat}>
            <mesh><boxGeometry args={[0.12, len, 0.12]} /><meshStandardMaterial color="#ff6600" transparent opacity={0.3} wireframe /></mesh>
            {scale > 0.3 && <lineSegments><edgesGeometry args={[new THREE.BoxGeometry(0.12, len, 0.12)]} /><lineBasicMaterial color="#ff8800" transparent opacity={scale * 0.3} /></lineSegments>}
          </group>
        );
      })}
    </group>
  );
}

// ── Ground ────────────────────────────────────────────────────

function Ground({ bb }: { bb: MockData['bounding_box'] }) {
  const size = Math.max(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1]) * 1.8;
  return (
    <group>
      <mesh position={[bb.center[0], bb.center[1], -0.15]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#080820" metalness={0.6} roughness={0.4} transparent opacity={0.5} />
      </mesh>
      <gridHelper args={[size, Math.floor(size / 1.5), '#00D4FF', '#444444']} rotation={[-Math.PI / 2, 0, 0]} position={[bb.center[0], bb.center[1], 0]} />
    </group>
  );
}

// ── Foundations ────────────────────────────────────────────────

function Foundations({ data, buildPhase }: { data: MockData; buildPhase: number }) {
  const groundNodes = useMemo(() => {
    return data.nodes.filter(n => Math.abs(n.z) < 0.01);
  }, [data]);

  const show = buildPhase >= 0.01;
  if (!show) return null;

  return (
    <group>
      {groundNodes.map(n => (
        <group key={`ft-${n.id}`} position={[n.x, n.y, 0]}>
          {/* 混凝土基础 */}
          <mesh position={[0, 0, -0.15]} receiveShadow>
            <boxGeometry args={[0.9, 0.9, 0.3]} />
            <meshStandardMaterial color="#787878" roughness={0.95} metalness={0.05} />
          </mesh>
          {/* 基础顶面边角倒角线 */}
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(0.9, 0.9, 0.3)]} />
            <lineBasicMaterial color="#ffffff" transparent opacity={0.08} />
          </lineSegments>
          {/* 柱底板 */}
          <mesh position={[0, 0, 0.025]}>
            <boxGeometry args={[0.52, 0.52, 0.05]} />
            <meshStandardMaterial color="#3a3a3a" metalness={0.8} roughness={0.25} />
          </mesh>
          {/* 底板边线 */}
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(0.52, 0.52, 0.05)]} />
            <lineBasicMaterial color="#64b4ff" transparent opacity={0.15} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

// ── Modal Vibration ──────────────────────────────────────────

function ModalVibration({ data }: { data: MockData }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (ref.current) { ref.current.position.z = Math.sin(clock.elapsedTime * 0.8) * 0.15; ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.4) * 0.005; } });
  return <group ref={ref}><FrameModel data={data} showColorMap={false} currentStep="analysis" buildPhase={1} animate={false} /></group>;
}

// ── Error Boundary: catch CDN load failures ────────────────

class EnvErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.warn('[ThreeCanvas] Environment CDN 加载失败，降级到 ProceduralEnv:', error.message);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ── Env with CDN-first, procedural fallback ─────────────────

function EnvWithFallback() {
  return (
    <EnvErrorBoundary fallback={<ProceduralEnv />}>
      <Suspense fallback={null}>
        <Environment preset="city" background={false} />
      </Suspense>
    </EnvErrorBoundary>
  );
}

// ── Procedural Env Map (no CDN dependency) ──────────────────

function ProceduralEnv() {
  const { scene, gl } = useThree();
  useEffect(() => {
    const envScene = new THREE.Scene();
    // gradient hemisphere-like background
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#4488cc');
    grad.addColorStop(0.5, '#223355');
    grad.addColorStop(1, '#111122');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(gl);
    const envMap = pmrem.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    scene.backgroundBlurriness = 0;
    texture.dispose();
    pmrem.dispose();
  }, [scene, gl]);
  return null;
}

// ── Lights ───────────────────────────────────────────────────

function Lights({ shadows = true }: { shadows?: boolean }) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[20, 40, 20]} intensity={2.0}
        castShadow={shadows} shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-far={80} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} />
      <directionalLight position={[-20, 10, -20]} intensity={0.5} color="#7B2FBE" />
      <hemisphereLight args={['#4444aa', '#111133', 0.4]} />
      {shadows && <pointLight position={[0, 20, 0]} intensity={0.3} color="#00D4FF" />}
    </>
  );
}

// ── View Controller: listens for preset view events ──────────

function ViewController({ controlsRef, center, boundingBox }: { controlsRef: any; center: [number, number, number]; boundingBox?: MockData['bounding_box'] }) {
  const { camera } = useThree();
  const dist = useMemo(() => {
    if (!boundingBox) return 40;
    const s = Math.max(boundingBox.max[0] - boundingBox.min[0],
                       boundingBox.max[1] - boundingBox.min[1],
                       boundingBox.max[2] - boundingBox.min[2], 1);
    return (s / 2) / Math.tan(((camera as THREE.PerspectiveCamera).fov || 40) * Math.PI / 360) / 0.6;
  }, [boundingBox, (camera as THREE.PerspectiveCamera).fov]);

  useEffect(() => {
    const handler = (e: Event) => {
      const angle = (e as CustomEvent).detail;
      const c = new THREE.Vector3(...center);
      let pos: THREE.Vector3;
      switch (angle) {
        case 'top': pos = new THREE.Vector3(c.x, c.y, c.z + dist); break;
        case 'bottom': pos = new THREE.Vector3(c.x, c.y, c.z - dist); break;
        case 'front': pos = new THREE.Vector3(c.x, c.y - dist, c.z); break;
        case 'back': pos = new THREE.Vector3(c.x, c.y + dist, c.z); break;
        case 'side': pos = new THREE.Vector3(c.x + dist, c.y, c.z); break;
        default: pos = new THREE.Vector3(c.x + dist * 0.7, c.y + dist * 0.55, c.z + dist * 0.7); break;
      }
      if (controlsRef.current) {
        controlsRef.current.target.copy(c);
        camera.position.copy(pos);
        controlsRef.current.update();
      }
    };
    window.addEventListener('caiao-set-view', handler);
    return () => window.removeEventListener('caiao-set-view', handler);
  }, [camera, controlsRef, center, dist]);
  return null;
}

// ── Camera Z-up setup ────────────────────────────────────────

function CameraSetup({ boundingBox: bb }: { boundingBox: MockData['bounding_box'] }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.up.set(0, 0, 1);

    if (bb) {
      const cx = (bb.max[0] + bb.min[0]) / 2;
      const cy = (bb.max[1] + bb.min[1]) / 2;
      const cz = (bb.max[2] + bb.min[2]) / 2;
      const center = new THREE.Vector3(cx, cy, cz);

      const sizeX = bb.max[0] - bb.min[0];
      const sizeY = bb.max[1] - bb.min[1];
      const sizeZ = bb.max[2] - bb.min[2];
      const maxDim = Math.max(sizeX, sizeY, sizeZ, 1);
      const fov = (camera as THREE.PerspectiveCamera).fov || 40;
      const dist = (maxDim / 2) / Math.tan(fov * Math.PI / 360) / 0.6;

      camera.position.set(
        cx + dist * 0.5,
        cy + dist * 0.5,
        cz + dist * 0.7
      );
      camera.lookAt(center);
    } else {
      camera.lookAt(0, 0, 0);
    }
    camera.updateProjectionMatrix();
  }, [camera, bb]);
  return null;
}

// ── Main Export ──────────────────────────────────────────────

export default function ThreeCanvas() {
  const {
    threeDData, currentStep, showColorMap, deformationScale, engineeringParams,
    displayMode, sectionPlane, explodeFactor, showGrid, showShadows, autoRotate,
    setAutoRotate,
  } = useStore();
  const [buildPhase, setBuildPhase] = useState(0);
  const controlsRef = useRef<any>(null);

  // Build animation: 楼层渐进展示 + 自动旋转
  useEffect(() => {
    if (currentStep === 'modeling') {
      setAutoRotate(true);
      setBuildPhase(0.05);
      // 进入建模时重置剖面切割（避免残留分割平面）
      useStore.getState().setSectionPlane(0);
      const steps = 28;
      let step = 0;
      const t = setInterval(() => {
        step++;
        setBuildPhase(step / steps);
        if (step >= steps) clearInterval(t);
      }, 100);
      return () => { clearInterval(t); setAutoRotate(false); };
    } else {
      setBuildPhase(1);
    }
  }, [currentStep, setAutoRotate]);

  // Generate data: prefer real data, compute from params as fallback
  const data: MockData = useMemo(() => {
    // Generate from engineering params (or defaults) as base
    const baseParams = (engineeringParams && Object.keys(engineeringParams).length > 0)
      ? engineeringParams as unknown as EngParams
      : undefined;
    const generated = baseParams ? generateModel(baseParams) : DEFAULT_DATA;

    if (threeDData) {
      const d = threeDData as any;
      return {
        nodes: d.nodes || generated.nodes,
        elements: d.elements || generated.elements,
        deformed_nodes: d.deformed_nodes || generated.deformed_nodes,
        color_map: d.color_map || generated.color_map,
        section_dimensions: d.section_dimensions || generated.section_dimensions,
        bounding_box: d.bounding_box || generated.bounding_box,
        load_arrows: d.load_arrows || generated.load_arrows,
        supports: d.supports || generated.supports,
      };
    }
    return generated;
  }, [threeDData, engineeringParams]);

  // Clipping
  const clipEnabled = sectionPlane > 0 && currentStep !== 'modeling';
  const clipPlane = useMemo(() => clipEnabled ? new THREE.Plane(new THREE.Vector3(0, 0, -1), sectionPlane * 50 - 25) : null, [clipEnabled, sectionPlane]);

  return (
    <>
      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.06}
        target={new THREE.Vector3(...data.bounding_box.center)}
        autoRotate={autoRotate} autoRotateSpeed={1.5}
        minDistance={5} maxDistance={120}
        onStart={() => { if (autoRotate) setAutoRotate(false); }} />
      <ViewController controlsRef={controlsRef} center={data.bounding_box.center} boundingBox={data.bounding_box} />
      <CameraSetup boundingBox={data.bounding_box} />

      <EnvWithFallback />
      <Lights shadows={showShadows} />
      {showGrid && <Ground bb={data.bounding_box} />}

      {/* 柱基础 + 底板 */}
      {currentStep !== 'opening' && (currentStep === 'modeling'
        ? <Foundations data={data} buildPhase={buildPhase} />
        : <Foundations data={data} buildPhase={1} />
      )}

      {/* Clipping plane */}
      {clipEnabled && clipPlane && (
        <group>
          <mesh>
            <planeGeometry args={[100, 100]} />
            <meshBasicMaterial color="#00D4FF" transparent opacity={0.04} side={THREE.DoubleSide} clippingPlanes={[clipPlane]} clipShadows />
          </mesh>
        </group>
      )}

      <group>
        {/* Explode offset */}
        <group>
          {currentStep !== 'analysis' ? (
            <FrameModel data={data} showColorMap={showColorMap} currentStep={currentStep}
              buildPhase={buildPhase} animate={currentStep === 'modeling'}
              displayMode={displayMode} explodeFactor={explodeFactor} />
          ) : (
            <>
              <ModalVibration data={data} />
              {deformationScale > 0 && <DeformedModel data={data} scale={deformationScale / 50} />}
            </>
          )}
        </group>
      </group>

      {(currentStep === 'loads' || currentStep === 'analysis' || currentStep === 'check' || currentStep === 'report' || currentStep === 'explore') &&
        <Supports supports={data.supports} nodes={data.nodes} />}
      {currentStep === 'loads' && <LoadArrows arrows={data.load_arrows} />}
      {currentStep === 'loads' && <WindAnimation bbox={data.bounding_box} />}
      {currentStep === 'loads' && <SeismicAnimation bbox={data.bounding_box} />}
    </>
  );
}
