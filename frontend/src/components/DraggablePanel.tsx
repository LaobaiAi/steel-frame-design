import { useRef, useState, useCallback } from 'react';

interface Props {
  children: React.ReactNode;
  defaultX: number;
  defaultY: number;
}

export default function DraggablePanel({ children, defaultX, defaultY }: Props) {
  const [pos, setPos] = useState({ x: defaultX, y: defaultY });
  const dragRef = useRef({ startX: 0, startY: 0, elX: 0, elY: 0, dragging: false });

  const onHandleDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const d = dragRef.current;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.elX = pos.x;
    d.elY = pos.y;
    d.dragging = true;

    const onMove = (ev: MouseEvent) => {
      if (!d.dragging) return;
      setPos({ x: d.elX + ev.clientX - d.startX, y: d.elY + ev.clientY - d.startY });
    };
    const onUp = () => {
      d.dragging = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos.x, pos.y]);

  return (
    <div className="fixed z-30" style={{ left: pos.x, top: pos.y }}>
      {/* Drag handle bar */}
      <div
        className="h-5 flex items-center gap-1 px-3 cursor-grab active:cursor-grabbing rounded-t-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
        onMouseDown={onHandleDown}
      >
        <span className="w-4 h-0.5 rounded-full bg-white/10" />
        <span className="w-2 h-0.5 rounded-full bg-white/10" />
        <span className="w-3 h-0.5 rounded-full bg-white/10" />
      </div>
      {children}
    </div>
  );
}
