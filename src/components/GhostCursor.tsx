import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * GhostCursor — a highly visible custom cursor rendered inside the
 * content-protected window.  Only the real user can see it; screen-share
 * viewers see nothing because setContentProtection hides the window content.
 *
 * Visual: bright cyan pulsing ring + white arrow + trailing glow.
 * Rendered via portal on document.body so it's never clipped.
 */
const GhostCursor: React.FC = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let raf = 0;
    let tx = 0, ty = 0;  // trail position (lerped)
    let cx = 0, cy = 0;  // real cursor position

    const onMove = (e: MouseEvent) => {
      cx = e.clientX;
      cy = e.clientY;
      // Cursor arrow follows instantly
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${cx}px, ${cy}px)`;
      }
      if (!visible) setVisible(true);
    };

    // Smooth trailing ring via requestAnimationFrame
    const tick = () => {
      tx += (cx - tx) * 0.18;
      ty += (cy - ty) * 0.18;
      if (trailRef.current) {
        trailRef.current.style.transform = `translate(${tx - 16}px, ${ty - 16}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onLeave = () => setVisible(false);
    const onEnter = () => setVisible(true);

    window.addEventListener('mousemove', onMove);
    document.documentElement.addEventListener('mouseleave', onLeave);
    document.documentElement.addEventListener('mouseenter', onEnter);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      document.documentElement.removeEventListener('mouseenter', onEnter);
    };
  }, [visible]);

  const portal = (
    <>
      {/* Trailing ring — smoothly follows cursor with delay */}
      <div
        ref={trailRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 32,
          height: 32,
          pointerEvents: 'none',
          zIndex: 2147483646,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.2s',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '2px solid rgba(34, 211, 238, 0.7)',
            boxShadow: '0 0 12px 2px rgba(34, 211, 238, 0.4), inset 0 0 6px rgba(34, 211, 238, 0.15)',
            animation: 'ghost-ring-pulse 1.5s ease-in-out infinite',
          }}
        />
      </div>

      {/* Main cursor — arrow + dot, follows instantly */}
      <div
        ref={cursorRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          pointerEvents: 'none',
          zIndex: 2147483647,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.15s',
        }}
      >
        {/* Dot at cursor tip */}
        <div
          style={{
            position: 'absolute',
            top: -3,
            left: -3,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#22d3ee',
            boxShadow: '0 0 8px 2px rgba(34, 211, 238, 0.6)',
          }}
        />
        {/* Arrow */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: 'absolute',
            top: -1,
            left: -1,
            filter: 'drop-shadow(0 0 6px rgba(34, 211, 238, 0.7)) drop-shadow(0 1px 3px rgba(0,0,0,0.6))',
          }}
        >
          <path
            d="M2 2L2 20L7 14.5L13 22L16 20L10.5 12.5L18 12L2 2Z"
            fill="rgba(255,255,255,0.95)"
            stroke="#0e7490"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Keyframes for the pulsing ring */}
      <style>{`
        @keyframes ghost-ring-pulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.25); opacity: 0.4; }
        }
      `}</style>
    </>
  );

  return createPortal(portal, document.body);
};

export default GhostCursor;
