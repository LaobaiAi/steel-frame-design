import { useMemo, useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { PieChart, CheckCircle, XCircle, AlertTriangle, Filter, ArrowUpDown } from 'lucide-react';
import type { CodeCheckElement } from '../types';

type TypeFilter = 'all' | 'column' | 'beam';
type StatusFilter = 'all' | 'pass' | 'fail' | 'warning';
type SortKey = keyof CodeCheckElement | '';
type SortDir = 'asc' | 'desc';

// ── Helpers ──────────────────────────────────────────────────────

const STRESS_COLORS = [
  { max: 0.45, bg: 'rgba(50,204,102,0.12)', dot: '#32CC66' },
  { max: 0.65, bg: 'rgba(170,221,0,0.12)', dot: '#AADD00' },
  { max: 0.85, bg: 'rgba(255,204,0,0.12)', dot: '#FFCC00' },
  { max: 1.0, bg: 'rgba(255,136,0,0.15)', dot: '#FF8800' },
  { max: Infinity, bg: 'rgba(255,68,0,0.18)', dot: '#FF4400' },
];

function stressColor(ratio: number) {
  for (const s of STRESS_COLORS) if (ratio <= s.max) return s;
  return STRESS_COLORS[STRESS_COLORS.length - 1];
}

function ratioClass(ratio: number): StatusFilter {
  if (ratio > 1.0) return 'fail';
  if (ratio > 0.8) return 'warning';
  return 'pass';
}

function statusLabel(s: StatusFilter) {
  if (s === 'pass') return '通过';
  if (s === 'fail') return '超限';
  if (s === 'warning') return '警告';
  return '全部';
}

// ── Generate mock data matching new CodeCheckElement shape ────────

function generateMockElements(): CodeCheckElement[] {
  const sections = ['HW400x400x13x21', 'HM390x300x10x16'];
  const els: CodeCheckElement[] = [];
  let id = 1;
  for (let story = 1; story <= 4; story++) {
    // 16 columns per floor (4x4 grid)
    for (let c = 0; c < 16; c++) {
      const r = 0.15 + Math.random() * 0.85;
      els.push({
        id: id++, type: 'column', section: sections[0], story,
        node_i: id * 2, node_j: id * 2 + 1,
        stress_ratio: +r.toFixed(4),
        stability_ratio: +(r * 0.85).toFixed(4),
        deflection_ratio: +(r * 0.3).toFixed(4),
        slenderness_ratio: +(Math.random() * 120).toFixed(1),
        pass: r <= 1.0,
      });
    }
    // 24 beams per floor (3x4 X + 4x3 Y)
    for (let b = 0; b < 24; b++) {
      const r = 0.2 + Math.random() * 0.85;
      els.push({
        id: id++, type: 'beam', section: sections[1], story,
        node_i: id * 2, node_j: id * 2 + 1,
        stress_ratio: +r.toFixed(4),
        stability_ratio: +(r * 0.82).toFixed(4),
        deflection_ratio: +(r * 0.45).toFixed(4),
        slenderness_ratio: +(Math.random() * 100).toFixed(1),
        pass: r <= 1.0,
      });
    }
  }
  return els;
}

const MOCK_ELEMENTS = generateMockElements();

// ── Main Component ───────────────────────────────────────────────

export default function ResultsPanel() {
  const { codeCheckResults, selectedElement, setSelectedElement } = useStore();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [floorFilter, setFloorFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('stress_ratio');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

  // ── Data ───────────────────────────────────────────────────────
  const elements: CodeCheckElement[] = useMemo(() => {
    if (!codeCheckResults) return MOCK_ELEMENTS;
    const data = codeCheckResults as any;
    if (data.elements && Array.isArray(data.elements) && data.elements.length > 0) {
      // Merge in defaults for missing fields (backward compat)
      return (data.elements as any[]).map((el: any) => ({
        id: el.id ?? 0,
        type: el.type ?? 'beam',
        section: el.section ?? '',
        story: el.story ?? 1,
        node_i: el.node_i ?? 0,
        node_j: el.node_j ?? 0,
        stress_ratio: el.stress_ratio ?? 0,
        stability_ratio: el.stability_ratio ?? 0,
        deflection_ratio: el.deflection_ratio ?? 0,
        slenderness_ratio: el.slenderness_ratio ?? 0,
        pass: el.pass ?? true,
        messages: el.messages ?? [],
      }));
    }
    return MOCK_ELEMENTS;
  }, [codeCheckResults]);

  // ── Floors ─────────────────────────────────────────────────────
  const floors = useMemo(() => {
    const s = new Set<number>();
    elements.forEach(el => s.add(el.story));
    return Array.from(s).sort((a, b) => a - b);
  }, [elements]);

  // ── Filter & Sort ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = elements;
    if (typeFilter !== 'all') result = result.filter(el => el.type === typeFilter);
    if (floorFilter !== 'all') result = result.filter(el => el.story === floorFilter);
    if (statusFilter === 'pass') result = result.filter(el => el.pass);
    else if (statusFilter === 'fail') result = result.filter(el => !el.pass && el.stress_ratio > 1.0);
    else if (statusFilter === 'warning') result = result.filter(el => el.pass && el.stress_ratio > 0.8);

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        const va = typeof av === 'number' ? av : String(av);
        const vb = typeof bv === 'number' ? bv : String(bv);
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [elements, typeFilter, floorFilter, statusFilter, sortKey, sortDir]);

  // ── Stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = elements.length;
    const passed = elements.filter(e => e.pass).length;
    const failed = elements.filter(e => !e.pass).length;
    const critical = elements.filter(e => e.stress_ratio > 1.0).length;
    const warning = elements.filter(e => e.stress_ratio > 0.8 && e.stress_ratio <= 1.0).length;
    const safe = elements.filter(e => e.stress_ratio <= 0.8).length;
    return { total, passed, failed, critical, warning, safe };
  }, [elements]);

  // ── Selection & scroll ─────────────────────────────────────────
  useEffect(() => {
    if (selectedElement !== null) {
      setSelectedRow(selectedElement);
      const row = rowRefs.current.get(selectedElement);
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [selectedElement]);

  const handleRowClick = (el: CodeCheckElement) => {
    setSelectedElement(el.id);
    setSelectedRow(el.id);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // ── Selected detail ────────────────────────────────────────────
  const detailEl = selectedRow ? elements.find(e => e.id === selectedRow) : null;

  return (
    <div className="glass-strong rounded-xl overflow-hidden flex flex-col max-h-[620px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2 flex-shrink-0">
        <PieChart size={14} className="text-cyan" />
        <span className="text-xs font-medium text-white">校核统计</span>
        <span className="text-[10px] text-gray-500 ml-auto">{stats.total} 构件</span>
      </div>

      {/* Donut chart */}
      <div className="px-4 py-3 flex items-center gap-4 flex-shrink-0 border-b border-white/5">
        <svg width="70" height="70" viewBox="0 0 80 80" className="flex-shrink-0">
          <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          {stats.safe > 0 && (
            <circle cx="40" cy="40" r="32" fill="none" stroke="#32CC66" strokeWidth="8"
              strokeDasharray={`${(stats.safe / stats.total) * 200.96} 200.96`}
              strokeDashoffset="0" transform="rotate(-90 40 40)" strokeLinecap="round" />
          )}
          {stats.warning > 0 && (
            <circle cx="40" cy="40" r="32" fill="none" stroke="#FFCC00" strokeWidth="8"
              strokeDasharray={`${(stats.warning / stats.total) * 200.96} 200.96`}
              strokeDashoffset={-((stats.safe / stats.total) * 200.96)}
              transform="rotate(-90 40 40)" strokeLinecap="round" />
          )}
          {stats.critical > 0 && (
            <circle cx="40" cy="40" r="32" fill="none" stroke="#FF4400" strokeWidth="8"
              strokeDasharray={`${(stats.critical / stats.total) * 200.96} 200.96`}
              strokeDashoffset={-(((stats.safe + stats.warning) / stats.total) * 200.96)}
              transform="rotate(-90 40 40)" strokeLinecap="round" />
          )}
          <text x="40" y="36" textAnchor="middle" className="fill-white text-[11px] font-bold">{stats.total}</text>
          <text x="40" y="48" textAnchor="middle" className="fill-gray-400 text-[8px]">构件</text>
        </svg>
        <div className="space-y-1 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#32CC66]" />
            <span className="text-gray-400">安全 (&le;0.8)</span>
            <span className="text-white font-medium ml-auto">{stats.safe}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#FFCC00]" />
            <span className="text-gray-400">警告 (&gt;0.8)</span>
            <span className="text-white font-medium ml-auto">{stats.warning}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#FF4400]" />
            <span className="text-gray-400">超限 (&gt;1.0)</span>
            <span className="text-white font-medium ml-auto">{stats.critical}</span>
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="px-3 py-2 flex items-center gap-1.5 flex-shrink-0 border-b border-white/5 flex-wrap">
        <Filter size={11} className="text-gray-500 flex-shrink-0" />
        {/* Type filter */}
        {(['all', 'column', 'beam'] as const).map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-2 py-0.5 rounded text-[10px] transition-all ${
              typeFilter === t ? 'bg-cyan/15 text-cyan' : 'text-gray-500 hover:text-gray-300 bg-white/5'
            }`}>
            {t === 'all' ? '全部' : t === 'column' ? '柱' : '梁'}
          </button>
        ))}
        <span className="text-gray-700 mx-0.5">|</span>
        {/* Floor filter */}
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
        {/* Status filter */}
        {(['all', 'pass', 'warning', 'fail'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-2 py-0.5 rounded text-[10px] transition-all ${
              statusFilter === s ? 'bg-cyan/15 text-cyan' : 'text-gray-500 hover:text-gray-300 bg-white/5'
            }`}>{statusLabel(s)}</button>
        ))}
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
              const sc = stressColor(el.stress_ratio);
              const isSelected = selectedRow === el.id;
              return (
                <tr key={el.id}
                  ref={node => { if (node) rowRefs.current.set(el.id, node); }}
                  onClick={() => handleRowClick(el)}
                  className={`border-b border-white/[0.02] cursor-pointer transition-all hover:bg-white/5 ${
                    isSelected ? 'bg-cyan/10 !border-cyan/20 ring-1 ring-cyan/20' : ''
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
                    {el.pass
                      ? <CheckCircle size={12} className="text-green-400 inline" />
                      : ratioClass(el.stress_ratio) === 'warning'
                        ? <AlertTriangle size={12} className="text-yellow-400 inline" />
                        : <XCircle size={12} className="text-red-400 inline" />
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
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
