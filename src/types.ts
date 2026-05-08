import type { ReactNode } from 'react';

/**
 * A single item rendered as a sector in the wheel.
 *
 * `icon` is a fully-rendered React node — pass `<Home />`, `<svg>...</svg>`,
 * an emoji span, or anything else you want to render at the sector's
 * midpoint. The library imports zero icon packages so consumers stay in
 * control of their icon set.
 */
export interface ThumbwheelItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /**
   * Per-item background fill (any CSS color string). When set, this
   * overrides the alternating even/odd sector fill from `theme`. Useful
   * for category-coding sectors. Hex strings recommended for consistent
   * rendering inside the SVG.
   */
  color?: string;
}

/** Which side of the screen the trigger button docks on. */
export type ThumbwheelDock = 'left' | 'right';

/**
 * Color overrides for the wheel surfaces. All optional — sensible
 * neutral-stone defaults apply if you pass nothing. Hex strings only
 * (no CSS variables, so the rendering survives missing theme contexts
 * and dark-mode strategy quirks).
 */
export interface ThumbwheelTheme {
  /** Underlay panel filling the inner-hole region. Default `#d6d3d1`. */
  baseFill?: string;
  /** Even-indexed sectors. Default `#fafaf9`. */
  evenSectorFill?: string;
  /** Odd-indexed sectors. Default `#e7e5e4`. */
  oddSectorFill?: string;
  /** Radial spokes + arcs. Default `#a8a29e`. */
  spoke?: string;
  /** Stroke width on the sector boundaries. Default `1.5`. */
  spokeWidth?: number;
  /** Icon and label color. Default `#44403c`. */
  textColor?: string;
  /** Trigger button background. Default `#1c1917`. */
  triggerBg?: string;
  /** Trigger icon color. Default `#fafaf9`. */
  triggerFg?: string;
  /** Backdrop fill behind the wheel. Default `rgba(0,0,0,0.4)`. */
  backdrop?: string;
  /**
   * Fill color of the offset band that sits just outside the wheel's
   * outer rim — a thin halo / matte that frames the wheel against the
   * backdrop. Defaults to `theme.baseFill`. Set `geometry.outerBandWidth`
   * to `0` to hide the band entirely.
   */
  outerBandFill?: string;
  /**
   * Fill color of the inner offset band that mirrors `outerBandFill` on
   * the inside of the wheel (just inside `innerRadius`). Cascades:
   * `innerBandFill ?? outerBandFill ?? baseFill` — so by default both
   * bands match without extra config. Set `geometry.innerBandWidth`
   * to `0` to hide the inner band.
   */
  innerBandFill?: string;
  /**
   * Resize handle base fill (gradient stop nearest the rim). Visible when
   * `enableResize` is true. Defaults to `theme.baseFill` so the bump's
   * base blends into the wheel surface.
   */
  resizeHandleFill?: string;
  /**
   * Resize handle highlight (gradient stop at the bump's outer face).
   * Defaults to `theme.evenSectorFill` — produces a raised, light-catching
   * look while staying inside the wheel's color family.
   */
  resizeHandleHighlight?: string;
  /**
   * Resize handle outline. Defaults to `theme.spoke` so the rim's stroke
   * line continues into and around the bump (the bump reads as part of
   * the wheel's line system, not a separate floating element).
   */
  resizeHandleShadow?: string;
  /**
   * Color of the tangent grip lines on the bump's outer face — the
   * "pullable" affordance. Defaults to `theme.textColor`.
   */
  resizeHandleGrip?: string;
}

/**
 * Geometry knobs. Defaults produce the reference look.
 */
export interface ThumbwheelGeometry {
  /** Inner radius of the sector ring. Default `130`. */
  innerRadius?: number;
  /** Outer radius of the sector ring. Default `210`. */
  outerRadius?: number;
  /** Visible arc in radians. Default `100° in radians` (slightly past a quarter circle). */
  visibleArc?: number;
  /** Trigger button size in pixels. Default `56`. */
  triggerSize?: number;
  /** Inset from screen edge for the trigger. Default `20`. */
  edgeInset?: number;
  /**
   * Pixel inset of the wheel's anchor pivot from the screen corner.
   * Default `0` (wheel goes all the way to the edge + bottom). Increase
   * to push the wheel inward from the corner.
   */
  anchorInset?: number;
  /**
   * Radial width of the offset band that sits just outside the outer
   * rim. The band is filled with `theme.outerBandFill` and creates a
   * thin halo / matte around the wheel. Set to `0` to disable the band.
   * Default `5`.
   */
  outerBandWidth?: number;
  /**
   * Radial width of the offset band that sits just inside the inner
   * rim — mirrors `outerBandWidth` on the donut-hole side. Cascades:
   * `innerBandWidth ?? outerBandWidth ?? 5`, so by default both bands
   * match. Set to `0` to disable the inner band.
   */
  innerBandWidth?: number;
  /**
   * Radial protrusion of the resize-handle bump beyond `outerRadius`.
   * Default `14`.
   */
  resizeHandleHeight?: number;
  /**
   * Angular width of the bump where it meets the rim, in radians. Wider
   * than `resizeHandleTopArc` to produce the chamfered side cuts.
   * Default `0.18` (~10.3°).
   */
  resizeHandleBaseArc?: number;
  /**
   * Angular width of the bump's outer face, in radians. Narrower than
   * the base for the trapezoidal/chamfered look. Default `0.10` (~5.7°).
   */
  resizeHandleTopArc?: number;
}

/**
 * Momentum physics knobs. Defaults are tuned for iOS-feeling spin
 * decay; override if you want a stiffer or looser wheel.
 */
export interface ThumbwheelPhysics {
  /** Friction decay applied each 16ms frame. Default `0.95`. */
  friction?: number;
  /** Velocity below this stops the rAF loop (rad/ms). Default `0.0001`. */
  minVelocity?: number;
  /** Velocity above this rule treats a release as a flick (rad/ms). Default `0.0005`. */
  flickThreshold?: number;
  /** Hard cap on release velocity (rad/ms). Default `0.012`. */
  maxVelocity?: number;
}

export interface ThumbwheelProps {
  /** Items rendered as sectors. */
  items: ThumbwheelItem[];
  /** Fired when an item is tapped. */
  onSelect?: (item: ThumbwheelItem) => void;

  /** Initial dock side; user-drag overrides and persists to localStorage. */
  defaultDock?: ThumbwheelDock;
  /** localStorage key for dock persistence. Default `'thumbwheel-dock'`. */
  storageKey?: string;

  /** Custom trigger icon when wheel is closed. Default: hamburger SVG. */
  triggerIcon?: ReactNode;
  /** Custom trigger icon when wheel is open. Default: X SVG. */
  closeIcon?: ReactNode;

  /** Optional theming. */
  theme?: ThumbwheelTheme;
  /** Optional geometry overrides. */
  geometry?: ThumbwheelGeometry;
  /** Optional physics overrides. */
  physics?: ThumbwheelPhysics;

  /**
   * If true, render a draggable handle on the outer arc that resizes the
   * wheel. The chosen radius persists to localStorage under
   * `${storageKey}-radius`. Default `false`.
   */
  enableResize?: boolean;

  /**
   * Number of concentric rings of items. `1` (default) is a single
   * ring from `innerRadius` to `outerRadius`. `2` splits the band in
   * half: items[0..ceil(N/2)) go on the outer ring, items[ceil(N/2)..N)
   * on the inner ring. Each ring uses its own angular step.
   */
  rows?: 1 | 2;

  /**
   * If true, the wheel does not spin. All items fan out evenly across
   * the `visibleArc` and stay put — useful for static radial menus
   * where every choice is always visible. Spin gestures, momentum,
   * and tick sound are all no-ops in this mode. Default `false`.
   */
  fixed?: boolean;

  /**
   * Maximum sector aspect ratio (`arc length / band thickness`) at the
   * outer rim, in spin mode only. When the natural angular step
   * (`2π / items.length`) would produce sectors wider than this, items
   * are repeated around the full 360° to fill more, smaller slots —
   * each item appears at multiple angles around the wheel. The wheel
   * still functions normally; tapping any instance of an item fires
   * the same `onSelect`. Default `1.0` (square sectors). Has no effect
   * in `fixed` mode (where items always span exactly `visibleArc`).
   * Set to `Infinity` to disable the cap and let sectors be arbitrarily
   * wide.
   */
  maxItemAspectRatio?: number;

  /**
   * If true, play a short tick sound (Web Audio sine pop) every time a
   * spoke crosses the visible window's edge — approximates iOS
   * PickerView / iPod click-wheel tactility. AudioContext is created
   * lazily on first tick and respects iOS user-gesture activation.
   * Default `false`.
   */
  tickSound?: boolean;

  /** Accessible labels for the trigger button. */
  triggerLabelOpen?: string;
  triggerLabelClose?: string;
}
