import { useRef, useState, useEffect, type CSSProperties, type PointerEvent, type KeyboardEvent } from 'react';
export function useFloatingPanels() {
  const [positions,setPositions]=useState<Record<string,{x:number;y:number}>>({});
  useEffect(()=>{const reset=()=>setPositions({});window.addEventListener("resize",reset);return()=>window.removeEventListener("resize",reset);},[]);
  const drag=useRef<{id:string;x:number;y:number;left:number;top:number}|null>(null);
  const clamp=(x:number,y:number,el:HTMLElement)=>({x:Math.max(8,Math.min(window.innerWidth-el.offsetWidth-8,x)),y:Math.max(84,Math.min(window.innerHeight-Math.min(el.offsetHeight,window.innerHeight-100)-(el.classList.contains("sidebar")?170:8),y))});
  return (id:string)=>({
    style: positions[id] ? {position:'fixed',left:positions[id].x,top:positions[id].y,right:'auto',bottom:'auto',zIndex:29} as CSSProperties : {},
    onPointerDownCapture:(e:PointerEvent<HTMLElement>)=>{
      const t=e.target as HTMLElement;
      if(e.button!==0 || !t.closest('.panel-title,.reference-header,.sidebar-heading,.panel-grip') || (t.closest('button,input,select,a') && !t.closest('.panel-grip'))) return;
      const r=e.currentTarget.getBoundingClientRect();drag.current={id,x:e.clientX,y:e.clientY,left:r.left,top:r.top};e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove:(e:PointerEvent<HTMLElement>)=>{const d=drag.current;if(d?.id===id){const next=clamp(d.left+e.clientX-d.x,d.top+e.clientY-d.y,e.currentTarget);setPositions(p=>({...p,[id]:next}));}},
    onPointerUp:()=>{drag.current=null;}, onPointerCancel:()=>{drag.current=null;},
    onKeyDown:(e:KeyboardEvent<HTMLElement>)=>{if(!(e.target as HTMLElement).closest('.panel-grip'))return;const keys:Record<string,[number,number]>={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};if(keys[e.key]){e.preventDefault();const r=e.currentTarget.getBoundingClientRect();const next=clamp(r.left+keys[e.key][0],r.top+keys[e.key][1],e.currentTarget);setPositions(p=>({...p,[id]:next}));}},
  });
}
export function PanelGrip({name}:{name:string}) {
  return <button type="button" className="panel-grip" aria-label={`Move ${name}`} title="Drag to move · arrow keys to reposition">⠿</button>;
}
