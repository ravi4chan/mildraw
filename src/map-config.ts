import type { LayerSpecification } from "maplibre-gl";
import type { BasemapView, Coordinate } from "./model";
export const mapViews: { id: BasemapView; label: string }[] = [
  { id: "map", label: "Map" },
  { id: "terrain", label: "Terrain" },
  { id: "satellite", label: "Satellite" },
  { id: "hybrid", label: "Hybrid" },
  { id: "sand", label: "Sand" },
  { id: "whiteboard", label: "Whiteboard" },
];
export const imagerySource = {
  id: "mildraw-imagery",
  vintage: "2016",
  maxzoom: 13,
  tileSize: 256,
  tiles: [
    "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg",
  ],
  attribution:
    '<a href="https://cloudless.eox.at">EOxCloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)',
};
export const isImagery = (view: BasemapView) =>
  view === "satellite" || view === "hybrid";
export function layerVisible(
  layer: Pick<LayerSpecification, "id" | "type">,
  view: BasemapView,
  labels: boolean,
): boolean {
  if (view === "sand" || view === "whiteboard") return layer.type === "background";
  if (layer.id === "mildraw-imagery-layer") return isImagery(view);
  if (layer.id === "mildraw-hillshade") return view === "terrain";
  if (layer.type === "background") return true;
  if (view === "satellite") return false;
  if (view === "hybrid")
    return layer.type === "line" || (layer.type === "symbol" && labels);
  return layer.type !== "symbol" || labels;
}
export function latLongReference(c: Coordinate | null): string {
  if (!c) return "—";
  return `${Math.abs(c[1]).toFixed(5)}° ${c[1] < 0 ? "S" : "N"} / ${Math.abs(c[0]).toFixed(5)}° ${c[0] < 0 ? "W" : "E"}`;
}
export function mapCredits(view: BasemapView): string[] {
  if (view === "sand" || view === "whiteboard") return [];
  if (view === "satellite")
    return [
      "EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH",
      "Contains modified Copernicus Sentinel data 2016 · CC BY 4.0",
    ];
  if (view === "hybrid")
    return [
      "EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH",
      "Contains modified Copernicus Sentinel data 2016 · CC BY 4.0",
      "© OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors",
    ];
  return [
    "© OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors" +
      (view === "terrain" ? " · AWS Terrain Tiles" : ""),
  ];
}
