/**
 * 模拟数据生成工具 — 自动演示和离线回退时使用
 *
 * 与后端 steel_code_check._generate_calc_processes 逻辑保持一致，
 * 确保自动演示模式下展示的计算步骤与真实后端输出格式兼容。
 */
import type { CodeCheckElement, CalcProcess, CalcStep } from '../types';

// ── 计算过程生成（后端 steel_code_check 的 TypeScript 等价实现）───

export function generateCalcProcesses(
  el: Pick<CodeCheckElement, 'type' | 'section' | 'stress_ratio' | 'stability_ratio' | 'deflection_ratio' | 'slenderness_ratio' | 'story'>,
): CalcProcess[] {
  const isColumn = el.type === 'column';
  const f = 305; // Q355
  const sr = el.stress_ratio;
  const limit = 1.0;

  const A = isColumn ? 218.7 : 133.2;
  const Wx = isColumn ? 3330 : 2000;
  const ix = isColumn ? 17.4 : 17.1;
  const iy = isColumn ? 10.1 : 7.36;
  const length = isColumn ? (el.story === 1 ? 4.5 : 3.6) : 6.0;

  const totalStress = sr * f;
  const l0 = length * 100;

  // ── 强度验算 ──
  let strengthSteps: CalcStep[];
  let strengthResultLine: string;
  if (isColumn) {
    const axialPart = totalStress * 0.55;
    const bendPart = totalStress * 0.45;
    const N = +(axialPart * A / 10).toFixed(1);
    const Mx = +(bendPart * 1.05 * Wx / 1000).toFixed(1);
    const sigmaN = +(N * 10 / A).toFixed(2);
    const sigmaM = +(Mx * 1000 / (1.05 * Wx)).toFixed(2);
    strengthSteps = [
      { label: '轴力 N', value: `${N} kN` },
      { label: '弯矩 Mx', value: `${Mx} kN·m` },
      { label: '截面积 A', value: `${A} cm²` },
      { label: '截面模量 Wx', value: `${Wx} cm³` },
      { label: '塑性发展系数 γx', value: '1.05' },
      { label: 'σ = N/A + Mx/(γx·Wx)', value: `${sigmaN} + ${sigmaM} = ${(sigmaN + sigmaM).toFixed(2)} MPa` },
      { label: '强度设计值 f', value: `${f} MPa` },
    ];
    strengthResultLine = `应力比 = ${(sigmaN + sigmaM).toFixed(2)}/${f} = ${sr.toFixed(4)}`;
  } else {
    const Mx = +(totalStress * 1.05 * Wx / 1000).toFixed(1);
    const sigma = +(Mx * 1000 / (1.05 * Wx)).toFixed(2);
    strengthSteps = [
      { label: '弯矩 Mx', value: `${Mx} kN·m` },
      { label: '截面模量 Wx', value: `${Wx} cm³` },
      { label: '塑性发展系数 γx', value: '1.05' },
      { label: 'σ = Mx/(γx·Wx)', value: `${sigma} MPa` },
      { label: '强度设计值 f', value: `${f} MPa` },
    ];
    strengthResultLine = `应力比 = ${sigma.toFixed(2)}/${f} = ${sr.toFixed(4)}`;
  }

  // ── 稳定验算 ──
  let stabilitySteps: CalcStep[];
  let stabilityResultLine: string;
  const lambda = +(l0 / ix).toFixed(1);
  const phi = +(0.986 - 0.0016 * lambda).toFixed(4);
  const NEx = +((3.1416 ** 2 * 206000 * A * 100) / (1.1 * lambda ** 2) / 1000).toFixed(0);
  if (isColumn) {
    const N = +(totalStress * 0.55 * A / 10).toFixed(1);
    const Mx = +(totalStress * 0.45 * 1.05 * Wx / 1000).toFixed(1);
    const phiA = +(N * 10 / (phi * A)).toFixed(2);
    const betaMx = 1.0;
    const denom = 1 - 0.8 * N / NEx;
    const mxTerm = +(betaMx * Mx * 1000 / (1.05 * Wx * denom)).toFixed(2);
    stabilitySteps = [
      { label: '计算长度 l₀', value: `${l0.toFixed(0)} cm` },
      { label: '回转半径 ix', value: `${ix} cm` },
      { label: '长细比 λ = l₀/ix', value: `${lambda}` },
      { label: '稳定系数 φ (b类)', value: `${phi}` },
      { label: 'N/(φ·A)', value: `${phiA} MPa` },
      { label: "欧拉力 NEx' = π²EA/(1.1λ²)", value: `${NEx} kN` },
      { label: '等效弯矩系数 βmx', value: `${betaMx}` },
      { label: "βmx·Mx/(γx·Wx·(1-0.8N/NEx'))", value: `${mxTerm} MPa` },
      { label: "σ = N/(φ·A) + βmx·Mx/(γx·Wx·(1-0.8N/NEx'))", value: `${(phiA + mxTerm).toFixed(2)} MPa` },
      { label: '强度设计值 f', value: `${f} MPa` },
    ];
    stabilityResultLine = `稳定比 = ${(phiA + mxTerm).toFixed(2)}/${f} = ${el.stability_ratio.toFixed(4)}`;
  } else {
    const phiB = +(0.76 + 0.24 * (iy / ix)).toFixed(4);
    stabilitySteps = [
      { label: '整体稳定系数 φb', value: `${phiB}` },
      { label: 'σ = Mx/(φb·Wx)', value: `${(totalStress / phiB).toFixed(2)} MPa` },
      { label: '强度设计值 f', value: `${f} MPa` },
    ];
    stabilityResultLine = `稳定比 = ${(totalStress / phiB).toFixed(2)}/${f} = ${el.stability_ratio.toFixed(4)}`;
  }

  // ── 挠度验算 ──
  const span = length * 1000;
  const allowDefl = +(span / 250).toFixed(1);
  const maxDefl = +(allowDefl * el.deflection_ratio).toFixed(1);
  const deflectionSteps: CalcStep[] = [
    { label: '计算跨度 L', value: `${span} mm` },
    { label: '最大挠度 δ (弹性分析)', value: `${maxDefl} mm` },
    { label: '容许挠度 [δ] = L/250', value: `${allowDefl} mm` },
  ];
  const deflectionResultLine = `挠度比 = ${maxDefl}/${allowDefl} = ${el.deflection_ratio.toFixed(4)}`;

  // ── 长细比验算 ──
  const slendernessLimit = isColumn ? 120 : 150;
  const slendernessSteps: CalcStep[] = [
    { label: '计算长度 l₀', value: `${l0.toFixed(0)} cm` },
    { label: '回转半径 i_min', value: `${iy} cm` },
    { label: '长细比 λ = l₀/i', value: `${el.slenderness_ratio.toFixed(1)}` },
    { label: '容许长细比 [λ]', value: `${slendernessLimit}` },
  ];
  const slendernessResultLine = `λ/[λ] = ${(el.slenderness_ratio / slendernessLimit).toFixed(4)}`;

  return [
    { title: '强度验算', steps: strengthSteps, resultLine: strengthResultLine, passed: sr <= limit },
    { title: '稳定验算', steps: stabilitySteps, resultLine: stabilityResultLine, passed: el.stability_ratio <= limit },
    { title: '挠度验算', steps: deflectionSteps, resultLine: deflectionResultLine, passed: el.deflection_ratio <= limit },
    { title: '长细比验算', steps: slendernessSteps, resultLine: slendernessResultLine, passed: el.slenderness_ratio <= slendernessLimit },
  ];
}

// ── 完整 mock 构件列表生成 ─────────────────────────────────────────

export function generateMockElements(): CodeCheckElement[] {
  const sections = ['HW400x400x13x21', 'HM390x300x10x16'];
  const els: CodeCheckElement[] = [];
  let id = 1;
  for (let story = 1; story <= 4; story++) {
    for (let c = 0; c < 16; c++) {
      const r = 0.15 + Math.random() * 0.85;
      const el: CodeCheckElement = {
        id: id++, type: 'column', section: sections[0], story,
        node_i: id * 2, node_j: id * 2 + 1,
        stress_ratio: +r.toFixed(4),
        stability_ratio: +(r * 0.85).toFixed(4),
        deflection_ratio: +(r * 0.3).toFixed(4),
        slenderness_ratio: +(Math.random() * 120).toFixed(1),
        pass: r <= 1.0,
      };
      el.calcProcesses = generateCalcProcesses(el);
      els.push(el);
    }
    for (let b = 0; b < 24; b++) {
      const r = 0.2 + Math.random() * 0.85;
      const el: CodeCheckElement = {
        id: id++, type: 'beam', section: sections[1], story,
        node_i: id * 2, node_j: id * 2 + 1,
        stress_ratio: +r.toFixed(4),
        stability_ratio: +(r * 0.82).toFixed(4),
        deflection_ratio: +(r * 0.45).toFixed(4),
        slenderness_ratio: +(Math.random() * 100).toFixed(1),
        pass: r <= 1.0,
      };
      el.calcProcesses = generateCalcProcesses(el);
      els.push(el);
    }
  }
  return els;
}

// 懒初始化 mock 数据（仅首次引用时生成，避免重复构造）
let _mockElementsCache: CodeCheckElement[] | null = null;
export function getMockElements(): CodeCheckElement[] {
  if (!_mockElementsCache) {
    _mockElementsCache = generateMockElements();
  }
  return _mockElementsCache;
}

// ── 自动演示模式 mock 结果生成 ───────────────────────────────────

export function computeMockStats(params: { grid_x: number[]; grid_y: number[]; num_stories: number }) {
  const nx = params.grid_x.length;
  const ny = params.grid_y.length;
  const nz = params.num_stories;
  const nCol = (nx + 1) * (ny + 1);
  const totalNodes = nCol * (nz + 1);
  const totalCols = nCol * nz;
  const totalBeams = nz * ((ny + 1) * nx + (nx + 1) * ny);
  const totalElements = totalCols + totalBeams;
  const failed = Math.max(1, Math.round(totalElements * 0.1));
  const passed = totalElements - failed;
  return { totalNodes, totalElements, totalCols, totalBeams, failed, passed };
}
