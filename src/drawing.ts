import {shapePath,dashArray} from "./extra-tools";
import {
  escapeXML,
  type Coordinate,
  type CurveKind,
  type Drawing,
} from "./model";
export interface PathGeometry {
  path: string;
  end: Coordinate;
  tangent: Coordinate;
}
const point = (p: Coordinate) => `${p[0]} ${p[1]}`;
export function drawingGeometry(
  points: Coordinate[],
  curve: CurveKind = "straight",
  pen = false,
  shape?: import("./model").ShapeKind,
): PathGeometry {
  const a = points[0] || [0, 0],
    b = points[1] || a;
  const line = {
    path: `M${point(a)} L${point(b)}`,
    end: b,
    tangent: [b[0] - a[0], b[1] - a[1]] as Coordinate,
  };
  if (shape) return {...line,path:shapePath(points,shape)};
  if (pen) {
    const end = points.at(-1) || a,
      previous = points.at(-2) || a;
    if (points.length < 3) return { ...line, end };
    let path = `M${point(a)}`;
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i],
        next = points[i + 1];
      path += ` Q${point(p)} ${(p[0] + next[0]) / 2} ${(p[1] + next[1]) / 2}`;
    }
    return {
      path: path + ` L${point(end)}`,
      end,
      tangent: [end[0] - previous[0], end[1] - previous[1]],
    };
  }
  const m = points[2];
  if (curve === "straight" || !m) return line;
  if (curve === "parabolic") {
    const c: Coordinate = [
      2 * m[0] - (a[0] + b[0]) / 2,
      2 * m[1] - (a[1] + b[1]) / 2,
    ];
    return {
      path: `M${point(a)} Q${point(c)} ${point(b)}`,
      end: b,
      tangent: [b[0] - c[0], b[1] - c[1]],
    };
  }
  // Circle through the two endpoints and a third point on the desired arc.
  // Translate first to avoid cancellation at large sketch coordinates.
  const bx = b[0] - a[0],
    by = b[1] - a[1],
    mx = m[0] - a[0],
    my = m[1] - a[1];
  const det = 2 * (bx * my - by * mx);
  if (Math.abs(det) < 1e-5) return line;
  const b2 = bx * bx + by * by,
    m2 = mx * mx + my * my;
  const cx = (b2 * my - m2 * by) / det,
    cy = (bx * m2 - mx * b2) / det;
  const r = Math.hypot(cx, cy);
  if (!Number.isFinite(r) || r > 1e8) return line;
  const tau = 2 * Math.PI,
    positive = (v: number) => ((v % tau) + tau) % tau;
  const start = Math.atan2(-cy, -cx),
    end = Math.atan2(by - cy, bx - cx),
    middle = Math.atan2(my - cy, mx - cx);
  const span = positive(end - start),
    sweep = positive(middle - start) <= span ? 1 : 0;
  const travelled = sweep ? span : tau - span,
    large = travelled > Math.PI ? 1 : 0;
  return {
    path: `M${point(a)} A${r} ${r} 0 ${large} ${sweep} ${point(b)}`,
    end: b,
    tangent: sweep ? [-(by - cy), bx - cx] : [by - cy, -(bx - cx)],
  };
}
export function arrowHead(g: PathGeometry, width = 2.5): string {
  const b = g.end;
  const angle = Math.atan2(g.tangent[1], g.tangent[0]),
    length = 10 + width;
  return `M${b[0] - length * Math.cos(angle - 0.45)} ${b[1] - length * Math.sin(angle - 0.45)} L${point(b)} L${b[0] - length * Math.cos(angle + 0.45)} ${b[1] - length * Math.sin(angle + 0.45)}`;
}
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** One vector renderer is shared by SVG export and PNG composition. */
export function drawingMarkup(d: Drawing, points: Coordinate[]): string {
  if (d.type === "text")
    return `<text x="${points[0][0]}" y="${points[0][1]}" fill="${d.color}" font-size="16" font-family="Arial" font-weight="600" stroke="#f6f3e5" stroke-width="3" paint-order="stroke">${escapeXML(d.text)}</text>`;
  const geometry = drawingGeometry(points, d.curve, d.type === "pen",d.shape);
  return `<path d="${geometry.path}" fill="${d.shape ? d.fill || "none" : "none"}" opacity="${d.opacity || 1}" ${dashArray(d.dash)?`stroke-dasharray="${dashArray(d.dash)}"`:""} stroke="${d.color}" stroke-width="${d.width || 2.5}" stroke-linecap="round" stroke-linejoin="round"/>${d.type === "arrow" ? `<path d="${arrowHead(geometry, d.width)}" fill="none" stroke="${d.color}" stroke-width="${d.width || 2.5}"/>` : ""}`;
}
/** Rotate around the artwork anchor, without changing geographic placement. */
export function rotationFromPoints(
  center: Coordinate,
  start: Coordinate,
  current: Coordinate,
  initial: number,
  snap = false,
): number {
  if (Math.hypot(current[0] - center[0], current[1] - center[1]) < 4)
    return ((initial % 360) + 360) % 360;
  const a = Math.atan2(start[1] - center[1], start[0] - center[0]);
  const b = Math.atan2(current[1] - center[1], current[0] - center[0]);
  const step = snap ? 15 : 1;
  const angle = Math.round((initial + ((b - a) * 180) / Math.PI) / step) * step;
  return ((angle % 360) + 360) % 360;
}
