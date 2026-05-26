import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { GripHorizontal, X, PanelRightOpen } from 'lucide-react';

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
}

const SNAP_THRESHOLD = 80;
const DOCK_TOP = 112;
const DOCK_GAP = 4;
const COLLAPSED_TAB_SIZE = 42;

export default function DockPanel({
  id, title = '', children, defaultX = 100, defaultY = 100,
  defaultDock, width = 260, dockOnly = false, icon, startExpanded = false,
}: DockPanelProps) {
  const dockPanels = useStore(s => s.dockPanels);
  const panelHeights = useStore(s => s.panelHeights);
  const collapsedDocked = useStore(s => s.collapsedDocked);
  const dockPanel = useStore(s => s.dockPanel);
  const undockPanel = useStore(s => s.undockPanel);
  const setPanelHeight = useStore(s => s.setPanelHeight);
  const setCollapsedDocked = useStore(s => s.setCollapsedDocked);
  const [pos, setPos] = useState({ x: defaultX, y: defaultY });
  const [snapSide, setSnapSide] = useState<'left' | 'right' | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startX: 0, startY: 0, elX: 0, elY: 0, dragging: false, wasDocked: false });
  const posRef = useRef(pos);
  posRef.current = pos;
  const myDockSideRef = useRef<'left' | 'right' | null>(null);
  myDockSideRef.current = dockPanels.left.includes(id) ? 'left'
    : dockPanels.right.includes(id) ? 'right' : null;

  const myDockSide = myDockSideRef.current;
  const myIndex = myDockSide === 'left'
    ? dockPanels.left.indexOf(id)
    : myDockSide === 'right'
      ? dockPanels.right.indexOf(id) : -1;
  const isCollapsed = myDockSide ? (collapsedDocked[id] ?? !startExpanded) : false;

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
      const panelW = panelRef.current?.offsetWidth ?? width;
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
  }, [id, width, isCollapsed, dockPanel, undockPanel, setCollapsedDocked]);

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
        className="fixed z-30 max-h-[85vh] flex flex-col"
        style={{ [isLeft ? 'left' : 'right']: 0, top: dockTop, width }}
      >
        <div className="glass-strong rounded-r-xl overflow-hidden shadow-2xl border border-white/5 flex flex-col">
          {/* Header / drag handle */}
          <div
            className="flex items-center justify-between px-3 py-1.5 cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors select-none"
            onMouseDown={onHandleDown}
          >
            <button
              onClick={() => setCollapsedDocked(id, true)}
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
          {/* Content */}
          <div className="overflow-y-auto flex-1 min-h-0">
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
          <div className={`absolute inset-y-24 w-0.5 ${snapSide === 'left' ? 'left-0' : 'right-0'} bg-cyan/50 shadow-lg shadow-cyan/30`} />
        </div>
      )}

      <div
        ref={panelRef}
        className="fixed z-30"
        style={{ left: pos.x, top: pos.y }}
      >
        <div className="glass-strong rounded-xl overflow-hidden shadow-2xl border border-white/5">
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
