import React, { useRef, useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import XuanwuLanding from './components/XuanwuLanding';
import InputPanel from './components/InputPanel';
import ThreeCanvas from './components/ThreeCanvas';
import ResultsPanel from './components/ResultsPanel';
import ReportPreview from './components/ReportPreview';
import SceneToolbar, { ViewCube } from './components/SceneToolbar';
import DockPanel from './components/DockPanel';
import { Canvas } from '@react-three/fiber';
import { Maximize2, RefreshCw, Info, Image, Loader, Weight, Wind, Gauge, XCircle, ChevronRight, LayoutGrid, Save, X } from 'lucide-react';
import { exportPanoramaFromStore } from './utils/exportPanorama';
import { api } from './api/client';
import type { StepType } from './store/useStore';
import type { RunPipelineParams } from './types';

// ── Step Indicator ──────────────────────────────────────────────

function StepIndicator() {
  const { currentStep, setStep } = useStore();
  const steps: { key: StepType; label: string }[] = [
    { key: 'input', label: '需求输入' }, { key: 'modeling', label: '模型生成' },
    { key: 'loads', label: '荷载施加' }, { key: 'analysis', label: '有限元分析' },
    { key: 'check', label: '规范校核' }, { key: 'report', label: '报告生成' },
  ];
  const currentIdx = steps.findIndex(s => s.key === currentStep);
  if (currentStep === 'opening' || currentStep === 'explore') return null;
  return (
    <div className="glass-strong rounded-full px-5 py-2 flex items-center gap-1 shadow-2xl">
      {steps.map((s, i) => {
        const isActive = i === currentIdx, isPast = i < currentIdx;
        return (
          <button key={s.key} onClick={() => isPast && setStep(s.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${isActive ? 'bg-cyan/20 text-cyan glow-cyan' : isPast ? 'text-cyan/60 cursor-pointer hover:bg-cyan/10' : 'text-gray-500'}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${isActive ? 'bg-cyan text-black' : isPast ? 'bg-cyan/30 text-cyan' : 'bg-gray-700 text-gray-400'}`}>{isPast ? '✓' : i + 1}</span>
            {s.label}{i < steps.length - 1 && <span className="text-gray-600 mx-0.5">→</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Panel Definitions ──────────────────────────────────────────

const PANEL_DEFS: { id: string; label: string; steps: string[] }[] = [
  { id: 'context', label: '信息面板', steps: ['modeling', 'loads', 'analysis', 'check'] },
  { id: 'toolbar', label: '场景控制', steps: ['modeling', 'loads', 'analysis', 'check'] },
  { id: 'controls', label: '变形控制', steps: ['analysis'] },
  { id: 'results', label: '校核结果', steps: ['check'] },
  { id: 'report', label: '报告', steps: ['report'] },
];

// ── Panel Menu (compact dropdown: manage panels + export) ───────────

function PanelMenu({ onExportPanorama, exporting }: { onExportPanorama: () => void; exporting: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { currentStep, dockPanels, collapsedDocked, dockPanel, undockPanel, setCollapsedDocked } = useStore();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [open]);

  if (!isPipelineStep(currentStep)) return null;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className={`p-2 rounded-full transition-all ${open ? 'bg-cyan/15 text-cyan' : 'text-gray-500 hover:bg-white/10'}`}
        title="面板管理">
        <LayoutGrid size={14} />
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-48 py-1 glass-strong rounded-xl shadow-2xl border border-white/10 overflow-hidden z-50">
          {PANEL_DEFS.map(p => {
            const isVisible = p.steps.includes(currentStep);
            const isDockedL = dockPanels.left.includes(p.id);
            const isDockedR = dockPanels.right.includes(p.id);
            const isDocked = isDockedL || isDockedR;
            const isCollapsed = collapsedDocked[p.id];
            let dotColor: string, actionLabel: string, onAction: () => void;
            if (isDocked && isCollapsed) {
              dotColor = 'bg-amber-400'; actionLabel = '展开';
              onAction = () => setCollapsedDocked(p.id, false);
            } else if (isDocked) {
              dotColor = 'bg-cyan-400'; actionLabel = '浮动';
              onAction = () => undockPanel(p.id);
            } else {
              dotColor = 'bg-gray-500'; actionLabel = '吸附';
              onAction = () => { dockPanel(p.id, 'left'); setCollapsedDocked(p.id, false); };
            }
            return (
              <div key={p.id}
                className={`flex items-center justify-between px-3 py-1.5 ${isVisible ? 'hover:bg-white/5' : 'opacity-35'}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                  <span className={`text-[10px] ${isVisible ? 'text-gray-300' : 'text-gray-600'}`}>{p.label}</span>
                </div>
                <button onClick={onAction}
                  className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500 hover:text-cyan hover:bg-cyan/10 transition-all">
                  {actionLabel}
                </button>
              </div>
            );
          })}
          <div className="h-px bg-white/5 mx-2 my-1" />
          <div className="px-2 pb-1 flex gap-1">
            <button onClick={() => PANEL_DEFS.forEach(p => {
              if (!dockPanels.left.includes(p.id) && !dockPanels.right.includes(p.id)) { dockPanel(p.id, 'left'); setCollapsedDocked(p.id, true); }
            })}
              className="flex-1 text-[8px] py-1 rounded bg-white/5 text-gray-600 hover:text-gray-400 transition-colors text-center">
              全部折叠
            </button>
            <button onClick={onExportPanorama} disabled={exporting}
              className="flex items-center justify-center gap-1 flex-1 text-[8px] py-1 rounded bg-white/5 text-gray-600 hover:text-cyan hover:bg-cyan/10 transition-all disabled:opacity-50">
              {exporting ? <Loader size={8} className="animate-spin" /> : <Image size={8} />}
              全景图
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function exportCalcDetailTxt() {
  const state = useStore.getState();
  const params = state.engineeringParams as Record<string, unknown>;
  const analysis = state.analysisResults as Record<string, unknown> | null;
  const check = state.codeCheckResults as Record<string, unknown> | null;

  const lines: string[] = [];
  const pad = (s: string) => `  ${s}`;

  lines.push('='.repeat(48));
  lines.push('  钢框架结构计算详情');
  lines.push('='.repeat(48));
  lines.push('');

  lines.push('【基本信息】');
  lines.push(pad(`项目名称: ${params?.name || '未命名'}`));
  lines.push(pad(`柱网 X: ${(params?.grid_x as number[])?.join(', ') || '-'}`));
  lines.push(pad(`柱网 Y: ${(params?.grid_y as number[])?.join(', ') || '-'}`));
  lines.push(pad(`层数: ${params?.num_stories ?? '-'}`));
  lines.push(pad(`层高: ${(params?.story_heights as number[])?.join(', ') || '-'} m`));
  lines.push(pad(`总高: ${(params?.story_heights as number[])?.reduce((a: number, b: number) => a + b, 0).toFixed(1) || '-'} m`));
  lines.push(pad(`柱截面: ${params?.column_section || '-'}`));
  lines.push(pad(`梁截面: ${params?.beam_section || '-'}`));
  lines.push(pad(`材料: ${params?.material || '-'}`));
  lines.push('');

  lines.push('【荷载配置】');
  lines.push(pad(`恒载: ${params?.dead_load ?? 2.0} kN/m²`));
  lines.push(pad(`活载: ${params?.live_load ?? 3.0} kN/m²`));
  lines.push(pad(`基本风压: ${params?.wind_pressure ?? 0.45} kN/m²`));
  lines.push(pad(`地震影响系数: ${params?.seismic_intensity ?? 0.08}`));
  lines.push('');

  lines.push('【分析结果】');
  if (analysis) {
    const maxDisp = analysis.summary?.max_displacement;
    const lc = analysis.load_case || '-';
    if (maxDisp !== undefined) lines.push(pad(`最大位移: ${maxDisp} mm (工况: ${lc})`));
    lines.push(pad(`求解器: ${analysis.engine || 'OpenSees'}`));
  } else {
    lines.push(pad('暂无分析数据'));
  }
  lines.push('');

  lines.push('【规范校核】');
  if (check) {
    const s = check.summary || {};
    const elements: Array<Record<string, unknown>> = (check.elements as Array<Record<string, unknown>>) || [];
    // 与 ResultsPanel 一致的统计口径：按应力比阈值分组
    const safeLimit = 0.8, criticalLimit = 1.0;
    // 取应力比、稳定比、挠度比、长细比的最大值作为综合判定
    const maxRatio = (el: Record<string, unknown>) => Math.max(
      Number(el.stress_ratio ?? 0),
      Number(el.stability_ratio ?? 0),
      Number(el.deflection_ratio ?? 0),
      Number(el.slenderness_ratio ?? 0) / 150,
    );
    const total = elements.length;
    const safe = elements.filter((e) => maxRatio(e) <= safeLimit).length;
    const warning = elements.filter((e) => maxRatio(e) > safeLimit && maxRatio(e) <= criticalLimit).length;
    const critical = elements.filter((e) => maxRatio(e) > criticalLimit).length;
    lines.push(pad(`构件总数: ${total}`));
    lines.push(pad(`安全 (≤${safeLimit}): ${safe}`));
    lines.push(pad(`警告 (${safeLimit}~${criticalLimit}): ${warning}`));
    lines.push(pad(`超限 (>${criticalLimit}): ${critical}`));
    lines.push(pad(`综合通过: ${s.passed ?? 0}`));
    lines.push(pad(`综合失败: ${s.failed ?? 0}`));
    lines.push(pad(`最大应力比: ${s.max_stress_ratio ?? '-'}`));
    lines.push(pad(`最大挠度比: ${s.max_deflection_ratio ?? '-'}`));
    if (elements.length > 0) {
      lines.push('');
      lines.push(pad('--- 构件校核明细 ---'));
      elements.forEach((el) => {
        const maxR = maxRatio(el);
        let status: string, statusColor: string;
        if (maxR > criticalLimit) { status = '超限'; statusColor = '✗'; }
        else if (maxR > safeLimit) { status = '警告'; statusColor = '△'; }
        else { status = '安全'; statusColor = '✓'; }
        lines.push(pad(`构件 #${el.id} (${el.type}) 楼层${el.story} 应力比:${el.stress_ratio ?? '-'} 稳定比:${el.stability_ratio ?? '-'} 挠度比:${el.deflection_ratio ?? '-'} 长细比:${el.slenderness_ratio ?? '-'} → ${statusColor} ${status}`));
      });
    }
  } else {
    lines.push(pad('暂无校核数据'));
  }

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `计算详情_${params?.name || '钢框架'}_${dateStr}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Context Panel (unified left sidebar) ────────────────────────

function ContextPanel() {
  const { currentStep, engineeringParams, analysisResults, colorMode, setColorMode } = useStore();
  const params = engineeringParams as Record<string, unknown> | null;
  const [collapsed, setCollapsed] = useState(false);

  if (!isPipelineStep(currentStep)) return null;

  const nz = (params?.num_stories as number) ?? 0;
  const totalHeight = (params?.story_heights as Array<number> | undefined)?.reduce((a: number, b: number) => a + b, 0) ?? 0;
  const engine = (analysisResults as Record<string, unknown> | null)?.engine as string ?? null;

  const stepMeta: Record<string, { title: string; icon: React.ReactNode }> = {
    modeling: { title: '模型信息', icon: <Info size={14} /> },
    loads: { title: '荷载配置', icon: <Weight size={14} /> },
    analysis: { title: '结构分析', icon: <Gauge size={14} /> },
    check: { title: '规范校核', icon: <Gauge size={14} /> },
  };
  const meta = stepMeta[currentStep];

  const renderContent = () => {
    switch (currentStep) {
      case 'modeling':
      case 'analysis':
        return (
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between"><span className="text-gray-400">构建编号</span><span className="text-white font-mono text-[10px] truncate max-w-[140px]" title={params?.name || '未命名'}>{params?.name || '未命名'}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">层数</span>
              <span className="text-white font-mono">{nz}</span>
            </div>
            <div className="flex justify-between"><span className="text-gray-400">总高</span><span className="text-white font-mono">{totalHeight.toFixed(1)}m</span></div>
            <div className="flex justify-between"><span className="text-gray-400">材料</span><span className="text-white font-mono">{params?.material || 'Q355'}</span></div>
            {currentStep === 'analysis' && engine && (
              <div className="pt-1.5 mt-1.5 border-t border-white/5">
                <div className="flex justify-between"><span className="text-gray-400">求解器</span><span className="text-green-400 font-mono text-[10px]">{engine}</span></div>
              </div>
            )}
          </div>
        );
      case 'loads':
        return <LoadSummaryPanel embedded />;
      case 'check':
        return (
          <div>
            <div className="flex items-center gap-1 flex-wrap mb-2">
              <span className="text-[9px] text-gray-500 mr-0.5">云图</span>
              {(['stress_ratio', 'stability_ratio', 'deflection_ratio', 'slenderness_ratio'] as const).map(mode => {
                const labels: Record<string, string> = {
                  stress_ratio: '应力比', stability_ratio: '稳定比',
                  deflection_ratio: '挠度比', slenderness_ratio: '长细比',
                };
                return (
                  <button key={mode} onClick={() => setColorMode(mode)}
                    className={`px-1.5 py-0.5 rounded text-[9px] transition-all ${
                      colorMode === mode ? 'bg-cyan/15 text-cyan font-medium' : 'text-gray-500 hover:text-gray-300 bg-white/5'
                    }`}>
                    {labels[mode]}
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-gray-500 mb-1.5">应力比</div>
            <div className="w-full h-2 rounded-full" style={{ background: 'linear-gradient(90deg, #32CC66 0%, #AADD00 65%, #FFCC00 85%, #FF8800 100%)' }} />
            <div className="flex justify-between text-[9px] text-gray-500 mt-0.5"><span>0.0</span><span>0.5</span><span>1.0+</span></div>
            <div className="flex gap-3 mt-1.5 text-[9px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#32CC66' }} />安全</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#FF8800' }} />警告</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#FF4400' }} />超限</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-cyan">{meta?.icon}</span>
          <span className="text-xs font-medium text-white">{meta?.title}</span>
        </div>
        <ChevronRight size={14} className={`text-gray-500 transition-transform duration-200 ${collapsed ? '' : 'rotate-90'}`} />
      </button>
      {!collapsed && (
        <div className="px-3 pb-3 pt-1">
          {renderContent()}
          {currentStep === 'check' && (
            <button onClick={exportCalcDetailTxt}
              className="w-full text-[10px] py-1.5 rounded-lg bg-cyan/10 text-cyan hover:bg-cyan/20 transition-all text-center mt-2">
              导出计算详情
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ── Load Summary Panel (editable) ──────────────────────────────────

function LoadSummaryPanel({ embedded }: { embedded?: boolean }) {
  const { engineeringParams, setEngineeringParams } = useStore();
  const p = engineeringParams as Record<string, unknown> | null;
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitEdit = (key: string) => {
    const num = parseFloat(editValue);
    if (!isNaN(num) && p) {
      setEngineeringParams({ ...p, [key]: num });
    }
    setEditing(null);
  };

  const loads = [
    { key: 'dead_load', label: '恒载', icon: Weight, unit: 'kN/m²', color: '#4488ff', value: p?.dead_load ?? 2.0 },
    { key: 'live_load', label: '活载', icon: Weight, unit: 'kN/m²', color: '#44ff88', value: p?.live_load ?? 3.0 },
    { key: 'wind_pressure', label: '风荷载', icon: Wind, unit: 'kN/m²', color: '#66ddff', value: p?.wind_pressure ?? 0.45 },
    { key: 'seismic_intensity', label: '地震作用', icon: Gauge, unit: 'α', color: '#ff8844', value: p?.seismic_intensity ?? 0.08 },
  ];
  return (
    <div className={`${embedded ? 'p-0' : 'glass-strong rounded-xl p-4 min-w-[200px]'}`} style={{ userSelect: 'none' }}>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Weight size={12} /> 荷载配置 <span className="text-[8px] text-gray-700 font-normal normal-case">点击数值修改</span>
      </div>
      <div className="space-y-1.5">
        {loads.map(l => {
          const Icon = l.icon;
          const isEditing = editing === l.key;
          return (
            <div key={l.key} className="flex items-center justify-between group hover:bg-white/[0.03] rounded-md px-1.5 py-1 -mx-1.5 transition-colors cursor-pointer"
              onClick={() => {
                if (!isEditing) { setEditValue(String(l.value)); setEditing(l.key); }
              }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                <Icon size={12} className="text-gray-500 shrink-0" />
                <span className="text-xs text-gray-400">{l.label}</span>
              </div>
              {isEditing ? (
                <input ref={inputRef} type="number" step="0.01"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(l.key)}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(l.key); if (e.key === 'Escape') setEditing(null); }}
                  className="w-20 text-right text-xs font-mono bg-white/10 rounded px-1.5 py-0.5 outline-none border border-cyan/40 text-white"
                  style={{ colorScheme: 'dark' }}
                  onClick={e => e.stopPropagation()}
                  autoFocus />
              ) : (
                <span className="text-xs font-mono" style={{ color: l.color }}>
                  {l.value} <span className="text-gray-600">{l.unit}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 pt-2 border-t border-white/5 text-[9px] text-gray-600 leading-relaxed">
        恒载 ↓ · 活载 ↓ · 风载 → · 地震 ↔
      </div>
    </div>
  );
}

// ── Analysis Controls ──────────────────────────────────────────

function AnalysisControls() {
  const { deformationScale, setDeformationScale, setShowDeformed, threeDData } = useStore();
  const maxDispRaw = (threeDData as Record<string, unknown> | null)?.max_displacement as number | undefined;
  const maxDisp = maxDispRaw != null ? (maxDispRaw * 1000).toFixed(1) : '12.5';
  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] text-gray-400">变形控制</span>
        <div className="text-[10px] text-gray-500">
          <span className="text-cyan font-mono">{deformationScale}×</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-gray-600">0</span>
        <input type="range" min="0" max="50" value={deformationScale}
          onChange={e => { setDeformationScale(Number(e.target.value)); setShowDeformed(true); }}
          className="flex-1 accent-cyan h-1.5" />
        <span className="text-[9px] text-gray-600">50×</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {[0, 5, 10, 20, 30, 50].map(v => (
          <button key={v} onClick={() => { setDeformationScale(v); setShowDeformed(v > 0); }}
            className={`px-2 py-0.5 rounded text-[9px] font-mono transition-all ${deformationScale === v ? 'bg-cyan/20 text-cyan' : 'text-gray-500 hover:text-gray-300 bg-white/5 hover:bg-white/10'}`}>
            {v}×
          </button>
        ))}
      </div>
      <div className="mt-2 text-[9px] text-gray-600">
        <span className="text-gray-500">最大位移:</span> <span className="text-cyan font-mono">{maxDisp} mm</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[9px] text-gray-600">
        <span>小</span>
        <div className="flex-1 h-1.5 rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-red-400" />
        <span>大</span>
      </div>
    </div>
  );
}


// ── Step Info Banner ─────────────────────────────────────────────

function StepInfo({ currentStep }: { currentStep: string }) {
  const analysisResults = useStore(s => s.analysisResults) as Record<string, unknown> | null;
  const engine = analysisResults?.engine || null;

  const info: Record<string, { title: string; desc: string }> = {
    modeling: { title: '模型生成中', desc: 'CAIAO 正在逐层构建钢框架结构模型...' },
    loads: { title: '荷载施加', desc: '显示结构上的恒载、活载、风载及地震作用' },
    analysis: { title: '有限元分析', desc: '结构在荷载作用下的变形与内力分析' },
    check: { title: '规范校核', desc: 'GB 50017-2017 钢结构设计规范校核结果' },
  };
  const i = info[currentStep];
  if (!i) return null;
  return (
    <div className="glass-strong rounded-xl px-5 py-2.5 flex items-center gap-3 shadow-lg whitespace-nowrap">
      <span className="text-sm font-medium text-white">{i.title}</span>
      <span className="text-xs text-gray-500">|</span>
      <span className="text-xs text-gray-400">{i.desc}</span>
      {currentStep === 'analysis' && (
        <>
          <span className="text-xs text-gray-500">|</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center gap-1 ${
            engine ? 'bg-cyan/10 text-cyan/90' : 'bg-gray-500/10 text-gray-500'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${engine ? 'bg-green-400' : 'bg-gray-500'}`} />
            {engine || '等待求解器'}
          </span>
        </>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────

function ErrorToast() {
  const { error, setError } = useStore();
  if (!error) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-scale-in">
      <div className="glass-strong rounded-xl px-5 py-3 flex items-center gap-3 shadow-2xl border border-red-500/30 bg-red-500/10 max-w-[640px]">
        <XCircle size={16} className="text-red-400 shrink-0" />
        <span className="text-sm text-red-200">{error}</span>
        <button onClick={() => setError(null)} className="text-red-400/50 hover:text-red-300 ml-2">
          ✕
        </button>
      </div>
    </div>
  );
}

const isPipelineStep = (s: string) =>
  s === 'modeling' || s === 'loads' || s === 'analysis' || s === 'check';

// ── Error Boundary ─────────────────────────────────────────────

class AppBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="w-screen h-screen bg-[#0a0a1a] flex items-center justify-center">
          <div className="glass-strong rounded-xl px-8 py-6 max-w-md text-center">
            <div className="text-red-400 text-sm font-medium mb-2">渲染错误</div>
            <div className="text-[11px] text-gray-500 mb-4 font-mono break-all">{this.state.error.message}</div>
            <button onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="text-[10px] px-4 py-2 rounded-lg bg-cyan/20 text-cyan hover:bg-cyan/30 transition-all">
              重新加载
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const { currentStep, nextStep, prevStep, isRunning } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const handleExport = () => {
    if (exporting) return;
    setExporting(true);
    exportPanoramaFromStore().finally(() => setExporting(false));
  };
  const [pageTransition, setPageTransition] = useState(false);
  const prevStepRef = useRef(currentStep);
  const inputMountedRef = useRef(false);

  // 控制 body 滚动：展示页可滚动（支持 #pipeline 锚点），演示页锁定
  useEffect(() => {
    document.body.style.overflow = currentStep === 'opening' ? '' : 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [currentStep]);

  // ⌨️ Keyboard navigation (仅方向键，输入框中不触发)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (currentStep === 'opening') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (!isRunning) nextStep();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentStep, isRunning, nextStep, prevStep]);

  // Auto-dock floating panels on step change + loads→analysis re-run
  useEffect(() => {
    if (prevStepRef.current !== currentStep) {
      const prev = prevStepRef.current;
      prevStepRef.current = currentStep;

      // 从荷载步进入分析步时，检测荷载值是否修改，修改则重算
      if (prev === 'loads' && currentStep === 'analysis') {
        const state = useStore.getState();
        const lastRun = state.lastRunParams;
        const current = state.engineeringParams;
        if (lastRun && current && !state.isRunning) {
          const loadKeys = ['dead_load', 'live_load', 'wind_pressure', 'seismic_intensity'];
          const hasChanged = loadKeys.some(k => current[k] !== lastRun[k]);
          if (hasChanged) {
            const merged = { ...lastRun, ...current };
            state.setIsRunning(true);
            state.setLastRunParams(null); // 防止重复触发
            api.runPipeline(merged as RunPipelineParams).then(result => {
              const s = useStore.getState();
              if (result.status === 'success') {
                s.setThreeDData(result.three_d_data ?? null);
                s.setCodeCheckResults(result.code_check ?? null);
                s.setAnalysisResults(result.analysis_result ?? null);
                s.setReportUrl(result.report_url ?? '');
                s.setLastRunParams(merged);
              } else {
                s.setError('荷载重算失败');
              }
            }).catch(() => {
              useStore.getState().setError('重算失败，请确认后端正在运行');
            }).finally(() => {
              useStore.getState().setIsRunning(false);
            });
          }
        }
      }

      window.dispatchEvent(new CustomEvent('caiao-auto-dock'));
    }
  }, [currentStep]);

  // Page transition: opening → input (full overlay)
  useEffect(() => {
    if (prevStepRef.current === 'opening' && currentStep === 'input') {
      setPageTransition(true);
      const t = setTimeout(() => {
        setPageTransition(false);
        inputMountedRef.current = true;
      }, 600);
      return () => clearTimeout(t);
    }
    if (currentStep !== 'input') {
      inputMountedRef.current = false;
    }
  }, [currentStep]);

  // Auto-demo mode: auto-advance through steps
  const { autoDemo, setAutoDemo } = useStore();
  useEffect(() => {
    if (!autoDemo) return;
    if (currentStep === 'report') {
      // End of demo
      setAutoDemo(false);
      return;
    }
    const t = setTimeout(() => {
      if (!useStore.getState().isRunning) {
        useStore.getState().nextStep();
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [autoDemo, currentStep, setAutoDemo]);

  const showCanvas = currentStep !== 'opening' && currentStep !== 'input';

  return (
    <AppBoundary>
    <div ref={containerRef} className={`w-screen bg-[#0a0a1a] relative ${currentStep === 'opening' ? 'min-h-screen' : 'h-screen overflow-hidden'}`}>

      {/* ── Persistent 3D Canvas ── */}
      {showCanvas && (
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [28, 22, 28], fov: 40, up: [0, 0, 1] }} dpr={[1, 2]} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
            onPointerMissed={() => {
              useStore.getState().clearSelectedElements();
              window.dispatchEvent(new CustomEvent('caiao-auto-dock'));
            }}>
            <ThreeCanvas />
          </Canvas>
        </div>
      )}

      {/* ── Opening overlay (XuanwuLanding) ── */}
      {currentStep === 'opening' && <XuanwuLanding />}

      {/* ── UI overlay layers ── */}

      {/* Page transition overlay (opening → input) */}
      {pageTransition && (
        <div className="fixed inset-0 z-50 pointer-events-none bg-[#0a0b0d]">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-cyan/30 border-t-cyan animate-spin" />
              <span className="text-xs text-gray-500">加载设计空间...</span>
            </div>
          </div>
        </div>
      )}

      {/* Step indicator + panel menu */}
      {currentStep !== 'opening' && currentStep !== 'explore' && (
        <div className="fixed top-0 left-0 right-0 z-40 flex justify-center pt-4 pointer-events-none">
          <div className="flex items-start gap-2 pointer-events-auto">
            <StepIndicator />
            <PanelMenu onExportPanorama={handleExport} exporting={exporting} />
          </div>
        </div>
      )}

      {/* Shared floating controls - pipeline steps */}
      {isPipelineStep(currentStep) && (
        <>
          {/* Step info banner at top-center */}
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30">
            <StepInfo currentStep={currentStep} />
          </div>

          {/* Context panel (default dock-left, auto-expand) */}
          <DockPanel id="context" defaultDock="left" title="信息面板" width={260} startExpanded>
            <ContextPanel />
          </DockPanel>

          {/* Scene controls (default dock-left) */}
          <DockPanel id="toolbar" defaultDock="left" title="场景控制" width={260}>
            <SceneToolbar />
          </DockPanel>

          {/* ViewCube overlay (bottom-left of 3D view) */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 opacity-40 hover:opacity-100 transition-opacity duration-300">
            <ViewCube />
          </div>

          {/* Analysis controls (dock-right, analysis step only) */}
          {currentStep === 'analysis' && (
            <DockPanel id="controls" defaultDock="right" title="变形控制" width={280} startExpanded>
              <AnalysisControls />
            </DockPanel>
          )}

          {/* Results panel (dock-right, check step only) */}
          {currentStep === 'check' && (
            <DockPanel id="results" defaultDock="right" title="校核结果" width={560} startExpanded noFrame>
              <ResultsPanel />
            </DockPanel>
          )}

        </>
      )}

      {/* ── Input step overlay ── */}
      {currentStep === 'input' && (
        <div className="relative z-10 w-full h-full flex">
          {/* Animated background with gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0b1a] via-[#0a0b0d] to-[#0a0d0a]">
            {/* Ambient glow */}
            <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] rounded-full opacity-[0.04]"
              style={{
                background: 'radial-gradient(circle, rgba(0,212,255,0.3) 0%, transparent 70%)',
                filter: 'blur(100px)',
              }}
            />
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.03]"
              style={{
                background: 'radial-gradient(circle, rgba(50,240,140,0.3) 0%, transparent 70%)',
                filter: 'blur(80px)',
              }}
            />
          </div>
          {/* Input panel */}
          <InputPanel />
          {/* Welcome banner on the right */}
          <div className="flex-1 flex flex-col justify-center items-center relative z-10 select-none">
            <div className="max-w-md text-center animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
              {/* XuanwuAI brand mark */}
              <div className="mb-8 flex items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan to-purple-600 flex items-center justify-center text-base font-bold text-black shadow-lg shadow-cyan/20">
                  X
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-white/70 tracking-tight">XuanwuAI</div>
                  <div className="text-[10px] text-gray-600">渊默之算 · Abyssal Computation</div>
                </div>
              </div>
              <h2 className="text-lg font-semibold text-white/70 mb-3 leading-relaxed">
                AI 驱动的参数化钢框架全流程设计
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                在左侧面板中配置结构参数，或使用 AI 对话快速生成设计
              </p>
              <div className="mt-8 flex justify-center gap-6 text-xs text-gray-700">
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-cyan/40" />
                  参数化建模
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-purple-400/40" />
                  AI 辅助
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-green-400/40" />
                  规范验算
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-orange-400/40" />
                  OpenSees 引擎
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Report step overlay (居中显示) ── */}
      {currentStep === 'report' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <ReportPreview />
          </div>
        </div>
      )}

      {/* ── Explore step overlay ── */}
      {currentStep === 'explore' && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          <div className="fixed top-4 left-4 glass-strong rounded-xl px-4 py-2 flex items-center gap-3 pointer-events-auto">
            <span className="text-xs text-cyan font-medium">自由探索</span>
            <span className="text-[10px] text-gray-500">拖拽旋转 · 滚轮缩放 · 右键平移</span>
          </div>
          <div className="fixed bottom-8 right-8 z-20 flex items-center gap-2 pointer-events-auto">
            <button onClick={() => {
              setShowFinishDialog(true);
              setSaveMessage(null);
            }}
              className="btn-primary flex items-center gap-2 shadow-2xl">
              <RefreshCw size={15} /> 设计完成
            </button>
            <button onClick={() => useStore.getState().setStep('report')}
              className="btn-secondary flex items-center gap-2 shadow-xl">
              查看报告
            </button>
          </div>
        </div>
      )}

      {/* ── 设计完成确认弹窗 ── */}
      {showFinishDialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 animate-fade-in"
            onClick={() => setShowFinishDialog(false)}>
            <div className="glass-strong rounded-xl p-5 shadow-2xl border border-white/10 max-w-sm w-full mx-4"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Save size={14} className="text-cyan" />
                  <span className="text-sm font-medium text-gray-200">设计完成</span>
                </div>
                <button onClick={() => setShowFinishDialog(false)}
                  className="text-gray-500 hover:text-white transition-colors">
                  <X size={14} />
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-4">是否保存当前项目数据？</p>
              {saveMessage && (
                <p className={`text-xs mb-3 ${saveMessage.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                  {saveMessage.text}
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={async () => {
                  setSaving(true);
                  const state = useStore.getState();
                  const params = (state.engineeringParams ?? {}) as Record<string, unknown>;
                  const check = (state.codeCheckResults ?? {}) as Record<string, unknown>;
                  const summary = check?.summary ?? {};
                  const elements = check?.elements ?? [];

                  const project = {
                    metadata: {
                      project_name: params.name || '未命名项目',
                      saved_at: new Date().toISOString(),
                      version: '2.0',
                      description: '设计完成时手动保存',
                    },
                    input: {
                      geometry: {
                        grid_x: params.grid_x ?? [],
                        grid_y: params.grid_y ?? [],
                        num_stories: params.num_stories ?? 0,
                        story_heights: params.story_heights ?? [],
                      },
                      sections: {
                        column: params.column_section ?? '',
                        beam: params.beam_section ?? '',
                        material: params.material ?? '',
                      },
                      loads: {
                        dead_load: params.dead_load ?? 0,
                        live_load: params.live_load ?? 0,
                        wind_pressure: params.wind_pressure ?? 0,
                        seismic_intensity: params.seismic_intensity ?? 0,
                      },
                    },
                    output: {
                      summary: {
                        total_elements: summary.total_elements ?? 0,
                        passed_count: summary.passed ?? 0,
                        failed_count: summary.failed ?? 0,
                        max_stress_ratio: summary.max_stress_ratio ?? 0,
                        max_deflection_ratio: summary.max_deflection_ratio ?? 0,
                      },
                      code_check_elements: elements,
                    },
                  };

                  try {
                    // 清洗数据，确保纯 JSON 可序列化，防止 NaN/undefined 等导致服务端崩溃
                    const safeProject = JSON.parse(JSON.stringify(project));

                    let serverOk = false;
                    try {
                      const resp = await fetch('/api/project/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(safeProject),
                      });
                      serverOk = resp.ok;
                    } catch {
                      // 服务端不可达，降级到浏览器下载
                    }

                    if (!serverOk) {
                      // 服务端保存失败，降级为浏览器下载
                      const ts = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
                      const filename = `${params.name || '项目'}_${ts}.json`;
                      const blob = new Blob([JSON.stringify(safeProject, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.download = filename;
                      a.href = url;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }

                    setSaving(false);
                    setShowFinishDialog(false);
                    setSaveMessage(null);
                    state.setStep('input');
                  } catch {
                    setSaving(false);
                    setSaveMessage({ type: 'error', text: '数据保存失败，请重试' });
                  }
                }}
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-cyan/20 text-cyan border border-cyan/20
                             hover:bg-cyan/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? <Loader size={13} className="animate-spin" /> : <Save size={13} />}
                  {saving ? '保存中' : '保存'}
                </button>
                <button onClick={() => {
                  setShowFinishDialog(false);
                  useStore.getState().setStep('input');
                }}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-white/5 text-gray-400 hover:text-gray-300
                             border border-white/5 hover:bg-white/10 transition-all">
                  不保存
                </button>
              </div>
              <button onClick={() => setShowFinishDialog(false)}
                className="w-full mt-2 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-400 transition-colors">
                取消
              </button>
            </div>
          </div>
        )}

      {/* ── Navigation buttons ── */}
      {currentStep !== 'opening' && currentStep !== 'explore' && (
        <div className="fixed bottom-8 right-8 z-40 flex items-center gap-3">
          {/* Previous step button */}
          {currentStep !== 'input' && !isRunning && (
            <button onClick={prevStep}
              className="btn-secondary flex items-center gap-2 shadow-xl">
              ← 上一步
            </button>
          )}
          {/* Next step button */}
          <button onClick={nextStep} disabled={isRunning}
            className="btn-primary flex items-center gap-2 shadow-2xl transition-all duration-300">
            {isRunning ? (
              <span className="flex items-center gap-2"><RefreshCw size={15} className="animate-spin" /> 运行中...</span>
            ) : (
              <>{currentStep === 'report' ? '完成 ✓' : '下一步'} {currentStep !== 'report' && <Maximize2 size={14} />}</>
            )}
          </button>
        </div>
      )}

      {/* Error toast */}
      <ErrorToast />
    </div>
    </AppBoundary>
  );
}
