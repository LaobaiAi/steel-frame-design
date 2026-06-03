import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { PieChart, CheckCircle, XCircle, AlertTriangle, Filter, ArrowUpDown, Minus, Plus, ChevronDown, ChevronRight, Download, CheckSquare } from 'lucide-react';
import type { CodeCheckElement } from '../types';
import { generateCalcProcesses, getMockElements } from '../utils/mockData';

type TypeFilter = 'all' | 'column' | 'beam';
type StatusFilter = 'all' | 'pass' | 'fail' | 'warning';
type SortKey = keyof CodeCheckElement | '';
type SortDir = 'asc' | 'desc';

// ── Color helpers with dynamic thresholds ──────────────────────────

// 应力比颜色映射 — 与 servers/defaults.py COLORMAP_THRESHOLDS 保持一致
const COLOR_THRESHOLDS = [
  { max: 0.5,  dot: '#32CC66', bg: 'rgba(50,204,102,0.12)' },
  { max: 0.65, dot: '#AADD00', bg: 'rgba(170,221,0,0.12)' },
  { max: 0.8,  dot: '#FFCC00', bg: 'rgba(255,204,0,0.12)' },
  { max: 0.95, dot: '#FF8800', bg: 'rgba(255,136,0,0.15)' },
  { max: Infinity, dot: '#FF4400', bg: 'rgba(255,68,0,0.18)' },
];

function stressColor(ratio: number) {
  for (const t of COLOR_THRESHOLDS) {
    if (ratio <= t.max) return { bg: t.bg, dot: t.dot };
  }
  return { bg: COLOR_THRESHOLDS[COLOR_THRESHOLDS.length - 1].bg, dot: COLOR_THRESHOLDS[COLOR_THRESHOLDS.length - 1].dot };
}

function ratioClass(ratio: number, safeLimit: number, criticalLimit: number): StatusFilter {
  if (ratio > criticalLimit) return 'fail';
  if (ratio > safeLimit) return 'warning';
  return 'pass';
}

/** 四项比值的最大值作为综合判定 */
function getMaxRatio(el: Pick<CodeCheckElement, 'stress_ratio' | 'stability_ratio' | 'deflection_ratio' | 'slenderness_ratio'>): number {
  return Math.max(
    el.stress_ratio,
    el.stability_ratio,
    el.deflection_ratio,
    el.slenderness_ratio / 150,
  );
}

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: '全部', pass: '通过', fail: '超限', warning: '警告',
};

// Mock 数据逻辑已移至 utils/mockData.ts，此处仅保留懒加载引用

// ── Main Component ───────────────────────────────────────────────

export default function ResultsPanel() {
  const { codeCheckResults, selectedElements, setSelectedElements, colorMode, setColorMode } = useStore();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [floorFilter, setFloorFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('stress_ratio');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [safeLimit, setSafeLimit] = useState(0.8);
  const [criticalLimit, setCriticalLimit] = useState(1.0);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [expandedCalc, setExpandedCalc] = useState<Set<string>>(new Set(['强度验算']));

  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

  // ── Elements ────────────────────────────────────────────────────
  const elements: CodeCheckElement[] = useMemo(() => {
    if (!codeCheckResults) return getMockElements();
    const data = codeCheckResults as Record<string, unknown>;
    if (data.elements && Array.isArray(data.elements) && data.elements.length > 0) {
      return (data.elements as Array<Record<string, unknown>>).map((el) => {
        const elType = String(el.type ?? '');
        const mapped: CodeCheckElement = {
          id: Number(el.id ?? 0),
          type: (elType === '柱' ? 'column' : elType === 'X向梁' || elType === 'Y向梁' ? 'beam' : 'beam') as 'column' | 'beam',
          section: String(el.section ?? ''),
          story: Number(el.story ?? 1),
          node_i: Number(el.node_i ?? 0),
          node_j: Number(el.node_j ?? 0),
          stress_ratio: Number(el.stress_ratio ?? 0),
          stability_ratio: Number(el.stability_ratio ?? 0),
          deflection_ratio: Number(el.deflection_ratio ?? 0),
          slenderness_ratio: Number(el.slenderness_ratio ?? 0),
          pass: el.pass !== undefined ? Boolean(el.pass) : true,
          messages: (el.messages ?? []) as string[],
          calcProcesses: (el.calc_processes ?? el.calcProcesses) as CodeCheckElement['calcProcesses'],
        };
        // Auto-generate calc processes if backend didn't provide them
        if (!mapped.calcProcesses) {
          mapped.calcProcesses = generateCalcProcesses(mapped);
        }
        return mapped;
      });
    }
    return getMockElements();
  }, [codeCheckResults]);

  // ── Floors ─────────────────────────────────────────────────────
  const floors = useMemo(() => {
    const s = new Set<number>();
    elements.forEach(el => s.add(el.story));
    return Array.from(s).sort((a, b) => a - b);
  }, [elements]);

  // ── Filter & Sort (use dynamic thresholds) ──────────────────────
  const filtered = useMemo(() => {
    let result = elements;
    if (typeFilter !== 'all') result = result.filter(el => el.type === typeFilter);
    if (floorFilter !== 'all') result = result.filter(el => el.story === floorFilter);
    if (statusFilter === 'pass') result = result.filter(el => getMaxRatio(el) <= safeLimit);
    else if (statusFilter === 'fail') result = result.filter(el => getMaxRatio(el) > criticalLimit);
    else if (statusFilter === 'warning') result = result.filter(el => getMaxRatio(el) > safeLimit && getMaxRatio(el) <= criticalLimit);

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        const va = typeof av === 'number' ? av : String(av);
        const vb = typeof bv === 'number' ? bv : String(bv);
        return sortDir === 'asc' ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
      });
    }
    return result;
  }, [elements, typeFilter, floorFilter, statusFilter, sortKey, sortDir, safeLimit, criticalLimit]);

  // ── Stats (四项比值综合判定) ──────────────────────────────────
  const stats = useMemo(() => {
    const total = elements.length;
    const safe = elements.filter(e => getMaxRatio(e) <= safeLimit).length;
    const warning = elements.filter(e => getMaxRatio(e) > safeLimit && getMaxRatio(e) <= criticalLimit).length;
    const critical = elements.filter(e => getMaxRatio(e) > criticalLimit).length;
    return { total, safe, warning, critical, passed: safe, failed: critical };
  }, [elements, safeLimit, criticalLimit]);

  // ── Selection ──────────────────────────────────────────────────
  useEffect(() => {
    if (selectedElements.length === 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional scroll-to-selected
      setSelectedRow(selectedElements[0]);
      const row = rowRefs.current.get(selectedElements[0]);
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [selectedElements]);

  const handleRowClick = (el: CodeCheckElement, e?: React.MouseEvent) => {
    if (e?.ctrlKey) {
      setSelectedElements(selectedElements.includes(el.id)
        ? selectedElements
        : [...selectedElements, el.id]
      );
    } else if (e?.shiftKey) {
      setSelectedElements(selectedElements.filter(id => id !== el.id));
    } else {
      setSelectedElements([el.id]);
    }
    setSelectedRow(el.id);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const detailEl = selectedRow ? elements.find(e => e.id === selectedRow) : null;

  // ── Export single component calc report ──────────────────────────
  const exportComponentDetail = useCallback((el: CodeCheckElement) => {
    const lines: string[] = [];
    const pad = (s: string) => `  ${s}`;

    lines.push('='.repeat(48));
    lines.push('  钢框架构件计算书');
    lines.push('='.repeat(48));
    lines.push('');
    lines.push(`构件: ${el.type === 'column' ? '柱' : '梁'} #${el.id}`);
    lines.push(`截面: ${el.section}`);
    lines.push(`楼层: ${el.story}F`);
    lines.push(`节点: ${el.node_i} → ${el.node_j}`);
    lines.push(`结果: ${el.pass ? '✓ 通过' : '✗ 不通过'}`);
    lines.push('');
    lines.push('─'.repeat(48));

    // 四项比值
    lines.push('');
    lines.push('【受力分析】');
    lines.push(pad(`应力比: ${el.stress_ratio.toFixed(4)}`));
    lines.push(pad(`稳定比: ${el.stability_ratio.toFixed(4)}`));
    lines.push(pad(`挠度比: ${el.deflection_ratio.toFixed(4)}`));
    lines.push(pad(`长细比: ${el.slenderness_ratio.toFixed(1)}`));
    lines.push('');

    // 详细验算过程
    lines.push('【构件验算】');
    const cps = el.calcProcesses ?? [];
    cps.forEach((cp) => {
      lines.push('');
      lines.push(pad(`── ${cp.title} ${cp.passed ? '✓ 通过' : '✗ 不通过'}`));
      cp.steps.forEach(step => {
        lines.push(pad(`${step.label}: ${step.value}`));
      });
      lines.push(pad(`结果: ${cp.resultLine}`));
    });

    lines.push('');
    lines.push('='.repeat(48));
    lines.push('XuanwuAI · CAIAO 钢框架设计系统');
    lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `构件计算书_${el.type === 'column' ? '柱' : '梁'}_${el.id}_${el.section}_${el.story}F.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Portal modal — extracted to avoid Rolldown JSX parser issue with createPortal
  const detailModal = showDetailModal && detailEl && createPortal(
    <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowDetailModal(false)}>
      <div className="absolute left-4 top-24 bottom-4 w-[520px] bg-[#0d0d24] border border-white/10 rounded-xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">构件计算详情</span>
            <span className="text-[11px] text-gray-500">
              {detailEl.type === 'column' ? '柱' : '梁'} #{detailEl.id} · {detailEl.section} · {detailEl.story}F
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => exportComponentDetail(detailEl)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-gray-400 hover:text-cyan hover:bg-cyan/10 transition-all">
              <Download size={10} />
              导出
            </button>
            <button onClick={() => setShowDetailModal(false)}
              className="text-gray-500 hover:text-white transition-colors text-lg leading-none">&times;</button>
          </div>
        </div>

        <div className="p-5 space-y-5 flex-1 overflow-y-auto">
          {/* 受力分析 */}
          <div>
            <h3 className="text-xs font-medium text-cyan mb-3 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-cyan rounded-full" />
              受力分析
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">应力比</span>
                <span className="font-mono" style={{ color: stressColor(detailEl.stress_ratio).dot }}>
                  {detailEl.stress_ratio.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">稳定比</span>
                <span className="font-mono text-gray-300">{detailEl.stability_ratio.toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">挠度比</span>
                <span className="font-mono text-gray-300">{detailEl.deflection_ratio.toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">长细比</span>
                <span className="font-mono text-gray-300">{detailEl.slenderness_ratio.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* 构件验算 + 计算过程 */}
          <div>
            <h3 className="text-xs font-medium text-cyan mb-3 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-cyan rounded-full" />
              构件验算
            </h3>
            <div className="space-y-1.5">
              {(detailEl.calcProcesses ?? []).map((cp, i) => {
                const isExpanded = expandedCalc.has(cp.title);
                return (
                  <div key={i} className="rounded-lg border border-white/[0.06] overflow-hidden">
                    {/* Card header — click to toggle */}
                    <button
                      onClick={() => {
                        setExpandedCalc(prev => {
                          const next = new Set(prev);
                          if (next.has(cp.title)) {
                            next.delete(cp.title);
                          } else {
                            next.add(cp.title);
                          }
                          return next;
                        });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-white/[0.03] transition-colors"
                    >
                      {isExpanded
                        ? <ChevronDown size={12} className="text-gray-500 flex-shrink-0" />
                        : <ChevronRight size={12} className="text-gray-500 flex-shrink-0" />}
                      <span className="text-gray-300">{cp.title}</span>
                      <span className="ml-auto font-mono text-gray-400">{cp.resultLine}</span>
                      {cp.passed
                        ? <CheckCircle size={12} className="text-green-400 flex-shrink-0" />
                        : <XCircle size={12} className="text-red-400 flex-shrink-0" />}
                    </button>

                    {/* Expanded body — calculation steps */}
                    {isExpanded && (
                      <div className="px-3 pb-2.5 pt-1 border-t border-white/[0.04]">
                        <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[10px]">
                          {cp.steps.map((step, j) => (
                            <React.Fragment key={j}>
                              <span className="text-gray-500 truncate">{step.label}</span>
                              <span className="font-mono text-gray-300 text-right whitespace-nowrap">{step.value}</span>
                            </React.Fragment>
                          ))}
                        </div>
                        <div className="mt-2 pt-1.5 border-t border-white/[0.04] text-[10px] flex items-center gap-2">
                          <span className="text-gray-500">结果</span>
                          <span className="font-mono text-gray-300">{cp.resultLine}</span>
                          <span className={`ml-auto font-medium ${cp.passed ? 'text-green-400' : 'text-red-400'}`}>
                            {cp.passed ? '通过 ✓' : '不通过 ✗'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  // ── Threshold helpers ──────────────────────────────────────────
  const stepThreshold = useCallback((key: 'safe' | 'critical', delta: number) => {
    if (key === 'safe') {
      setSafeLimit(v => Math.max(0.1, Math.min(criticalLimit - 0.05, +(v + delta).toFixed(2))));
    } else {
      setCriticalLimit(v => Math.max(safeLimit + 0.05, Math.min(2.0, +(v + delta).toFixed(2))));
    }
  }, [safeLimit, criticalLimit]);

  // Donut circumference
  const C = 2 * Math.PI * 32; // ~200.96

  return (
    <>
    <div className="glass-strong rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2 flex-shrink-0">
        <PieChart size={14} className="text-cyan" />
        <span className="text-xs font-medium text-white" style={{ marginRight: '4em' }}>校核统计</span>
        <button
          onClick={() => setShowDetailModal(true)}
          disabled={!detailEl}
          className={`px-2.5 py-0.5 rounded text-[10px] font-medium transition-all ${
            detailEl
              ? 'bg-cyan/15 text-cyan hover:bg-cyan/25 cursor-pointer'
              : 'text-gray-600 cursor-not-allowed'
          }`}
        >构建详情</button>
        <span className="text-[10px] text-gray-500 ml-auto">{stats.total} 构件</span>
      </div>

      {/* 云图参数切换 */}
      <div className="px-4 py-2 border-b border-white/5 flex items-center gap-1.5 flex-shrink-0">
        <span className="text-[9px] text-gray-500 mr-1">云图</span>
        {(['stress_ratio', 'stability_ratio', 'deflection_ratio', 'slenderness_ratio'] as const).map(mode => {
          const labels: Record<string, string> = {
            stress_ratio: '应力比', stability_ratio: '稳定比',
            deflection_ratio: '挠度比', slenderness_ratio: '长细比',
          };
          const isActive = colorMode === mode;
          return (
            <button key={mode} onClick={() => setColorMode(mode)}
              className={`px-2 py-0.5 rounded text-[10px] transition-all ${
                isActive ? 'bg-cyan/15 text-cyan font-medium' : 'text-gray-500 hover:text-gray-300 bg-white/5'
              }`}>
              {labels[mode]}
            </button>
          );
        })}
      </div>

      {/* Donut + Legend row with editable thresholds */}
      <div className="px-4 py-3 flex items-start gap-4 flex-shrink-0 border-b border-white/5">
        {/* Donut chart */}
        <svg width="70" height="70" viewBox="0 0 80 80" className="flex-shrink-0 mt-0.5">
          <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          {stats.safe > 0 && (
            <circle cx="40" cy="40" r="32" fill="none" stroke="#32CC66" strokeWidth="8"
              strokeDasharray={`${(stats.safe / stats.total) * C} ${C}`}
              strokeDashoffset="0" transform="rotate(-90 40 40)" strokeLinecap="round" />
          )}
          {stats.warning > 0 && (
            <circle cx="40" cy="40" r="32" fill="none" stroke="#FFCC00" strokeWidth="8"
              strokeDasharray={`${(stats.warning / stats.total) * C} ${C}`}
              strokeDashoffset={-((stats.safe / stats.total) * C)}
              transform="rotate(-90 40 40)" strokeLinecap="round" />
          )}
          {stats.critical > 0 && (
            <circle cx="40" cy="40" r="32" fill="none" stroke="#FF4400" strokeWidth="8"
              strokeDasharray={`${(stats.critical / stats.total) * C} ${C}`}
              strokeDashoffset={-(((stats.safe + stats.warning) / stats.total) * C)}
              transform="rotate(-90 40 40)" strokeLinecap="round" />
          )}
          <text x="40" y="36" textAnchor="middle" className="fill-white text-[11px] font-bold">{stats.total}</text>
          <text x="40" y="48" textAnchor="middle" className="fill-gray-400 text-[8px]">构件</text>
        </svg>

        {/* Legend with editable thresholds — CSS grid for perfect alignment */}
        <div className="flex-1 text-[10px] min-w-0" style={{ display: 'grid', gridTemplateColumns: '16px 32px 28px 16px 1fr 48px', gap: '4px 6px', alignItems: 'center' }}>
          {/* Safe row */}
          <span className="w-2 h-2 rounded-full bg-[#32CC66] justify-self-center" />
          <span className="text-gray-400">安全</span>
          <span className="text-white font-medium text-right">{stats.safe}</span>
          <span className="text-gray-600 text-right">≤</span>
          <span className="font-mono text-gray-300 text-right tabular-nums">{safeLimit.toFixed(2)}</span>
          <div className="flex items-center gap-[1px]">
            <button onClick={() => stepThreshold('safe', -0.05)}
              className="p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors">
              <Minus size={10} />
            </button>
            <button onClick={() => stepThreshold('safe', 0.05)}
              className="p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors">
              <Plus size={10} />
            </button>
          </div>

          {/* Warning row */}
          <span className="w-2 h-2 rounded-full bg-[#FFCC00] justify-self-center" />
          <span className="text-gray-400">警告</span>
          <span className="text-white font-medium text-right">{stats.warning}</span>
          <span className="text-gray-600 text-right">&gt;</span>
          <span className="font-mono text-gray-300 text-right tabular-nums">{safeLimit.toFixed(2)}</span>
          <div /> {/* spacer */}

          {/* Critical row */}
          <span className="w-2 h-2 rounded-full bg-[#FF4400] justify-self-center" />
          <span className="text-gray-400">超限</span>
          <span className="text-white font-medium text-right">{stats.critical}</span>
          <span className="text-gray-600 text-right">&gt;</span>
          <span className="font-mono text-gray-300 text-right tabular-nums">{criticalLimit.toFixed(2)}</span>
          <div className="flex items-center gap-[1px]">
            <button onClick={() => stepThreshold('critical', -0.05)}
              className="p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors">
              <Minus size={10} />
            </button>
            <button onClick={() => stepThreshold('critical', 0.05)}
              className="p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors">
              <Plus size={10} />
            </button>
          </div>
        </div>
      </div>

      {/* Gradient bar */}
      <div className="px-4 py-1.5 flex-shrink-0 border-b border-white/5">
        <div className="h-1.5 w-full rounded-full overflow-hidden flex">
          <div className="h-full flex-1" style={{ background: 'linear-gradient(90deg, #32CC66, #AADD00)' }} />
          <div className="h-full" style={{
            flex: `0 0 ${Math.max(6, Math.min(40, (criticalLimit - safeLimit) * 100))}px`,
            background: 'linear-gradient(90deg, #AADD00, #FFCC00)',
          }} />
          <div className="h-full flex-1" style={{ background: 'linear-gradient(90deg, #FFCC00, #FF8800, #FF4400)' }} />
        </div>
        <div className="flex justify-between text-[8px] text-gray-600 mt-0.5">
          <span>0</span>
          <span style={{ color: safeLimit > 0.3 ? '#a0a0a0' : 'transparent' }}>{safeLimit.toFixed(2)}</span>
          <span>{criticalLimit.toFixed(2)}</span>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="px-3 py-2 flex items-center gap-1.5 flex-shrink-0 border-b border-white/5 flex-wrap">
        <Filter size={11} className="text-gray-500 flex-shrink-0" />
        {(['all', 'column', 'beam'] as const).map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-2 py-0.5 rounded text-[10px] transition-all ${
              typeFilter === t ? 'bg-cyan/15 text-cyan' : 'text-gray-500 hover:text-gray-300 bg-white/5'
            }`}>
            {t === 'all' ? '全部' : t === 'column' ? '柱' : '梁'}
          </button>
        ))}
        <span className="text-gray-700 mx-0.5">|</span>
        <button key="all-f" onClick={() => setFloorFilter('all')}
          className={`px-2 py-0.5 rounded text-[10px] transition-all ${
            floorFilter === 'all' ? 'bg-cyan/15 text-cyan' : 'text-gray-500 hover:text-gray-300 bg-white/5'
          }`}>全部层</button>
        {floors.map(f => (
          <button key={f} onClick={() => setFloorFilter(f)}
            className={`px-2 py-0.5 rounded text-[10px] transition-all ${
              floorFilter === f ? 'bg-cyan/15 text-cyan' : 'text-gray-500 hover:text-gray-300 bg-white/5'
            }`}>{f}F</button>
        ))}
        <span className="text-gray-700 mx-0.5">|</span>
        {(['all', 'pass', 'warning', 'fail'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-2 py-0.5 rounded text-[10px] transition-all ${
              statusFilter === s ? 'bg-cyan/15 text-cyan' : 'text-gray-500 hover:text-gray-300 bg-white/5'
            }`}>{STATUS_LABEL[s]}</button>
        ))}
        <button onClick={() => setSelectedElements(filtered.map(el => el.id))}
          className="px-2 py-0.5 rounded text-[10px] text-gray-500 hover:text-cyan hover:bg-cyan/10 transition-all flex items-center gap-1"
          title="选中当前筛选结果中的所有构件">
          <CheckSquare size={11} /> 选中所有筛选构建
        </button>
        <span className="text-[10px] text-gray-600 ml-auto">{filtered.length} 条</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10 bg-[#0a0a1a]/95">
            <tr className="text-gray-500 border-b border-white/5">
              <Th onClick={() => handleSort('id')} sortKey={sortKey} dir={sortDir} colKey="id">#</Th>
              <Th onClick={() => handleSort('type')} sortKey={sortKey} dir={sortDir} colKey="type">类型</Th>
              <Th onClick={() => handleSort('section')} sortKey={sortKey} dir={sortDir} colKey="section">截面</Th>
              <Th onClick={() => handleSort('story')} sortKey={sortKey} dir={sortDir} colKey="story">层</Th>
              <Th onClick={() => handleSort('stress_ratio')} sortKey={sortKey} dir={sortDir} colKey="stress_ratio">应力比</Th>
              <Th onClick={() => handleSort('stability_ratio')} sortKey={sortKey} dir={sortDir} colKey="stability_ratio">稳定比</Th>
              <Th onClick={() => handleSort('deflection_ratio')} sortKey={sortKey} dir={sortDir} colKey="deflection_ratio">挠度比</Th>
              <Th onClick={() => handleSort('slenderness_ratio')} sortKey={sortKey} dir={sortDir} colKey="slenderness_ratio">长细比</Th>
              <Th onClick={() => handleSort('pass')} sortKey={sortKey} dir={sortDir} colKey="pass">结果</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(el => {
              const mr = getMaxRatio(el);
              const sc = stressColor(mr);
              const isSelected = selectedRow === el.id;
              return (
                <tr key={el.id}
                  ref={node => { if (node) rowRefs.current.set(el.id, node); }}
                  onClick={(e) => handleRowClick(el, e)}
                  className={`border-b border-white/[0.02] cursor-pointer transition-all hover:bg-white/5 ${
                    isSelected ? 'bg-purple-400/10 !border-purple-400/20 ring-1 ring-purple-400/20' : ''
                  }`}
                  style={{ backgroundColor: isSelected ? undefined : sc.bg }}>
                  <td className="py-1.5 pl-3 text-gray-400 font-mono">{el.id}</td>
                  <td className="py-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                      el.type === 'column' ? 'bg-blue-400/10 text-blue-400' : 'bg-green-400/10 text-green-400'
                    }`}>{el.type === 'column' ? '柱' : '梁'}</span>
                  </td>
                  <td className="py-1.5 text-gray-300 font-mono text-[10px]">{el.section || '-'}</td>
                  <td className="py-1.5 text-gray-400 text-center">{el.story || '-'}F</td>
                  <td className="py-1.5 font-mono text-right pr-2" style={{ color: sc.dot }}>
                    {el.stress_ratio.toFixed(4)}
                  </td>
                  <td className="py-1.5 font-mono text-right pr-2 text-gray-400">
                    {el.stability_ratio.toFixed(4)}
                  </td>
                  <td className="py-1.5 font-mono text-right pr-2 text-gray-400">
                    {el.deflection_ratio.toFixed(4)}
                  </td>
                  <td className="py-1.5 font-mono text-right pr-2 text-gray-400">
                    {el.slenderness_ratio.toFixed(1)}
                  </td>
                  <td className="py-1.5 pr-3 text-center">
                    {(() => {
                      const cls = ratioClass(mr, safeLimit, criticalLimit);
                      return cls === 'pass'
                        ? <CheckCircle size={12} className="text-green-400 inline" />
                        : cls === 'warning'
                          ? <AlertTriangle size={12} className="text-yellow-400 inline" />
                          : <XCircle size={12} className="text-red-400 inline" />;
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom detail bar */}
      {detailEl && (
        <div className="px-4 py-3 border-t border-white/5 flex-shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-gray-300">
              {detailEl.type === 'column' ? '柱' : '梁'} #{detailEl.id}
            </span>
            <span className="text-[10px] text-gray-600">{detailEl.section} · {detailEl.story}F</span>
            <span className={`ml-auto text-[10px] font-medium ${detailEl.pass ? 'text-green-400' : 'text-red-400'}`}>
              {detailEl.pass ? '通过' : '不通过'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-x-3 gap-y-1 text-[11px]">
            <span className="text-gray-500">应力比</span>
            <span className="text-right font-mono" style={{ color: stressColor(detailEl.stress_ratio).dot }}>
              {detailEl.stress_ratio.toFixed(4)}
            </span>
            <span className="text-gray-500">稳定比</span>
            <span className="text-right font-mono text-gray-300">{detailEl.stability_ratio.toFixed(4)}</span>
            <span className="text-gray-500">挠度比</span>
            <span className="text-right font-mono text-gray-300">{detailEl.deflection_ratio.toFixed(4)}</span>
            <span className="text-gray-500">长细比</span>
            <span className="text-right font-mono text-gray-300">{detailEl.slenderness_ratio.toFixed(1)}</span>
          </div>
          {detailEl.messages && detailEl.messages.length > 0 && (
            <div className="space-y-0.5">
              {detailEl.messages.map((msg, i) => (
                <div key={i} className="text-[10px] text-red-400/80">{msg}</div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
      {detailModal}
    </>
  );
}

// ── Sortable table header ─────────────────────────────────────────

function Th({ children, onClick, sortKey, dir, colKey }: {
  children: React.ReactNode;
  onClick: () => void;
  sortKey: SortKey;
  dir: SortDir;
  colKey: string;
}) {
  const active = sortKey === colKey;
  return (
    <th onClick={onClick}
      className={`py-1.5 px-2 text-left font-normal cursor-pointer hover:text-gray-300 transition-colors ${
        active ? 'text-cyan' : ''
      }`}>
      <span className="inline-flex items-center gap-1">
        {children}
        {active && <ArrowUpDown size={10} className={dir === 'desc' ? 'rotate-180' : ''} />}
      </span>
    </th>
  );
}
