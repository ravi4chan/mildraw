import { useRef, useState } from 'react';
export type ImagePlacement = { x:number;y:number;scale:number };
export const defaultImagePlacement:ImagePlacement={x:0,y:0,scale:1};
export default function BackgroundImage({src,view,placement,onChange}:{src:string;view:{x:number;y:number;z:number};placement:ImagePlacement;onChange:(p:ImagePlacement)=>void}) {
  const [editing,setEditing]=useState(false), [size,setSize]=useState({w:1,h:1}), [preview,setPreview]=useState<ImagePlacement|null>(null);
  const gesture=useRef<{x:number;y:number;start:ImagePlacement;resize:boolean}|null>(null);
  const p=preview||placement;
  return <>
    <div className="background-image-controls" onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
      <button type="button" aria-pressed={editing} onClick={()=>setEditing(!editing)}>{editing?'Done editing background':'Move / resize background'}</button>
      {editing && <><label>Size <input aria-label="Background image size" type="range" min="5" max="300" value={p.scale*100} onChange={e=>onChange({...p,scale:Number(e.target.value)/100})}/></label><button type="button" onClick={()=>onChange(defaultImagePlacement)}>Reset</button></>}
    </div>
    <div className={`background-image-frame ${editing?'editing':''}`} style={{left:view.x+p.x*view.z,top:view.y+p.y*view.z,width:size.w*p.scale*view.z,height:size.h*p.scale*view.z}}
      onClick={e=>e.stopPropagation()}
      onPointerDown={e=>{if(!editing||e.button!==0)return;e.stopPropagation();gesture.current={x:e.clientX,y:e.clientY,start:p,resize:!!(e.target as HTMLElement).closest('.image-resize-handle')};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{const g=gesture.current;if(!g)return;e.stopPropagation();const dx=(e.clientX-g.x)/view.z,dy=(e.clientY-g.y)/view.z;setPreview(g.resize?{...g.start,scale:Math.max(.05,Math.min(20,g.start.scale+(dx*size.w+dy*size.h)/(size.w*size.w+size.h*size.h)))}:{...g.start,x:g.start.x+dx,y:g.start.y+dy});}}
      onPointerUp={e=>{if(!gesture.current)return;e.stopPropagation();if(preview)onChange(preview);gesture.current=null;setPreview(null);}}
      onPointerCancel={()=>{gesture.current=null;setPreview(null);}}>
      <img className="sketch-image" alt="Imported sketch background" src={src} draggable={false} onLoad={e=>setSize({w:e.currentTarget.naturalWidth,h:e.currentTarget.naturalHeight})}/>
      {editing && <button type="button" className="image-resize-handle" aria-label="Resize background image" title="Drag to resize proportionally" onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowUp'||e.key==='ArrowLeft'||e.key==='ArrowDown'){e.preventDefault();onChange({...p,scale:Math.max(.05,Math.min(20,p.scale+(e.key==='ArrowRight'||e.key==='ArrowUp'?.05:-.05)))});}}}>↘</button>}
    </div>
  </>;
}
