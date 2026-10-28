import standardCatalogue from "./standard-catalogue.json";
import { tacticalTasks } from "./tactical-tasks";
import { forward } from "mgrs";
export type Coordinate = [number, number];
export type Category =
  | "Armour"
  | "Infantry"
  | "Artillery"
  | "Engineers"
  | "Logistics"
  | "Formations"
  | "Signals"
  | "Aviation"
  | "Special Forces" | "Equipment" | "Naval" | "Installations" | "Control Measures" | "Tactical Tasks";
export type SymbolKind =
  | "armour"
  | "infantry"
  | "artillery"
  | "engineer"
  | "logistics"
  | "recon"
  | "medical"
  | "airdefence"
  | "command"
  | "bridge"
  | "truck"
  | "tank"
  | "mechanised"
  | "armoured-recon"
  | "signals"
  | "aviation"
  | "special-forces" | "standard" | "tactical-task";
export const symbolColours = [
  { name: "Navy blue", hex: "#000080" },
  { name: "Green", hex: "#008000" },
  { name: "Red", hex: "#ff0000" },
  { name: "Blue", hex: "#0000ff" },
  { name: "Yellow", hex: "#ffff00" },
  { name: "Black", hex: "#000000" },
] as const;
export type SymbolColour = (typeof symbolColours)[number]["hex"];
export const echelons = [
  { id: "none", name: "No echelon", mark: "" },
  { id: "section", name: "Section", mark: "•" },
  { id: "platoon", name: "Platoon / Troop", mark: "•••" },
  { id: "company", name: "Company / Squadron / Battery", mark: "I" },
  { id: "battalion", name: "Battalion / Regiment", mark: "II" },
  { id: "brigade", name: "Brigade", mark: "X" },
  { id: "division", name: "Division", mark: "XX" },
  { id: "corps", name: "Corps", mark: "XXX" },
  { id: "command", name: "Command", mark: "XXXX" },
] as const;
export type EchelonId = (typeof echelons)[number]["id"];
export function normaliseSymbolColour(hex: string): SymbolColour {
  const exact = symbolColours.find((c) => c.hex === hex.toLowerCase());
  if (exact) return exact.hex;
  const legacy: Record<string, SymbolColour> = {
    "#354d3b": "#008000",
    "#3a6685": "#000080",
    "#945b4b": "#ff0000",
    "#9c751d": "#ffff00",
    "#665777": "#000080",
  };
  if (legacy[hex.toLowerCase()]) return legacy[hex.toLowerCase()];
  const rgb = (c: string) =>
    [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const a = rgb(hex);
  return [...symbolColours].sort((x, y) => {
    const distance = (v: string) =>
      rgb(v).reduce((sum, n, i) => sum + (n - a[i]) ** 2, 0);
    return distance(x.hex) - distance(y.hex);
  })[0].hex;
}
export type BasemapView = "map" | "terrain" | "satellite" | "hybrid" | "sand" | "whiteboard";
export type CoordinateDisplay = "grid" | "latlong" | "both";
export type Affiliation = "friendly" | "hostile" | "neutral" | "unknown";
export type SymbolFamily = "Units" | "Equipment" | "Air" | "Sea" | "Installations" | "Control Measures" | "Tasks";
export interface Template {
  sidc?: string;
  family?: SymbolFamily;
  task?: string;
  id: string;
  name: string;
  category: Category;
  kind: SymbolKind;
  level: string;
  aliases: string[];
  rotation: boolean;
}
export const catalogue: Template[] = [
  {
    id: "armoured-regiment",
    name: "Armoured Regiment",
    category: "Armour",
    kind: "armour",
    level: "II",
    aliases: ["armored regiment"],
    rotation: true,
  },
  {
    id: "armoured-squadron",
    name: "Armoured Squadron",
    category: "Armour",
    kind: "armour",
    level: "I",
    aliases: ["armored squadron"],
    rotation: true,
  },
  {
    id: "tank",
    name: "Main Battle Tank",
    category: "Armour",
    kind: "tank",
    level: "",
    aliases: ["tank", "mbt"],
    rotation: true,
  },
  {
    id: "recon-squadron",
    name: "Reconnaissance Squadron",
    category: "Armour",
    kind: "armoured-recon",
    level: "I",
    aliases: ["recce squadron"],
    rotation: true,
  },
  {
    id: "mechanised-infantry",
    name: "Mechanised Infantry",
    category: "Infantry",
    kind: "mechanised",
    level: "II",
    aliases: ["mechanized infantry"],
    rotation: true,
  },
  {
    id: "infantry-battalion",
    name: "Infantry Battalion",
    category: "Infantry",
    kind: "infantry",
    level: "II",
    aliases: ["inf battalion"],
    rotation: true,
  },
  {
    id: "infantry-company",
    name: "Infantry Company",
    category: "Infantry",
    kind: "infantry",
    level: "I",
    aliases: ["inf company"],
    rotation: true,
  },
  {
    id: "recon-patrol",
    name: "Reconnaissance Patrol",
    category: "Infantry",
    kind: "recon",
    level: "••",
    aliases: ["recce patrol"],
    rotation: true,
  },
  {
    id: "artillery-regiment",
    name: "Artillery Regiment",
    category: "Artillery",
    kind: "artillery",
    level: "II",
    aliases: ["arty regiment"],
    rotation: true,
  },
  {
    id: "artillery-battery",
    name: "Artillery Battery",
    category: "Artillery",
    kind: "artillery",
    level: "I",
    aliases: ["battery"],
    rotation: true,
  },
  {
    id: "air-defence",
    name: "Air Defence Battery",
    category: "Artillery",
    kind: "airdefence",
    level: "I",
    aliases: ["air defense"],
    rotation: true,
  },
  {
    id: "mortar",
    name: "Mortar Platoon",
    category: "Artillery",
    kind: "artillery",
    level: "•••",
    aliases: ["mortar"],
    rotation: true,
  },
  {
    id: "engineer-regiment",
    name: "Engineer Regiment",
    category: "Engineers",
    kind: "engineer",
    level: "II",
    aliases: ["engineers regiment"],
    rotation: true,
  },
  {
    id: "engineer-company",
    name: "Engineer Company",
    category: "Engineers",
    kind: "engineer",
    level: "I",
    aliases: ["sappers"],
    rotation: true,
  },
  {
    id: "bridge",
    name: "Bridge Equipment",
    category: "Engineers",
    kind: "bridge",
    level: "",
    aliases: ["bridge"],
    rotation: true,
  },
  {
    id: "logistics-company",
    name: "Logistics Company",
    category: "Logistics",
    kind: "logistics",
    level: "I",
    aliases: ["supply company"],
    rotation: true,
  },
  {
    id: "transport",
    name: "Transport Vehicle",
    category: "Logistics",
    kind: "truck",
    level: "",
    aliases: ["truck"],
    rotation: true,
  },
  {
    id: "medical",
    name: "Medical Unit",
    category: "Logistics",
    kind: "medical",
    level: "I",
    aliases: ["medical"],
    rotation: true,
  },
  {
    id: "headquarters",
    name: "Headquarters",
    category: "Logistics",
    kind: "command",
    level: "II",
    aliases: ["hq"],
    rotation: true,
  },
  {
    id: "supply-point",
    name: "Supply Point",
    category: "Logistics",
    kind: "logistics",
    level: "",
    aliases: ["supply"],
    rotation: true,
  },
  {
    id: "infantry-section",
    name: "Infantry Section",
    category: "Infantry",
    kind: "infantry",
    level: "\u2022",
    aliases: ["section"],
    rotation: true,
  },
  {
    id: "infantry-platoon",
    name: "Infantry Platoon",
    category: "Infantry",
    kind: "infantry",
    level: "\u2022\u2022\u2022",
    aliases: ["platoon"],
    rotation: true,
  },
  {
    id: "infantry-brigade",
    name: "Infantry Brigade",
    category: "Formations",
    kind: "infantry",
    level: "X",
    aliases: ["brigade"],
    rotation: true,
  },
  {
    id: "infantry-division",
    name: "Infantry Division",
    category: "Formations",
    kind: "infantry",
    level: "XX",
    aliases: ["division"],
    rotation: true,
  },
  {
    id: "corps",
    name: "Corps",
    category: "Formations",
    kind: "infantry",
    level: "XXX",
    aliases: [],
    rotation: true,
  },
  {
    id: "army-command",
    name: "Army Command",
    category: "Formations",
    kind: "infantry",
    level: "XXXX",
    aliases: ["command"],
    rotation: true,
  },
  {
    id: "armoured-brigade",
    name: "Armoured Brigade",
    category: "Formations",
    kind: "armour",
    level: "X",
    aliases: ["armored brigade"],
    rotation: true,
  },
  {
    id: "armoured-division",
    name: "Armoured Division",
    category: "Formations",
    kind: "armour",
    level: "XX",
    aliases: ["armored division"],
    rotation: true,
  },
  {
    id: "artillery-brigade",
    name: "Artillery Brigade",
    category: "Formations",
    kind: "artillery",
    level: "X",
    aliases: ["arty brigade"],
    rotation: true,
  },
  {
    id: "armoured-troop",
    name: "Armoured Troop",
    category: "Armour",
    kind: "armour",
    level: "\u2022\u2022\u2022",
    aliases: ["tank troop"],
    rotation: true,
  },
  {
    id: "signal-company",
    name: "Signal Company",
    category: "Signals",
    kind: "signals",
    level: "I",
    aliases: ["signals company"],
    rotation: true,
  },
  {
    id: "signal-regiment",
    name: "Signal Regiment",
    category: "Signals",
    kind: "signals",
    level: "II",
    aliases: ["signals regiment"],
    rotation: true,
  },
  {
    id: "aviation-squadron",
    name: "Army Aviation Squadron",
    category: "Aviation",
    kind: "aviation",
    level: "I",
    aliases: ["aviation squadron"],
    rotation: true,
  },
  {
    id: "special-forces-company",
    name: "Special Forces Company",
    category: "Special Forces",
    kind: "special-forces",
    level: "I",
    aliases: ["sf company"],
    rotation: true,
  },
  {
    id: "air-defence-regiment",
    name: "Air Defence Regiment",
    category: "Artillery",
    kind: "airdefence",
    level: "II",
    aliases: ["air defense regiment"],
    rotation: true,
  },
];
catalogue.push(...standardCatalogue as Template[]);
catalogue.push(...tacticalTasks.map(task=>({id:'task-'+task.toLowerCase().replaceAll(' ','-'),name:task,category:'Tactical Tasks' as Category,kind:'tactical-task' as SymbolKind,level:'',aliases:[task,task.replace('Neutralise','Neutralize'),task==='Attack by fire'?'ABF':task==='Support by fire'?'SBF':''],rotation:true,family:'Tasks' as SymbolFamily,task})));
export function symbolFamily(t:Template):SymbolFamily { return t.family || (['tank','truck','bridge'].includes(t.kind)?'Equipment':'Units'); }
export const templateById = (id: string) => catalogue.find((t) => t.id === id)!;
export interface Item {
  id: string;
  templateId: string;
  designation: string;
  coordinate: Coordinate | null;
  sketch: Coordinate | null;
  size: number;
  rotation: number;
  echelon?: EchelonId;
  affiliation?: Affiliation;
  color: string;
  notes: string;
}
export type CurveKind = "straight" | "arc" | "parabolic";
export type ShapeKind = "circle" | "rectangle" | "polygon" | "star";
export interface Drawing {
  shape?: ShapeKind;
  dash?: "solid" | "dashed" | "dotted" | "dash-dot";
  fill?: string;
  opacity?: number;
  id: string;
  type: "line" | "arrow" | "text" | "pen";
  curve?: CurveKind;
  width?: number;
  points: Coordinate[];
  text: string;
  color: string;
}
export interface Project {
  version: 1;
  notationProfile: "illustrative-v1";
  title: string;
  items: Item[];
  drawings: Drawing[];
  inactiveDrawings: Drawing[];
  mode: "terrain" | "sketch";
  camera: { center: Coordinate; zoom: number };
  grid: {
    visible: boolean;
    precision: 3 | 4 | 5;
    color: string;
    opacity: number;
    weight: number;
  };
  labels: boolean;
  basemap: "openfreemap-liberty";
  mapView?: BasemapView;
  coordinateDisplay?: CoordinateDisplay;
  imagery?: "eox-s2cloudless-2016";
  sketchImage?: string;
  sketchImageTransform?: {x:number;y:number;scale:number};
}
export const uid = () => crypto.randomUUID();
export function createProject(): Project {
  return {
    version: 1,
    notationProfile: "illustrative-v1",
    title: "Untitled briefing",
    items: [],
    drawings: [],
    inactiveDrawings: [],
    mode: "terrain",
    camera: { center: [76.9, 30.7], zoom: 10 },
    grid: {
      visible: true,
      precision: 4,
      color: "#53604d",
      opacity: 0.32,
      weight: 1,
    },
    labels: true,
    basemap: "openfreemap-liberty",
    mapView: "terrain",
    coordinateDisplay: "both",
    imagery: "eox-s2cloudless-2016",
  };
}
export function makeItem(templateId: string, designation = ""): Item {
  return {
    id: uid(),
    templateId,
    designation,
    coordinate: null,
    sketch: null,
    size: 76,
    rotation: 0,
    color: "#000000",
    notes: "",
  };
}
export const nameOf = (item: Item) =>
  [item.designation, templateById(item.templateId)?.name]
    .filter(Boolean)
    .join(" ");
export function gridReference(
  c: Coordinate | null,
  precision: 3 | 4 | 5 = 4,
): string {
  if (!c) return "—";
  if (c[1] < -80 || c[1] > 84 || c[0] < -180 || c[0] > 180)
    return "Outside MGRS coverage";
  try {
    const m = forward(c, precision);
    const match = m.match(/^(\d{1,2}[A-Z])([A-Z]{2})(\d+)$/);
    if (!match) return m;
    return `${match[1]} ${match[2]} ${match[3].slice(0, precision)} ${match[3].slice(precision)}`;
  } catch {
    return "Outside MGRS coverage";
  }
}
const coord = (v: unknown): v is Coordinate =>
  Array.isArray(v) &&
  v.length === 2 &&
  v.every((n) => typeof n === "number" && Number.isFinite(n));
const geo = (v: unknown): v is Coordinate =>
  coord(v) && v[0] >= -180 && v[0] <= 180 && v[1] >= -85 && v[1] <= 85;
const str = (v: unknown, n: number): v is string =>
  typeof v === "string" && v.length <= n;
export function validateProject(input: unknown): Project {
  const p = input as Project;
  if (
    !p ||
    p.version !== 1 ||
    p.notationProfile !== "illustrative-v1" ||
    !str(p.title, 120) ||
    !["terrain", "sketch"].includes(p.mode) ||
    p.basemap !== "openfreemap-liberty" ||
    !Array.isArray(p.items) ||
    p.items.length > 3000 ||
    !Array.isArray(p.drawings) ||
    p.drawings.length > 3000 ||
    !Array.isArray(p.inactiveDrawings) ||
    p.inactiveDrawings.length > 3000
  )
    throw Error("Unsupported or invalid MILDraw project.");
  if (
    !p.camera ||
    !geo(p.camera.center) ||
    !Number.isFinite(p.camera.zoom) ||
    p.camera.zoom < 2 ||
    p.camera.zoom > 19 ||
    !p.grid ||
    ![3, 4, 5].includes(p.grid.precision) ||
    typeof p.grid.visible !== "boolean" ||
    !/^#[0-9a-f]{6}$/i.test(p.grid.color) ||
    !Number.isFinite(p.grid.opacity) ||
    p.grid.opacity < 0 ||
    p.grid.opacity > 1 ||
    !Number.isFinite(p.grid.weight) ||
    p.grid.weight < 0.5 ||
    p.grid.weight > 3 ||
    typeof p.labels !== "boolean"
  )
    throw Error("Invalid map settings.");
  if (
    (p.mapView !== undefined &&
      !["map", "terrain", "satellite", "hybrid", "sand", "whiteboard"].includes(p.mapView)) ||
    (p.coordinateDisplay !== undefined &&
      !["grid", "latlong", "both"].includes(p.coordinateDisplay)) ||
    (p.imagery !== undefined && p.imagery !== "eox-s2cloudless-2016")
  )
    throw Error("Invalid view settings.");
  if (p.sketchImageTransform && (!Number.isFinite(p.sketchImageTransform.x) || !Number.isFinite(p.sketchImageTransform.y) || !Number.isFinite(p.sketchImageTransform.scale) || p.sketchImageTransform.scale < .05 || p.sketchImageTransform.scale > 20)) throw Error("Invalid background image placement.");
  const ids = new Set<string>();
  for (const i of p.items) {
    if (
      !str(i.id, 100) ||
      ids.has(i.id) ||
      !catalogue.some((t) => t.id === i.templateId) ||
      !str(i.designation, 30) ||
      !str(i.notes, 1000) ||
      !(i.coordinate === null || geo(i.coordinate)) ||
      !(i.sketch === null || coord(i.sketch)) ||
      !Number.isFinite(i.size) ||
      i.size < 40 ||
      i.size > 160 ||
      !Number.isFinite(i.rotation) ||
      i.rotation < 0 ||
      i.rotation > 360 ||
      (i.echelon !== undefined && !echelons.some((e) => e.id === i.echelon)) ||
      (i.affiliation !== undefined && !["friendly","hostile","neutral","unknown"].includes(i.affiliation)) ||
      !/^#[0-9a-f]{6}$/i.test(i.color)
    )
      throw Error("Invalid symbol data.");
    ids.add(i.id);
  }
  for (const d of [...p.drawings, ...p.inactiveDrawings]) {
    if (
      !str(d.id, 100) ||
      ids.has(d.id) ||
      !["line", "arrow", "text", "pen"].includes(d.type) ||
      !Array.isArray(d.points) ||
      (d.shape === "polygon" ? d.points.length < 3 || d.points.length > 500 : d.type === "pen"
        ? d.points.length < 2 || d.points.length > 5000
        : d.points.length !==
          (d.type === "text"
            ? 1
            : d.curve && d.curve !== "straight"
              ? 3
              : 2)) ||
      (d.shape !== undefined && (d.type!=="line" || !["circle","rectangle","polygon","star"].includes(d.shape))) ||
      (d.dash !== undefined && !["solid","dashed","dotted","dash-dot"].includes(d.dash)) ||
      (d.fill !== undefined && d.fill !== "none" && !/^#[0-9a-f]{6}$/i.test(d.fill)) ||
      (d.opacity !== undefined && (!Number.isFinite(d.opacity)||d.opacity<.05||d.opacity>1)) ||
      (d.curve !== undefined &&
        !["straight", "arc", "parabolic"].includes(d.curve)) ||
      (d.width !== undefined &&
        (!Number.isFinite(d.width) || d.width < 1 || d.width > 8)) ||
      !d.points.every(
        (p.drawings.includes(d) ? p.mode === "terrain" : p.mode === "sketch")
          ? geo
          : coord,
      ) ||
      !str(d.text, 300) ||
      !/^#[0-9a-f]{6}$/i.test(d.color)
    )
      throw Error("Invalid drawing data.");
    ids.add(d.id);
  }
  if (
    p.sketchImage &&
    (!str(p.sketchImage, 20000000) ||
      !/^data:image\/(png|jpeg|webp);base64,/.test(p.sketchImage))
  )
    throw Error("Invalid sketch background.");
  const result = structuredClone(p);
  result.items = result.items.map((item) => ({
    ...item,
    color: normaliseSymbolColour(item.color),
  }));
  return result;
}
export function resolvePhrase(
  text: string,
): { templateId: string; designation: string } | null {
  const s = text.trim();
  if (/\b(do not|don't|never|cancel)\b/i.test(s)) return null;
  const ordered = catalogue
    .filter(t => !t.sidc && !t.task)
    .flatMap((t) => [t.name, ...t.aliases].map((alias) => ({ t, alias })))
    .sort((a, b) => b.alias.length - a.alias.length);
  for (const { t, alias } of ordered) {
    if (s.toLowerCase().endsWith(alias.toLowerCase())) {
      const designation = s.slice(0, -alias.length).trim();
      if (
        designation.length <= 30 &&
        (!designation || /^[\w -]+$/.test(designation))
      )
        return { templateId: t.id, designation };
    }
  }
  return null;
}
export interface History {
  past: Project[];
  present: Project;
  future: Project[];
}
export type HistoryAction =
  | { type: "commit"; project: Project }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "replace"; project: Project };
export function historyReducer(h: History, a: HistoryAction): History {
  if (a.type === "replace") return { past: [], present: a.project, future: [] };
  if (a.type === "commit") {
    if (JSON.stringify(h.present) === JSON.stringify(a.project)) return h;
    return {
      past: [...h.past.slice(-79), h.present],
      present: a.project,
      future: [],
    };
  }
  if (a.type === "undo" && h.past.length)
    return {
      past: h.past.slice(0, -1),
      present: h.past.at(-1)!,
      future: [h.present, ...h.future],
    };
  if (a.type === "redo" && h.future.length)
    return {
      past: [...h.past, h.present],
      present: h.future[0],
      future: h.future.slice(1),
    };
  return h;
}
export const escapeXML = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
