import { describe, it, expect } from "vitest";
import {
  catalogue,
  echelons,
  symbolColours,
  normaliseSymbolColour,
  makeItem,
  createProject,
  validateProject,
  historyReducer,
  type History,
} from "./model";
import { symbolMarkup } from "./Symbol";
import {
  layerVisible,
  latLongReference,
  mapCredits,
  imagerySource,
} from "./map-config";
describe("reference symbol catalogue", () => {
  it("represents the full Section-to-Command echelon ladder", () => {
    expect(echelons.slice(1).map((e) => e.mark)).toEqual([
      "•",
      "•••",
      "I",
      "II",
      "X",
      "XX",
      "XXX",
      "XXXX",
    ]);
  });
  it("uses the supplied battalion-equivalent marking for armoured/artillery regiments", () => {
    expect(catalogue.find((t) => t.id === "armoured-regiment")?.level).toBe(
      "II",
    );
    expect(catalogue.find((t) => t.id === "artillery-regiment")?.level).toBe(
      "II",
    );
  });
  it("contains distinct mechanised and armoured reconnaissance artwork", () => {
    expect(
      symbolMarkup(catalogue.find((t) => t.id === "mechanised-infantry")!),
    ).toContain("<ellipse");
    expect(
      symbolMarkup(catalogue.find((t) => t.id === "recon-squadron")!),
    ).toContain("<ellipse");
  });
  it.each([
    "signal-company",
    "aviation-squadron",
    "special-forces-company",
    "army-command",
    "corps",
    "infantry-division",
    "infantry-brigade",
    "infantry-platoon",
    "infantry-section",
  ])("includes reference template %s", (id) =>
    expect(catalogue.some((t) => t.id === id)).toBe(true),
  );
  it("allows every selected symbol to rotate and rotates artwork, echelon and designation together", () => {
    for (const t of catalogue) {
      expect(t.rotation).toBe(true);
      const markup = symbolMarkup(t, "66", "#000080", 135);
      expect(markup).toMatch(/^<g transform="rotate\(135 50 38\)">/);
      expect(markup).toMatch(/>66<\/text><\/g><\/g>$/);
      expect(markup.endsWith("</g></g>")).toBe(true);
      expect(markup).toContain(">66</text>");
      const p = createProject();
      p.items = [{ ...makeItem(t.id, "66"), rotation: 135 }];
      expect(validateProject(p).items[0].rotation).toBe(135);
    }
  });
  it("renders the selected echelon override", () => {
    expect(symbolMarkup(catalogue[0], "66", "#000080", 45, "corps")).toContain(
      ">XXX</text>",
    );
    expect(
      symbolMarkup(catalogue[0], "66", "#000080", 45, "none"),
    ).not.toContain(">II</text>");
  });
  it("persists and undoes rotation and hierarchy without moving the symbol", () => {
    const p = createProject();
    p.items = [
      { ...makeItem("infantry-battalion", "12"), coordinate: [76.9, 30.7] },
    ];
    let h: History = { present: p, past: [], future: [] };
    h = historyReducer(h, {
      type: "commit",
      project: {
        ...p,
        items: [{ ...p.items[0], rotation: 90, echelon: "division" }],
      },
    });
    expect(validateProject(h.present).items[0].coordinate).toEqual([
      76.9, 30.7,
    ]);
    h = historyReducer(h, { type: "undo" });
    expect(h.present.items[0].rotation).toBe(0);
    h = historyReducer(h, { type: "redo" });
    expect(h.present.items[0].echelon).toBe("division");
  });
});
describe("six-colour symbology", () => {
  it("contains exactly the requested palette", () => {
    expect(symbolColours.map((c) => c.name)).toEqual([
      "Navy blue",
      "Green",
      "Red",
      "Blue",
      "Yellow",
      "Black",
    ]);
    expect(symbolColours).toHaveLength(6);
  });
  it.each(symbolColours)("preserves $name in project imports", (c) => {
    const p = createProject();
    p.items = [{ ...makeItem("tank"), color: c.hex }];
    expect(validateProject(p).items[0].color).toBe(c.hex);
  });
  it("migrates legacy colours into the allowed palette without modifying the original", () => {
    const p = createProject();
    p.items = [{ ...makeItem("tank"), color: "#354d3b" }];
    const q = validateProject(p);
    expect(q.items[0].color).toBe("#008000");
    expect(p.items[0].color).toBe("#354d3b");
  });
  it.each(["#aabbcc", "#123456", "#ababab", "#99ee99"])(
    "maps other legacy hex colours to a valid colour",
    (c) =>
      expect(
        symbolColours.some((p) => p.hex === normaliseSymbolColour(c)),
      ).toBe(true),
  );
});
describe("basemap and coordinate views", () => {
  const fill = { id: "landcover", type: "fill" } as const,
    line = { id: "road", type: "line" } as const,
    label = { id: "place", type: "symbol" } as const,
    hill = { id: "mildraw-hillshade", type: "hillshade" } as const,
    image = { id: "mildraw-imagery-layer", type: "raster" } as const;
  it("distinguishes flat map and shaded terrain", () => {
    expect(layerVisible(fill, "map", true)).toBe(true);
    expect(layerVisible(hill, "map", true)).toBe(false);
    expect(layerVisible(hill, "terrain", true)).toBe(true);
  });
  it("shows imagery only in satellite mode", () => {
    expect(layerVisible(image, "satellite", true)).toBe(true);
    expect(layerVisible(fill, "satellite", true)).toBe(false);
    expect(layerVisible(line, "satellite", true)).toBe(false);
    expect(layerVisible(label, "satellite", true)).toBe(false);
  });
  it("shows imagery, roads and optional labels in hybrid mode", () => {
    expect(layerVisible(image, "hybrid", true)).toBe(true);
    expect(layerVisible(fill, "hybrid", true)).toBe(false);
    expect(layerVisible(line, "hybrid", true)).toBe(true);
    expect(layerVisible(label, "hybrid", true)).toBe(true);
    expect(layerVisible(label, "hybrid", false)).toBe(false);
  });
  it("records imagery vintage and includes provider credits for export", () => {
    expect(imagerySource.vintage).toBe("2016");
    expect(mapCredits("satellite").join(" ")).toContain(
      "Copernicus Sentinel data 2016",
    );
    expect(mapCredits("hybrid").join(" ")).toContain("OpenStreetMap");
  });
  it("formats both hemispheres without replacing missing coordinates", () => {
    expect(latLongReference([-77.0365, -33.8])).toBe(
      "33.80000° S / 77.03650° W",
    );
    expect(latLongReference(null)).toBe("—");
  });
  it.each(["map", "terrain", "satellite", "hybrid"] as const)(
    "roundtrips %s with saved coordinates and coordinate display",
    (mapView) => {
      const p = createProject();
      p.mapView = mapView;
      p.coordinateDisplay = "latlong";
      p.items = [
        {
          ...makeItem("infantry-division", "12"),
          coordinate: [76.9, 30.7],
          echelon: "division",
          rotation: 45,
        },
      ];
      expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
    },
  );
  it("rejects unknown view settings and echelon IDs", () => {
    const p = createProject();
    expect(() => validateProject({ ...p, mapView: "unknown" })).toThrow();
    expect(() =>
      validateProject({ ...p, coordinateDisplay: "unknown" }),
    ).toThrow();
    expect(() =>
      validateProject({
        ...p,
        items: [{ ...makeItem("tank"), echelon: "invented" }],
      }),
    ).toThrow();
  });
});

describe("plain board views", () => {
  it.each(["sand", "whiteboard"] as const)("persists %s and hides geographic layers", view => {
    const p=createProject();p.mapView=view;
    expect(validateProject(p).mapView).toBe(view);
    expect(layerVisible({id:"roads",type:"line"},view,true)).toBe(false);
    expect(layerVisible({id:"land",type:"fill"},view,true)).toBe(false);
    expect(layerVisible({id:"background",type:"background"},view,true)).toBe(true);
    expect(mapCredits(view)).toEqual([]);
  });
});

describe('uniform symbol ink', () => {
  it('defaults new symbols and catalogue artwork to black', () => {
    expect(makeItem(catalogue[0].id).color).toBe('#000000');
    expect(symbolMarkup(catalogue[0])).toContain('stroke="#000000"');
  });
  it.each(symbolColours)('uses $name for artwork and unoutlined formation text', ({hex}) => {
    const markup=symbolMarkup(catalogue[0],'66',hex,0,'brigade');
    expect(markup).toContain(`stroke="${hex}"`);
    expect(markup).toContain(`<g fill="${hex}" stroke="none" text-anchor="middle"`);
    expect(markup).toContain('>X</text>');
  });
});

describe('background placement persistence', () => {
  it('roundtrips independent image position and scale', () => {
    const p=createProject();p.sketchImageTransform={x:120,y:-35,scale:1.5};
    expect(validateProject(JSON.parse(JSON.stringify(p))).sketchImageTransform).toEqual(p.sketchImageTransform);
  });
  it.each([0,-1,21,NaN,Infinity])('rejects invalid background scale %s',scale=>{
    const p=createProject();p.sketchImageTransform={x:0,y:0,scale};expect(()=>validateProject(p)).toThrow();
  });
});
