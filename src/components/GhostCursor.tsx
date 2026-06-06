/**
 * GhostCursor — Custom DOM-rendered cursor, invisible to screen capture.
 *
 * Renders directly on <body> (via a portal) so it is NEVER clipped by
 * any parent's `overflow: hidden` or `backdrop-filter`.
 *
 * Two layers:
 *  • gc-dot  — 5 px cyan dot, follows mouse instantly via rAF.
 *  • gc-ring — 18 px ring, trails the dot ~90 ms via CSS transition.
 *
 * Position source: IPC stream from main process (`cursor:pos` at ~60 fps).
 * Using `screen.getCursorScreenPoint()` in the main process means the cursor
 * stays visible even when the mouse is over the ChatGPT <webview>, which
 * swallows all DOM mouse events from the parent renderer.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import React from 'react';

const GhostCursor: React.FC = () => {
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId: number;
    let mouseX = -200;
    let mouseY = -200;
    let visible = false;

    const show = () => {
      if (visible) return;
      visible = true;
      dotRef.current?.classList.remove('gc-hidden');
      ringRef.current?.classList.remove('gc-hidden');
    };

    const hide = () => {
      if (!visible) return;
      visible = false;
      dotRef.current?.classList.add('gc-hidden');
      ringRef.current?.classList.add('gc-hidden');
    };

    // IPC stream from main process — fires at ~60 fps using
    // screen.getCursorScreenPoint(), so it works over webviews too.
    const unsubIPC = window.electronAPI.onCursorPos(({ x, y }) => {
      // Hide when cursor leaves the window bounds
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
        hide();
        return;
      }
      mouseX = x;
      mouseY = y;
      show();
    });

    // rAF loop — applies the latest position at display refresh rate
    const tick = () => {
      if (dotRef.current)  dotRef.current.style.transform  = `translate(${mouseX}px, ${mouseY}px)`;
      if (ringRef.current) ringRef.current.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      unsubIPC();
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Render into <body> directly — bypasses all React tree overflow/filter parents
  return createPortal(
    <>
      {/* Outer trailing ring — CSS transition gives the 90 ms lag trail */}
      <div ref={ringRef} aria-hidden="true" className="gc-ring gc-hidden" />
      {/* Inner dot — instant rAF follow */}
      <div ref={dotRef}  aria-hidden="true" className="gc-dot  gc-hidden" />
    </>,
    document.body
  );
};

export default GhostCursor;
