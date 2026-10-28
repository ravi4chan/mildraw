import { describe, it, expect } from "vitest";
import { drawingGeometry, arrowHead, hslToHex, drawingMarkup, rotationFromPoints } from "./drawing";
import {
  createProject,
  validateProject,
  historyReducer,
  type History,
  type Coordinate,
  type Drawing,
} from "./model";
describe("curved paths", () => {
  it("renders straight endpoints without changing coordinates", () => {
    const p: Coordinate[] = [
      [10, 20],
      [100, 80],
    ];
    expect(drawingGeometry(p).path).toBe("M10 20 L100 80");
    expect(p).toEqual([
      [10, 20],
      [100, 80],
    ]);
  });
  it("uses a circular SVG arc through the third point", () => {
    const g = drawingGeometry(
      [
        [0, 0],
        [100, 0],
        [50, -50],
      ],
      "arc",
    );
    expect(g.path).toBe("M0 0 A50 50 0 0 1 100 0");
    expect(g.end).toEqual([100, 0]);
    expect(g.tangent[0]).toBeCloseTo(0);
    expect(g.tangent[1]).toBe(50);
  });
  it("reverses the circle sweep for the other side of the baseline", () => {
    expect(
      drawingGeometry(
        [
          [0, 0],
          [100, 0],
          [50, 50],
        ],
        "arc",
      ).path,
    ).toBe("M0 0 A50 50 0 0 0 100 0");
  });
  it("supports circular arcs larger than a semicircle", () => {
    expect(
      drawingGeometry(
        [
          [0, 0],
          [100, 0],
          [50, -100],
        ],
        "arc",
      ).path,
    ).toMatch(/ 0 1 1 /);
  });
  it("builds a parabola which passes through the chosen bend at t=0.5", () => {
    const g = drawingGeometry(
      [
        [0, 0],
        [100, 0],
        [50, -50],
      ],
      "parabolic",
    );
    expect(g.path).toBe("M0 0 Q50 -100 100 0");
    expect(g.tangent).toEqual([50, 100]);
  });
  it.each([
    [
      [0, 0],
      [100, 0],
      [50, 0],
    ],
    [
      [0, 0],
      [0, 0],
      [50, 50],
    ],
    [
      [1e6, 1e6],
      [1e6 + 100, 1e6],
      [1e6 + 50, 1e6],
    ],
  ])("falls back safely for degenerate geometry", (...points) => {
    const g = drawingGeometry(
      points.map((p) => [p[0], p[1]] as Coordinate),
      "arc",
    );
    expect(g.path).not.toMatch(/NaN|Infinity/);
    expect(g.path).toContain(" L");
  });
  it("keeps large coordinate offsets numerically stable", () => {
    const g = drawingGeometry(
      [
        [1e6, 1e6],
        [1e6 + 100, 1e6],
        [1e6 + 50, 1e6 - 50],
      ],
      "arc",
    );
    expect(g.path).toContain("A50 50");
  });
  it("orients arrowheads along the curve tangent", () => {
    const g = drawingGeometry(
      [
        [0, 0],
        [100, 0],
        [50, -50],
      ],
      "arc",
    );
    const path = arrowHead(g);
    expect(path).toContain(" L100 0 L");
    const numbers = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    expect(numbers[1]).toBeLessThan(0);
    expect(numbers[5]).toBeLessThan(0);
  });
});
describe("pen paths", () => {
  it("smooths a freehand stroke while keeping endpoints and all input data", () => {
    const p: Coordinate[] = [
      [0, 0],
      [10, 20],
      [20, 0],
      [30, 10],
    ];
    const g = drawingGeometry(p, "straight", true);
    expect(g.path).toBe("M0 0 Q10 20 15 10 Q20 0 25 5 L30 10");
    expect(g.end).toEqual([30, 10]);
    expect(p).toHaveLength(4);
  });
  it("supports closed loops", () => {
    const g = drawingGeometry(
      [
        [0, 0],
        [30, 40],
        [60, 0],
        [0, 0],
      ],
      "straight",
      true,
    );
    expect(g.path).toMatch(/^M0 0 .*L0 0$/);
  });
  it("handles short and single-point previews without invalid numbers", () => {
    for (const points of [
      [],
      [[0, 0]],
      [
        [0, 0],
        [1, 1],
      ],
    ] as Coordinate[][])
      expect(drawingGeometry(points, "straight", true).path).not.toMatch(
        /NaN|undefined|Infinity/,
      );
  });
});
describe("stroke persistence and undo", () => {
  const drawings: Drawing[] = [
    {
      id: "pen",
      type: "pen",
      points: [
        [76.9, 30.7],
        [76.91, 30.71],
        [76.92, 30.7],
      ],
      text: "",
      color: "#000000",
      width: 3,
    },
    {
      id: "arc",
      type: "arrow",
      curve: "arc",
      points: [
        [76.9, 30.7],
        [76.91, 30.71],
        [76.92, 30.7],
      ],
      text: "",
      color: "#ed2529",
      width: 2.5,
    },
    {
      id: "parabola",
      type: "line",
      curve: "parabolic",
      points: [
        [76.9, 30.7],
        [76.91, 30.71],
        [76.92, 30.7],
      ],
      text: "",
      color: "#195bc4",
      width: 4,
    },
  ];
  it("roundtrips pen samples, curve kind, three geographic anchors and ink", () => {
    const p = { ...createProject(), drawings };
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it("undoes an entire pen stroke in one action", () => {
    const empty = createProject();
    let h: History = { past: [], present: empty, future: [] };
    h = historyReducer(h, {
      type: "commit",
      project: { ...empty, drawings: [drawings[0]] },
    });
    h = historyReducer(h, { type: "undo" });
    expect(h.present.drawings).toHaveLength(0);
    h = historyReducer(h, { type: "redo" });
    expect(h.present.drawings[0].points).toHaveLength(3);
  });
  it.each([
    { ...drawings[0], points: [[0, 0]] },
    {
      ...drawings[1],
      points: [
        [0, 0],
        [1, 1],
      ],
    },
    { ...drawings[1], curve: "unknown" },
    { ...drawings[0], width: 0 },
    { ...drawings[0], width: 20 },
  ])("rejects malformed strokes", (d) =>
    expect(() =>
      validateProject({ ...createProject(), drawings: [d] }),
    ).toThrow(),
  );
});
describe("slider colours", () => {
  it.each([
    [0, 0, 0, "#000000"],
    [0, 0, 100, "#ffffff"],
    [0, 100, 50, "#ff0000"],
    [120, 100, 50, "#00ff00"],
    [240, 100, 50, "#0000ff"],
    [0, 0, 50, "#808080"],
  ])("converts HSL to exact RGB hex", (h, s, l, hex) =>
    expect(hslToHex(h as number, s as number, l as number)).toBe(hex),
  );
});

describe("shared SVG and PNG vector renderer", () => {
  it("exports circular arrows with tangent arrowheads and the selected colour/width", () => {
    const svg = drawingMarkup(
      {
        id: "a",
        type: "arrow",
        curve: "arc",
        points: [],
        text: "",
        color: "#ed2529",
        width: 4,
      },
      [
        [0, 0],
        [100, 0],
        [50, -50],
      ],
    );
    expect(svg).toContain("A50 50");
    expect(svg.match(/<path/g)).toHaveLength(2);
    expect(svg).toContain('stroke="#ed2529"');
    expect(svg).toContain('stroke-width="4"');
  });
  it("exports parabolic phase lines as genuine quadratic vectors", () => {
    expect(
      drawingMarkup(
        {
          id: "p",
          type: "line",
          curve: "parabolic",
          points: [],
          text: "",
          color: "#000000",
        },
        [
          [0, 0],
          [100, 0],
          [50, -50],
        ],
      ),
    ).toContain("Q50 -100 100 0");
  });
  it("exports freehand paths with rounded joins and escaped text", () => {
    expect(
      drawingMarkup(
        {
          id: "f",
          type: "pen",
          points: [],
          text: "",
          color: "#000000",
          width: 3,
        },
        [
          [0, 0],
          [10, 20],
          [30, 0],
        ],
      ),
    ).toContain("Q10 20 20 10");
    expect(
      drawingMarkup(
        {
          id: "t",
          type: "text",
          points: [],
          text: "<script>",
          color: "#000000",
        },
        [[0, 0]],
      ),
    ).toContain("&lt;script&gt;");
  });
});

describe("rotation handle geometry", () => {
  it("turns clockwise from the upper handle", () => {
    expect(rotationFromPoints([0,0],[0,-50],[50,0],0)).toBe(90);
  });
  it("wraps across zero degrees", () => {
    expect(rotationFromPoints([0,0],[0,-50],[50,0],300)).toBe(30);
  });
  it("snaps to 15 degrees with Shift", () => {
    expect(rotationFromPoints([0,0],[0,-50],[50,0],7,true)).toBe(90);
  });
  it("avoids unstable rotation at the centre", () => {
    expect(rotationFromPoints([0,0],[0,-50],[1,1],45)).toBe(45);
  });
});
