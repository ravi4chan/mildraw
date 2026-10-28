declare module "mgrs" {
  export function forward(
    coordinate: [number, number],
    precision?: number,
  ): string;
  export function inverse(mgrs: string): [number, number, number, number];
  export function toPoint(mgrs: string): [number, number];
}
