import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
export default function DelayedTooltip(){
 const [tip,setTip]=useState<{text:string;x:number;y:number}|null>(null);
 useEffect(()=>{let timer:ReturnType<typeof setTimeout>;let active:HTMLElement|null=null;
  const clear=()=>{clearTimeout(timer);active=null;setTip(null);};
  const enter=(event:Event)=>{const target=(event.target as Element)?.closest<HTMLElement>('[data-tooltip]');if(!target||target===active)return;clear();active=target;timer=setTimeout(()=>{const r=target.getBoundingClientRect();setTip({text:target.dataset.tooltip||'',x:Math.max(100,Math.min(innerWidth-100,r.x+r.width/2)),y:r.bottom+8});},1000);};
  const leave=(event:Event)=>{const to=(event as PointerEvent).relatedTarget as Element|null;if(active&&to instanceof Element&&to.closest('[data-tooltip]')===active)return;clear();};
  document.addEventListener('pointerover',enter);document.addEventListener('pointerout',leave);document.addEventListener('focusin',enter);document.addEventListener('focusout',clear);document.addEventListener('pointerdown',clear);window.addEventListener('scroll',clear,true);
  return()=>{clearTimeout(timer);document.removeEventListener('pointerover',enter);document.removeEventListener('pointerout',leave);document.removeEventListener('focusin',enter);document.removeEventListener('focusout',clear);document.removeEventListener('pointerdown',clear);window.removeEventListener('scroll',clear,true);};
 },[]);
 return tip?createPortal(<div role="tooltip" className="delayed-tooltip" style={{left:tip.x,top:tip.y}}>{tip.text}</div>,document.body):null;
}
