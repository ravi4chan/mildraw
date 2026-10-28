import {useRef,useState} from 'react';
import type {Coordinate} from './model';
export function parseMapCoordinate(value:string):Coordinate|null {
 const match=value.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
 if(!match)return null;const lat=Number(match[1]),lon=Number(match[2]);return Math.abs(lat)<=85&&Math.abs(lon)<=180?[lon,lat]:null;
}
type Result={label:string;coordinate:Coordinate};
export default function MapSearch({onGo}:{onGo:(c:Coordinate)=>void}) {
 const [query,setQuery]=useState(''),[results,setResults]=useState<Result[]>([]),[status,setStatus]=useState('');const request=useRef<AbortController|null>(null);
 return <form className="map-search" role="search" aria-label="Map location search" onSubmit={async e=>{
  e.preventDefault();const q=query.trim();if(!q)return;request.current?.abort();setResults([]);
  const coordinate=parseMapCoordinate(q);if(coordinate){onGo(coordinate);setStatus('');return;}
  const controller=new AbortController();request.current=controller;setStatus('Searching…');
  try {const response=await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`,{signal:controller.signal});if(!response.ok)throw Error();const body=await response.json();
   const next:Result[]=(body.features||[]).filter((f:any)=>Array.isArray(f.geometry?.coordinates)&&Number.isFinite(f.geometry.coordinates[0])&&Number.isFinite(f.geometry.coordinates[1])).map((f:any)=>({coordinate:f.geometry.coordinates.slice(0,2),label:[f.properties.name,f.properties.city,f.properties.state,f.properties.country].filter(Boolean).filter((v:string,i:number,a:string[])=>a.indexOf(v)===i).join(', ')}));
   if(!controller.signal.aborted){setResults(next);setStatus(next.length?'':'No locations found. Try a place or latitude, longitude.');}
  }catch{if(!controller.signal.aborted)setStatus('Search unavailable. You can still enter latitude, longitude.');}
 }}>
  <input aria-label="Search map location" placeholder="Search place or lat, long" value={query} maxLength={200} onChange={e=>{request.current?.abort();setQuery(e.target.value);setResults([]);setStatus('');}} onKeyDown={e=>{if(e.key==='Escape'){setResults([]);setStatus('');e.currentTarget.blur();}}}/>
  <button type="submit" aria-label="Find map location" title="Find location">⌕</button>
  {(results.length>0||status) && <div className="map-search-results">{results.map((r,i)=><button key={i} type="button" onClick={()=>{onGo(r.coordinate);setQuery(r.label);setResults([]);setStatus('');}}>{r.label}</button>)}{status&&<p role="status">{status}</p>}<small>Search: Photon · © OpenStreetMap contributors</small></div>}
 </form>;
}
