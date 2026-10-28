import {deleteObjects} from "./project-actions";
import DelayedTooltip from "./DelayedTooltip";
import {projectKML} from "./extra-tools";
import MapSearch from "./MapSearch";
import { useElevation } from "./elevation";
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { get, set } from "idb-keyval";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Copy,
  Crosshair,
  Download,
  FilePlus2,
  FolderOpen,
  Grid2X2,
  Shapes, Ruler, ShieldCheck, ShieldAlert, Swords, Truck, Eraser, FileText,
  GripHorizontal,
  Moon,
  Sun,
  Hand,
  HelpCircle,
  Image,
  Layers,
  LocateFixed,
  Map,
  Maximize,
  Minus,
  MousePointer2,
  MoveUpRight,
  PanelLeftClose,
  PenTool,
  Plus,
  Redo2,
  Search,
  Shield,
  SlidersHorizontal,
  Spline,
  SquareDashed,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import MapWorkspace, { type MapHandle, type Tool } from "./MapWorkspace";
import { SymbolArt } from "./Symbol";
import InkPicker from "./InkPicker";
import { useFloatingPanels, PanelGrip } from "./useFloatingPanels";
import { mapViews, latLongReference, isImagery } from "./map-config";
import {
  catalogue,
  symbolFamily,
  type SymbolFamily,
  type Affiliation,
  symbolColours,
  echelons,
  type EchelonId,
  type CoordinateDisplay,
  createProject,
  gridReference,
  historyReducer,
  makeItem,
  nameOf,
  templateById,
  uid,
  validateProject,
  type Category,
  type CurveKind,
  type Coordinate,
  type Item,
  type Project,
} from "./model";

const categories: ("All" | Category)[] = [
  "All",
  "Formations",
  "Armour",
  "Infantry",
  "Artillery",
  "Engineers",
  "Logistics",
  "Signals",
  "Aviation",
  "Special Forces", "Equipment", "Naval", "Installations", "Control Measures", "Tactical Tasks",
];
function download(blob: Blob, name: string) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 2000);
}
function Logo({dark=false}:{dark?:boolean}) {
  return (
    <img
      className="brand-logo"
      src={dark ? "/mildraw-logo-dark.png" : "/mildraw-logo.png"}
      width="296"
      height="226"
      alt="MILDraw — terrain briefing editor"
    />
  );
}
function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  active,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${active ? "active" : ""}`}
      aria-label={label}
      aria-pressed={active}
      data-tooltip={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export default function App() {
  const [history, dispatch] = useReducer(historyReducer, undefined, () => ({
    past: [],
    present: createProject(),
    future: [],
  }));
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("mildraw-theme") || "light"; } catch { return "light"; } });
  const [dock, setDock] = useState({ x: 16, y: 155 });
  const dockDrag = useRef<{x:number;y:number;left:number;top:number}|null>(null);
  useEffect(() => { try { localStorage.setItem("mildraw-theme", theme); } catch {} }, [theme]);
  const panel = useFloatingPanels();
  const [referenceBottom,setReferenceBottom]=useState(190);
  useLayoutEffect(()=>{const r=document.querySelector('.reference-panel')?.getBoundingClientRect();const w=document.querySelector('.workspace-container')?.getBoundingClientRect();if(r&&w){const b=Math.round(r.bottom-w.top+10);setReferenceBottom(v=>v===b?v:b);}});

  const [showStrokeOptions,setShowStrokeOptions]=useState(true);
  const [shape,setShape]=useState<import("./model").ShapeKind>("rectangle");
  const [dash,setDash]=useState<import("./model").Drawing["dash"]>("solid");
  const [fill,setFill]=useState("none");
  const [opacity,setOpacity]=useState(1);
  const [collection,setCollection]=useState<"All"|SymbolFamily>("All");
  const [libraryAffiliation,setLibraryAffiliation]=useState<Affiliation>("friendly");
  const [visibleSymbols,setVisibleSymbols]=useState(48);
  const [savedProject,setSavedProject]=useState<Project|null>(null);
  const savedProjectRef=useRef<Project|null>(null),saveLocked=useRef(true),pendingBackup=useRef<Promise<unknown>|null>(null);
  const project = history.present;
  const projectRef = useRef(project);
  projectRef.current = project;
  const [hydrated, setHydrated] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [tool, setTool] = useState<Tool>("select"),
    [strokeColor, setStrokeColor] = useState("#000000"),
    [strokeWidth, setStrokeWidth] = useState(2.5),
    [curve, setCurve] = useState<CurveKind>("straight"),
    [draftStage, setDraftStage] = useState(0),
    [placing, setPlacing] = useState<string | null>(null),
    [cursor, setCursor] = useState<Coordinate | null>(null),
    [moving, setMoving] = useState<{ id: string; c: Coordinate | null } | null>(
      null,
    ),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState<"All" | Category>("All"),
    [tab, setTab] = useState<"catalogue" | "objects">("catalogue"),
    [toast, setToast] = useState(""),
    [saveState, setSaveState] = useState("Loading local project"),
    [mapState, setMapState] = useState("loading"),
    [sidebar, setSidebar] = useState(true),
    [settings, setSettings] = useState(false),
    [exportMenu, setExportMenu] = useState(false),
    [modal, setModal] = useState<"help" | "new" | "mode" | null>(null),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [offlineReady, setOfflineReady] = useState(
      navigator.serviceWorker?.controller ? "ready" : "pending",
    );
  const mapRef = useRef<MapHandle>(null),
    fileRef = useRef<HTMLInputElement>(null),
    imageRef = useRef<HTMLInputElement>(null),
    cameraRef = useRef(project.camera),
    saveSeq = useRef(0),
    dirtyAt = useRef(0),
    savedAt = useRef(0);
  const notify = useCallback((s: string) => setToast(s), []);
  const commit = useCallback((p: Project) => {
    if(saveLocked.current && savedProjectRef.current) pendingBackup.current=set('mildraw-recovery-project',savedProjectRef.current).catch(()=>{});
    saveLocked.current=false;
    setSaveState("Saving…");
    dispatch({ type: "commit", project: { ...p, camera: cameraRef.current } });
  }, []);
  useEffect(() => {
    let live = true;
    get("mildraw-project")
      .then((p) => {
        if (p && live) {
          const valid = validateProject(p);
          if (
            p.items.some(
              (i: Item, n: number) => i.color !== valid.items[n].color,
            )
          )
            notify("Existing symbol colours mapped to the six-colour palette.");
          if(valid.items.length || valid.drawings.length || valid.inactiveDrawings.length || valid.sketchImage){savedProjectRef.current=valid;setSavedProject(valid);}
          else saveLocked.current=false;
        }
        if(live && !p)saveLocked.current=false;
        if (live) {
          setHydrated(true);
          setSaveState("All changes saved");
        }
      })
      .catch(() => {
        saveLocked.current=false;
        if (live) {
          setHydrated(true);
          setSaveState("Local storage unavailable");
          notify(
            "Browser storage is unavailable. Download your project to keep a backup.",
          );
        }
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    const ready = () => setOfflineReady("ready"),
      error = () => setOfflineReady("unavailable");
    window.addEventListener("mildraw-offline-ready", ready);
    window.addEventListener("mildraw-offline-error", error);
    return () => {
      window.removeEventListener("mildraw-offline-ready", ready);
      window.removeEventListener("mildraw-offline-error", error);
    };
  }, []);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(
          ".modal button",
        )
        ?.focus(),
    );
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".modal button:not(:disabled),.modal input,.modal a[href],.modal textarea,.modal select",
        ),
      );
      const first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus();
    };
  }, [modal]);
  const persist = useCallback(
    async (p: Project) => {
      if(saveLocked.current)return;
      await pendingBackup.current;
      const seq = ++saveSeq.current;
      const revision = dirtyAt.current;
      setSaveState("Saving…");
      try {
        await set("mildraw-project", p);
        if (seq === saveSeq.current) {
          savedAt.current = revision;
          if (revision === dirtyAt.current) setSaveState("All changes saved");
        }
      } catch {
        if (seq === saveSeq.current) {
          setSaveState("Save failed · download backup");
          notify("Could not autosave. Download your project now.");
        }
      }
    },
    [notify],
  );
  useEffect(() => {
    if (!hydrated || saveLocked.current) return;
    dirtyAt.current++;
    setSaveState("Saving…");
    const t = setTimeout(
      () => persist({ ...project, camera: cameraRef.current }),
      500,
    );
    return () => clearTimeout(t);
  }, [project, hydrated, persist]);
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && hydrated)
        void persist({ ...projectRef.current, camera: cameraRef.current });
    };
    const pageHide = () => {
      if (hydrated)
        void persist({ ...projectRef.current, camera: cameraRef.current });
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", pageHide);
    const interval = setInterval(() => {
      if (hydrated && dirtyAt.current !== savedAt.current)
        void persist({ ...projectRef.current, camera: cameraRef.current });
    }, 2000);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", pageHide);
      clearInterval(interval);
    };
  }, [hydrated, persist]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    setSelected((s) =>
      s.filter(
        (id) =>
          project.items.some((i) => i.id === id) ||
          project.drawings.some((d) => d.id === id),
      ),
    );
    if (placing && !project.items.some((i) => i.id === placing))
      setPlacing(null);
  }, [project.items, project.drawings, placing]);
  const item =
    selected.length === 1
      ? project.items.find((i) => i.id === selected[0])
      : undefined;
  const drawing =
    selected.length === 1
      ? project.drawings.find((i) => i.id === selected[0])
      : undefined;
  const select = (id: string | null, multi = false) =>
    setSelected((s) =>
      !id
        ? []
        : multi
          ? s.includes(id)
            ? s.filter((x) => x !== id)
            : [...s, id]
          : [id],
    );
  const updateItem = (patch: Partial<Item>) => {
    if (!item) return;
    commit({
      ...project,
      items: project.items.map((i) =>
        i.id === item.id ? { ...i, ...patch } : i,
      ),
    });
  };
  const removeIds = (ids:readonly string[]) => {
    if(!ids.length)return;
    const current=projectRef.current;
    const removed=current.items.filter(i=>ids.includes(i.id));
    commit(deleteObjects(current,ids));
    setSelected(s=>s.filter(id=>!ids.includes(id)));setPlacing(null);setMoving(null);setTool('select');
    notify(removed.length===1&&ids.length===1?`Deleted ${nameOf(removed[0])} · Undo available`:`Deleted ${ids.length} object(s) · Undo available`);
  };
  const remove=()=>removeIds(selected);
  const duplicate = () => {
    const copies = project.items
      .filter((i) => selected.includes(i.id))
      .map((i) => ({
        ...i,
        id: uid(),
        coordinate: project.mode === "terrain" ? (mapRef.current?.center() || project.camera.center) : i.coordinate,
        sketch:
          project.mode === "sketch" && i.sketch
            ? ([i.sketch[0] + 30, i.sketch[1] + 30] as Coordinate)
            : null,
      }));
    const drawings = project.drawings
      .filter((d) => selected.includes(d.id))
      .map((d) => ({
        ...d,
        id: uid(),
        points: d.points.map(
          (c) =>
            [
              c[0] + (project.mode === "sketch" ? 20 : 0.002),
              c[1] + (project.mode === "sketch" ? 20 : 0.002),
            ] as Coordinate,
        ),
      }));
    if (!copies.length && !drawings.length) return;
    commit({
      ...project,
      items: [...project.items, ...copies],
      drawings: [...project.drawings, ...drawings],
    });
    setSelected([...copies.map((i) => i.id), ...drawings.map((d) => d.id)]);
    notify(
      `${copies.length + drawings.length} object(s) duplicated`,
    );
  };
  const add = (templateId: string, designation = "") => {
    const i = makeItem(templateId, designation);
    if(templateById(templateId).sidc) i.affiliation=libraryAffiliation;
    if (project.mode === "sketch") i.sketch = mapRef.current?.center() || [400, 300];
    else i.coordinate = mapRef.current?.center() || project.camera.center;
    commit({ ...project, items: [...project.items, i] });
    setSelected([i.id]);
    setTool("select");
    setPlacing(null);
    notify(
      `${nameOf(i)} added at centre`,
    );
  };
  const place = (id: string, c: Coordinate) => {
    if (
      project.mode === "terrain" &&
      (c[1] < -80 || c[1] > 84 || c[0] < -180 || c[0] > 180)
    ) {
      notify("Place symbols within MGRS coverage: 80°S to 84°N.");
      return;
    }
    commit({
      ...project,
      items: project.items.map((i) =>
        i.id === id
          ? {
              ...i,
              ...(project.mode === "terrain"
                ? { coordinate: c }
                : { sketch: c }),
            }
          : i,
      ),
    });
    setPlacing(null);
    setMoving(null);
    setSelected([id]);
  };
  const cancel = () => {
    setPlacing(null);
    setMoving(null);
    setTool("select");
  };
  const downloadProject = () => {
    download(
      new Blob(
        [JSON.stringify({ ...project, camera: cameraRef.current }, null, 2)],
        { type: "application/json" },
      ),
      `${project.title.replace(/[^a-z0-9-]/gi, "_") || "briefing"}.mildraw.json`,
    );
    notify("Project downloaded · your portable backup");
  };
  const exportFile = async (kind: "png" | "svg" | "pdf" | "kml") => {
    setExportMenu(false);
    setBusy(true);
    try {
      if (!mapRef.current) throw Error("Workspace not ready.");
      let blob:Blob;
      if(kind==='kml')blob=new Blob([projectKML(project)],{type:'application/vnd.google-earth.kml+xml'});
      else if(kind==='pdf'){
        const png=await mapRef.current.exportPNG(),bytes=new Uint8Array(await png.arrayBuffer());
        const image=await createImageBitmap(png);const {jsPDF}=await import('jspdf');
        const pdf=new jsPDF({orientation:image.width>image.height?'landscape':'portrait',unit:'px',format:[image.width,image.height]});
        pdf.addImage(bytes,'PNG',0,0,image.width,image.height);image.close();blob=pdf.output('blob');
      }else blob=kind==='svg'?new Blob([mapRef.current.exportSVG()],{type:'image/svg+xml'}):await mapRef.current.exportPNG();
      download(blob, `${project.title.replace(/[^a-z0-9-]/gi, "_")}.${kind}`);
      notify(
        kind === "svg"
          ? "SVG overlay exported · basemap excluded"
          : `${kind.toUpperCase()} exported`,
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const importProject = async (f: File) => {
    try {
      if (f.size > 25 * 1024 * 1024)
        throw Error("Project exceeds the 25 MB import limit.");
      const p = validateProject(JSON.parse(await f.text()));
      saveLocked.current=false;
      cameraRef.current = p.camera;
      dispatch({ type: "replace", project: p });
      setSelected([]);
      setPlacing(null);
      notify("Project opened successfully");
    } catch (e) {
      notify(`Import rejected: ${(e as Error).message}`);
    }
  };
  const importImage = async (f: File) => {
    try {
      
      if (
        !f.type.startsWith("image/") ||
        f.size > 8 * 1024 * 1024
      )
        throw Error("Choose an image under 8 MB.");
      const reader = new FileReader();
      const data = await new Promise<string>((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(f);
      });
      const im = new window.Image();
      im.src = data;
      await im.decode();
      if (im.width > 12000 || im.height > 12000)
        throw Error("Image dimensions exceed 12,000 pixels.");
      const canvas=document.createElement("canvas");
      const scale=Math.min(1,4096/Math.max(im.width,im.height));
      canvas.width=Math.max(1,Math.round(im.width*scale));canvas.height=Math.max(1,Math.round(im.height*scale));
      canvas.getContext("2d")!.drawImage(im,0,0,canvas.width,canvas.height);
      const background=canvas.toDataURL("image/png");
      commit({ ...project, mode:"sketch", sketchImage: background,sketchImageTransform:{x:0,y:0,scale:1},
        items:project.items.map(i=>({...i,sketch:i.sketch || (i.coordinate ? mapRef.current?.toCanvas(i.coordinate) : null) || [400,300]})),
        ...(project.mode === "terrain" ? {drawings:project.inactiveDrawings,inactiveDrawings:project.drawings} : {}) });
      setPlacing(null);setTool("select");
      notify("Image background loaded · unreferenced canvas · Undo available");
    } catch (e) {
      notify((e as Error).message);
    }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).matches(
          'input,textarea,select,[contenteditable="true"]',
        ) &&
        e.key !== "Escape"
      )
        return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Escape") {
        cancel();
        setModal(null);
        setExportMenu(false);
        setSettings(false);
        return;
      }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
        cancel();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
        cancel();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        downloadProject();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
        return;
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected([
          ...project.items.map((i) => i.id),
          ...project.drawings.map((d) => d.id),
        ]);
        return;
      }
      if (mod) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
        return;
      }
      const tools: Record<string, Tool> = {
        p: "pen",
        v: "select",
        h: "pan",
        l: "line",
        a: "arrow",
        t: "text",
      };
      if (tools[e.key.toLowerCase()]) {
        setPlacing(null);
        setTool(tools[e.key.toLowerCase()]);
      }
      if (e.key.toLowerCase() === "c") {
        setPlacing(null);
        setTool("line");
        setCurve("parabolic");
      }
      if (e.key === "/") {
        e.preventDefault();
        setSidebar(true);
        document
          .querySelector<HTMLInputElement>('[aria-label="Search symbols"]')
          ?.focus();
      }
      if (e.key === "?") setModal("help");
      if (e.key === "=" || e.key === "+") mapRef.current?.zoom(1);
      if (e.key === "-") mapRef.current?.zoom(-1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  useEffect(()=>setVisibleSymbols(48),[search,category,collection,libraryAffiliation]);
  const filtered = catalogue.filter(
    (t) =>
      (libraryAffiliation === "friendly" || !!t.sidc || !!t.task) &&
      (collection === "All" || symbolFamily(t) === collection) &&
      (category === "All" || category === t.category) &&
      [t.name, ...t.aliases].some((s) =>
        s.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  const refItem = moving
    ? project.items.find((i) => i.id === moving.id)
    : placing
      ? project.items.find((i) => i.id === placing)
      : cursor ? undefined : item;
  const refCoordinate =
    project.mode === "sketch"
      ? null
      : moving
        ? moving.c
        : placing
          ? null
          : cursor ? cursor : selected.length > 1
            ? null
            : item
              ? item.coordinate
              : cursor;
  const refState =
    project.mode === "sketch"
      ? "Sketch workspace"
      : moving
        ? "Moving"
        : placing
          ? "Placing"
          : cursor ? "Cursor" : selected.length > 1
            ? "Multiple symbols selected"
            : item
              ? "Selected"
              : "Cursor";
  const refValue =
    project.mode === "sketch"
      ? "No geographic reference"
      : refItem && !refCoordinate
        ? "Unplaced"
        : selected.length > 1 && !cursor
          ? "—"
          : project.coordinateDisplay === "latlong"
            ? latLongReference(refCoordinate)
            : gridReference(refCoordinate, project.grid.precision);
  const coordinateDisplay = project.coordinateDisplay || "both";
  const changeMode = () => {
    commit({
      ...project,
      mode: project.mode === "terrain" ? "sketch" : "terrain",
      drawings: project.inactiveDrawings,
      inactiveDrawings: project.drawings,
    });
    cancel();
    setSelected([]);
    setModal(null);
    notify(
      "Workspace switched. Symbols retain their separate terrain/sketch positions.",
    );
  };
  const elevationCoordinate = project.mode === "terrain" ? (cursor || refCoordinate) : null;
  const elevation = useElevation(elevationCoordinate);
  return (
    <div className={`app floating-layout theme-${theme} ${!sidebar ? "sidebar-collapsed" : ""}`} style={{"--reference-bottom":`${referenceBottom}px`} as React.CSSProperties}>
      <DelayedTooltip/>
      <header className="header">
        <a
          className="brand"
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="MILDraw home"
        >
          <Logo dark={theme === "dark"} />
          <span className="brand-signature">
            DRAW.
            <br />
            BRIEF.
            <br />
            OPERATE.
          </span>
        </a>
        <div className="header-divider" />
        <div className="project-meta">
          <div className="eyebrow">WORKSPACE / BRIEFING</div>
          <input
            aria-label="Project title"
            value={project.title}
            maxLength={120}
            onChange={(e) => commit({ ...project, title: e.target.value })}
          />
        </div>
        <div className="save-indicator">
          <span
            className={
              saveState.includes("failed") || saveState.includes("unavailable")
                ? "status-dot amber"
                : "status-dot"
            }
          />
          <span>{saveState}</span>
        </div>
        <div className="header-actions">
          {savedProject && <button className="restore-briefing" title="Restore the briefing saved before this launch" onClick={()=>{saveLocked.current=false;cameraRef.current=savedProject.camera;commit(savedProject);setSavedProject(null);setSelected([]);cancel();notify('Saved briefing restored');}}>Restore saved briefing</button>}
          <IconButton label="Upload background image" onClick={() => imageRef.current?.click()}><Image size={18}/></IconButton>
          <IconButton label="New project" onClick={() => setModal("new")}>
            <FilePlus2 size={18} />
          </IconButton>
          <IconButton
            label="Open project"
            onClick={() => fileRef.current?.click()}
          >
            <FolderOpen size={18} />
          </IconButton>
          <span className="separator" />
          <button
            className="button download-button"
            aria-label="Download project"
            title="Download project (⌘S)"
            onClick={downloadProject}
          >
            <ArrowDownToLine size={16} />
            <span>Download project</span>
          </button>
          <div className="export-wrap">
            <button
              className="button primary"
              onClick={() => setExportMenu(!exportMenu)}
              disabled={busy}
            >
              <Download size={16} />
              {busy ? "Exporting…" : "Export"}
              <ChevronDown size={14} />
            </button>
            {exportMenu && (
              <div className="dropdown export-menu">
                <div className="eyebrow">EXPORT WORKSPACE</div>
                <button
                  disabled={project.mode === "terrain" && mapState !== "ready"}
                  onClick={() => exportFile("png")}
                >
                  <Image size={17} />
                  <span>
                    PNG image
                    <small>
                      {project.mode === "terrain" && mapState !== "ready"
                        ? "Waiting for terrain · SVG available"
                        : "Visible map + overlays · 2×"}
                    </small>
                  </span>
                </button>
                <button disabled={project.mode==='terrain' && mapState!=='ready'} onClick={()=>exportFile('pdf')}><FileText size={17}/><span>PDF briefing<small>Visible map and overlays</small></span></button>
                <button disabled={project.mode!=='terrain'} onClick={()=>exportFile('kml')}><Map size={17}/><span>KML overlay<small>Geographic objects · Google Earth</small></span></button>
                <button onClick={() => exportFile("svg")}>
                  <SquareDashed size={17} />
                  <span>
                    SVG overlay<small>Editable vectors · no basemap</small>
                  </span>
                </button>
              </div>
            )}
          </div>

        </div>
      </header>
      <div className="symbol-dock" aria-label="Movable symbol toolbar" style={{left:dock.x,top:dock.y}}>
        <button className="dock-grip" aria-label="Move symbol toolbar" title="Drag to move · arrow keys to reposition" onPointerDown={e => { dockDrag.current={x:e.clientX,y:e.clientY,left:dock.x,top:dock.y};e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { const d=dockDrag.current;if(d) setDock({x:Math.max(8,Math.min(window.innerWidth-68,d.left+e.clientX-d.x)),y:Math.max(90,Math.min(window.innerHeight-160,d.top+e.clientY-d.y))}); }} onPointerUp={() => dockDrag.current=null} onPointerCancel={() => dockDrag.current=null} onKeyDown={e => { const v:Record<string,[number,number]>={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]}; if(v[e.key]) {e.preventDefault(); setDock(d=>({x:Math.max(8,Math.min(window.innerWidth-68,d.x+v[e.key][0])),y:Math.max(90,Math.min(window.innerHeight-160,d.y+v[e.key][1]))}));} }}><GripHorizontal size={18}/></button>
        <IconButton label="Choose military symbol" active={sidebar && tab === "catalogue"} onClick={() => {setTab("catalogue");setSidebar(!(sidebar && tab === "catalogue"));}}><Grid2X2 size={19}/></IconButton>
        <IconButton label="Placed objects" active={sidebar && tab === "objects"} onClick={() => {setTab("objects");setSidebar(!(sidebar && tab === "objects"));}}><Layers size={19}/></IconButton>
        <IconButton label="Equipment library" onClick={()=>{setCollection('Equipment');setCategory('All');setSearch('');setTab('catalogue');setSidebar(true);}}><Truck size={18}/></IconButton>
        <IconButton label="Friendly units" onClick={()=>{setCollection('Units');setCategory('All');setSearch('');setLibraryAffiliation('friendly');setTab('catalogue');setSidebar(true);}}><ShieldCheck size={18}/></IconButton>
        <IconButton label="Enemy units" onClick={()=>{setCollection('Units');setCategory('All');setSearch('');setLibraryAffiliation('hostile');setTab('catalogue');setSidebar(true);}}><ShieldAlert size={18}/></IconButton>
        <IconButton label="Tactical tasks" onClick={()=>{setCollection('Tasks');setCategory('All');setSearch('');setTab('catalogue');setSidebar(true);}}><Swords size={18}/></IconButton>


      </div>
      <aside className="sidebar" aria-label="Symbol picker" {...panel("symbol library")} style={{left:Math.max(8,Math.min(dock.x+56,window.innerWidth-320)),top:Math.max(dock.y,window.innerWidth<=590?230:190),...panel("symbol library").style}}>
        <div className="sidebar-heading"><PanelGrip name="symbol library"/>
          <div>
            <span className="eyebrow">YOUR FIELD KIT</span>
            <h1>
              Symbol library<span>{catalogue.length}</span>
            </h1>
          </div>
          <IconButton
            label="Close symbol picker"
            onClick={() => setSidebar(false)}
          >
            <PanelLeftClose size={17} />
          </IconButton>
        </div>
        <div className="tab-row">
          <button
            className={tab === "catalogue" ? "selected" : ""}
            onClick={() => setTab("catalogue")}
          >
            <Grid2X2 size={14} />
            Catalogue
          </button>
          <button
            className={tab === "objects" ? "selected" : ""}
            onClick={() => setTab("objects")}
          >
            <Layers size={14} />
            Objects<span>{project.items.length + project.drawings.length}</span>
          </button>
        </div>
        {tab === "catalogue" ? (
          <>
            <label className="search">
              <Search size={16} />
              <input
                aria-label="Search symbols"
                placeholder="Search the catalogue…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>/</kbd>
            </label>
            <div className="catalogue-filters">
              <label>Collection<select aria-label="Symbol collection" value={collection} onChange={e=>{setCollection(e.target.value as "All"|SymbolFamily);setCategory("All");}}>{["All","Units","Equipment","Air","Sea","Installations","Control Measures","Tasks"].map(f=><option key={f}>{f}</option>)}</select></label>
              <label>Affiliation<select aria-label="Library affiliation" value={libraryAffiliation} onChange={e=>setLibraryAffiliation(e.target.value as Affiliation)}><option value="friendly">Friendly</option><option value="hostile">Enemy / Hostile</option><option value="neutral">Neutral</option><option value="unknown">Unknown</option></select></label>
              <label className="branch-filter">Branch<select aria-label="Symbol branch" value={category} onChange={e=>setCategory(e.target.value as "All"|Category)}>{categories.map(c=><option key={c} value={c}>{c === "All" ? "All branches" : c}</option>)}</select></label>
            </div>
            <div className="catalogue-scroll">
              <div className="list-caption">
                <span>
                  {category === "All" ? "ALL SYMBOLS" : category.toUpperCase()}
                </span>
                <span>{filtered.length} templates</span>
              </div>
              <div className="symbol-grid">
                {filtered.slice(0,visibleSymbols).map((t) => (
                  <button
                    className="symbol-card"
                    key={t.id}
                    onClick={() => add(t.id)}
                    title={`Add ${t.name}`}
                  >
                    <span className="add-badge">
                      <Plus size={12} />
                    </span>
                    <div className="symbol-thumbnail">
                      <SymbolArt template={t} affiliation={libraryAffiliation}/>
                    </div>
                    <strong>{t.name}</strong>
                    <span>{t.category}</span>
                  </button>
                ))}
              </div>
              {filtered.length>visibleSymbols && <button className="load-symbols" onClick={()=>setVisibleSymbols(v=>v+48)}>Show more · {filtered.length-visibleSymbols} remaining</button>}
              {!filtered.length && (
                <div className="empty-search">
                  <Search size={25} />
                  <strong>No symbols found</strong>
                  <p>Try another term or category.</p>
                  <button
                    onClick={() => {
                      setSearch("");
                      setCategory("All");setCollection("All");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
              <div className="notation-note">
                <Shield size={15} />
                <p>
                  Illustrative catalogue
                  <small>Pending your approved notation.</small>
                </p>
              </div>
            </div>

          </>
        ) : (
          <div className="objects-list">
            <div className="list-caption">
              <span>PROJECT OBJECTS</span>
              <span>{project.items.length + project.drawings.length}</span>
            </div>
            {!project.items.length && !project.drawings.length && (
              <div className="empty-search">
                <Layers size={30} />
                <strong>A clean slate</strong>
                <p>Add a symbol or draw on the map.</p>
              </div>
            )}
            {project.items.map((i) => (
              <button
                key={i.id}
                className={`object-row ${selected.includes(i.id) ? "chosen" : ""}`}
                onClick={(e) => select(i.id, e.shiftKey)}
              >
                <SymbolArt
                  template={templateById(i.templateId)}
                  color={i.color}
                  affiliation={i.affiliation}
                />
                <span>
                  {nameOf(i)}
                  <small>
                    {(project.mode === "terrain" ? i.coordinate : i.sketch)
                      ? "Placed"
                      : "Unplaced"}
                  </small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
            {project.drawings.map((d) => (
              <button
                className={`object-row ${selected.includes(d.id) ? "chosen" : ""}`}
                key={d.id}
                onClick={(e) => select(d.id, e.shiftKey)}
              >
                {d.type === "text" ? (
                  <Type size={20} />
                ) : (
                  <MoveUpRight size={20} />
                )}
                <span>
                  {d.type === "text"
                    ? d.text
                    : d.type === "pen"
                      ? "Pen stroke"
                      : d.type === "arrow"
                        ? `${d.curve && d.curve !== "straight" ? d.curve + " " : ""}Arrow`
                        : `${d.curve && d.curve !== "straight" ? d.curve + " " : ""}Line`}
                  <small>Drawing layer</small>
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="sidebar-bottom">
          <span
            className={
              offlineReady === "unavailable" ? "status-dot amber" : "status-dot"
            }
          />
          {offlineReady === "ready"
            ? "OFFLINE EDITOR READY"
            : offlineReady === "unavailable"
              ? "OFFLINE CACHE UNAVAILABLE"
              : "LOCAL-FIRST WORKSPACE"}
          <IconButton
            label="Help and keyboard shortcuts"
            onClick={() => setModal("help")}
          >
            <HelpCircle size={16} />
          </IconButton>
        </div>
      </aside>
      <main className="main">
        <div className="workspace-topbar">
          <div className="workspace-tabs">
            {!sidebar && (
              <IconButton
                label="Open symbol library"
                onClick={() => setSidebar(true)}
              >
                <Grid2X2 size={17} />
              </IconButton>
            )}
            <button
              className="workspace-tab active"
              onClick={() => setModal("mode")}
            >
              {project.mode === "terrain" ? (
                <Map size={15} />
              ) : (
                <SquareDashed size={15} />
              )}
              <span>
                {project.mode === "terrain"
                  ? "Terrain workspace"
                  : "Blank sketch"}
              </span>
              <ChevronDown size={13} />
            </button>
            <span className="sample-tag">SAMPLE / UNCLASSIFIED</span>
          </div>
          <MapSearch onGo={center=>{cameraRef.current={center,zoom:13};commit({...project,mode:"terrain",...(project.mode === "sketch" ? {drawings:project.inactiveDrawings,inactiveDrawings:project.drawings}: {})});setPlacing(null);setTool("select");}}/>
          <div className="workspace-top-actions">
          <IconButton label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? <Moon size={18}/> : <Sun size={18}/>}</IconButton>
            <IconButton
              label="Undo (⌘Z)"
              onClick={() => {
                dispatch({ type: "undo" });
                cancel();
              }}
              disabled={!history.past.length}
            >
              <Undo2 size={17} />
            </IconButton>
            <IconButton
              label="Redo (⌘⇧Z)"
              onClick={() => {
                dispatch({ type: "redo" });
                cancel();
              }}
              disabled={!history.future.length}
            >
              <Redo2 size={17} />
            </IconButton>
            <span className="separator" />
            <button
              className="layers-button"
              onClick={() => setSettings(!settings)}
            >
              <SlidersHorizontal size={15} />
              Map settings
            </button>
          </div>
        </div>
        <div className="workspace-container">
          {hydrated && (
            <MapWorkspace
              ref={mapRef}
              project={project}
              selected={selected}
              tool={tool}
              strokeColor={strokeColor}
              strokeWidth={strokeWidth}
              curve={curve}
              shape={shape} dash={dash} fill={fill} opacity={opacity}
              onDraftStage={setDraftStage}
              placing={placing}
              onSelect={select}
              onPlace={place}
              onDelete={id=>removeIds([id])}
              onImagePlacement={p => commit({...project,sketchImageTransform:p})}
              onRotate={(id, rotation) =>
                commit({
                  ...project,
                  items: project.items.map((i) =>
                    i.id === id ? { ...i, rotation } : i,
                  ),
                })
              }
              onCursor={setCursor}
              onMoving={(id, c) => setMoving(id ? { id, c } : null)}
              onCamera={(c) => {
                cameraRef.current = c;
                void persist({ ...projectRef.current, camera: c });
              }}
              onText={(coordinate,text)=>{const id=uid();commit({...project,drawings:[...project.drawings,{id,type:"text",points:[coordinate],text,color:strokeColor}]});setSelected([id]);setTool("select");}}
              onDrawing={(d) => commit({...project,drawings:[...project.drawings,{...d,id:uid(),text:""}]})}
              onMoveDrawing={(id, points) =>
                commit({
                  ...project,
                  drawings: project.drawings.map((d) =>
                    d.id === id ? { ...d, points } : d,
                  ),
                })
              }
              onMapState={setMapState}
              onCancel={cancel}
            />
          )}
          <div className="map-heading">
            <span className="eyebrow">THE BIG PICTURE</span>
            <span>Clarity on every coordinate.</span>
          </div>
          <div
            className="floating-toolbar"
            {...panel("drawing toolbar")}
            role="toolbar"
            aria-label="Drawing tools"
          >
            <PanelGrip name="drawing toolbar"/>
            {(
              [
                {
                  id: "select",
                  icon: <MousePointer2 size={19} />,
                  label: "Select (V)",
                },
                { id: "pan", icon: <Hand size={19} />, label: "Pan (H)" },
                { id: "pen", icon: <PenTool size={19} />, label: "Pen (P)" },
                { id: "line", icon: <Minus size={21} />, label: "Line (L)" },
                {
                  id: "arrow",
                  icon: <MoveUpRight size={20} />,
                  label: "Arrow (A)",
                },
                { id: "text", icon: <Type size={19} />, label: "Text (T)" },
              ] as const
            ).map((t) => (
              <IconButton
                key={t.id}
                label={t.label}
                active={
                  tool === t.id &&
                  !placing &&
                  (t.id !== "line" || curve === "straight")
                }
                onClick={() => {
                  setPlacing(null);
                  setTool(t.id);setShowStrokeOptions(true);setSidebar(false);
                  if (t.id === "line") setCurve("straight");
                }}
              >
                {t.icon}
              </IconButton>
            ))}
            <IconButton
              label="Parabolic curve / phase line (C)"
              active={tool === "line" && curve !== "straight" && !placing}
              onClick={() => {
                setPlacing(null);
                setTool("line");
                setCurve("parabolic");setShowStrokeOptions(true);
              }}
            >
              <Spline size={20} />
            </IconButton>
            <IconButton label="Shapes" active={tool==='shape'} onClick={()=>{setTool('shape');setShowStrokeOptions(true);setSidebar(false);setPlacing(null);}}><Shapes size={19}/></IconButton>
            <IconButton label="Measure distance" active={tool==='measure'} onClick={()=>{setTool('measure');setSidebar(false);setPlacing(null);}}><Ruler size={19}/></IconButton>
            <IconButton label="Map controls" onClick={()=>setSettings(!settings)}><Map size={19}/></IconButton>
            <IconButton label="Clear workspace · undo available" disabled={!project.items.length&&!project.drawings.length} onClick={()=>{commit({...project,items:[],drawings:[]});setSelected([]);notify('Workspace cleared · Undo restores it');}}><Eraser size={19}/></IconButton>
            <IconButton label="Help and keyboard shortcuts" onClick={()=>setModal('help')}><HelpCircle size={19}/></IconButton>
            <span className="toolbar-rule" />
            <IconButton
              label="Duplicate selection (⌘D)"
              onClick={duplicate}
              disabled={!selected.length}
            >
              <Copy size={18} />
            </IconButton>
            <IconButton
              label="Delete selection"
              onClick={remove}
              disabled={!selected.length}
            >
              <Trash2 size={18} />
            </IconButton>
          </div>
          {(["pen","line","arrow","shape"] as Tool[]).includes(tool) && !placing && !showStrokeOptions && <button className="stroke-options-reopen" onClick={()=>setShowStrokeOptions(true)}>Drawing options</button>}
          {(["pen", "line", "arrow", "shape"] as Tool[]).includes(tool) && !placing && showStrokeOptions && (
            <section className="drawing-options" {...panel("drawing options")} aria-label="Stroke options">
              <PanelGrip name="drawing options"/>
              <div className="panel-title">
                <span className="eyebrow">
                  {tool === "shape" ? "SHAPES" : tool === "pen"
                    ? "FREEHAND PEN"
                    : tool === "arrow"
                      ? "ARROW TOOL"
                      : "LINE TOOL"}
                </span>
                <IconButton
                  label="Close stroke options"
                  onClick={() => setShowStrokeOptions(false)}
                >
                  <X size={14} />
                </IconButton>
              </div>
              {tool==='shape' ? <div className="shape-choices">{(['rectangle','circle','polygon','star'] as const).map(s=><button key={s} aria-pressed={shape===s} onClick={()=>setShape(s)}>{s[0].toUpperCase()+s.slice(1)}</button>)}</div> : <>
              <div className="drawing-modes" role="group" aria-label="Drawing shape">
                {([
                  { id: "straight", name: "Straight line", path: "M5 25 L35 8" },
                  { id: "parabolic", name: "Parabolic curve", path: "M4 26 Q20 -12 36 26" },
                  { id: "freehand", name: "Freehand drawing", path: "M4 24 C8 2 14 4 17 18 S26 34 29 16 S34 8 37 11" },
                ] as const).map(mode => <button key={mode.id} type="button" aria-label={mode.name} title={mode.name} aria-pressed={mode.id === "freehand" ? tool === "pen" : tool !== "pen" && curve === mode.id} onClick={() => {
                  if (mode.id === "freehand") setTool("pen");
                  else { setTool(tool === "arrow" ? "arrow" : "line"); setCurve(mode.id); }
                }}><svg viewBox="0 0 40 34" aria-hidden="true"><path d={mode.path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></button>)}
              </div>
              </>}
              <InkPicker color={strokeColor} onChange={setStrokeColor} />
              <label className="range-label">
                Stroke width<span>{strokeWidth}px</span>
                <input
                  aria-label="Stroke width"
                  type="range"
                  min="1"
                  max="8"
                  step="0.5"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(Number(e.target.value))}
                />
              </label>
              <label className="field-label">Line style<select aria-label="Drawing line style" value={dash} onChange={e=>setDash(e.target.value as typeof dash)}>{['solid','dashed','dotted','dash-dot'].map(d=><option key={d}>{d}</option>)}</select></label>
              {tool==='shape' && <label className="toggle-label">Fill colour<input aria-label="Shape fill colour" type="color" value={fill==='none'?'#788953':fill} onChange={e=>setFill(e.target.value)}/><button onClick={()=>setFill('none')}>No fill</button></label>}
              <label className="range-label">Opacity<span>{Math.round(opacity*100)}%</span><input aria-label="Drawing opacity" type="range" min=".05" max="1" step=".05" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label>
              <p className="panel-note">
                {tool==='shape' ? shape==='polygon' ? 'Click vertices, then click the first point to close.' : shape==='rectangle' ? 'Click opposite corners.' : 'Click the centre, then set the radius.' : tool === "pen"
                  ? "Hold and draw. Release to finish one stroke."
                  : curve === "straight"
                    ? "Click the start and end points."
                    : "Click start, end, then a point on the bend. The curve passes through all three."}
              </p>
            </section>
          )}
          <section className="reference-panel" {...panel("coordinates")} aria-label="Live grid reference">
              <PanelGrip name="coordinates"/>
            <div className="reference-header">
              <span>
                <Crosshair size={14} />
                LIVE COORDINATES
              </span>
              <span className="datum-tag">WGS84</span>
            </div>
            <div
              className="coordinate-tabs"
              role="group"
              aria-label="Coordinate display"
            >
              {(
                [
                  { id: "grid", label: "Grid" },
                  { id: "latlong", label: "Lat / Long" },
                  { id: "both", label: "Both" },
                ] as { id: CoordinateDisplay; label: string }[]
              ).map((v) => (
                <button
                  key={v.id}
                  aria-pressed={coordinateDisplay === v.id}
                  className={coordinateDisplay === v.id ? "active" : ""}
                  onClick={() =>
                    commit({ ...project, coordinateDisplay: v.id })
                  }
                >
                  {v.label}
                </button>
              ))}
            </div>
            <div className="reference-source">
              <span className="pulse-dot" />
              {refState}
              <span>
                {refItem
                  ? nameOf(refItem)
                  : selected.length > 1
                    ? `${selected.length} objects`
                    : project.mode === "terrain"
                      ? "Map position"
                      : "Unreferenced canvas"}
              </span>
            </div>
            <div
              className={`mgrs-value ${refValue.length > 27 ? "small" : ""} ${coordinateDisplay === "latlong" ? "latlong-primary" : ""}`}
            >
              {refValue}
            </div>
            <div className="reference-bottom">
              <span>
                {coordinateDisplay === "both"
                  ? refCoordinate
                    ? latLongReference(refCoordinate)
                    : "— latitude / — longitude"
                  : coordinateDisplay === "latlong"
                    ? "WGS84 · decimal degrees"
                    : `MGRS · ${project.grid.precision * 2}-digit reference`}
              </span>
              <IconButton
                label="Copy grid reference"
                disabled={
                  !refCoordinate ||
                  (coordinateDisplay !== "latlong" &&
                    refValue === "Outside MGRS coverage")
                }
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${refItem ? nameOf(refItem) + " · " : ""}${refValue} · WGS84 ${refCoordinate![1].toFixed(6)}, ${refCoordinate![0].toFixed(6)}`,
                    );
                    notify("Full grid reference copied");
                  } catch {
                    notify(
                      "Clipboard unavailable. Select and copy the reference text.",
                    );
                  }
                }}
              >
                <Copy size={14} />
              </IconButton>
            </div>
            <div className="elevation-readout" aria-live="polite" title="Approximate ground elevation from AWS Terrain Tiles">
              <span>{cursor ? "Cursor elevation" : "Ground elevation"}</span>
              <strong>{project.mode !== "terrain" ? "Unreferenced" : !elevationCoordinate ? "—" : elevation.loading ? "Loading…" : elevation.value === null ? "Unavailable" : `≈ ${Math.round(elevation.value)} m`}</strong>
            </div>
          </section>
          {settings && (
            <section className="settings-panel" {...panel("map settings")}>
              <PanelGrip name="map settings"/>
              <div className="panel-title">
                <h2>Map settings</h2>
                <IconButton
                  label="Close map settings"
                  onClick={() => setSettings(false)}
                >
                  <X size={15} />
                </IconButton>
              </div>
              <label className="toggle-label">
                Geographic grid
                <input
                  type="checkbox"
                  checked={project.grid.visible}
                  onChange={(e) =>
                    commit({
                      ...project,
                      grid: { ...project.grid, visible: e.target.checked },
                    })
                  }
                />
              </label>
              <label className="toggle-label">
                Place labels
                <input
                  type="checkbox"
                  checked={project.labels}
                  onChange={(e) =>
                    commit({ ...project, labels: e.target.checked })
                  }
                />
              </label>
              <label className="field-label">
                MGRS precision
                <select
                  value={project.grid.precision}
                  onChange={(e) =>
                    commit({
                      ...project,
                      grid: {
                        ...project.grid,
                        precision: Number(e.target.value) as 3 | 4 | 5,
                      },
                    })
                  }
                >
                  <option value={3}>6 digits · 100 m</option>
                  <option value={4}>8 digits · 10 m</option>
                  <option value={5}>10 digits · 1 m</option>
                </select>
              </label>
              <label className="range-label">
                Grid opacity{" "}
                <span>{Math.round(project.grid.opacity * 100)}%</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={project.grid.opacity}
                  onChange={(e) =>
                    commit({
                      ...project,
                      grid: {
                        ...project.grid,
                        opacity: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
              <label className="range-label">
                Line weight <span>{project.grid.weight}px</span>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.5"
                  value={project.grid.weight}
                  onChange={(e) =>
                    commit({
                      ...project,
                      grid: { ...project.grid, weight: Number(e.target.value) },
                    })
                  }
                />
              </label>
              <label className="toggle-label">
                Grid colour
                <input
                  type="color"
                  value={project.grid.color}
                  onChange={(e) =>
                    commit({
                      ...project,
                      grid: { ...project.grid, color: e.target.value },
                    })
                  }
                />
              </label>
              <p className="panel-note">
                Display precision does not establish positional accuracy. Grid
                is limited to a single supported UTM zone.
              </p>
              {project.mode === "sketch" && (
                <button
                  className="button"
                  onClick={() => imageRef.current?.click()}
                >
                  <Image size={15} />
                  Import background
                </button>
              )}
              {project.sketchImage && <button className="button" onClick={() => commit({...project,sketchImage:undefined})}>Remove background image</button>}
            </section>
          )}
          {!settings && (item || drawing || selected.length > 1) && (
            <section className="properties-panel" {...panel("object properties")}>
              <PanelGrip name="object properties"/>
              <div className="panel-title">
                <span className="eyebrow">
                  {selected.length > 1 ? "SELECTION" : "OBJECT PROPERTIES"}
                </span>
                <IconButton label="Deselect" onClick={() => setSelected([])}>
                  <X size={15} />
                </IconButton>
              </div>
              {item ? (
                <>
                  <div className="selected-preview">
                    <SymbolArt
                      template={templateById(item.templateId)}
                      designation={item.designation}
                      color={item.color}
                      rotation={item.rotation}
                      echelon={item.echelon}
                      affiliation={item.affiliation}
                    />
                    <div>
                      <h2>{templateById(item.templateId).name}</h2>
                      <span>
                        {templateById(item.templateId).sidc ? `${templateById(item.templateId).family} · APP-6 renderer` : templateById(item.templateId).task ? "Schematic task graphic" : `${templateById(item.templateId).category} · Illustrative v1`}
                      </span>
                    </div>
                  </div>
                  {templateById(item.templateId).sidc && <label className="field-label">Affiliation<select aria-label="Symbol affiliation" value={item.affiliation || "friendly"} onChange={e=>updateItem({affiliation:e.target.value as Affiliation})}><option value="friendly">Friendly</option><option value="hostile">Enemy / Hostile</option><option value="neutral">Neutral</option><option value="unknown">Unknown</option></select></label>}
                  <label className="field-label">
                    Designation
                    <input
                      value={item.designation}
                      maxLength={30}
                      placeholder="e.g. 66"
                      onChange={(e) =>
                        updateItem({ designation: e.target.value })
                      }
                    />
                  </label>
                  <label className="range-label">
                    Symbol size<span>{item.size}px</span>
                    <input
                      type="range"
                      min="40"
                      max="160"
                      step="2"
                      value={item.size}
                      onChange={(e) =>
                        updateItem({ size: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="field-label">
                    Formation echelon
                    <select
                      aria-label="Formation echelon"
                      value={
                        item.echelon ||
                        echelons.find(
                          (e) => e.mark === templateById(item.templateId).level,
                        )?.id ||
                        "none"
                      }
                      onChange={(e) =>
                        updateItem({ echelon: e.target.value as EchelonId })
                      }
                    >
                      {echelons.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.mark ? e.mark + " · " : ""}
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="range-label">
                    Symbol rotation<span>{item.rotation}°</span>
                    <input
                      aria-label="Symbol rotation"
                      type="range"
                      min="0"
                      max="360"
                      step="1"
                      value={item.rotation}
                      onChange={(e) =>
                        updateItem({ rotation: Number(e.target.value) })
                      }
                    />
                  </label>
                  <div className="rotation-actions">
                    <button
                      onClick={() =>
                        updateItem({ rotation: (item.rotation + 345) % 360 })
                      }
                      aria-label="Rotate symbol counterclockwise 15 degrees"
                    >
                      −15°
                    </button>
                    <label>
                      <input
                        aria-label="Rotation degrees"
                        type="number"
                        min="0"
                        max="360"
                        step="1"
                        value={item.rotation}
                        onChange={(e) => {
                          const rotation = Number(e.target.value);
                          if (Number.isFinite(rotation))
                            updateItem({
                              rotation: Math.max(0, Math.min(360, rotation)),
                            });
                        }}
                      />
                      °
                    </label>
                    <button
                      onClick={() => updateItem({ rotation: 0 })}
                      aria-label="Reset symbol rotation"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() =>
                        updateItem({ rotation: (item.rotation + 15) % 360 })
                      }
                      aria-label="Rotate symbol clockwise 15 degrees"
                    >
                      +15°
                    </button>
                  </div>
                  <div className="colour-field">
                    <span>Symbol colour</span>
                    <div>
                      {symbolColours.map((c) => (
                        <button
                          key={c.hex}
                          title={c.name}
                          aria-label={`Symbol colour ${c.name}`}
                          aria-pressed={item.color === c.hex}
                          className={item.color === c.hex ? "chosen" : ""}
                          style={{
                            background: c.hex,
                            color: c.hex === "#ffff00" ? "#000" : "#fff",
                          }}
                          onClick={() => updateItem({ color: c.hex })}
                        >
                          {item.color === c.hex && <Check size={13} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="field-label">
                    Notes
                    <textarea
                      value={item.notes}
                      maxLength={1000}
                      onChange={(e) => updateItem({ notes: e.target.value })}
                      placeholder="Add a briefing note…"
                      rows={2}
                    />
                  </label>
                  <div className="property-actions">
                    <button onClick={duplicate}>
                      <Copy size={14} />
                      Duplicate
                    </button>
                    <button className="danger" onClick={remove}>
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                  {!(project.mode === "terrain"
                    ? item.coordinate
                    : item.sketch) && (
                    <button
                      className="button primary full"
                      onClick={() => {
                        setPlacing(item.id);
                        setTool("select");
                      }}
                    >
                      <LocateFixed size={15} />
                      Place on {project.mode === "terrain" ? "map" : "sketch"}
                    </button>
                  )}
                </>
              ) : drawing ? (
                <>
                  <h2>
                    {drawing.type === "text"
                      ? "Text annotation"
                      : `${drawing.shape ? drawing.shape : drawing.type === "pen" ? "Freehand pen" : drawing.type === "arrow" ? "Arrow" : "Line"}${drawing.curve && drawing.curve !== "straight" ? " · " + drawing.curve : ""} drawing`}
                  </h2>
                  {drawing.type === "text" && (
                    <label className="field-label">
                      Text
                      <input
                        value={drawing.text}
                        maxLength={300}
                        onChange={(e) =>
                          commit({
                            ...project,
                            drawings: project.drawings.map((d) =>
                              d.id === drawing.id
                                ? { ...d, text: e.target.value }
                                : d,
                            ),
                          })
                        }
                      />
                    </label>
                  )}
                  <label className="toggle-label">
                    Ink colour
                    <input
                      type="color"
                      value={drawing.color}
                      onChange={(e) =>
                        commit({
                          ...project,
                          drawings: project.drawings.map((d) =>
                            d.id === drawing.id
                              ? { ...d, color: e.target.value }
                              : d,
                          ),
                        })
                      }
                    />
                  </label>
                  {drawing.type !== "text" && (
                    <>
                      <InkPicker
                        label="Selected ink"
                        color={drawing.color}
                        onChange={(color) =>
                          commit({
                            ...project,
                            drawings: project.drawings.map((d) =>
                              d.id === drawing.id ? { ...d, color } : d,
                            ),
                          })
                        }
                      />
                      <label className="range-label">
                        Stroke width<span>{drawing.width || 2.5}px</span>
                        <input
                          aria-label="Selected stroke width"
                          type="range"
                          min="1"
                          max="8"
                          step="0.5"
                          value={drawing.width || 2.5}
                          onChange={(e) =>
                            commit({
                              ...project,
                              drawings: project.drawings.map((d) =>
                                d.id === drawing.id
                                  ? { ...d, width: Number(e.target.value) }
                                  : d,
                              ),
                            })
                          }
                        />
                      </label>
                    </>
                  )}
                  {drawing.type!=='text' && <>
                    <label className="field-label">Line style<select aria-label="Selected drawing line style" value={drawing.dash||'solid'} onChange={e=>commit({...project,drawings:project.drawings.map(d=>d.id===drawing.id?{...d,dash:e.target.value as typeof dash}:d)})}>{['solid','dashed','dotted','dash-dot'].map(v=><option key={v}>{v}</option>)}</select></label>
                    <label className="range-label">Opacity<input aria-label="Selected drawing opacity" type="range" min=".05" max="1" step=".05" value={drawing.opacity||1} onChange={e=>commit({...project,drawings:project.drawings.map(d=>d.id===drawing.id?{...d,opacity:Number(e.target.value)}:d)})}/></label>
                    {drawing.shape && <label className="toggle-label">Fill colour<input aria-label="Selected shape fill" type="color" value={drawing.fill&&drawing.fill!=='none'?drawing.fill:'#788953'} onChange={e=>commit({...project,drawings:project.drawings.map(d=>d.id===drawing.id?{...d,fill:e.target.value}:d)})}/><button onClick={()=>commit({...project,drawings:project.drawings.map(d=>d.id===drawing.id?{...d,fill:'none'}:d)})}>No fill</button></label>}
                  </>}
                  <div className="property-actions">
                    <button onClick={duplicate}>
                      <Copy size={14} />
                      Duplicate
                    </button>
                    <button className="danger" onClick={remove}>
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2>{selected.length} objects selected</h2>
                  <p className="panel-note">
                    Shift-click to change your selection.
                  </p>
                  <div className="property-actions">
                    <button onClick={duplicate}>
                      <Copy size={14} />
                      Duplicate
                    </button>
                    <button className="danger" onClick={remove}>
                      <Trash2 size={14} />
                      Remove all
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
          {project.mode === "terrain" && (
            <div
              className="basemap-switcher"
              {...panel("basemap selector")}
              role="group"
              aria-label="Basemap view"
              style={{...panel("basemap selector").style}}
            >
              <PanelGrip name="basemap selector"/>
              {mapViews.map((v) => (
                <button
                  key={v.id}
                  aria-label={`${v.label} view`}
                  aria-pressed={(project.mapView || "terrain") === v.id}
                  className={
                    (project.mapView || "terrain") === v.id ? "active" : ""
                  }
                  onClick={() => commit({ ...project, mapView: v.id })}
                >
                  {v.label}
                </button>
              ))}
              {isImagery(project.mapView || "terrain") && (
                <span>Sentinel-2 · 2016 archive</span>
              )}
            </div>
          )}
          <div className="map-navigation">
            <div
              className="north"
              role="img"
              aria-label="North-up map"
              title="Map stays north-up"
            >
              <span>N</span>
              <Compass size={27} />
            </div>
            <div>
              <IconButton
                label="Zoom in (+)"
                onClick={() => mapRef.current?.zoom(1)}
              >
                <Plus size={18} />
              </IconButton>
              <IconButton
                label="Zoom out (-)"
                onClick={() => mapRef.current?.zoom(-1)}
              >
                <Minus size={18} />
              </IconButton>
            </div>
            <IconButton
              label="Fit symbols to view"
              onClick={() => mapRef.current?.fit()}
            >
              <Maximize size={17} />
            </IconButton>
            <IconButton
              label="Toggle geographic grid"
              active={project.grid.visible}
              onClick={() =>
                commit({
                  ...project,
                  grid: { ...project.grid, visible: !project.grid.visible },
                })
              }
            >
              <Grid2X2 size={18} />
            </IconButton>
          </div>
          {(placing || (tool !== "select" && tool !== "pan")) && (
            <div className="tool-hint">
              {placing
                ? "Click terrain to place the symbol"
                : tool === "text"
                  ? "Click to add a text annotation"
                  : tool === "pen"
                    ? "Hold to draw · release to finish"
                    : curve !== "straight"
                      ? draftStage === 0
                        ? "Click the start point"
                        : draftStage === 1
                          ? "Click the end point"
                          : "Move to bend the curve · click to finish"
                      : "Click a start point, then an end point"}
              <kbd>ESC</kbd>
              <button onClick={cancel}>Cancel</button>
            </div>
          )}
        </div>
        <footer className="statusbar">
          <div>
            <span className={online ? "status-dot" : "status-dot amber"} />
            {online ? "Online" : "Offline"}
            <span className="footer-separator" />
            {project.items.length} symbols
            <span className="footer-separator" />
            {project.drawings.length} drawings
          </div>
          <span className="footer-tip">
            {selected.length
              ? `${selected.length} selected · Shift-click for multiple`
              : "Choose from the catalogue, then click or drag to place"}
          </span>
          <button onClick={() => setModal("help")}>
            <HelpCircle size={13} />
            Shortcuts<kbd>?</kbd>
          </button>
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <IconButton label="Close dialog" onClick={() => setModal(null)}>
              <X size={18} />
            </IconButton>
            <span className="eyebrow">MILDRAW / FIELD GUIDE</span>
            <h2 id="modal-title">
              {modal === "help"
                ? "A few useful bearings."
                : modal === "new"
                  ? "Start a fresh briefing?"
                  : modal === "mode"
                    ? "Choose your workspace."
                    : "Add a text annotation."}
            </h2>
            {modal === "help" ? (
              <>
                <p>
                  Use the floating picker to add a symbol at the map centre. Shift-click
                  selects multiple objects.
                </p>
                <div className="shortcut-grid">
                  {[
                    ["Select", "V"],
                    ["Pan", "H"],
                    ["Pen", "P"],
                    ["Arc / phase line", "C"],
                    ["Line", "L"],
                    ["Arrow", "A"],
                    ["Text", "T"],
                    ["Cancel", "Esc"],
                    ["Undo", "⌘ / Ctrl Z"],
                    ["Redo", "⌘ / Ctrl ⇧ Z"],
                    ["Duplicate", "⌘ / Ctrl D"],
                    ["Download", "⌘ / Ctrl S"],
                    ["Select all", "⌘ / Ctrl A"],
                    ["Remove", "Delete"],
                  ].map(([a, b]) => (
                    <div key={a}>
                      <span>{a}</span>
                      <kbd>{b}</kbd>
                    </div>
                  ))}
                </div>
                <p className="panel-note">
                  Projects autosave on this device. Download a project for a
                  portable backup. Voice is planned for Phase 2. Symbols are
                  illustrative, pending approved notation. Offline mode
                  preserves manual editing; terrain needs a connection. MGRS
                  covers 80°S–84°N. Geographic grid displays only supported
                  single-zone extents.
                </p>
                <a
                  href="https://openfreemap.org/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Basemap: OpenFreeMap / OpenMapTiles / OpenStreetMap ↗
                </a>
              </>
            ) : modal === "new" ? (
              <>
                <p>
                  Download your current project first if you want to keep it. A
                  new briefing replaces this browser’s autosaved project.
                </p>
                <div className="modal-actions">
                  <button className="button" onClick={downloadProject}>
                    <Download size={15} />
                    Download current
                  </button>
                  <button
                    className="button primary"
                    onClick={() => {
                      const p = createProject();
                      saveLocked.current=false;setSavedProject(null);
                      cameraRef.current = p.camera;
                      dispatch({ type: "replace", project: p });
                      setSelected([]);
                      cancel();
                      setSettings(false);
                      setTab("catalogue");
                      setSearch("");
                      setCategory("All");setCollection("All");
                      setModal(null);
                      notify("New briefing ready");
                    }}
                  >
                    Create new briefing
                  </button>
                </div>
              </>
            ) : modal === "mode" ? (
              <>
                <p>
                  {project.mode === "terrain"
                    ? "Terrain uses WGS84 geographic positions. Sketch uses a separate, unreferenced canvas."
                    : "Sketch is an unreferenced canvas. Terrain uses real geographic positions."}{" "}
                  Each workspace keeps its own drawings and symbol positions.
                  Symbols stay unplaced in a workspace until you place them
                  there. Undo restores the previous workspace.
                </p>
                <div className="mode-card">
                  <div>
                    {project.mode === "terrain" ? (
                      <SquareDashed size={25} />
                    ) : (
                      <Map size={25} />
                    )}
                    <strong>
                      {project.mode === "terrain"
                        ? "Blank sketch"
                        : "Terrain map"}
                    </strong>
                    <small>
                      {project.mode === "terrain"
                        ? "Draw freely. Import a background image."
                        : "Real terrain. Live MGRS. Geographic placement."}
                    </small>
                  </div>
                  <button className="button primary" onClick={changeMode}>
                    Switch workspace
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              </>
            ) : (
              null
            )}
          </section>
        </div>
      )}
      <input
        type="file"
        ref={fileRef}
        accept=".json,.mildraw"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importProject(f);
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={imageRef}
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importImage(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
