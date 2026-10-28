import ms from "milsymbol";
import {taskArtwork} from "./tactical-tasks";
import type {Affiliation} from "./model";
import type { Template } from "./model";
import { escapeXML, echelons, type EchelonId } from "./model";
export function artwork(kind: string): string {
  switch (kind) {
    case "armour":
      return '<ellipse cx="50" cy="38" rx="23" ry="12"/>';
    case "mechanised":
      return '<path d="M17 20l66 36M83 20L17 56"/><ellipse cx="50" cy="38" rx="23" ry="12"/>';
    case "armoured-recon":
      return '<path d="M17 56l66-36"/><ellipse cx="50" cy="38" rx="23" ry="12"/>';
    case "signals":
      return '<path d="M31 24l25 11-11 5 24 12"/>';
    case "aviation":
      return '<path d="M50 50Q29 18 19 39L50 50Q71 18 81 39L50 50M50 50v-7"/>';
    case "special-forces":
      return '<text x="50" y="44" text-anchor="middle" fill="currentColor" stroke="none" font-family="Arial,sans-serif" font-size="18">SF</text>';
    case "tank":
      return '<rect x="22" y="25" width="56" height="26" rx="10"/><rect x="36" y="30" width="24" height="16" rx="4"/><path d="M60 38h27"/>';
    case "infantry":
      return '<path d="M17 20l66 36M83 20L17 56"/>';
    case "artillery":
      return '<circle cx="50" cy="38" r="6" fill="currentColor"/>';
    case "engineer":
      return '<path d="M28 27v23h44V27H60v11H40V27z"/>';
    case "logistics":
      return '<path d="M28 38h44M50 22v32"/>';
    case "recon":
      return '<path d="M17 56l66-36"/>';
    case "medical":
      return '<path d="M44 23h12v9h10v12H56v10H44V44H34V32h10z"/>';
    case "airdefence":
      return '<path d="M25 49a25 25 0 0 1 50 0z"/>';
    case "command":
      return '<path d="M30 53V23h27l14 10-14 9H30"/>';
    case "bridge":
      return '<path d="M20 49V28h60v21M20 37h60M32 28v21M67 28v21"/>';
    case "truck":
      return '<path d="M20 28h38v22H20zM58 34h15l9 10v6H58"/><circle cx="32" cy="53" r="5"/><circle cx="70" cy="53" r="5"/>';
    default:
      return "";
  }
}
const renderedSymbols=new Map<string,string>();
function buildSymbolMarkup(
  t: Template,
  designation = "",
  color = "#000000",
  rotation = 0,
  echelon?: EchelonId,
  affiliation:Affiliation="friendly",
): string {
  const level =
    echelon !== undefined
      ? echelons.find((e) => e.id === echelon)?.mark || ""
      : t.level;
  if (t.sidc || t.task) {
    let body='';
    if(t.sidc) {
      const identity={friendly:'3',hostile:'6',neutral:'4',unknown:'1'}[affiliation];
      const sidc=t.sidc.slice(0,3)+identity+t.sidc.slice(4);
      const symbol=new ms.Symbol(sidc,{size:50,monoColor:color,fill:false,frame:t.family!=='Equipment'&&t.family!=='Control Measures',standard:'APP6',infoFields:false,outlineWidth:0});
      const svg=symbol.asSVG(), viewBox=svg.match(/viewBox="([^"]+)"/)?.[1] || '0 0 100 100';
      const inner=svg.slice(svg.indexOf('>')+1,svg.lastIndexOf('</svg>'));
      body=`<svg x="8" y="17" width="84" height="43" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
    } else body=`<g fill="none" stroke="${color}" color="${color}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${taskArtwork(t.task!)}</g>`;
    return `<g transform="rotate(${rotation} 50 38)"><g>${body}</g><g fill="${color}" stroke="none" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700"><text x="50" y="12" font-size="12">${escapeXML(level)}</text><text x="50" y="76" font-size="${designation.length>12?9:12}">${escapeXML(designation)}</text></g></g>`;
  }
  const equipment = ["tank", "truck", "bridge"].includes(t.kind);
  return `<g transform="rotate(${rotation} 50 38)"><g fill="none" stroke="${color}" color="${color}" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round">${equipment ? "" : `<rect x="15" y="19" width="70" height="38" rx="1" fill="#f7f5e9" fill-opacity=".94"/>`}${artwork(t.kind)}</g><g fill="${color}" stroke="none" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700"><text x="50" y="14" font-size="12">${escapeXML(level)}</text><text x="50" y="76" font-size="${designation.length > 12 ? 9 : 12}">${escapeXML(designation)}</text></g></g>`;
}
export function symbolMarkup(t:Template,designation='',color='#000000',rotation=0,echelon?:EchelonId,affiliation:Affiliation='friendly'):string {
 const key=JSON.stringify([t.id,designation,color,rotation,echelon,affiliation]);
 if(renderedSymbols.has(key))return renderedSymbols.get(key)!;
 const svg=buildSymbolMarkup(t,designation,color,rotation,echelon,affiliation);
 if(renderedSymbols.size>=1200)renderedSymbols.delete(renderedSymbols.keys().next().value!);
 renderedSymbols.set(key,svg);return svg;
}
export function SymbolArt({
  template,
  designation = "",
  color = "#000000",
  rotation = 0,
  echelon,
  affiliation,
}: {
  template: Template;
  designation?: string;
  color?: string;
  rotation?: number;
  echelon?: EchelonId;
  affiliation?: Affiliation;
}) {
  return (
    <svg
      viewBox="0 0 100 84"
      aria-hidden="true"
      dangerouslySetInnerHTML={{
        __html: symbolMarkup(template, designation, color, rotation, echelon, affiliation),
      }}
    />
  );
}
