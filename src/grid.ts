import proj4 from "proj4";
import type { Coordinate } from "./model";
export interface GridLine {
  points: Coordinate[];
  label: string;
  axis: "e" | "n";
}
export interface GridResult {
  lines: GridLine[];
  spacing: number;
  zone: string;
  unsupported: boolean;
}
export function geographicGrid(
  west: number,
  south: number,
  east: number,
  north: number,
  zoom: number,
): GridResult {
  const spacing =
    zoom >= 15
      ? 100
      : zoom >= 12
        ? 1000
        : zoom >= 9
          ? 5000
          : zoom >= 7
            ? 20000
            : 100000;
  if (
    south < -80 ||
    north > 84 ||
    east - west > 12 ||
    west < -180 ||
    east > 180
  )
    return {
      lines: [],
      spacing,
      zone: "Zoom in for UTM grid",
      unsupported: true,
    };
  const zone = Math.min(
    60,
    Math.max(1, Math.floor(((west + east) / 2 + 180) / 6) + 1),
  );
  // Restrict projected grid to one regular UTM zone; special Norway/Svalbard zones are explicit unsupported extents.
  const zoneWest = (zone - 1) * 6 - 180,
    zoneEast = zoneWest + 6;
  if (
    west < zoneWest ||
    east > zoneEast ||
    (north >= 56 && south <= 64 && east >= 3 && west <= 12) ||
    (north >= 72 && east >= 0 && west <= 42) ||
    (south < 0 && north > 0)
  )
    return {
      lines: [],
      spacing,
      zone: "Zone boundary · grid unavailable",
      unsupported: true,
    };
  const crs = `+proj=utm +zone=${zone} ${north < 0 ? "+south " : ""}+datum=WGS84 +units=m +no_defs`;
  const points = [
    [west, south],
    [west, north],
    [east, south],
    [east, north],
  ].map((c) => proj4("EPSG:4326", crs, c));
  const eMin = Math.min(...points.map((p) => p[0])),
    eMax = Math.max(...points.map((p) => p[0])),
    nMin = Math.min(...points.map((p) => p[1])),
    nMax = Math.max(...points.map((p) => p[1]));
  const lines: GridLine[] = [];
  for (
    let e = Math.floor(eMin / spacing) * spacing;
    e <= eMax + spacing;
    e += spacing
  ) {
    const pts: Coordinate[] = [];
    for (let j = 0; j <= 24; j++)
      pts.push(
        proj4(crs, "EPSG:4326", [
          e,
          nMin + ((nMax - nMin) * j) / 24,
        ]) as Coordinate,
      );
    lines.push({ points: pts, label: `${Math.round(e / 1000)} E`, axis: "e" });
  }
  for (
    let n = Math.floor(nMin / spacing) * spacing;
    n <= nMax + spacing;
    n += spacing
  ) {
    const pts: Coordinate[] = [];
    for (let j = 0; j <= 24; j++)
      pts.push(
        proj4(crs, "EPSG:4326", [
          eMin + ((eMax - eMin) * j) / 24,
          n,
        ]) as Coordinate,
      );
    lines.push({ points: pts, label: `${Math.round(n / 1000)} N`, axis: "n" });
  }
  return {
    lines,
    spacing,
    zone: `UTM ${zone}${north < 0 ? "S" : "N"}`,
    unsupported: false,
  };
}
