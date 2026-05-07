'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  ThumbwheelDock,
  ThumbwheelItem,
  ThumbwheelProps,
} from './types';

// ── Defaults ──────────────────────────────────────────────────────────
const DEFAULT_INNER_RADIUS = 130;
const DEFAULT_OUTER_RADIUS = 210;
const DEFAULT_VISIBLE_ARC = Math.PI / 2;
const DEFAULT_TRIGGER_SIZE = 56;
const DEFAULT_EDGE_INSET = 20;
const ANCHOR_INSET = 32;
const ICON_SIZE = 24;
const SPIN_THRESHOLD_RAD = 0.04;
const TRIGGER_DRAG_THRESHOLD_PX = 5;
const VELOCITY_SAMPLE_WINDOW_MS = 100;
const TWO_PI = Math.PI * 2;

const DEFAULT_FRICTION = 0.95;
const DEFAULT_MAX_VELOCITY = 0.012;
const DEFAULT_MIN_VELOCITY = 0.0001;
const DEFAULT_FLICK_THRESHOLD = 0.0005;

// Default colors (inline hex, no CSS dependency).
const DEFAULTS = {
  baseFill: '#d6d3d1',
  evenSectorFill: '#fafaf9',
  oddSectorFill: '#e7e5e4',
  spoke: '#a8a29e',
  spokeWidth: 1.5,
  textColor: '#44403c',
  triggerBg: '#1c1917',
  triggerFg: '#fafaf9',
  backdrop: 'rgba(0,0,0,0.4)',
} as const;

// ── SVG path helpers ──────────────────────────────────────────────────

// `direction` is +1 for left dock (sweep clockwise from up to right) and
// -1 for right dock (counterclockwise from up to left).
function polar(cx: number, cy: number, r: number, angle: number, direction: 1 | -1) {
  return {
    x: cx + direction * r * Math.sin(angle),
    y: cy - r * Math.cos(angle),
  };
}

function annularSectorPath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  a1: number,
  a2: number,
  direction: 1 | -1,
): string {
  const so = polar(cx, cy, rOut, a1, direction);
  const eo = polar(cx, cy, rOut, a2, direction);
  const si = polar(cx, cy, rIn, a1, direction);
  const ei = polar(cx, cy, rIn, a2, direction);
  const sweepOuter = direction === -1 ? 0 : 1;
  const sweepInner = sweepOuter === 0 ? 1 : 0;
  const largeArc = a2 - a1 > Math.PI ? 1 : 0;
  return [
    `M ${si.x} ${si.y}`,
    `L ${so.x} ${so.y}`,
    `A ${rOut} ${rOut} 0 ${largeArc} ${sweepOuter} ${eo.x} ${eo.y}`,
    `L ${ei.x} ${ei.y}`,
    `A ${rIn} ${rIn} 0 ${largeArc} ${sweepInner} ${si.x} ${si.y}`,
    'Z',
  ].join(' ');
}

function wedgeClipPath(
  cx: number,
  cy: number,
  rOut: number,
  visibleArc: number,
  direction: 1 | -1,
): string {
  const so = polar(cx, cy, rOut, 0, direction);
  const eo = polar(cx, cy, rOut, visibleArc, direction);
  const sweepOuter = direction === -1 ? 0 : 1;
  return `M ${cx} ${cy} L ${so.x} ${so.y} A ${rOut} ${rOut} 0 0 ${sweepOuter} ${eo.x} ${eo.y} Z`;
}

// ── Default trigger icons (inline SVG so library has zero icon deps) ──

const DefaultMenuIcon = (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
);

const DefaultCloseIcon = (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────

export function Thumbwheel(props: ThumbwheelProps) {
  const {
    items,
    onSelect,
    defaultDock = 'right',
    storageKey = 'thumbwheel-dock',
    triggerIcon = DefaultMenuIcon,
    closeIcon = DefaultCloseIcon,
    theme = {},
    geometry = {},
    physics = {},
    triggerLabelOpen = 'Close navigation',
    triggerLabelClose = 'Open navigation',
  } = props;

  const innerRadius = geometry.innerRadius ?? DEFAULT_INNER_RADIUS;
  const outerRadius = geometry.outerRadius ?? DEFAULT_OUTER_RADIUS;
  const visibleArc = geometry.visibleArc ?? DEFAULT_VISIBLE_ARC;
  const triggerSize = geometry.triggerSize ?? DEFAULT_TRIGGER_SIZE;
  const edgeInset = geometry.edgeInset ?? DEFAULT_EDGE_INSET;
  const angleStep = items.length > 0 ? TWO_PI / items.length : 0;

  const friction = physics.friction ?? DEFAULT_FRICTION;
  const maxVelocity = physics.maxVelocity ?? DEFAULT_MAX_VELOCITY;
  const minVelocity = physics.minVelocity ?? DEFAULT_MIN_VELOCITY;
  const flickThreshold = physics.flickThreshold ?? DEFAULT_FLICK_THRESHOLD;

  const baseFill = theme.baseFill ?? DEFAULTS.baseFill;
  const evenSectorFill = theme.evenSectorFill ?? DEFAULTS.evenSectorFill;
  const oddSectorFill = theme.oddSectorFill ?? DEFAULTS.oddSectorFill;
  const spoke = theme.spoke ?? DEFAULTS.spoke;
  const spokeWidth = theme.spokeWidth ?? DEFAULTS.spokeWidth;
  const textColor = theme.textColor ?? DEFAULTS.textColor;
  const triggerBg = theme.triggerBg ?? DEFAULTS.triggerBg;
  const triggerFg = theme.triggerFg ?? DEFAULTS.triggerFg;
  const backdrop = theme.backdrop ?? DEFAULTS.backdrop;

  const [isOpen, setIsOpen] = useState(false);
  const [spinOffset, setSpinOffset] = useState(0);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [dock, setDock] = useState<ThumbwheelDock>(defaultDock);
  const [triggerX, setTriggerX] = useState(0);
  const [isTriggerDragging, setIsTriggerDragging] = useState(false);
  const spinDragRef = useRef<{
    startAngle: number;
    startOffset: number;
    moved: boolean;
  } | null>(null);
  const triggerDragRef = useRef<{
    startClientX: number;
    startTriggerX: number;
    moved: boolean;
  } | null>(null);
  const velocityRef = useRef(0);
  const samplesRef = useRef<{ offset: number; time: number }[]>([]);
  const momentumFrameRef = useRef<number | null>(null);
  const triggerXRef = useRef(triggerX);

  useEffect(() => {
    triggerXRef.current = triggerX;
  }, [triggerX]);

  // Restore last dock preference from localStorage. Coerce legacy
  // 'center' values (from the three-dock variant in the original
  // prototype) to 'right'.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(storageKey);
    if (saved === 'left' || saved === 'right') {
      setDock(saved);
    } else if (saved === 'center') {
      setDock('right');
      window.localStorage.setItem(storageKey, 'right');
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Stop momentum on close + on unmount.
  useEffect(() => {
    if (!isOpen) {
      if (momentumFrameRef.current !== null) {
        cancelAnimationFrame(momentumFrameRef.current);
        momentumFrameRef.current = null;
        velocityRef.current = 0;
      }
    }
    return () => {
      if (momentumFrameRef.current !== null) {
        cancelAnimationFrame(momentumFrameRef.current);
        momentumFrameRef.current = null;
      }
    };
  }, [isOpen]);

  // Lock body scroll + disable pull-to-refresh while open.
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const scrollY = window.scrollY;
    const html = document.documentElement;
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const originalOverscroll = html.style.overscrollBehaviorY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    html.style.overscrollBehaviorY = 'none';
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      html.style.overscrollBehaviorY = originalOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  const snapPoints = useMemo<Record<ThumbwheelDock, number>>(
    () => ({
      left: edgeInset,
      right: viewport.w - triggerSize - edgeInset,
    }),
    [viewport.w, edgeInset, triggerSize],
  );

  useEffect(() => {
    if (viewport.w > 0 && !isTriggerDragging) {
      setTriggerX(snapPoints[dock]);
    }
  }, [viewport.w, dock, snapPoints, isTriggerDragging]);

  const isLeftDock = dock === 'left';
  const anchorX = isLeftDock ? ANCHOR_INSET : viewport.w - ANCHOR_INSET;
  const anchorY = viewport.h - ANCHOR_INSET;
  const direction: 1 | -1 = isLeftDock ? 1 : -1;

  const angleFromAnchor = (clientX: number, clientY: number) => {
    const dx = clientX - anchorX;
    const dy = clientY - anchorY;
    return Math.atan2(-dy, direction * -dx);
  };

  const stopMomentum = () => {
    if (momentumFrameRef.current !== null) {
      cancelAnimationFrame(momentumFrameRef.current);
      momentumFrameRef.current = null;
    }
    velocityRef.current = 0;
  };

  const startMomentum = () => {
    let lastTime = performance.now();
    const tick = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      setSpinOffset((prev) => prev + velocityRef.current * dt);
      velocityRef.current *= Math.pow(friction, dt / 16);
      if (Math.abs(velocityRef.current) > minVelocity) {
        momentumFrameRef.current = requestAnimationFrame(tick);
      } else {
        momentumFrameRef.current = null;
        velocityRef.current = 0;
      }
    };
    momentumFrameRef.current = requestAnimationFrame(tick);
  };

  const handleSpinPointerDown = (e: React.PointerEvent) => {
    stopMomentum();
    const angle = angleFromAnchor(e.clientX, e.clientY);
    spinDragRef.current = {
      startAngle: angle,
      startOffset: spinOffset,
      moved: false,
    };
    samplesRef.current = [{ offset: spinOffset, time: performance.now() }];
  };

  const handleSpinPointerMove = (e: React.PointerEvent) => {
    if (!spinDragRef.current) return;
    const angle = angleFromAnchor(e.clientX, e.clientY);
    let delta = angle - spinDragRef.current.startAngle;
    if (delta > Math.PI) delta -= TWO_PI;
    if (delta < -Math.PI) delta += TWO_PI;
    if (Math.abs(delta) > SPIN_THRESHOLD_RAD) spinDragRef.current.moved = true;
    const newOffset = spinDragRef.current.startOffset + delta;
    setSpinOffset(newOffset);

    const now = performance.now();
    samplesRef.current.push({ offset: newOffset, time: now });
    while (
      samplesRef.current.length > 0 &&
      now - (samplesRef.current[0]?.time ?? 0) > VELOCITY_SAMPLE_WINDOW_MS
    ) {
      samplesRef.current.shift();
    }
  };

  const handleSpinPointerUp = () => {
    if (!spinDragRef.current) return;
    const wasMoved = spinDragRef.current.moved;

    const samples = samplesRef.current;
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      if (first && last) {
        const dt = last.time - first.time;
        if (dt > 0) {
          const v = (last.offset - first.offset) / dt;
          velocityRef.current = Math.max(-maxVelocity, Math.min(maxVelocity, v));
        }
      }
    }
    samplesRef.current = [];

    if (wasMoved && Math.abs(velocityRef.current) > flickThreshold) {
      setTimeout(() => {
        spinDragRef.current = null;
      }, 0);
      startMomentum();
    } else {
      if (wasMoved) {
        setTimeout(() => {
          spinDragRef.current = null;
        }, 0);
      } else {
        spinDragRef.current = null;
      }
    }
  };

  const handleBackdropClick = () => {
    if (spinDragRef.current?.moved) return;
    setIsOpen(false);
  };

  const handleSelect = (item: ThumbwheelItem) => {
    setIsOpen(false);
    setSpinOffset(0);
    onSelect?.(item);
  };

  // Trigger gesture handler — synchronous window listeners (no
  // setPointerCapture, which is unreliable on iOS Safari for <button>).
  const handleTriggerPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    triggerDragRef.current = {
      startClientX: e.clientX,
      startTriggerX: triggerX,
      moved: false,
    };
    setIsTriggerDragging(true);

    const onMove = (ev: PointerEvent) => {
      if (!triggerDragRef.current) return;
      const delta = ev.clientX - triggerDragRef.current.startClientX;
      if (Math.abs(delta) > TRIGGER_DRAG_THRESHOLD_PX) {
        triggerDragRef.current.moved = true;
      }
      const newX = triggerDragRef.current.startTriggerX + delta;
      const clamped = Math.max(0, Math.min(viewport.w - triggerSize, newX));
      setTriggerX(clamped);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };

    const onUp = () => {
      cleanup();
      if (!triggerDragRef.current) return;
      const wasDrag = triggerDragRef.current.moved;

      if (wasDrag) {
        const currentX = triggerXRef.current;
        let nearest: ThumbwheelDock = 'right';
        let nearestDist = Infinity;
        (Object.entries(snapPoints) as [ThumbwheelDock, number][]).forEach(
          ([id, snapX]) => {
            const dist = Math.abs(snapX - currentX);
            if (dist < nearestDist) {
              nearest = id;
              nearestDist = dist;
            }
          },
        );
        setTriggerX(snapPoints[nearest]);
        setDock(nearest);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(storageKey, nearest);
        }
      } else {
        setIsOpen((o) => !o);
      }

      triggerDragRef.current = null;
      setIsTriggerDragging(false);
    };

    const onCancel = () => {
      cleanup();
      triggerDragRef.current = null;
      setIsTriggerDragging(false);
      if (viewport.w > 0) setTriggerX(snapPoints[dock]);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  const wheelRotationDeg = (direction * spinOffset * 180) / Math.PI;
  const iconCounterRotationDeg = -wheelRotationDeg;

  // Stable clipPath id per component instance so multiple wheels on the
  // same page don't collide.
  const clipId = useMemo(() => `thumbwheel-clip-${Math.random().toString(36).slice(2, 9)}`, []);

  return (
    <>
      <button
        type="button"
        onPointerDown={handleTriggerPointerDown}
        style={{
          position: 'fixed',
          bottom: `${edgeInset}px`,
          left: 0,
          width: `${triggerSize}px`,
          height: `${triggerSize}px`,
          transform: `translateX(${triggerX}px)`,
          transition: isTriggerDragging
            ? 'none'
            : 'transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          touchAction: 'none',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: triggerBg,
          color: triggerFg,
          borderRadius: '50%',
          border: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          cursor: 'pointer',
        }}
        aria-label={isOpen ? triggerLabelOpen : triggerLabelClose}
      >
        {isOpen ? closeIcon : triggerIcon}
      </button>

      {isOpen && (
        <div
          onClick={handleBackdropClick}
          onPointerDown={handleSpinPointerDown}
          onPointerMove={handleSpinPointerMove}
          onPointerUp={handleSpinPointerUp}
          onPointerCancel={handleSpinPointerUp}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            touchAction: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: backdrop,
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              pointerEvents: 'none',
            }}
          />
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
            }}
            viewBox={`0 0 ${viewport.w} ${viewport.h}`}
          >
            <defs>
              <clipPath id={clipId}>
                <path d={wedgeClipPath(anchorX, anchorY, outerRadius + 4, visibleArc, direction)} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              <path
                d={wedgeClipPath(anchorX, anchorY, outerRadius + 4, visibleArc, direction)}
                fill={baseFill}
              />
              <g transform={`rotate(${wheelRotationDeg} ${anchorX} ${anchorY})`}>
                {items.map((item, i) => {
                  const a1 = i * angleStep;
                  const a2 = (i + 1) * angleStep;
                  const path = annularSectorPath(
                    anchorX,
                    anchorY,
                    innerRadius,
                    outerRadius,
                    a1,
                    a2,
                    direction,
                  );
                  const midAngle = (a1 + a2) / 2;
                  const iconRadius = (innerRadius + outerRadius) / 2;
                  const iconPos = polar(anchorX, anchorY, iconRadius, midAngle, direction);
                  const isEven = i % 2 === 0;
                  const sectorFill = isEven ? evenSectorFill : oddSectorFill;
                  return (
                    <g
                      key={item.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (spinDragRef.current?.moved) return;
                        handleSelect(item);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <path
                        d={path}
                        fill={sectorFill}
                        stroke={spoke}
                        strokeWidth={spokeWidth}
                        strokeLinejoin="round"
                      />
                      <g
                        transform={`translate(${iconPos.x} ${iconPos.y}) rotate(${iconCounterRotationDeg})`}
                        style={{ pointerEvents: 'none' }}
                      >
                        {item.icon ? (
                          <foreignObject
                            x={-ICON_SIZE / 2}
                            y={-ICON_SIZE / 2 - 6}
                            width={ICON_SIZE}
                            height={ICON_SIZE}
                          >
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: textColor,
                              }}
                            >
                              {item.icon as ReactNode}
                            </div>
                          </foreignObject>
                        ) : null}
                        <text
                          y={ICON_SIZE / 2 + 6}
                          textAnchor="middle"
                          fill={textColor}
                          style={{
                            fontSize: '9px',
                            fontFamily: 'inherit',
                          }}
                        >
                          {item.label}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        </div>
      )}
    </>
  );
}
