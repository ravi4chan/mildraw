import { describe, it, expect } from "vitest";
import {
  catalogue,
  createProject,
  makeItem,
  gridReference,
  validateProject,
  historyReducer,
  resolvePhrase,
  escapeXML,
  type History,
} from "./model";
import { geographicGrid } from "./grid";
import { symbolMarkup } from "./Symbol";
import proj4 from "proj4";
import { forward, toPoint } from "mgrs";
const projectWithItem = () => {
  const p = createProject();
  p.items = [
    { ...makeItem("armoured-regiment", "66"), coordinate: [76.9, 30.7] },
  ];
  return p;
};
describe("project contract", () => {
  it("roundtrips symbols, geographic geometry, unplaced items and settings", () => {
    const p = projectWithItem();
    p.items.push(makeItem("medical"));
    p.drawings = [
      {
        id: "d1",
        type: "arrow",
        points: [
          [76.9, 30.7],
          [76.91, 30.71],
        ],
        text: "",
        color: "#354d3b",
      },
    ];
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it("roundtrips 35 representative template projects with separate workspaces", () => {
    for (const [n, t] of catalogue.entries()) {
      const p = createProject();
      p.title = `Fixture ${n}`;
      const i = makeItem(t.id, `A-${n}`);
      i.coordinate = [76.8 + n * 0.001, 30.7];
      i.sketch = [400 + n * 10, 300];
      i.rotation = t.rotation ? 90 : 0;
      i.color = "#0000ff";
      i.notes = "Sample note";
      p.items = [i, makeItem(t.id)];
      p.inactiveDrawings = [
        {
          id: "s",
          type: "text",
          points: [[400, 300]],
          text: "Sketch note",
          color: "#354d3b",
        },
      ];
      expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
    }
  });
  it("returns an independent project clone", () => {
    const p = projectWithItem();
    const q = validateProject(p);
    q.items[0].designation = "67";
    expect(p.items[0].designation).toBe("66");
  });
  it.each([
    null,
    {},
    { version: 2 },
    { ...createProject(), items: [], camera: { center: [500, 0], zoom: 10 } },
  ])("rejects malformed imports", (p) => {
    expect(() => validateProject(p)).toThrow();
  });
  it.each([
    "coordinate",
    "templateId",
    "designation",
    "color",
    "size",
    "rotation",
    "id",
  ])("rejects malformed symbol %s", (key) => {
    const p = projectWithItem();
    const i = p.items[0] as unknown as Record<string, unknown>;
    i[key] = (
      {
        coordinate: [900, 0],
        templateId: "invented",
        designation: "x".repeat(31),
        color: "red;script",
        size: 1000,
        rotation: 361,
        id: undefined,
      } as Record<string, unknown>
    )[key];
    expect(() => validateProject(p)).toThrow();
  });
  it("rejects duplicate IDs across objects and drawing layers", () => {
    const p = projectWithItem();
    p.items.push({ ...p.items[0] });
    expect(() => validateProject(p)).toThrow();
  });
  it("rejects invalid drawing geometry and nonfinite values", () => {
    const p = createProject();
    p.drawings = [
      {
        id: "bad",
        type: "arrow",
        points: [[0, 0]],
        text: "",
        color: "#354d3b",
      },
    ];
    expect(() => validateProject(p)).toThrow();
    p.drawings = [];
    p.grid.opacity = NaN;
    expect(() => validateProject(p)).toThrow();
  });
  it("keeps sketch and geographic drawings distinct", () => {
    const p = createProject();
    p.inactiveDrawings = [
      {
        id: "sketch",
        type: "line",
        points: [
          [400, 200],
          [600, 300],
        ],
        text: "",
        color: "#354d3b",
      },
    ];
    expect(validateProject(p)).toEqual(p);
  });
  it("rejects executable image formats", () => {
    const p = createProject();
    p.sketchImage = 'data:image/svg+xml,<svg onload="alert(1)"/>';
    expect(() => validateProject(p)).toThrow();
  });
});
describe("catalogue and safe artwork", () => {
  it("has an extensive unique catalogue and preserves all template artwork", () => {
    expect(catalogue.length).toBeGreaterThan(1000);
    expect(new Set(catalogue.map((t) => t.id)).size).toBe(catalogue.length);
    for (const t of catalogue) {
      const svg = symbolMarkup(t, "66");
      expect(svg).toContain("<g");
      expect(svg).not.toMatch(/undefined|NaN/);
    }
  });
  it("escapes user text before SVG export", () => {
    expect(escapeXML('<script>"&')).toBe("&lt;script&gt;&quot;&amp;");
    expect(symbolMarkup(catalogue[0], '<img onerror="x">')).not.toContain(
      "<img",
    );
  });
  it.each([
    ["66 Armoured Regiment", "armoured-regiment", "66"],
    ["66 armored regiment", "armoured-regiment", "66"],
    ["A-12 Infantry Battalion", "infantry-battalion", "A-12"],
    ["tank", "tank", ""],
    ["  67 Artillery Battery  ", "artillery-battery", "67"],
  ])("resolves %s exactly", (text, id, designation) => {
    expect(resolvePhrase(text)).toEqual({ templateId: id, designation });
  });
  it.each([
    "do not add a tank",
    "don't add tank",
    "unknown unit",
    "66 armour",
    "hello world",
    "66 Armoured Regiment please",
  ])("rejects unsupported partial phrases", (text) =>
    expect(resolvePhrase(text)).toBeNull(),
  );
});
describe("undo/redo", () => {
  it("restores placement, coordinates, designation and redo state", () => {
    const p = createProject();
    p.items = [makeItem("armoured-regiment", "66")];
    let h: History = { past: [], present: p, future: [] };
    const placed = {
      ...p,
      items: [{ ...p.items[0], coordinate: [76.9, 30.7] as [number, number] }],
    };
    h = historyReducer(h, { type: "commit", project: placed });
    h = historyReducer(h, { type: "undo" });
    expect(h.present.items[0].coordinate).toBeNull();
    h = historyReducer(h, { type: "redo" });
    expect(h.present.items[0].coordinate).toEqual([76.9, 30.7]);
    expect(h.present.items[0].designation).toBe("66");
  });
  it("clears future on new action and bounds history", () => {
    let h: History = { past: [], present: createProject(), future: [] };
    for (let i = 0; i < 100; i++)
      h = historyReducer(h, {
        type: "commit",
        project: { ...h.present, title: `Brief ${i}` },
      });
    expect(h.past).toHaveLength(80);
    h = historyReducer(h, { type: "undo" });
    expect(h.future).toHaveLength(1);
    h = historyReducer(h, {
      type: "commit",
      project: { ...h.present, title: "new" },
    });
    expect(h.future).toHaveLength(0);
  });
  it("does not record no-op commits", () => {
    const p = createProject();
    const h = { past: [], present: p, future: [] };
    expect(
      historyReducer(h, { type: "commit", project: structuredClone(p) }),
    ).toBe(h);
  });
});
describe("MGRS coordinate conversion", () => {
  // Published WGS84 landmark fixtures, checked against independent PROJ UTM numeric values below.
  it.each([
    [[2.2945, 48.8582], "31U DQ 48251 11932"],
    [[-77.0365, 38.8977], "18S UJ 23394 07395"],
    [[151.2153, -33.8568], "56H LH 34900 52288"],
    [[0, 0], "31N AA 66021 00000"],
  ])("converts known fixture %j", (c, result) =>
    expect(gridReference(c as [number, number], 5)).toBe(result),
  );
  it("uses truncation for all three precisions", () => {
    const c: [number, number] = [2.2945, 48.8582];
    expect(gridReference(c, 3)).toBe("31U DQ 482 119");
    expect(gridReference(c, 4)).toBe("31U DQ 4825 1193");
    expect(gridReference(c, 5)).toBe("31U DQ 48251 11932");
  });
  it("changes zone at the six-degree boundary", () => {
    expect(gridReference([5.99999, 0])).toMatch(/^31N /);
    expect(gridReference([6, 0])).toMatch(/^32N /);
  });
  it("never creates references for unplaced or unsupported areas", () => {
    expect(gridReference(null)).toBe("—");
    expect(gridReference([0, 85])).toBe("Outside MGRS coverage");
    expect(gridReference([0, -81])).toBe("Outside MGRS coverage");
  });
  it("agrees with independent PROJ UTM projection for hemisphere and easting/northing digits", () => {
    for (const c of [
      [2.2945, 48.8582],
      [-77.0365, 38.8977],
      [151.2153, -33.8568],
      [76.9, 30.7],
      [-70, -40],
      [5.99999, 0],
      [6, 0],
    ] as [number, number][]) {
      const zone = Math.floor((c[0] + 180) / 6) + 1;
      const [e, n] = proj4(
        "EPSG:4326",
        `+proj=utm +zone=${zone} ${c[1] < 0 ? "+south " : ""}+datum=WGS84 +units=m +no_defs`,
        c,
      );
      const m = forward(c, 5);
      expect(m.slice(-10, -5)).toBe(
        String(Math.floor(e) % 100000).padStart(5, "0"),
      );
      expect(m.slice(-5)).toBe(String(Math.floor(n) % 100000).padStart(5, "0"));
      const back = toPoint(m);
      expect(back[0]).toBeCloseTo(c[0], 4);
      expect(back[1]).toBeCloseTo(c[1], 4);
    }
  });
});
describe("projected grid", () => {
  it("creates projected geographic lines, not screen-space squares", () => {
    const g = geographicGrid(76.8, 30.6, 77.0, 30.8, 11);
    expect(g.unsupported).toBe(false);
    expect(g.lines.length).toBeGreaterThan(3);
    expect(g.zone).toBe("UTM 43N");
    expect(g.lines[0].points).toHaveLength(25);
  });
  it("uses southern hemisphere projection", () => {
    expect(geographicGrid(151, -34, 151.3, -33.8, 10).zone).toBe("UTM 56S");
  });
  it.each([
    [-2, 30, 2, 31],
    [0, 83, 1, 85],
    [2, 60, 4, 62],
    [8, 73, 10, 74],
    [76, -1, 77, 1],
  ])("explicitly declines unsupported boundaries", (...b) => {
    expect(geographicGrid(b[0], b[1], b[2], b[3], 8).unsupported).toBe(true);
  });
  it("adapts spacing as zoom changes", () => {
    expect(geographicGrid(76.8, 30.6, 77, 30.8, 16).spacing).toBe(100);
    expect(geographicGrid(76.8, 30.6, 77, 30.8, 10).spacing).toBe(5000);
  });
});
