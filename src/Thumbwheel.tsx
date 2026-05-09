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
const MIN_OUTER_RADIUS = 120;
// 100° — slightly past a quarter circle so the wheel's outer arc curls
// past the natural quadrant. Looks more "wrapped around the corner."
const DEFAULT_VISIBLE_ARC = (100 * Math.PI) / 180;
const DEFAULT_TRIGGER_SIZE = 56;
const DEFAULT_EDGE_INSET = 20;
// Anchor sits AT the screen corner by default — wheel goes all the way
// to the edge and bottom. Override via geometry.anchorInset.
const DEFAULT_ANCHOR_INSET = 0;
const ICON_SIZE = 24;
const SPIN_THRESHOLD_RAD = 0.04;
const TRIGGER_DRAG_THRESHOLD_PX = 5;
const VELOCITY_SAMPLE_WINDOW_MS = 100;
const TWO_PI = Math.PI * 2;
const RESIZE_STORAGE_SUFFIX = '-radius';
const DEFAULT_OUTER_BAND_WIDTH = 5;
// Resize-bump geometry defaults — exposed via geometry.resizeHandle*.
const DEFAULT_RESIZE_HANDLE_HEIGHT = 14;
const DEFAULT_RESIZE_HANDLE_BASE_ARC = 0.18;
const DEFAULT_RESIZE_HANDLE_TOP_ARC = 0.10;

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
  // resizeHandle* tokens cascade from other theme tokens (baseFill,
  // evenSectorFill, spoke, textColor) so the bump inherits the wheel's
  // color identity automatically. See destructuring below.
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

// Trapezoidal bump on the outer rim. The inner edge follows the rim
// arc (between `innerA1` and `innerA2`); the outer face is a smaller
// concentric arc (between `outerA1` and `outerA2`); the two `L` segments
// connecting them are the angled side cuts that taper the bump back into
// the wheel surface.
function bumpPath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  innerA1: number,
  innerA2: number,
  outerA1: number,
  outerA2: number,
  direction: 1 | -1,
): string {
  const innerStart = polar(cx, cy, rIn, innerA1, direction);
  const innerEnd = polar(cx, cy, rIn, innerA2, direction);
  const outerStart = polar(cx, cy, rOut, outerA1, direction);
  const outerEnd = polar(cx, cy, rOut, outerA2, direction);
  const sweepOuter = direction === -1 ? 0 : 1;
  const sweepInner = sweepOuter === 0 ? 1 : 0;
  return [
    `M ${innerStart.x} ${innerStart.y}`,
    `L ${outerStart.x} ${outerStart.y}`,
    `A ${rOut} ${rOut} 0 0 ${sweepOuter} ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${rIn} ${rIn} 0 0 ${sweepInner} ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

// Fan-unfold polygon for the open animation. Approximates a wedge
// hinged at `hingeAngle` (the edge that does NOT move) opening toward
// `hingeAngle - arcAngle` (the edge that swings out). With
// `arcAngle === 0` all sample points stack at `hingeAngle` — the wedge
// is collapsed to its hinge. CSS `clip-path: polygon(...)` interpolates
// point-by-point linearly, so each sample point's trajectory is from
// `hingeAngle` (closed) to `hingeAngle - (i/N) * arcAngle` (open):
// point 0 doesn't move (it's at the hinge in both states), point N
// sweeps the full arc. The result is a fan unfolding from the hinge
// edge. ~24 samples gives a smooth arc curve.
function fanWedgePolygon(
  cx: number,
  cy: number,
  r: number,
  arcAngle: number,
  hingeAngle: number,
  direction: 1 | -1,
  samples: number = 24,
): string {
  const pts: string[] = [`${cx}px ${cy}px`];
  for (let i = 0; i <= samples; i++) {
    const a = hingeAngle - (i / samples) * arcAngle;
    const p = polar(cx, cy, r, a, direction);
    pts.push(`${p.x}px ${p.y}px`);
  }
  return `polygon(${pts.join(', ')})`;
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
    enableResize = false,
    tickSound = false,
    rows = 1,
    fixed = false,
    maxItemAspectRatio = 1.0,
  } = props;

  const baseInnerRadius = geometry.innerRadius ?? DEFAULT_INNER_RADIUS;
  const baseOuterRadius = geometry.outerRadius ?? DEFAULT_OUTER_RADIUS;
  const configuredVisibleArc = geometry.visibleArc ?? DEFAULT_VISIBLE_ARC;
  const triggerSize = geometry.triggerSize ?? DEFAULT_TRIGGER_SIZE;
  const edgeInset = geometry.edgeInset ?? DEFAULT_EDGE_INSET;
  const anchorInset = geometry.anchorInset ?? DEFAULT_ANCHOR_INSET;
  const outerBandWidth = geometry.outerBandWidth ?? DEFAULT_OUTER_BAND_WIDTH;
  // Inner band width cascades from outer band width by default — so
  // setting `outerBandWidth` alone keeps the framing symmetric without
  // needing to also set `innerBandWidth`.
  const innerBandWidth = geometry.innerBandWidth ?? outerBandWidth;
  const resizeHandleHeight =
    geometry.resizeHandleHeight ?? DEFAULT_RESIZE_HANDLE_HEIGHT;
  const resizeHandleBaseArc =
    geometry.resizeHandleBaseArc ?? DEFAULT_RESIZE_HANDLE_BASE_ARC;
  const resizeHandleTopArc =
    geometry.resizeHandleTopArc ?? DEFAULT_RESIZE_HANDLE_TOP_ARC;

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
  // The outer band fill cascades from baseFill (was the wedge underlay
  // tone before the donut hole was made transparent — now exclusively
  // serves as the matte/halo color around the rim).
  const outerBandFill = theme.outerBandFill ?? baseFill;
  // Inner band fill cascades from outer band fill, so symmetric framing
  // requires only setting one token.
  const innerBandFill = theme.innerBandFill ?? outerBandFill;
  // Bump tokens cascade from primary wheel tokens so the resize handle
  // inherits the wheel's identity (and stays integrated visually) unless
  // a consumer explicitly overrides.
  const resizeHandleFill = theme.resizeHandleFill ?? baseFill;
  const resizeHandleHighlight = theme.resizeHandleHighlight ?? evenSectorFill;
  const resizeHandleShadow = theme.resizeHandleShadow ?? spoke;
  const resizeHandleGrip = theme.resizeHandleGrip ?? textColor;

  // Split items across rings. Outer ring gets the first half (rounded up
  // so an odd count puts the extra item outward, which reads better at
  // the wider outer radius). Each ring keeps its own angular step so the
  // counts can differ — visual misalignment between rings during a spin
  // is intentional knurled-wheel texture, not a bug.
  // 2-row mode is only meaningful for static/non-spinning menus where
  // every option is visible at once. In spin mode the inner ring would
  // scroll past the visible arc together with the outer, defeating the
  // "all options shown" intent — so we silently coerce to 1 row when
  // `fixed` is false. Consumers can still pass `rows={2}` unconditionally;
  // it just has no effect outside fixed mode.
  const ringCount: 1 | 2 = fixed && rows === 2 ? 2 : 1;
  const itemRings = useMemo<ThumbwheelItem[][]>(() => {
    if (ringCount === 1) return [items];
    const split = Math.ceil(items.length / 2);
    return [items.slice(0, split), items.slice(split)];
  }, [items, ringCount]);

  const [isOpen, setIsOpen] = useState(false);
  // `wipeOpen` lags `isOpen` by one rAF so the open-wipe CSS transition
  // has a "from" frame (radius 0, just-mounted) and a "to" frame (full
  // radius) to interpolate between. Without the rAF gap, React would
  // render both states inside one paint and the browser would skip the
  // transition entirely. Reset to false on close so a fresh open
  // re-runs the wipe.
  const [wipeOpen, setWipeOpen] = useState(false);
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

  // User-resizable radius (only mutated when `enableResize` is true).
  // Outer is the draggable knob; inner stays a FIXED radial distance
  // from outer (the band thickness is constant — the wheel does not
  // scale, it grows/shrinks by translating the inner edge with the
  // outer). The fixed thickness is derived from the consumer's initial
  // base geometry so the resting visual is preserved.
  const [outerRadius, setOuterRadius] = useState(baseOuterRadius);
  const ringBandThickness = baseOuterRadius - baseInnerRadius;
  const innerRadius = Math.max(0, outerRadius - ringBandThickness);
  const outerRadiusRef = useRef(outerRadius);
  const radiusStorageKey = `${storageKey}${RESIZE_STORAGE_SUFFIX}`;

  // Effective visible arc.
  //
  // Spin mode: equal to the configured `geometry.visibleArc` — the
  // wheel always shows a fixed-size viewport on a 2π reel of items.
  //
  // Fixed mode: auto-adjusted to keep sector aspect ratio at or below
  // `maxItemAspectRatio` at the outer rim of every ring. Since fixed
  // mode shows every item at once with no repetition, the only way to
  // bound sector width is to control the visible arc itself. The
  // most-constrained ring (largest required arc) sets the floor;
  // result is clamped to [π/4, 3π/2] so the wheel can't degenerate
  // into a sliver or wrap past the corner-anchor's natural sweep.
  // When `maxItemAspectRatio` is non-finite, this auto-fit is bypassed
  // and the configured arc is used verbatim.
  const visibleArc = useMemo(() => {
    if (!fixed) return configuredVisibleArc;
    if (!isFinite(maxItemAspectRatio) || maxItemAspectRatio <= 0) {
      return configuredVisibleArc;
    }
    const bandThickness = (outerRadius - innerRadius) / ringCount;
    let required = 0;
    itemRings.forEach((rItems, i) => {
      if (rItems.length === 0) return;
      const ringROut = outerRadius - i * bandThickness;
      if (ringROut <= 0) return;
      const ringRequired =
        (rItems.length * maxItemAspectRatio * bandThickness) / ringROut;
      if (ringRequired > required) required = ringRequired;
    });
    if (required === 0) return configuredVisibleArc;
    return Math.max(Math.PI / 4, Math.min(Math.PI * 1.5, required));
  }, [
    fixed,
    configuredVisibleArc,
    outerRadius,
    innerRadius,
    ringCount,
    itemRings,
    maxItemAspectRatio,
  ]);

  // Per-ring rendering plan. Bundles everything the render path needs:
  // resolved (rIn, rOut), the angular step, and the array of items to
  // actually render (which may repeat unique items in spin mode if the
  // max aspect ratio constraint kicks in). Spin mode: items wrap around
  // 2π and may repeat; if the natural step would produce sectors wider
  // than `maxItemAspectRatio` at the outer rim, we expand the slot
  // count to `items.length * ceil(naturalStep / maxStep)` so every
  // item appears the same number of times (repeats are evenly
  // distributed). Fixed mode: items always span exactly `visibleArc`
  // with no repetition.
  type RingDisplay = {
    items: ThumbwheelItem[];
    step: number;
    rIn: number;
    rOut: number;
  };
  const ringDisplays = useMemo<RingDisplay[]>(() => {
    const bandThickness = (outerRadius - innerRadius) / ringCount;
    return itemRings.map((rItems, ringIdx) => {
      const rOut = outerRadius - ringIdx * bandThickness;
      const rIn = rOut - bandThickness;
      if (rItems.length === 0) {
        return { items: [], step: 0, rIn, rOut };
      }
      if (fixed) {
        return {
          items: rItems,
          step: visibleArc / rItems.length,
          rIn,
          rOut,
        };
      }
      const naturalStep = TWO_PI / rItems.length;
      const ringBand = rOut - rIn;
      // Effective max step from the aspect-ratio cap. Guard against
      // a non-positive cap (which would imply infinite slots).
      const maxStep =
        maxItemAspectRatio > 0
          ? (maxItemAspectRatio * ringBand) / rOut
          : naturalStep;
      if (naturalStep <= maxStep) {
        return { items: rItems, step: naturalStep, rIn, rOut };
      }
      const repeats = Math.ceil(naturalStep / maxStep);
      const slotCount = rItems.length * repeats;
      const step = TWO_PI / slotCount;
      const displayItems = Array.from(
        { length: slotCount },
        (_, i) => rItems[i % rItems.length] as ThumbwheelItem,
      );
      return { items: displayItems, step, rIn, rOut };
    });
  }, [
    itemRings,
    ringCount,
    outerRadius,
    innerRadius,
    fixed,
    visibleArc,
    maxItemAspectRatio,
  ]);
  // Tick-sound effect samples the OUTER ring's step. Ring 0 is outer.
  const angleStep = ringDisplays[0]?.step ?? 0;

  useEffect(() => {
    outerRadiusRef.current = outerRadius;
  }, [outerRadius]);

  useEffect(() => {
    triggerXRef.current = triggerX;
  }, [triggerX]);

  // Restore saved radius (only when resize is enabled).
  useEffect(() => {
    if (!enableResize || typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(radiusStorageKey);
    if (saved) {
      const n = parseFloat(saved);
      if (!Number.isNaN(n) && n >= MIN_OUTER_RADIUS) setOuterRadius(n);
    }
  }, [enableResize, radiusStorageKey]);

  // Tick sound on spoke crossings.
  //
  // iOS Safari requires AudioContext to be created/resumed
  // SYNCHRONOUSLY inside a user-gesture handler. A lazy-creation
  // approach inside a useEffect (post-commit) silently fails on iOS —
  // the AudioContext stays in 'suspended' state and no audio plays.
  // Solution: ensureAudioContext() is called from inside every
  // pointerdown handler (trigger button + spin backdrop) so creation
  // happens during a confirmed user gesture. The useEffect only plays
  // an already-running context.
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastTickIndexRef = useRef(0);

  const ensureAudioContext = () => {
    if (!tickSound || typeof window === 'undefined') return;
    try {
      if (audioContextRef.current === null) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) return;
        audioContextRef.current = new Ctor();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
    } catch {
      // AudioContext unavailable — fail silently.
    }
  };

  const playTick = () => {
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state !== 'running') return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 800;
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // playback failed — silent
    }
  };

  useEffect(() => {
    if (!tickSound || fixed || angleStep === 0) return;
    const idx = Math.floor(spinOffset / angleStep);
    if (idx !== lastTickIndexRef.current) {
      playTick();
      lastTickIndexRef.current = idx;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinOffset, tickSound, angleStep, fixed]);

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

  // Track viewport for anchor + snap math.
  //
  // On iOS Safari the bottom address bar sits OVER the page (browser
  // chrome, not page content). `window.innerHeight` is the SMALL
  // viewport — i.e. excludes the area behind the bar. Probe `100lvh`
  // (large viewport, supported in iOS Safari 15.4+) to get the full
  // screen height including the bar's territory, and use that as
  // viewport.h so the wheel extends BELOW the bar. Re-probe on
  // visualViewport resize (bar shows/hides as the user scrolls).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => {
      const probe = document.createElement('div');
      probe.style.cssText =
        'position:fixed;top:0;height:100lvh;visibility:hidden;pointer-events:none;width:1px;';
      document.body.appendChild(probe);
      const lvh = probe.offsetHeight || window.innerHeight;
      document.body.removeChild(probe);
      setViewport({ w: window.innerWidth, h: lvh });
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
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

  // Drive the open-wipe transition: on open, mount with `wipeOpen=false`
  // (radius 0), then flip to true on the next animation frame so the
  // browser sees two distinct frame values and runs the CSS transition
  // between them. On close, reset immediately so the next open starts
  // from radius 0 again.
  useEffect(() => {
    if (!isOpen) {
      setWipeOpen(false);
      return;
    }
    const id = requestAnimationFrame(() => setWipeOpen(true));
    return () => cancelAnimationFrame(id);
  }, [isOpen]);

  // Lock body scroll + disable pull-to-refresh + disable browser
  // swipe-nav while open. `overscroll-behavior-x: none` on <html> blocks
  // iOS Safari's edge-swipe-to-navigate gesture and Mac trackpad
  // horizontal swipe-back; `overscroll-behavior-y: none` disables iOS
  // pull-to-refresh; `position: fixed` + scroll restore prevents the
  // page from scrolling under the backdrop.
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const scrollY = window.scrollY;
    const html = document.documentElement;
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const originalOverscrollX = html.style.overscrollBehaviorX;
    const originalOverscrollY = html.style.overscrollBehaviorY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    html.style.overscrollBehaviorX = 'none';
    html.style.overscrollBehaviorY = 'none';
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      html.style.overscrollBehaviorX = originalOverscrollX;
      html.style.overscrollBehaviorY = originalOverscrollY;
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
  const anchorX = isLeftDock ? anchorInset : viewport.w - anchorInset;
  const anchorY = viewport.h - anchorInset;
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
    // Activate audio synchronously inside the gesture (iOS Safari rule).
    // Done even in fixed mode so audio is ready if the consumer toggles
    // back to spin without a fresh gesture.
    ensureAudioContext();
    if (fixed) return;
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
    // Activate audio synchronously inside the gesture (iOS Safari rule).
    ensureAudioContext();
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

  // Drag-to-resize handle. Sits at the middle of the visible arc on the
  // outer rim (rendered as a skeu bump). Drag radially to grow/shrink.
  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    // Capture the grab offset so wherever the user grabs on the bump
    // (top, edge, slope), the wheel follows the cursor's RELATIVE motion
    // instead of snapping its rim under the cursor.
    const dx0 = e.clientX - anchorX;
    const dy0 = e.clientY - anchorY;
    const startDist = Math.sqrt(dx0 * dx0 + dy0 * dy0);
    const grabOffset = startDist - outerRadiusRef.current;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - anchorX;
      const dy = ev.clientY - anchorY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxOuter = Math.min(viewport.w, viewport.h) - 16;
      const newOuter = Math.max(
        MIN_OUTER_RADIUS,
        Math.min(maxOuter, dist - grabOffset),
      );
      setOuterRadius(newOuter);
    };
    const onUp = () => {
      cleanup();
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(radiusStorageKey, String(outerRadiusRef.current));
      }
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // In fixed mode the wheel doesn't rotate, so spinOffset is forced to
  // 0 for rendering. The state is left intact so tickSound + momentum
  // resume cleanly if the consumer toggles back to spin without a
  // remount.
  const renderSpinOffset = fixed ? 0 : spinOffset;
  const wheelRotationDeg = (direction * renderSpinOffset * 180) / Math.PI;
  const iconCounterRotationDeg = -wheelRotationDeg;

  // Stable per-instance ids so multiple wheels on the same page don't
  // collide on clipPath / gradient references.
  const instanceId = useMemo(
    () => Math.random().toString(36).slice(2, 9),
    [],
  );
  const clipId = `thumbwheel-clip-${instanceId}`;
  const bumpGradientId = `thumbwheel-bump-grad-${instanceId}`;

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

      {isOpen && (() => {
        // Fan-unfold open animation. Only the SVG (the wheel) is wedge-
        // clipped — the backdrop blur is left full-screen so it reads
        // as page chrome that's already settled, while the wheel itself
        // hinges open from the corner anchor. The hinge sits at the
        // `visibleArc` edge (the lower / horizontal-ish edge of the
        // wedge — closer to "the bottom" of the wheel), so the
        // angle-0 edge (vertical along the dock side) is the swinging
        // edge. Visually: the wedge starts collapsed against the bottom
        // edge and opens upward toward the screen side. Sectors are
        // revealed in order as the wedge sweeps past them. The polygon's
        // outer radius is the screen diagonal so the wedge always
        // covers the full SVG viewport.
        const fanRadius = Math.hypot(viewport.w, viewport.h);
        const fanArcAngle = wipeOpen ? visibleArc : 0;
        const fanClipPath = fanWedgePolygon(
          anchorX,
          anchorY,
          fanRadius,
          fanArcAngle,
          visibleArc,
          direction,
        );
        return (
        <div
          onClick={handleBackdropClick}
          onPointerDown={handleSpinPointerDown}
          onPointerMove={handleSpinPointerMove}
          onPointerUp={handleSpinPointerUp}
          onPointerCancel={handleSpinPointerUp}
          style={{
            // Explicit positioning + 100lvh (NOT inset:0) so the
            // wrapper extends behind iOS Safari's bottom address bar.
            // viewport.h is set to lvh by the resize useEffect so the
            // SVG coord system matches.
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '100lvh',
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
              clipPath: fanClipPath,
              WebkitClipPath: fanClipPath,
              transition:
                'clip-path 400ms cubic-bezier(0.2, 0.8, 0.2, 1), -webkit-clip-path 400ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
            viewBox={`0 0 ${viewport.w} ${viewport.h}`}
          >
            <defs>
              <clipPath id={clipId}>
                <path d={wedgeClipPath(anchorX, anchorY, outerRadius + 4, visibleArc, direction)} />
              </clipPath>
              {/* Skeu bump gradient — radial light direction, mapped to
                  user-space coords so it tracks the bump position even as
                  outerRadius changes. */}
              {enableResize && (() => {
                const handleAngle = visibleArc / 2;
                const innerCenter = polar(anchorX, anchorY, outerRadius, handleAngle, direction);
                const outerCenter = polar(
                  anchorX,
                  anchorY,
                  outerRadius + resizeHandleHeight,
                  handleAngle,
                  direction,
                );
                return (
                  <linearGradient
                    id={bumpGradientId}
                    gradientUnits="userSpaceOnUse"
                    x1={innerCenter.x}
                    y1={innerCenter.y}
                    x2={outerCenter.x}
                    y2={outerCenter.y}
                  >
                    <stop offset="0%" stopColor={resizeHandleFill} />
                    <stop offset="100%" stopColor={resizeHandleHighlight} />
                  </linearGradient>
                );
              })()}
            </defs>
            <g clipPath={`url(#${clipId})`}>
              <g
                transform={
                  fixed
                    ? undefined
                    : `rotate(${wheelRotationDeg} ${anchorX} ${anchorY})`
                }
              >
                {ringDisplays.map((ring, ringIndex) => {
                  const { items: ringItems, step: ringStep, rIn, rOut } = ring;
                  return (
                    <g key={ringIndex}>
                      {ringItems.map((item, i) => {
                        const a1 = i * ringStep;
                        const a2 = (i + 1) * ringStep;
                        const path = annularSectorPath(
                          anchorX,
                          anchorY,
                          rIn,
                          rOut,
                          a1,
                          a2,
                          direction,
                        );
                        const midAngle = (a1 + a2) / 2;
                        const iconRadius = (rIn + rOut) / 2;
                        const iconPos = polar(anchorX, anchorY, iconRadius, midAngle, direction);
                        // Per-item color overrides the alternating fallback.
                        const isEven = i % 2 === 0;
                        const sectorFill = item.color ?? (isEven ? evenSectorFill : oddSectorFill);
                        return (
                          // Position-based key — items can repeat in spin
                          // mode (max-aspect-ratio expansion), so item.id
                          // is not unique across sectors.
                          <g
                            key={`${ringIndex}-${i}`}
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
                  );
                })}
              </g>
              {/* Inner-arc boundary stroke. The donut hole is now
                  transparent (the wedge-fill underlay was dropped so the
                  blurred backdrop shows through), so we draw an explicit
                  arc at innerRadius matching the outer rim's stroke
                  treatment. Outside the rotated group — the inner edge
                  of the donut is fixed, it does not spin with the wheel.
                  Stays inside the clipped group so it still respects the
                  visible-arc wedge. */}
              {(() => {
                const start = polar(anchorX, anchorY, innerRadius, 0, direction);
                const end = polar(anchorX, anchorY, innerRadius, visibleArc, direction);
                const sweep = direction === -1 ? 0 : 1;
                const innerArcD =
                  `M ${start.x} ${start.y} ` +
                  `A ${innerRadius} ${innerRadius} 0 0 ${sweep} ${end.x} ${end.y}`;
                return (
                  <path
                    d={innerArcD}
                    fill="none"
                    stroke={spoke}
                    strokeWidth={spokeWidth}
                    strokeLinecap="round"
                  />
                );
              })()}
            </g>
            {/* Outer-band matte — a thin halo of `outerBandFill` between
                the rim and a parallel circumference at
                `outerRadius + outerBandWidth`. Frames the wheel against
                the backdrop without using a heavy stroke. Outside the
                clipped group so it renders fully; placed BEFORE the bump
                in document order so the bump (which protrudes through
                the band region) renders on top. Skipped when the band
                width is 0. */}
            {outerBandWidth > 0 && (
              <path
                d={annularSectorPath(
                  anchorX,
                  anchorY,
                  outerRadius,
                  outerRadius + outerBandWidth,
                  0,
                  visibleArc,
                  direction,
                )}
                fill={outerBandFill}
              />
            )}
            {/* Inner-band matte — mirrors the outer band on the donut-
                hole side. Sits between `innerRadius - innerBandWidth`
                and `innerRadius`. Same construction (annular sector,
                clipped naturally by its own angular range, rendered
                outside the wheel's clip group). Skipped when width is
                zero or would push the band's inner edge below zero. */}
            {innerBandWidth > 0 && innerRadius - innerBandWidth > 0 && (
              <path
                d={annularSectorPath(
                  anchorX,
                  anchorY,
                  innerRadius - innerBandWidth,
                  innerRadius,
                  0,
                  visibleArc,
                  direction,
                )}
                fill={innerBandFill}
              />
            )}
            {/* Lateral edge borders — short radial strokes from the inner
                arc to the outer rim at the two visible-arc boundaries.
                Placed OUTSIDE the clipped group so a stroke that sits on
                the clip boundary renders at full width (a centered stroke
                inside the clip would lose its outer half to the clip
                cut). Together with the inner-arc stroke and the
                sector-formed outer rim, these close the annular frame
                around the wheel. */}
            {(() => {
              const sides: [number, number] = [0, visibleArc];
              return sides.map((a, i) => {
                const inner = polar(anchorX, anchorY, innerRadius, a, direction);
                const outer = polar(anchorX, anchorY, outerRadius, a, direction);
                return (
                  <line
                    key={i}
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                    stroke={spoke}
                    strokeWidth={spokeWidth}
                    strokeLinecap="round"
                  />
                );
              });
            })()}
            {/* Resize handle — skeuomorphic bump on the outer rim.
                Trapezoidal protrusion with chamfered side cuts that taper
                back into the wheel. Filled with a radial linearGradient
                (light at the outer face, darker at the base) for raised
                3D depth, plus a chiseled outline stroke. Rendered outside
                the clipped + rotated wheel group so it stays at the
                middle of the visible arc regardless of wheel rotation. */}
            {enableResize && (() => {
              const handleAngle = visibleArc / 2;
              const baseHalf = resizeHandleBaseArc / 2;
              const topHalf = resizeHandleTopArc / 2;
              const bumpD = bumpPath(
                anchorX,
                anchorY,
                outerRadius,
                outerRadius + resizeHandleHeight,
                handleAngle - baseHalf,
                handleAngle + baseHalf,
                handleAngle - topHalf,
                handleAngle + topHalf,
                direction,
              );
              // Hit target — annular sector slightly wider/taller than
              // the bump, so fingers don't have to land precisely.
              const hitPad = 0.08;
              const hitPath = annularSectorPath(
                anchorX,
                anchorY,
                outerRadius - 6,
                outerRadius + resizeHandleHeight + 8,
                handleAngle - baseHalf - hitPad,
                handleAngle + baseHalf + hitPad,
                direction,
              );
              // Two tangent grip lines on the bump's outer face — the
              // "pullable" affordance. Each line is perpendicular to its
              // own radius from the anchor (= parallel to the local arc
              // tangent at that point). Placed within the topArc so they
              // don't run off the top face onto the angled side cuts.
              const gripTopRadius = outerRadius + resizeHandleHeight;
              const gripAngularOffset = topHalf * 0.5;
              const gripAngles = [
                handleAngle - gripAngularOffset,
                handleAngle + gripAngularOffset,
              ];
              const gripHalfLen = 4;
              return (
                <g
                  onPointerDown={handleResizePointerDown}
                  style={{ cursor: 'grab', touchAction: 'none' }}
                >
                  <path d={hitPath} fill="transparent" />
                  <path
                    d={bumpD}
                    fill={`url(#${bumpGradientId})`}
                    stroke={resizeHandleShadow}
                    strokeWidth={spokeWidth}
                    strokeLinejoin="round"
                  />
                  {gripAngles.map((a, i) => {
                    const p = polar(anchorX, anchorY, gripTopRadius, a, direction);
                    // Tangent unit vector — see math note in bumpPath /
                    // earlier tick implementation.
                    const tx = direction * Math.cos(a);
                    const ty = Math.sin(a);
                    return (
                      <line
                        key={i}
                        x1={p.x - tx * gripHalfLen}
                        y1={p.y - ty * gripHalfLen}
                        x2={p.x + tx * gripHalfLen}
                        y2={p.y + ty * gripHalfLen}
                        stroke={resizeHandleGrip}
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        style={{ pointerEvents: 'none' }}
                      />
                    );
                  })}
                </g>
              );
            })()}
          </svg>
        </div>
        );
      })()}
    </>
  );
}
