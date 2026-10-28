import { useState, useEffect, useRef } from "react";
import { hslToHex } from "./drawing";
const stops = ["#000000", ...Array.from({length: 361}, (_, h) => hslToHex(h, 100, 50))];
export default function InkPicker({ color, onChange, label = "Stroke" }: {
  color: string; onChange: (color: string) => void; label?: string;
}) {
  const [position, setPosition] = useState(() => Math.max(0, stops.indexOf(color.toLowerCase())));
  const emitted = useRef(color);
  useEffect(() => { if (color !== emitted.current) { setPosition(Math.max(0, stops.indexOf(color.toLowerCase()))); emitted.current = color; } }, [color]);
  return <div className="ink-picker">
    <label className="simple-colour-label">Colour
      <span className="ink-swatch" style={{background: color}} />
      <input aria-label={`${label} colour`} type="range" min="0" max="361" value={position}
        className="simple-colour-slider" onChange={e => { const value = Number(e.target.value); setPosition(value); emitted.current = stops[value]; onChange(stops[value]); }} />
    </label>
  </div>;
}
