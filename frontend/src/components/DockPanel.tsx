import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { X, PanelRightOpen } from 'lucide-react';

interface DockPanelProps {
  id: string;
  title?: string;
  children: React.ReactNode;
  defaultX?: number;
  defaultY?: number;
  defaultDock?: 'left' | 'right';
  width?: number;
  /** Only render when docked, fully unmount when floating */
  dockOnly?: boolean;
  /** Icon to show when in collapsed docked state */
  icon?: React.ReactNode;
  /** Start expanded instead of collapsed (default: false) */
  startExpanded?: boolean;
  /** Remove glass background, border, shadow (panel content provides its own styling) */
  noFrame?: boolean;
}

const SNAP_THRESHOLD = 80;
const DOCK_TOP = 112;
const DOCK_GAP = 4;
const COLLAPSED_TAB_SIZE = 42;
const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH = 800;
const MIN_PANEL_HEIGHT = 120;

export default function DockPanel({
  id, title = '', children, defaultX = 100, defaultY = 100,
  defaultDock, width = 260, dockOnly = false, icon, startExpanded = false, noFrame = false,
}: DockPanelProps) {
  const dockPanels = useStore(s => s.dockPanels);
  const panelHeights = useStore(s => s.panelHeights);
  const panelWidths = useStore(s => s.panelWidths);
  const collapsedDocked = useStore(s => s.collapsedDocked);
  const dockPanel = useStore(s => s.dockPanel);
  const undockPanel = useStore(s => s.undockPanel);
  const setPanelHeight = useStore(s => s.setPanelHeight);
  const setPanelWidth = useStore(s => s.setPanelWidth);
  const setCollapsedDocked = useStore(s => s.setCollapsedDocked);
  const [pos, setPos] = useState({ x: defaultX, y: defaultY });
  const [snapSide, setSnapSide] = useState<'left' | 'right' | null>(null);
  const [fixedHeight, setFixedHeight] = useState<number | null>(
    startExpanded ? 600 : null
  );
  const [topOffset, setTopOffset] = useState(0);
  const resizeRef = useRef({ startX: 0, startY: 0, startW: 0, startH: 0, mode: '' as 'h' | 'v' | 'hv' | 'vt' });
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startX: 0, startY: 0, elX: 0, elY: 0, dragging: false, wasDocked: false });
  const posRef = useRef(pos);
  useLayoutEffect(() => {
    posRef.current = pos;
  });
  const myDockSideRef = useRef<'left' | 'right' | null>(null);
  useLayoutEffect(() => {
    myDockSideRef.current = dockPanels.left.includes(id) ? 'left'
      : dockPanels.right.includes(id) ? 'right' : null;
  });

  const myDockSide = dockPanels.left.includes(id) ? 'left'
      : dockPanels.right.includes(id) ? 'right' : null;
  const myIndex = myDockSide === 'left'
    ? dockPanels.left.indexOf(id)
    : myDockSide === 'right'
      ? dockPanels.right.indexOf(id) : -1;
  const isCollapsed = myDockSide ? (collapsedDocked[id] ?? !startExpanded) : false;

  // Actual width: store value > prop default
  const actualWidth = panelWidths[id] ?? width;

  // Initialize default dock on mount, clean up on unmount
  useEffect(() => {
    if (defaultDock) {
      const cur = useStore.getState().dockPanels;
      if (!cur.left.includes(id) && !cur.right.includes(id)) {
        dockPanel(id, defaultDock);
        setCollapsedDocked(id, !startExpanded);
      }
    }
    return () => {
      // Clean up stale dock entries when panel unmounts
      const cur = useStore.getState().dockPanels;
      if (cur.left.includes(id) || cur.right.includes(id)) {
        undockPanel(id);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for auto-dock event (dispatched when canvas is clicked)
  useEffect(() => {
    const handler = () => {
      if (!myDockSideRef.current) {
        const side = posRef.current.x < window.innerWidth / 2 ? 'left' : 'right';
        dockPanel(id, side);
        setCollapsedDocked(id, true);
      }
    };
    window.addEventListener('caiao-auto-dock', handler);
    return () => window.removeEventListener('caiao-auto-dock', handler);
  }, [id, dockPanel, setCollapsedDocked]);

  // ResizeObserver to track height for stacking
  useEffect(() => {
    if (!myDockSide || isCollapsed || !panelRef.current) return;
    const el = panelRef.current;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setPanelHeight(id, entry.contentRect.height);
      }
    });
    ro.observe(el);
    setPanelHeight(id, el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, [myDockSide, isCollapsed, id, setPanelHeight]);

  // When collapsed, store minimal height
  useEffect(() => {
    if (myDockSide && isCollapsed) {
      setPanelHeight(id, COLLAPSED_TAB_SIZE);
    }
  }, [myDockSide, isCollapsed, id, setPanelHeight]);

  // Calculate dock position based on accumulated heights of panels above
  let dockTop = DOCK_TOP;
  if (myDockSide) {
    const sidePanels = myDockSide === 'left' ? dockPanels.left : dockPanels.right;
    for (let i = 0; i < myIndex; i++) {
      dockTop += (panelHeights[sidePanels[i]] || COLLAPSED_TAB_SIZE) + DOCK_GAP;
    }
  }

  const onHandleDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const d = dragRef.current;
    const rect = panelRef.current?.getBoundingClientRect();
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.elX = rect?.left ?? 0;
    d.elY = rect?.top ?? 0;
    d.dragging = false;
    d.wasDocked = myDockSideRef.current !== null;

    // If docked and collapsed, expand on click first — only drag if moved
    if (d.wasDocked && isCollapsed) {
      setCollapsedDocked(id, false);
      d.dragging = false;
      d.wasDocked = false;
      return;
    }

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;

      if (!d.dragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        d.dragging = true;
        if (d.wasDocked) {
          undockPanel(id);
          setPos({ x: d.elX, y: d.elY });
        }
      }

      if (!d.dragging) return;

      // Clamp position to keep panel visible
      const panelW = panelRef.current?.offsetWidth ?? actualWidth;
      const clampedX = Math.max(-panelW * 0.25, Math.min(window.innerWidth - 40, d.elX + dx));
      const clampedY = Math.max(0, Math.min(window.innerHeight - 60, d.elY + dy));
      setPos({ x: clampedX, y: clampedY });

      if (ev.clientX < SNAP_THRESHOLD) setSnapSide('left');
      else if (ev.clientX > window.innerWidth - SNAP_THRESHOLD) setSnapSide('right');
      else setSnapSide(null);
    };

    const onUp = (ev: MouseEvent) => {
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      const didDrag = Math.abs(dx) > 5 || Math.abs(dy) > 5;

      if (didDrag && d.dragging) {
        if (ev.clientX < SNAP_THRESHOLD) {
          dockPanel(id, 'left');
          setCollapsedDocked(id, false);
        } else if (ev.clientX > window.innerWidth - SNAP_THRESHOLD) {
          dockPanel(id, 'right');
          setCollapsedDocked(id, false);
        }
      }

      d.dragging = false;
      d.wasDocked = false;
      setSnapSide(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [id, actualWidth, isCollapsed, dockPanel, undockPanel, setCollapsedDocked]);

  // ── Shared resize handler (works for both docked and floating) ──
  const onResizeStart = useCallback((
    e: React.MouseEvent,
    mode: 'h' | 'v' | 'hv' | 'vt',
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const r = resizeRef.current;
    const rect = panelRef.current?.getBoundingClientRect();
    r.startX = e.clientX;
    r.startY = e.clientY;
    r.startW = rect?.width ?? actualWidth;
    r.startH = rect?.height ?? 400;
    r.mode = mode;

    const side = myDockSideRef.current;
    const startTopOff = topOffset;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - r.startX;
      const dy = ev.clientY - r.startY;

      if (r.mode === 'h' || r.mode === 'hv') {
        const newW = side === 'right' ? r.startW - dx : r.startW + dx;
        setPanelWidth(id, Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newW)));
      }

      if (r.mode === 'v' || r.mode === 'hv') {
        setFixedHeight(Math.max(MIN_PANEL_HEIGHT, r.startH + dy));
      }

      if (r.mode === 'vt') {
        // Drag up (dy < 0): height grows, top edge moves up
        // Drag down (dy > 0): height shrinks, top edge moves down
        const newH = r.startH - dy;
        const clampedH = Math.max(MIN_PANEL_HEIGHT, newH);
        setFixedHeight(clampedH);
        // Shift top so the panel extends/contracts from the top edge
        setTopOffset(startTopOff + dy);
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [id, actualWidth, topOffset, setPanelWidth]);

  // ── Docked + Collapsed: prominent edge tab ──
  if (myDockSide && isCollapsed) {
    const isLeft = myDockSide === 'left';
    return (
      <div
        ref={panelRef}
        className="fixed z-30"
        style={{ [isLeft ? 'left' : 'right']: 0, top: dockTop, minHeight: COLLAPSED_TAB_SIZE }}
      >
        <button
          onClick={() => setCollapsedDocked(id, false)}
          onMouseDown={onHandleDown}
          className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer
            glass-strong hover:bg-white/[0.12] transition-all duration-200
            ${isLeft ? 'rounded-r-xl' : 'rounded-l-xl'}
            border-l-2 border-cyan/30 shadow-2xl group`}
          title={`点击展开 ${title}`}
        >
          <span className="text-gray-300 group-hover:text-cyan transition-colors shrink-0">
            {icon || <PanelRightOpen size={16} />}
          </span>
          <span className="text-xs font-medium text-gray-400 group-hover:text-white tracking-wide whitespace-nowrap">
            {title}
          </span>
          <span className="text-[9px] text-gray-600 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
            展开
          </span>
        </button>
      </div>
    );
  }

  // ── Docked + Expanded ──
  if (myDockSide) {
    const isLeft = myDockSide === 'left';

    return (
      <div
        ref={panelRef}
        className="fixed z-30 flex flex-col"
        style={{
          [isLeft ? 'left' : 'right']: 0,
          top: dockTop + topOffset,
          width: actualWidth,
          height: fixedHeight ?? undefined,
          maxHeight: fixedHeight ? undefined : '85vh',
        }}
      >
        {/* Resize handles — outside glass-strong so overflow-hidden doesn't clip them */}
        {/* Top handle — drag up to expand upward */}
        <div
          className="absolute inset-x-0 top-0 h-1.5 z-30 cursor-row-resize
            transition-all duration-150
            hover:bg-purple-400/40 active:bg-purple-400/60"
          onMouseDown={(e) => onResizeStart(e, 'vt')}
        />
        <div
          className={`absolute inset-y-0 w-1.5 z-30 cursor-col-resize
            transition-all duration-150
            hover:bg-purple-400/40 active:bg-purple-400/60
            ${isLeft ? 'right-0' : 'left-0'}`}
          onMouseDown={(e) => onResizeStart(e, 'h')}
        />
        {/* Bottom handle */}
        <div
          className="absolute inset-x-0 bottom-0 h-1.5 z-30 cursor-row-resize
            transition-all duration-150
            hover:bg-purple-400/40 active:bg-purple-400/60"
          onMouseDown={(e) => onResizeStart(e, 'v')}
        />
        {/* Corner handle */}
        <div
          className={`absolute bottom-0 z-30 w-3 h-3 cursor-nwse-resize
            transition-all duration-150
            hover:bg-purple-400/40 active:bg-purple-400/60
            ${isLeft ? 'right-0' : 'left-0'}`}
          style={{ clipPath: 'polygon(100% 0, 0 100%, 100% 100%)' }}
          onMouseDown={(e) => onResizeStart(e, 'hv')}
        />

        <div className={`${noFrame ? '' : 'glass-strong rounded-r-xl shadow-2xl border border-white/5'} flex flex-col flex-1 min-h-0`}>
          {/* Header / drag handle */}
          <div
            className="flex items-center justify-between px-3 py-1.5 cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors select-none"
            onMouseDown={onHandleDown}
          >
            <button
              onClick={() => { setCollapsedDocked(id, true); setTopOffset(0); }}
              className="text-gray-500 hover:text-gray-300 transition-colors p-0.5 shrink-0 mr-1"
              title="折叠"
            >
              <ChevronLeft size={11} />
            </button>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 flex-1 min-w-0">
              <span className="truncate">{title}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); undockPanel(id); }}
              className="text-gray-600 hover:text-gray-300 transition-colors p-0.5 shrink-0"
              title="浮动"
            >
              <X size={11} />
            </button>
          </div>
          {/* Content — flex-col so children (ResultsPanel) get a definite flex-1 height */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // ── Floating state ──
  if (dockOnly) return null;

  return (
    <>
      {/* Snap indicator — glowing edge line */}
      {snapSide && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className={`absolute inset-y-24 w-0.5 ${snapSide === 'left' ? 'left-0' : 'right-0'} bg-purple-400/50 shadow-lg shadow-purple-400/30`} />
        </div>
      )}

      <div
        ref={panelRef}
        className="fixed z-30"
        style={{ left: pos.x, top: pos.y, width: actualWidth }}
      >
        {/* Resize handles */}
        <div
          className="absolute inset-y-0 right-0 w-1.5 z-30 cursor-col-resize
            transition-all duration-150
            hover:bg-purple-400/40 active:bg-purple-400/60"
          onMouseDown={(e) => onResizeStart(e, 'h')}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-1.5 z-30 cursor-row-resize
            transition-all duration-150
            hover:bg-purple-400/40 active:bg-purple-400/60"
          onMouseDown={(e) => onResizeStart(e, 'v')}
        />
        <div
          className="absolute bottom-0 right-0 w-3 h-3 z-30 cursor-nwse-resize
            transition-all duration-150
            hover:bg-purple-400/40 active:bg-purple-400/60"
          style={{ clipPath: 'polygon(100% 0, 0 100%, 100% 100%)' }}
          onMouseDown={(e) => onResizeStart(e, 'hv')}
        />

        <div className="glass-strong rounded-xl shadow-2xl border border-white/5">
          {/* Drag handle */}
          <div
            className="flex items-center justify-between px-3 py-1 cursor-grab active:cursor-grabbing rounded-t-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors select-none"
            onMouseDown={onHandleDown}
          >
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="flex gap-0.5">
                <span className="w-3 h-0.5 rounded-full bg-white/10" />
                <span className="w-2 h-0.5 rounded-full bg-white/10" />
                <span className="w-1 h-0.5 rounded-full bg-white/10" />
              </span>
              {title}
            </div>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

function ChevronLeft({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
