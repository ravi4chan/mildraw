import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import {groundDistance,dashArray} from "./extra-tools";
import BackgroundImage, { defaultImagePlacement, type ImagePlacement } from "./BackgroundImage";
import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as GLMap, StyleSpecification } from "maplibre-gl";
import { SymbolArt, symbolMarkup } from "./Symbol";
import {
  templateById,
  escapeXML,
  nameOf,
  type Project,
  type Item,
  type Coordinate,
  type Drawing,
  type CurveKind,
} from "./model";
import { geographicGrid, type GridResult } from "./grid";
import {
  imagerySource,
  layerVisible,
  mapViews,
  mapCredits,
  isImagery,
} from "./map-config";
import {
  drawingGeometry,
  arrowHead,
  drawingMarkup,
  rotationFromPoints,
} from "./drawing";
export type Tool = "select" | "pan" | "line" | "arrow" | "text" | "pen" | "shape" | "measure";
export interface MapHandle {
  zoom: (n: number) => void;
  fit: () => void;
  exportSVG: () => string;
  exportPNG: () => Promise<Blob>;
  center: () => Coordinate;
  toCanvas: (c:Coordinate) => Coordinate;
}
interface Props {
  project: Project;
  selected: string[];
  tool: Tool;
  strokeColor: string;
  strokeWidth: number;
  curve: CurveKind;
  shape: import("./model").ShapeKind;
  dash: import("./model").Drawing["dash"];
  fill: string;
  opacity:number;
  onDraftStage: (stage: number) => void;
  placing: string | null;
  onSelect: (id: string | null, multi?: boolean) => void;
  onPlace: (id: string, c: Coordinate) => void;
  onDelete:(id:string)=>void;
  onRotate: (id: string, rotation: number) => void;
  onImagePlacement: (p:ImagePlacement)=>void;
  onCursor: (c: Coordinate | null) => void;
  onMoving: (id: string | null, c: Coordinate | null) => void;
  onCamera: (camera: Project["camera"]) => void;
  onText:(c:Coordinate,text:string)=>void;
  onDrawing: (d: Omit<Drawing, "id" | "text">) => void;
  onMoveDrawing: (id: string, points: Coordinate[]) => void;
  onMapState: (state: string) => void;
  onCancel: () => void;
}
maplibregl.setWorkerUrl(mapWorkerUrl);
const blankStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#ecebdf" },
    },
  ],
};
export default forwardRef<MapHandle, Props>(function MapWorkspace(props, ref) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<GLMap | null>(null),
    latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    if (props.project.mode !== "sketch" || !props.project.sketchImage) return;
    let active=true;const image=new Image();image.onload=()=>{if(!active||!host.current)return;const w=host.current.clientWidth,h=host.current.clientHeight;const z=Math.min(w/image.width,h/image.height);setSketchView({x:(w-image.width*z)/2,y:(h-image.height*z)/2,z});};image.src=props.project.sketchImage;return()=>{active=false;};
  },[props.project.sketchImage,props.project.mode]);
  const [frame, setFrame] = useState(0),
    [ready, setReady] = useState(false),
    [styleVersion, setStyleVersion] = useState(0),
    [mapState, setMapState] = useState("Loading terrain…"),
    [grid, setGrid] = useState<GridResult>({
      lines: [],
      spacing: 1000,
      zone: "",
      unsupported: false,
    });
  const [drawingPreview, setDrawingPreview] = useState<{
      id: string;
      points: Coordinate[];
    } | null>(null),
    [preview, setPreview] = useState<{ id: string; point: Coordinate } | null>(
      null,
    ),
    [draft, setDraft] = useState<Coordinate[]>([]),
    [penPreview, setPenPreview] = useState<Coordinate[]>([]),
    [draggingCursor, setDraggingCursor] = useState(false),
    [rotationPreview, setRotationPreview] = useState<{
      id: string;
      rotation: number;
    } | null>(null),
    [measurement,setMeasurement]=useState<Coordinate[]|null>(null),
    [pointer, setPointer] = useState<Coordinate | null>(null),
    [sketchView, setSketchView] = useState({ x: 0, y: 0, z: 1 });
  const viewRef = useRef(sketchView);
  viewRef.current = sketchView;
  const rotationDrag = useRef<{
    id: string;
    center: Coordinate;
    start: Coordinate;
    initial: number;
  } | null>(null);
  const rotationGesture = useRef(false);
  const penStroke = useRef<Coordinate[] | null>(null);
  const drawingDrag = useRef<{
    id: string;
    start: Coordinate;
    pixels: Coordinate[];
    moved: boolean;
  } | null>(null);
  const drag = useRef<{
      id: string;
      start: Coordinate;
      offset: Coordinate;
      moved: boolean;
    } | null>(null),
    pan = useRef<{ start: Coordinate; x: number; y: number } | null>(null),
    cancelDrag = useRef(false),
    tileError = useRef(false);
  const mode = props.project.mode;
  const mapView = props.project.mapView || "terrain";
  const blankView = mapView === "sand" || mapView === "whiteboard";
  const projectPoint = (c: Coordinate): Coordinate => {
    if (mode === "sketch") {
      const v = viewRef.current;
      return [c[0] * v.z + v.x, c[1] * v.z + v.y];
    }
    const p = map.current?.project(c);
    return p ? [p.x, p.y] : [0, 0];
  };
  const unprojectPoint = (c: Coordinate): Coordinate => {
    if (mode === "sketch") {
      const v = viewRef.current;
      return [(c[0] - v.x) / v.z, (c[1] - v.y) / v.z];
    }
    const p = map.current?.unproject(c);
    return p ? [p.lng, p.lat] : [0, 0];
  };
  const refresh = () => setFrame((f) => f + 1);
  useEffect(() => {
    if (!host.current) return;
    let stopped = false;
    const ctrl = new AbortController();
    let gl: GLMap;
    try {
      gl = new maplibregl.Map({
        container: host.current,
        style: blankStyle,
        center: latest.current.project.camera.center,
        zoom: latest.current.project.camera.zoom,
        minZoom: 2,
        maxZoom: 19,
        pitch: 0,
        bearing: 0,
        renderWorldCopies: false,
        dragRotate: false,
        touchPitch: false,
        canvasContextAttributes: { preserveDrawingBuffer: true },
        attributionControl: { compact: true },
      });
      map.current = gl;
      gl.touchZoomRotate.disableRotation();
      gl.addControl(
        new maplibregl.ScaleControl({ maxWidth: 100, unit: "metric" }),
        "bottom-left",
      );
      gl.on("move", refresh);
      gl.on("resize", refresh);
      gl.on("moveend", () => {
        latest.current.onCamera({
          center: gl.getCenter().toArray() as Coordinate,
          zoom: gl.getZoom(),
        });
        updateGrid();
      });
      gl.on("error", () => {
        if (!stopped) {
          tileError.current = true;
          setMapState(
            navigator.onLine
              ? "Some terrain tiles unavailable"
              : "Basemap unavailable offline",
          );
          latest.current.onMapState("unavailable");
        }
      });
      gl.on("idle", () => {
        if (
          !stopped &&
          !tileError.current &&
          gl.getSource("openmaptiles") &&
          gl.areTilesLoaded()
        ) {
          setMapState("Terrain connected");
          latest.current.onMapState("ready");
        }
      });
      const updateGrid = () => {
        const b = gl.getBounds();
        setGrid(
          geographicGrid(
            b.getWest(),
            b.getSouth(),
            b.getEast(),
            b.getNorth(),
            gl.getZoom(),
          ),
        );
      };
      gl.on("load", () => {
        setReady(true);
        updateGrid();
      });
      fetch("https://tiles.openfreemap.org/styles/liberty", {
        signal: ctrl.signal,
      })
        .then((r) => {
          if (!r.ok) throw Error();
          return r.json();
        })
        .then((style: StyleSpecification) => {
          if (stopped) return;
          for (const layer of style.layers) {
            if (layer.type === "background")
              layer.paint = { "background-color": "#eeeddf" };
            if (layer.type === "fill" && layer.paint) {
              if (/water/.test(layer.id)) layer.paint["fill-color"] = "#b1c6c0";
              else if (/wood|forest|park|landcover/.test(layer.id)) {
                layer.paint["fill-color"] = "#b5c19d";
                layer.paint["fill-opacity"] = 0.48;
              } else if (/residential|building/.test(layer.id))
                layer.paint["fill-color"] = "#d9d6c6";
            }
            if (layer.type === "symbol" && layer.paint) {
              layer.paint["text-color"] = "#5d6552";
              layer.paint["text-halo-color"] = "#f2f0e3";
            }
          }
          style.sources["mildraw-dem"] = {
            type: "raster-dem",
            tiles: [
              "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            encoding: "terrarium",
            maxzoom: 14,
            attribution: "Elevation: AWS Terrain Tiles",
          };
          style.sources[imagerySource.id] = {
            type: "raster",
            tiles: imagerySource.tiles,
            tileSize: imagerySource.tileSize,
            maxzoom: imagerySource.maxzoom,
            attribution: imagerySource.attribution,
          };
          style.layers.splice(1, 0, {
            id: "mildraw-imagery-layer",
            type: "raster",
            source: imagerySource.id,
            layout: {
              visibility: isImagery(latest.current.project.mapView || "terrain")
                ? "visible"
                : "none",
            },
            paint: { "raster-fade-duration": 200 },
          });
          for (const layer of style.layers) {
            layer.layout = {
              ...layer.layout,
              visibility: layerVisible(
                layer,
                latest.current.project.mapView || "terrain",
                latest.current.project.labels,
              )
                ? "visible"
                : "none",
            };
          }
          const index = style.layers.findIndex((l) => l.type === "line");
          style.layers.splice(index < 0 ? 1 : index, 0, {
            id: "mildraw-hillshade",
            type: "hillshade",
            source: "mildraw-dem",
            layout: {
              visibility:
                (latest.current.project.mapView || "terrain") === "terrain"
                  ? "visible"
                  : "none",
            },
            paint: {
              "hillshade-shadow-color": "#726e4f",
              "hillshade-highlight-color": "#fffcdf",
              "hillshade-accent-color": "#8a8b61",
              "hillshade-exaggeration": 0.38,
            },
          });
          gl.setStyle(style);
          gl.once("style.load", () => {
            setReady(true);
            setStyleVersion((v) => v + 1);
            refresh();
            updateGrid();
          });
        })
        .catch((e) => {
          if (!stopped && e.name !== "AbortError") {
            setMapState("Basemap unavailable · overlays preserved");
            latest.current.onMapState("unavailable");
          }
        });
    } catch {
      setMapState("WebGL unavailable · use Sketch");
      latest.current.onMapState("unavailable");
    }
    const online = () => {
      if (!navigator.onLine) {
        setMapState("Basemap unavailable offline");
        latest.current.onMapState("unavailable");
      }
    };
    window.addEventListener("offline", online);
    return () => {
      stopped = true;
      ctrl.abort();
      window.removeEventListener("offline", online);
      gl?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const gl = map.current;
    if (!gl) return;
    if (props.tool === "pan" || props.tool === "select") gl.dragPan.enable();
    else gl.dragPan.disable();
    if(props.tool=== "shape"||props.tool==="measure")gl.doubleClickZoom.disable();else gl.doubleClickZoom.enable();
  }, [props.tool]);
  useEffect(() => {
    setDraft([]);
    setPointer(null);
    penStroke.current = null;
    setPenPreview([]);
  }, [props.tool, mode, props.curve,props.shape]);
  useEffect(
    () => props.onDraftStage(draft.length),
    [draft.length, props.onDraftStage],
  );
  useEffect(() => {
    const gl = map.current;
    if (!gl) return;
    gl.resize();
    if (mode === "terrain") {
      gl.jumpTo({
        center: props.project.camera.center,
        zoom: props.project.camera.zoom,
      });
      refresh();
    }
  }, [mode]);
  useEffect(() => {
    const gl = map.current;
    if (!gl || !ready || !gl.isStyleLoaded()) return;
    for (const layer of gl.getStyle().layers) {
      gl.setLayoutProperty(
        layer.id,
        "visibility",
        layerVisible(layer, mapView, props.project.labels) ? "visible" : "none",
      );
      if (layer.type === "background") gl.setPaintProperty(layer.id, "background-color", mapView === "sand" ? "#e8ddc5" : mapView === "whiteboard" ? "#ffffff" : "#f2f0e3");
      if (layer.type === "symbol") {
        gl.setPaintProperty(
          layer.id,
          "text-color",
          mapView === "hybrid" ? "#f6f7ef" : "#5d6552",
        );
        gl.setPaintProperty(
          layer.id,
          "text-halo-color",
          mapView === "hybrid" ? "#17221b" : "#f2f0e3",
        );
      }
    }
    if (blankView) { setMapState("Terrain connected"); props.onMapState("ready"); gl.triggerRepaint(); return; }
    setMapState(
      "Loading " +
        (mapViews.find((v) => v.id === mapView)?.label.toLowerCase() || "map") +
        "…",
    );
    props.onMapState("loading");
    gl.triggerRepaint();
  }, [props.project.labels, ready, styleVersion, mapView]);
  useEffect(() => {
    const gl = map.current;
    if (!gl || mode !== "terrain") return;
    const c = props.project.camera;
    if (
      Math.abs(gl.getCenter().lng - c.center[0]) > 0.000001 ||
      Math.abs(gl.getCenter().lat - c.center[1]) > 0.000001 ||
      Math.abs(gl.getZoom() - c.zoom) > 0.0001
    )
      gl.jumpTo({ center: c.center, zoom: c.zoom });
  }, [props.project.camera]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelDrag.current = true;
        rotationDrag.current = null;
        setRotationPreview(null);
        penStroke.current = null;
        setPenPreview([]);
        setDraggingCursor(false);
        drag.current = null;
        drawingDrag.current = null;
        setDrawingPreview(null);
        pan.current = null;
        setPreview(null);
        setDraft([]);
        latest.current.onMoving(null, null);
        map.current?.dragPan.enable();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const placed = props.project.items.filter((i) =>
    mode === "terrain" ? i.coordinate : i.sketch,
  );
  const pos = (i: Item): Coordinate =>
    preview?.id === i.id
      ? preview.point
      : (mode === "terrain" ? i.coordinate : i.sketch)!;
  const drawPoints = (d: Drawing) =>
    drawingPreview?.id === d.id ? drawingPreview.points : d.points;
  const gridSVG = () =>
    mode === "terrain" && !blankView && props.project.grid.visible
      ? grid.lines
          .map((l) => {
            const pts = l.points.map(projectPoint);
            const path = pts.map((p) => p.join(",")).join(" ");
            const p = pts.reduce((a, b) =>
              l.axis === "e"
                ? Math.abs(b[1] - 20) < Math.abs(a[1] - 20)
                  ? b
                  : a
                : Math.abs(b[0] - 20) < Math.abs(a[0] - 20)
                  ? b
                  : a,
            );
            return `<polyline points="${path}" fill="none" stroke="${props.project.grid.color}" opacity="${props.project.grid.opacity}" stroke-width="${props.project.grid.weight}"/><text x="${l.axis === "e" ? p[0] + 4 : 18}" y="${l.axis === "e" ? 18 : p[1] - 4}" fill="#626957" font-family="monospace" font-size="10">${l.label}</text>`;
          })
          .join("")
      : "";
  const svgContent = () => {
    const drawings = props.project.drawings
      .map((d) => {
        const pts = drawPoints(d).map(projectPoint);
        return drawingMarkup(d, pts);
      })
      .join("");
    return `${gridSVG()}<defs><marker id="export-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="#354d3b" stroke-width="1.4"/></marker></defs>${drawings}${placed
      .map((i) => {
        const p = projectPoint(pos(i));
        return `<g transform="translate(${p[0] - i.size / 2} ${p[1] - i.size * 0.42}) scale(${i.size / 100})">${symbolMarkup(templateById(i.templateId), i.designation, i.color, rotationPreview?.id === i.id ? rotationPreview.rotation : i.rotation, i.echelon, i.affiliation)}</g>`;
      })
      .join("")}`;
  };
  const getSVG = (withLabel = true) => {
    const w = host.current?.clientWidth || 1000,
      h = host.current?.clientHeight || 700;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${svgContent()}${withLabel ? `<rect y="${h - 24}" width="${w}" height="24" fill="#f6f4e9"/><text x="12" y="${h - 8}" font-size="10" font-family="Arial" fill="#354d3b">MILDraw · ${escapeXML(props.project.title)} · ${mode === "terrain" ? "OVERLAY ONLY · WGS84 · Illustrative symbols" : "SKETCH · Illustrative symbols"}</text>` : ""}</svg>`;
  };
  useImperativeHandle(ref, () => ({
    zoom: (n) => {
      if (mode === "terrain")
        map.current?.zoomTo((map.current?.getZoom() || 10) + n);
      else
        setSketchView((v) => ({
          ...v,
          z: Math.max(0.25, Math.min(4, v.z * (n > 0 ? 1.2 : 1 / 1.2))),
        }));
    },
    fit: () => {
      if (mode === "sketch") {
        setSketchView({ x: 0, y: 0, z: 1 });
        return;
      }
      if (placed.length) {
        const bounds = new maplibregl.LngLatBounds();
        placed.forEach((i) => bounds.extend(i.coordinate!));
        map.current?.fitBounds(bounds, {
          padding: { top: 160, right: 320, bottom: 150, left: 100 },
          maxZoom: 13,
        });
      } else map.current?.easeTo({ center: [76.9, 30.7], zoom: 10 });
    },
    toCanvas: (c) => projectPoint(c),
    center: () =>
      unprojectPoint([
        (host.current?.clientWidth || 800) / 2,
        (host.current?.clientHeight || 600) / 2,
      ]),
    exportSVG: () => getSVG(),
    exportPNG: async () => {
      if (
        mode === "terrain" && !blankView &&
        (mapState !== "Terrain connected" || !map.current?.areTilesLoaded())
      )
        throw Error(
          "Terrain is incomplete. Wait for tiles or export an SVG overlay.",
        );
      const w = host.current!.clientWidth,
        h = host.current!.clientHeight;
      const out = document.createElement("canvas");
      out.width = w * 2;
      out.height = h * 2;
      const ctx = out.getContext("2d")!;
      ctx.scale(2, 2);
      ctx.fillStyle = mapView === "sand" ? "#e8ddc5" : mapView === "whiteboard" ? "#ffffff" : "#eeeddf";
      ctx.fillRect(0, 0, w, h);
      if (mode === "terrain" && !blankView)
        ctx.drawImage(map.current!.getCanvas(), 0, 0, w, h);
      if (mode === "sketch" && props.project.sketchImage) {
        const im = new Image();
        im.src = props.project.sketchImage;
        await im.decode();
        ctx.drawImage(
          im,
          sketchView.x + (props.project.sketchImageTransform?.x || 0)*sketchView.z,
          sketchView.y + (props.project.sketchImageTransform?.y || 0)*sketchView.z,
          im.width * sketchView.z*(props.project.sketchImageTransform?.scale || 1),
          im.height * sketchView.z*(props.project.sketchImageTransform?.scale || 1),
        );
      }
      const img = new Image();
      const url = URL.createObjectURL(
        new Blob([getSVG(false)], { type: "image/svg+xml" }),
      );
      try {
        img.src = url;
        await img.decode();
        ctx.drawImage(img, 0, 0, w, h);
      } finally {
        URL.revokeObjectURL(url);
      }
      const creditLines = mode === "terrain" ? mapCredits(mapView) : [];
      const textLines = [
        `MILDraw · ${props.project.title.slice(0, 50)} · Reference symbols`,
        ...creditLines,
      ];
      ctx.font = "10px Arial";
      const wrapped: string[] = [];
      for (const line of textLines) {
        let row = "";
        for (const word of line.split(" ")) {
          if (ctx.measureText(row + " " + word).width > w - 24 && row) {
            wrapped.push(row);
            row = word;
          } else row += (row ? " " : "") + word;
        }
        if (row) wrapped.push(row);
      }
      const footerHeight = wrapped.length * 14 + 12;
      ctx.fillStyle = "#f5f3e8";
      ctx.fillRect(0, h - footerHeight, w, footerHeight);
      ctx.fillStyle = "#354d3b";
      ctx.textAlign = "left";
      wrapped.forEach((line, i) =>
        ctx.fillText(line, 12, h - footerHeight + 15 + i * 14),
      );
      return new Promise<Blob>((resolve, reject) =>
        out.toBlob(
          (b) => (b ? resolve(b) : reject(Error("Could not export image."))),
          "image/png",
        ),
      );
    },
  }));
  const local = (e: { clientX: number; clientY: number }): Coordinate => {
    const b = host.current!.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  };
  const hover = (e: React.PointerEvent) => {
    const p = local(e);
    const c = unprojectPoint(p);
    if (penStroke.current) {
      const points = penStroke.current;
      const last = projectPoint(points[points.length - 1]);
      if (
        points.length < 5000 &&
        Math.hypot(p[0] - last[0], p[1] - last[1]) >= 2
      ) {
        points.push(c);
        setPenPreview([...points]);
      }
    }
    setPointer(c);
    props.onCursor(mode === "terrain" ? c : null);
    if (rotationDrag.current) {
      const d = rotationDrag.current;
      const rotation = rotationFromPoints(
        d.center,
        d.start,
        p,
        d.initial,
        e.shiftKey,
      );
      if (rotation !== d.initial) rotationGesture.current = true;
      setRotationPreview({ id: d.id, rotation });
    }
    if (drag.current) {
      const d = drag.current;
      if (Math.hypot(p[0] - d.start[0], p[1] - d.start[1]) > 3) d.moved = true;
      const anchor: Coordinate = [p[0] - d.offset[0], p[1] - d.offset[1]];
      const target = unprojectPoint(anchor);
      setPreview({ id: d.id, point: target });
      props.onMoving(d.id, mode === "terrain" ? target : null);
    }
    if (drawingDrag.current) {
      const d = drawingDrag.current;
      const dx = p[0] - d.start[0],
        dy = p[1] - d.start[1];
      if (Math.hypot(dx, dy) > 3) d.moved = true;
      setDrawingPreview({
        id: d.id,
        points: d.pixels.map((q) => unprojectPoint([q[0] + dx, q[1] + dy])),
      });
    }
    if (pan.current && mode === "sketch") {
      const d = pan.current;
      setSketchView((v) => ({
        ...v,
        x: d.x + p[0] - d.start[0],
        y: d.y + p[1] - d.start[1],
      }));
    }
  };
  const up = (e: React.PointerEvent) => {
    if (rotationDrag.current) {
      const d = rotationDrag.current;
      const rotation = rotationFromPoints(
        d.center,
        d.start,
        local(e),
        d.initial,
        e.shiftKey,
      );
      if (rotationGesture.current && !cancelDrag.current)
        props.onRotate(d.id, rotation);
      rotationDrag.current = null;
      setRotationPreview(null);
      map.current?.dragPan.enable();
    }

    if (penStroke.current) {
      const points = penStroke.current;
      const last = unprojectPoint(local(e));
      if (points.length < 5000) points.push(last);
      if (
        points.length >= 2 &&
        (points.length > 2 ||
          Math.hypot(
            ...([
              projectPoint(points[0])[0] - projectPoint(last)[0],
              projectPoint(points[0])[1] - projectPoint(last)[1],
            ] as Coordinate),
          ) > 1)
      )
        props.onDrawing({
          type: "pen",
          points: [...points],
          color: props.strokeColor,
          width: props.strokeWidth,
          dash:props.dash,opacity:props.opacity,
        });
      penStroke.current = null;
      setPenPreview([]);
      cancelDrag.current = true;
    }
    setDraggingCursor(false);
    if (drawingDrag.current) {
      const d = drawingDrag.current;
      const p = local(e);
      if (d.moved && !cancelDrag.current)
        props.onMoveDrawing(
          d.id,
          d.pixels.map((q) =>
            unprojectPoint([
              q[0] + p[0] - d.start[0],
              q[1] + p[1] - d.start[1],
            ]),
          ),
        );
      drawingDrag.current = null;
      setDrawingPreview(null);
      map.current?.dragPan.enable();
    }
    if (drag.current) {
      const d = drag.current;
      const p = local(e);
      const c = unprojectPoint([p[0] - d.offset[0], p[1] - d.offset[1]]);
      if (d.moved && !cancelDrag.current) props.onPlace(d.id, c);
      drag.current = null;
      setPreview(null);
      props.onMoving(null, null);
      map.current?.dragPan.enable();
    }
    pan.current = null;
  };
  const click = (e: React.MouseEvent) => {
    if (mode === "terrain" && !map.current) return;
    if (
      (e.target as HTMLElement).closest(".map-symbol") ||
      cancelDrag.current
    ) {
      cancelDrag.current = false;
      return;
    }
    if (props.tool === "pen") return;
    const c = unprojectPoint(local(e));
    if (props.placing) {
      props.onPlace(props.placing, c);
      return;
    }
    if(props.tool==='measure') {if(!draft.length){setMeasurement(null);setDraft([c]);}else {setMeasurement([draft[0],c]);setDraft([]);}return;}
    if(props.tool==='shape') {
      if(props.shape==='polygon'){if(draft.length>=3&&Math.hypot(...([projectPoint(c)[0]-projectPoint(draft[0])[0],projectPoint(c)[1]-projectPoint(draft[0])[1]] as [number,number]))<12){props.onDrawing({type:'line',points:draft,shape:'polygon',color:props.strokeColor,width:props.strokeWidth,fill:props.fill,opacity:props.opacity,dash:props.dash});setDraft([]);}else setDraft([...draft,c]);}
      else if(!draft.length)setDraft([c]);else {props.onDrawing({type:'line',points:[draft[0],c],shape:props.shape,color:props.strokeColor,width:props.strokeWidth,fill:props.fill,opacity:props.opacity,dash:props.dash});setDraft([]);}return;
    }
    if (props.tool === "text") {
      setInlineText({coordinate:c,text:""});
      return;
    }
    if (props.tool === "line" || props.tool === "arrow") {
      if (!draft.length) setDraft([c]);
      else if (draft.length === 1 && props.curve !== "straight")
        setDraft([draft[0], c]);
      else {
        props.onDrawing({
          type: props.tool,
          points: [...draft, c],
          color: props.strokeColor,
          width: props.strokeWidth,
          curve: props.curve,
          dash: props.dash,opacity:props.opacity,
        });
        setDraft([]);
      }
      return;
    }
    props.onSelect(null);
  };
  const [inlineText,setInlineText]=useState<{coordinate:Coordinate;text:string}|null>(null);
  const [clickPulse, setClickPulse] = useState<{x:number;y:number;id:number}|null>(null);
  void frame;
  return (
    <div
      className={`workspace ${props.tool} ${draggingCursor ? "moving-object" : ""} ${props.placing ? "placing" : ""} ${mode === "sketch" ? "sketch" : ""}`}
      onPointerDownCapture={e => { if(e.button===0) { const r=e.currentTarget.getBoundingClientRect();setClickPulse({x:e.clientX-r.left,y:e.clientY-r.top,id:performance.now()}); } }}
      onPointerMove={hover}
      onPointerUp={up}
      onPointerCancel={() => {
        rotationDrag.current = null;
        setRotationPreview(null);
        penStroke.current = null;
        setPenPreview([]);
        setDraggingCursor(false);
        drawingDrag.current = null;
        setDrawingPreview(null);
        drag.current = null;
        pan.current = null;
        setPreview(null);
        props.onMoving(null, null);
        map.current?.dragPan.enable();
      }}
      onPointerLeave={() => props.onCursor(null)}
      onClick={click}
      onPointerDown={(e) => {
        if (props.tool === "pen" && e.button === 0) {
          if (mode === "terrain" && !map.current) return;
          cancelDrag.current = false;
          penStroke.current = [unprojectPoint(local(e))];
          setPenPreview([...penStroke.current]);
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }
        if (
          mode === "sketch" &&
          !(e.target as HTMLElement).closest(".map-symbol") &&
          (props.tool === "pan" || props.tool === "select")
        ) {
          pan.current = { start: local(e), x: sketchView.x, y: sketchView.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        const c = unprojectPoint(local(e));
        const id = e.dataTransfer.types.includes("application/mildraw")
          ? props.placing
          : null;
        if (id) props.onMoving(id, mode === "terrain" ? c : null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (mode === "terrain" && !map.current) return;
        const id = e.dataTransfer.getData("application/mildraw");
        if (id) props.onPlace(id, unprojectPoint(local(e)));
        props.onMoving(null, null);
      }}
    >
      {clickPulse && <svg key={clickPulse.id} className="click-reticle" style={{left:clickPulse.x,top:clickPulse.y}} viewBox="0 0 56 56" aria-hidden="true"><g><path d="M9 20V9h11M36 9h11v11M47 36v11H36M20 47H9V36" fill="none" stroke="#fff" strokeWidth="5"/><path d="M9 20V9h11M36 9h11v11M47 36v11H36M20 47H9V36" fill="none" stroke="#ed262a" strokeWidth="2"/></g><circle cx="28" cy="28" r="2" fill="#ed262a"/></svg>}

      {inlineText && <input autoFocus className="inline-map-text" aria-label="Text on map" placeholder="Type text…" maxLength={300}
        style={{left:projectPoint(inlineText.coordinate)[0],top:projectPoint(inlineText.coordinate)[1]-18,color:props.strokeColor}}
        value={inlineText.text} onChange={e=>setInlineText({...inlineText,text:e.target.value})}
        onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
        onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){setInlineText(null);}else if(e.key==='Enter'){e.preventDefault();if(inlineText.text.trim())props.onText(inlineText.coordinate,inlineText.text.trim());setInlineText(null);}}}
        onBlur={()=>{if(inlineText.text.trim())props.onText(inlineText.coordinate,inlineText.text.trim());setInlineText(null);}}/>}
      <div
        ref={host}
        aria-hidden={mode === "sketch"}
        className={`map-host ${mode === "sketch" ? "hidden-map" : ""}`}
      />
      {mode === "sketch" && props.project.sketchImage && <BackgroundImage src={props.project.sketchImage} view={sketchView} placement={props.project.sketchImageTransform || defaultImagePlacement} onChange={props.onImagePlacement}/>}
      {props.tool==='measure' && <div className="measurement-readout">{measurement ? mode==='terrain' ? `${(groundDistance(measurement[0],measurement[1])/1000).toFixed(2)} km` : `${Math.hypot(measurement[1][0]-measurement[0][0],measurement[1][1]-measurement[0][1]).toFixed(0)} canvas units` : 'Measure: click two points'}<button onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setMeasurement(null);setDraft([]);}}>Reset</button></div>}
      <svg className="drawing-overlay" aria-label="Drawing overlays">
        {props.tool==='measure' && measurement && <path d={`M${projectPoint(measurement[0]).join(' ')} L${projectPoint(measurement[1]).join(' ')}`} stroke="#a97619" strokeWidth="3" strokeDasharray="6 4" fill="none"/>}
        <defs>
          <marker
            id="arrow"
            markerWidth="9"
            markerHeight="9"
            refX="8"
            refY="4"
            orient="auto"
          >
            <path
              d="M0 0L8 4L0 8"
              fill="none"
              stroke="#354d3b"
              strokeWidth="1.4"
            />
          </marker>
        </defs>
        {mode === "terrain" &&
          !blankView && props.project.grid.visible &&
          grid.lines.map((l, i) => {
            const pts = l.points.map(projectPoint);
            const p = pts.reduce((a, b) =>
              l.axis === "e"
                ? Math.abs(b[1] - 20) < Math.abs(a[1] - 20)
                  ? b
                  : a
                : Math.abs(b[0] - 20) < Math.abs(a[0] - 20)
                  ? b
                  : a,
            );
            return (
              <g key={i}>
                <polyline
                  points={pts.map((p) => p.join(",")).join(" ")}
                  fill="none"
                  stroke={props.project.grid.color}
                  strokeOpacity={props.project.grid.opacity}
                  strokeWidth={props.project.grid.weight}
                />
                <text
                  x={l.axis === "e" ? p[0] + 4 : 18}
                  y={l.axis === "e" ? 18 : p[1] - 4}
                  className="grid-label"
                >
                  {l.label}
                </text>
              </g>
            );
          })}
        {props.project.drawings.map((d) => {
          const p = drawPoints(d).map(projectPoint);
          const geometry = drawingGeometry(p, d.curve, d.type === "pen",d.shape);
          return (
            <g
              key={d.id}
              className="drawing-hit"
              data-drawing-type={d.type}
              data-curve={d.curve || "straight"}
              onPointerDown={(e) => {
                if (props.tool !== "select") return;
                e.stopPropagation();
                cancelDrag.current = false;
                props.onSelect(d.id, e.shiftKey);
                if (e.shiftKey) return;
                setDraggingCursor(true);
                drawingDrag.current = {
                  id: d.id,
                  start: local(e),
                  pixels: p,
                  moved: false,
                };
                map.current?.dragPan.disable();
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onClick={(e) => {
                e.stopPropagation();
                props.onSelect(d.id, e.shiftKey);
              }}
            >
              {d.type === "text" ? (
                <text
                  x={p[0][0]}
                  y={p[0][1]}
                  fill={d.color}
                  className="map-text"
                  stroke={props.selected.includes(d.id) ? "#c6d69a" : "#f6f3e5"}
                >
                  {d.text}
                </text>
              ) : (
                <>
                  <path
                    d={geometry.path}
                    stroke="transparent"
                    strokeWidth="18"
                  />
                  <path
                    d={geometry.path}
                    stroke={props.selected.includes(d.id) ? "#9c751d" : d.color}
                    strokeWidth={d.width || 2.5}
                    fill={d.shape ? d.fill || "none" : "none"}
                    opacity={d.opacity || 1}
                    strokeDasharray={dashArray(d.dash)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {d.type === "arrow" && (
                    <path
                      d={arrowHead(geometry, d.width)}
                      fill="none"
                      stroke={
                        props.selected.includes(d.id) ? "#9c751d" : d.color
                      }
                      strokeWidth={d.width || 2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </>
              )}
            </g>
          );
        })}
        {draft.length > 0 &&
          pointer &&
          (() => {
            const points = (
              draft.length === 1 ? [draft[0], pointer] : [...draft, pointer]
            ).map(projectPoint);
            const g = drawingGeometry(points, props.tool === "shape" || props.tool==="measure" ? "straight" : props.curve,false,props.tool==="shape"?props.shape:undefined);
            return (
              <g>
                <path
                  d={g.path}
                  fill="none"
                  stroke={props.strokeColor}
                  strokeWidth={props.strokeWidth}
                  strokeDasharray="6 4"
                />
                {props.tool === "arrow" && (
                  <path
                    d={arrowHead(g, props.strokeWidth)}
                    fill="none"
                    stroke={props.strokeColor}
                    strokeWidth={props.strokeWidth}
                  />
                )}
                {draft.map((p, i) => {
                  const q = projectPoint(p);
                  return (
                    <circle
                      key={i}
                      cx={q[0]}
                      cy={q[1]}
                      r="4"
                      fill="#f9f9ed"
                      stroke={props.strokeColor}
                    />
                  );
                })}
              </g>
            );
          })()}
        {penPreview.length > 1 && (
          <path
            d={
              drawingGeometry(penPreview.map(projectPoint), "straight", true)
                .path
            }
            fill="none"
            stroke={props.strokeColor}
            strokeWidth={props.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      {placed.map((i) => {
        const p = projectPoint(pos(i));
        return (
          <div key={i.id} className="symbol-instance">
            <button
              aria-label={`Select ${nameOf(i)}`}
              className={`map-symbol ${props.selected.includes(i.id) ? "selected" : ""}`}
              style={{
                left: p[0],
                top: p[1],
                width: i.size,
                height: i.size * 0.84,
              }}
              onClick={(e) => {e.stopPropagation();if(e.detail===0)props.onSelect(i.id,e.shiftKey);}}
              onPointerDown={(e) => {
                if (props.tool === "pan") return;
                e.stopPropagation();
                cancelDrag.current = false;
                props.onSelect(i.id, e.shiftKey);
                if (e.shiftKey) return;
                const q = local(e);
                setDraggingCursor(true);
                drag.current = {
                  id: i.id,
                  start: q,
                  offset: [q[0] - p[0], q[1] - p[1]],
                  moved: false,
                };
                map.current?.dragPan.disable();
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
            >
              <SymbolArt
                template={templateById(i.templateId)}
                designation={i.designation}
                color={i.color}
                rotation={
                  rotationPreview?.id === i.id
                    ? rotationPreview.rotation
                    : i.rotation
                }
                echelon={i.echelon}
                affiliation={i.affiliation}
              />
              <span className="anchor-dot" />
            </button>
            {props.selected.length === 1 &&
              props.selected[0] === i.id &&
              props.tool === "select" &&
              !props.placing && (
                <div
                  className="symbol-rotation-controls"
                  style={{ left: p[0], top: p[1] - i.size * 0.42 - 37 }}
                >
                  <button
                    className="rotation-handle"
                    aria-label={`Rotate ${nameOf(i)}`}
                    title="Drag to rotate · click +15° · Shift snaps to 15°"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!rotationGesture.current)
                        props.onRotate(i.id, (i.rotation + 15) % 360);
                      rotationGesture.current = false;
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      cancelDrag.current = false;
                      rotationGesture.current = false;
                      rotationDrag.current = {
                        id: i.id,
                        center: [p[0], p[1] - i.size * 0.04],
                        start: local(e),
                        initial: i.rotation,
                      };
                      setDraggingCursor(true);
                      map.current?.dragPan.disable();
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                        e.preventDefault();
                        e.stopPropagation();
                        props.onRotate(
                          i.id,
                          (((i.rotation +
                            (e.key === "ArrowRight" ? 1 : -1) *
                              (e.shiftKey ? 15 : 5)) %
                            360) +
                            360) %
                            360,
                        );
                      }
                    }}
                  >
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      aria-hidden="true"
                    >
                      <path d="M20 7v5h-5M20 12a8 8 0 1 0-2 6" />
                    </svg>
                  </button>
                  <button type="button" className="symbol-delete-handle" aria-label={`Delete ${nameOf(i)}`} data-tooltip={`Delete ${nameOf(i)}`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();props.onDelete(i.id);}}>×</button>
                  <span>
                    {rotationPreview?.id === i.id
                      ? rotationPreview.rotation
                      : i.rotation}
                    °
                  </span>
                </div>
              )}
          </div>
        );
      })}
      <div className="map-source-status">
        <span
          className={
            mapState === "Terrain connected" ? "status-dot" : "status-dot amber"
          }
        />
        {mode === "sketch"
          ? "Sketch · no geographic coordinates"
          : mapState === "Terrain connected"
            ? `${mapViews.find((v) => v.id === mapView)?.label || "Terrain"} connected${isImagery(mapView) ? " · EOX 2016 (archived)" : ""}`
            : mapState}
        {mode === "terrain" && !blankView && props.project.grid.visible && (
          <span>
            {" "}
            · {grid.zone}{" "}
            {grid.unsupported
              ? ""
              : `/ ${grid.spacing >= 1000 ? `${grid.spacing / 1000} km` : `${grid.spacing} m`}`}
          </span>
        )}
      </div>
    </div>
  );
});
