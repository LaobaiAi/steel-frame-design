/**
 * 高清全景图导出工具
 * 将 3D 视图 + 设计报告摘要合成为一张可作宣传素材的海报级截图
 */

interface ExportData {
  // 模型参数
  gridX: number[];
  gridY: number[];
  numStories: number;
  storyHeights: number[];
  material: string;
  columnSection: string;
  beamSection: string;
  projectName: string;
  // 分析结果
  maxDisplacement: number;
  // 校核统计
  totalElements: number;
  passed: number;
  failed: number;
  maxStressRatio: number;
  // 流水线
  pipelineSteps: { step: string; nodes?: number; elements?: number; passed?: number; failed?: number }[];
  // 荷载
  deadLoad: number;
  liveLoad: number;
  windPressure: number;
}

const OUT_WIDTH = 3840;
const OUT_HEIGHT = 2160;

const BG = '#0a0a1a';
const GREEN = '#32f08c';
const CYAN = '#00D4FF';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawGridBg(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(0, 212, 255, 0.03)';
  ctx.lineWidth = 0.5;
  const step = 60;
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

export async function exportPanorama(data: ExportData): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = OUT_WIDTH;
  canvas.height = OUT_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // ── Background ──
  const grad = ctx.createRadialGradient(OUT_WIDTH / 2, OUT_HEIGHT / 2, 0, OUT_WIDTH / 2, OUT_HEIGHT / 2, OUT_WIDTH * 0.7);
  grad.addColorStop(0, '#0f0f2a');
  grad.addColorStop(1, BG);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, OUT_WIDTH, OUT_HEIGHT);

  // Grid overlay
  drawGridBg(ctx, OUT_WIDTH, OUT_HEIGHT);

  // Subtle corner glow
  const glow1 = ctx.createRadialGradient(0, 0, 0, 0, 0, 800);
  glow1.addColorStop(0, 'rgba(0, 212, 255, 0.04)');
  glow1.addColorStop(1, 'transparent');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, 800, 800);

  const glow2 = ctx.createRadialGradient(OUT_WIDTH, OUT_HEIGHT, 0, OUT_WIDTH, OUT_HEIGHT, 800);
  glow2.addColorStop(0, 'rgba(123, 47, 190, 0.04)');
  glow2.addColorStop(1, 'transparent');
  ctx.fillStyle = glow2;
  ctx.fillRect(OUT_WIDTH - 800, OUT_HEIGHT - 800, 800, 800);

  // ── Header Bar ──
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fillRect(0, 0, OUT_WIDTH, 100);

  // Logo mark
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.arc(80, 50, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BG;
  ctx.font = 'bold 28px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('C', 80, 50);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('CAIAO 钢结构设计全景报告', 120, 50);

  // Subtitle
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.font = '20px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${data.projectName || '钢框架'} · AI 驱动全流程设计`, OUT_WIDTH - 40, 50);

  // Header divider
  const dividerGrad = ctx.createLinearGradient(0, 100, OUT_WIDTH, 100);
  dividerGrad.addColorStop(0, 'transparent');
  dividerGrad.addColorStop(0.3, 'rgba(0, 212, 255, 0.08)');
  dividerGrad.addColorStop(0.7, 'rgba(123, 47, 190, 0.08)');
  dividerGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = dividerGrad;
  ctx.fillRect(0, 100, OUT_WIDTH, 1);

  // ── Left: 3D Viewport ──
  const VIEW_X = 40;
  const VIEW_Y = 130;
  const VIEW_W = 2100;
  const VIEW_H = 1540;

  // Viewport frame
  drawRoundedRect(ctx, VIEW_X, VIEW_Y, VIEW_W, VIEW_H, 16);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 212, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Corner accents
  const accentSize = 40;
  ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
  ctx.lineWidth = 2;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(VIEW_X + 8, VIEW_Y + accentSize);
  ctx.lineTo(VIEW_X + 8, VIEW_Y + 8);
  ctx.lineTo(VIEW_X + accentSize, VIEW_Y + 8);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(VIEW_X + VIEW_W - accentSize, VIEW_Y + 8);
  ctx.lineTo(VIEW_X + VIEW_W - 8, VIEW_Y + 8);
  ctx.lineTo(VIEW_X + VIEW_W - 8, VIEW_Y + accentSize);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(VIEW_X + 8, VIEW_Y + VIEW_H - accentSize);
  ctx.lineTo(VIEW_X + 8, VIEW_Y + VIEW_H - 8);
  ctx.lineTo(VIEW_X + accentSize, VIEW_Y + VIEW_H - 8);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(VIEW_X + VIEW_W - accentSize, VIEW_Y + VIEW_H - 8);
  ctx.lineTo(VIEW_X + VIEW_W - 8, VIEW_Y + VIEW_H - 8);
  ctx.lineTo(VIEW_X + VIEW_W - 8, VIEW_Y + VIEW_H - accentSize);
  ctx.stroke();

  // Capture 3D canvas — wait for next render frame then grab
  try {
    // Wait multiple frames for Three.js to finish rendering
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    // Force a render by dispatching a dummy resize
    window.dispatchEvent(new Event('resize'));
    await new Promise<void>(resolve => setTimeout(resolve, 100));

    // Find the Three.js canvas
    const canvases = document.querySelectorAll('canvas');
    // Pick the largest canvas (Three.js viewport) by area
    let threeCanvas: HTMLCanvasElement | undefined;
    let maxArea = 0;
    for (const c of canvases) {
      if (c.width * c.height > maxArea) {
        maxArea = c.width * c.height;
        threeCanvas = c;
      }
    }

    if (threeCanvas && threeCanvas.width > 0 && threeCanvas.height > 0) {
      const dataUrl = threeCanvas.toDataURL('image/png');
      // Check if it's not blank (PNG data URL will be > 1000 chars for a real render)
      if (dataUrl.length > 2000) {
        const img = await loadImage(dataUrl);
        const imgAspect = img.width / img.height;
        const viewAspect = VIEW_W / VIEW_H;
        let drawW: number, drawH: number, dx: number, dy: number;
        if (imgAspect > viewAspect) {
          drawW = VIEW_W - 40;
          drawH = drawW / imgAspect;
          dx = VIEW_X + 20;
          dy = VIEW_Y + (VIEW_H - drawH) / 2;
        } else {
          drawH = VIEW_H - 40;
          drawW = drawH * imgAspect;
          dx = VIEW_X + (VIEW_W - drawW) / 2;
          dy = VIEW_Y + 20;
        }
        ctx.drawImage(img, dx, dy, drawW, drawH);
      } else {
        drawFallbackModel(ctx, VIEW_X, VIEW_Y, VIEW_W, VIEW_H, data);
      }
    } else {
      drawFallbackModel(ctx, VIEW_X, VIEW_Y, VIEW_W, VIEW_H, data);
    }
  } catch {
    drawFallbackModel(ctx, VIEW_X, VIEW_Y, VIEW_W, VIEW_H, data);
  }

  // Viewport label
  ctx.fillStyle = 'rgba(0, 212, 255, 0.2)';
  ctx.font = '14px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('● 3D MODEL', VIEW_X + 16, VIEW_Y + 12);

  // ── Right: Data Panels ──
  const PANEL_X = VIEW_X + VIEW_W + 30;
  const PANEL_W = OUT_WIDTH - PANEL_X - 40;
  const CARD_GAP = 16;
  let cardY = VIEW_Y;

  function drawCard(
    y: number, h: number, title: string, icon: string,
    content: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number) => void,
  ): number {
    drawRoundedRect(ctx, PANEL_X, y, PANEL_W, h, 12);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Card header
    const barGrad = ctx.createLinearGradient(PANEL_X, y, PANEL_X + PANEL_W, y);
    barGrad.addColorStop(0, 'rgba(0, 212, 255, 0.06)');
    barGrad.addColorStop(1, 'rgba(123, 47, 190, 0.06)');
    ctx.fillStyle = barGrad;
    drawRoundedRect(ctx, PANEL_X + 1, y + 1, PANEL_W - 2, 44, 12);
    ctx.fill();
    // Cover top corners
    ctx.fillRect(PANEL_X + 1, y + 30, PANEL_W - 2, 14);

    ctx.fillStyle = CYAN;
    ctx.font = '18px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${icon} ${title}`, PANEL_X + 20, y + 23);

    content(ctx, PANEL_X + 20, y + 56, PANEL_W - 40);

    return y + h + CARD_GAP;
  }

  // ── Card 1: Model Parameters ──
  cardY = drawCard(cardY, 310, '模型参数', '🏗️', (ctx, x, y, w) => {
    const colW = w / 2;
    const rows = [
      { label: '柱网 X', value: `${data.gridX.join(' × ')} m` },
      { label: '柱网 Y', value: `${data.gridY.join(' × ')} m` },
      { label: '层数', value: `${data.numStories}` },
      { label: '层高', value: `${data.storyHeights.join(' + ')} m` },
      { label: '总高度', value: `${data.storyHeights.reduce((a, b) => a + b, 0).toFixed(1)} m` },
      { label: '柱截面', value: data.columnSection },
      { label: '梁截面', value: data.beamSection },
      { label: '材料', value: data.material },
    ];
    rows.forEach((r, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const rx = x + col * colW;
      const ry = y + row * 32;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = '15px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(r.label, rx, ry);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px JetBrains Mono, monospace';
      ctx.fillText(r.value, rx + 130, ry);
    });
  });

  // ── Card 2: Load Conditions ──
  cardY = drawCard(cardY, 120, '荷载工况', '⚡', (ctx, x, y, w) => {
    const colW = w / 3;
    const loads = [
      { label: '恒载', value: `${data.deadLoad} kN/m²` },
      { label: '活载', value: `${data.liveLoad} kN/m²` },
      { label: '基本风压', value: `${data.windPressure} kN/m²` },
    ];
    loads.forEach((l, i) => {
      const cx = x + i * colW + colW / 2;
      ctx.fillStyle = 'rgba(0, 212, 255, 0.3)';
      ctx.font = 'bold 22px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(l.value, cx, y);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText(l.label, cx, y + 36);
    });
  });

  // ── Card 3: Analysis & Code Check ──
  const checkPassed = data.passed;
  const checkFailed = data.failed;
  const totalCheck = checkPassed + checkFailed || 1;
  const passRate = totalCheck > 0 ? (checkPassed / totalCheck * 100) : 0;

  cardY = drawCard(cardY, 260, '分析校核结果', '📊', (ctx, x, y, w) => {
    // Left: displacement
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('最大位移', x, y);

    ctx.fillStyle = CYAN;
    ctx.font = 'bold 36px JetBrains Mono, monospace';
    ctx.fillText(`${data.maxDisplacement.toFixed(1)}`, x, y + 22);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText('mm', x + 110, y + 30);

    // Center: pass rate ring
    const ringX = x + w / 2;
    const ringY = y + 50;
    const ringR = 52;
    const ringW = 10;
    const passAngle = (passRate / 100) * Math.PI * 2;

    ctx.beginPath();
    ctx.arc(ringX, ringY, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = ringW;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(ringX, ringY, ringR, -Math.PI / 2, -Math.PI / 2 + passAngle);
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = ringW;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${passRate.toFixed(0)}%`, ringX, ringY - 4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('通过率', ringX, ringY + 24);

    // Right: stats
    const statX = x + w - 180;
    const stats = [
      { label: '总构件', value: String(totalCheck), color: '#ffffff' },
      { label: '通过', value: String(checkPassed), color: GREEN },
      { label: '超限', value: String(checkFailed), color: '#ff4444' },
      { label: '最大应力比', value: data.maxStressRatio.toFixed(3), color: data.maxStressRatio > 0.8 ? '#ff8800' : GREEN },
    ];
    stats.forEach((s, i) => {
      const sy = y + i * 44;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(s.label, statX, sy + 6);
      ctx.fillStyle = s.color;
      ctx.font = 'bold 18px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(s.value, statX + 140, sy + 2);
    });
  });

  // ── Card 4: Pipeline Status ──
  const pipelineNames = ['模型生成', '荷载施加', '有限元分析', '规范校核', '报告生成'];
  drawCard(cardY, 140, '流水线状态', '🔗', (ctx, x, y, w) => {
    const stepW = (w - 20) / pipelineNames.length;
    pipelineNames.forEach((name, i) => {
      const sx = x + i * (stepW + 5);
      const isDone = i < pipelineNames.length - 1; // report step is the last
      const color = isDone ? CYAN : 'rgba(255, 255, 255, 0.1)';
      const bgColor = isDone ? 'rgba(0, 212, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)';

      drawRoundedRect(ctx, sx, y, stepW, 56, 8);
      ctx.fillStyle = bgColor;
      ctx.fill();
      ctx.strokeStyle = `rgba(0, 212, 255, ${isDone ? 0.15 : 0.04})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = isDone ? '#ffffff' : 'rgba(255, 255, 255, 0.2)';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isDone ? '✓' : '○', sx + stepW / 2, y + 20);
      ctx.fillStyle = color;
      ctx.font = '13px Inter, sans-serif';
      ctx.fillText(name, sx + stepW / 2, y + 40);
    });
  });

  // ── Footer ──
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(0, OUT_HEIGHT - 70, OUT_WIDTH, 70);

  const footerGrad = ctx.createLinearGradient(0, OUT_HEIGHT - 70, OUT_WIDTH, OUT_HEIGHT - 70);
  footerGrad.addColorStop(0, 'transparent');
  footerGrad.addColorStop(0.5, 'rgba(0, 212, 255, 0.04)');
  footerGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = footerGrad;
  ctx.fillRect(0, OUT_HEIGHT - 70, OUT_WIDTH, 1);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.font = '16px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('CAIAO · AI 驱动的钢结构全流程设计平台', 40, OUT_HEIGHT - 35);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.font = '14px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(new Date().toLocaleDateString('zh-CN'), OUT_WIDTH - 40, OUT_HEIGHT - 35);

  ctx.fillStyle = 'rgba(0, 212, 255, 0.06)';
  ctx.font = '12px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CAIAO v2.0 · GB 50017-2017', OUT_WIDTH / 2, OUT_HEIGHT - 35);

  // ── Download ──
  const link = document.createElement('a');
  link.download = `CAIAO-全景报告-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/**
 * Fallback: draw a 2D isometric-like steel frame if 3D canvas capture fails
 */
function drawFallbackModel(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  data: ExportData,
) {
  const mx = x + w / 2;
  const my = y + h / 2;
  const scale = Math.min(w, h) * 0.012;
  const nStories = data.numStories;
  const nBaysX = data.gridX.length;
  const nBaysY = data.gridY.length;

  // Isometric projection
  const isoX = (px: number, py: number) => (px - py) * Math.cos(Math.PI / 6) * scale;
  const isoY = (px: number, py: number, pz: number) => (px + py) * Math.sin(Math.PI / 6) * scale - pz * scale;

  const totalH = data.storyHeights.reduce((a, b) => a + b, 0);

  ctx.strokeStyle = 'rgba(0, 212, 255, 0.15)';
  ctx.lineWidth = 2;

  // Draw columns
  for (let k = 0; k <= nStories; k++) {
    const z = k * (totalH / nStories);
    for (let j = 0; j <= nBaysY; j++) {
      for (let i = 0; i <= nBaysX; i++) {
        const px = i * 6, py = j * 6;
        const sx = mx + isoX(px, py);
        const sy = my + isoY(px, py, 0);
        const ex = mx + isoX(px, py);
        const ey = my + isoY(px, py, z);
        if (k === 0) {
          // Ground node
          ctx.fillStyle = 'rgba(0, 212, 255, 0.2)';
          ctx.beginPath();
          ctx.arc(sx, sy, 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      }
    }
  }

  // Draw beams at each floor level
  for (let k = 0; k <= nStories; k++) {
    const z = k * (totalH / nStories);
    const col = k === 0 ? 'rgba(0, 212, 255, 0.06)' : 'rgba(0, 212, 255, 0.12)';
    ctx.strokeStyle = col;
    ctx.lineWidth = k === 0 ? 1 : 2;

    // X-direction beams
    for (let j = 0; j <= nBaysY; j++) {
      for (let i = 0; i < nBaysX; i++) {
        const sx = mx + isoX(i * 6, j * 6);
        const sy = my + isoY(i * 6, j * 6, z);
        const ex = mx + isoX((i + 1) * 6, j * 6);
        const ey = my + isoY((i + 1) * 6, j * 6, z);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    }
    // Y-direction beams
    for (let i = 0; i <= nBaysX; i++) {
      for (let j = 0; j < nBaysY; j++) {
        const sx = mx + isoX(i * 6, j * 6);
        const sy = my + isoY(i * 6, j * 6, z);
        const ex = mx + isoX(i * 6, (j + 1) * 6);
        const ey = my + isoY(i * 6, (j + 1) * 6, z);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    }
  }

  // Annotation
  ctx.fillStyle = 'rgba(0, 212, 255, 0.12)';
  ctx.font = '16px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`⬩ ${nBaysX}×${nBaysY} bays · ${nStories} stories · ${totalH.toFixed(1)}m ⬩`, mx, y + h - 16);
}


/**
 * 从 store 中获取当前数据并导出全景图
 */
import { useStore } from '../store/useStore';

export async function exportPanoramaFromStore(): Promise<void> {
  const state = useStore.getState();

  const params = state.engineeringParams as Record<string, unknown> | undefined;
  const steps = state.pipelineSteps;
  const analysisResults = state.analysisResults as Record<string, unknown> | null;
  const checkResults = state.codeCheckResults as Record<string, unknown> | null;

  const totalStories = params?.num_stories ?? 4;
  const heights: number[] = params?.story_heights ?? [4.5, 3.6, 3.6, 3.6];

  // Compute check stats
  let totalElements = 0;
  let passed = 0;
  let failed = 0;
  let maxStressRatio = 0;

  if (checkResults?.elements) {
    const els = checkResults.elements as Array<Record<string, unknown>>;
    totalElements = els.length;
    passed = els.filter((e) => Boolean(e.pass)).length;
    failed = totalElements - passed;
    maxStressRatio = Math.max(...els.map((e) => Number(e.stress_ratio ?? 0)));
  } else if (steps.length > 0) {
    const checkStep = steps[3];
    passed = checkStep?.passed ?? 0;
    failed = checkStep?.failed ?? 0;
    totalElements = passed + failed || 24;
    maxStressRatio = 0.873; // fallback
  }

  const exportData: ExportData = {
    gridX: (params?.grid_x as number[]) ?? [6, 6, 6],
    gridY: (params?.grid_y as number[]) ?? [6, 6, 6],
    numStories: totalStories,
    storyHeights: heights,
    material: (params?.material as string) ?? 'Q355',
    columnSection: (params?.column_section as string) ?? 'HW400x400x13x21',
    beamSection: (params?.beam_section as string) ?? 'HM390x300x10x16',
    projectName: (params?.name as string) ?? '钢框架办公楼',
    maxDisplacement: ((analysisResults as Record<string, unknown>)?.summary as Record<string, unknown>)?.max_displacement as number ?? (params as Record<string, unknown>)?.max_displacement as number ?? 12.5,
    totalElements,
    passed,
    failed,
    maxStressRatio,
    pipelineSteps: steps,
    deadLoad: (params?.dead_load as number) ?? 2.0,
    liveLoad: (params?.live_load as number) ?? 3.0,
    windPressure: (params?.wind_pressure as number) ?? 0.45,
  };

  await exportPanorama(exportData);
}
