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
