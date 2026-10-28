import { useEffect, useState } from 'react';
import type { Coordinate } from './model';
export function decodeElevation(r:number,g:number,b:number) { return r === 0 ? null : r*256+g+b/256-32768; }
export function elevationPixel([lng,lat]:Coordinate,z=12) {
  if(!Number.isFinite(lng)||!Number.isFinite(lat)||Math.abs(lat)>85.05112878)return null;
  const n=2**z, x=((lng+180)/360*n%n+n)%n;
  const sin=Math.sin(lat*Math.PI/180), y=Math.max(0,Math.min(n-Number.EPSILON,(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*n));
  return {z,x:Math.floor(x),y:Math.floor(y),px:Math.min(255,Math.floor((x%1)*256)),py:Math.min(255,Math.floor((y%1)*256))};
}
const tiles=new Map<string,Promise<ImageData>>();
async function sampleElevation(c:Coordinate) {
  const p=elevationPixel(c);if(!p)return null;
  const key=`${p.z}/${p.x}/${p.y}`;
  if(!tiles.has(key)) {
    if(tiles.size>=32)tiles.delete(tiles.keys().next().value!);
    const tile=(async()=>{
      const response=await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${key}.png`);
      if(!response.ok)throw Error('Elevation unavailable');
      const bitmap=await createImageBitmap(await response.blob());
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
      const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(bitmap,0,0);bitmap.close();return ctx.getImageData(0,0,256,256);
    })();tiles.set(key,tile);tile.catch(()=>tiles.delete(key));
  }
  const data=(await tiles.get(key)!).data, i=(p.py*256+p.px)*4;
  return data[i+3] ? decodeElevation(data[i],data[i+1],data[i+2]):null;
}
export function useElevation(coordinate:Coordinate|null) {
  const [result,setResult]=useState<{value:number|null;loading:boolean}>({value:null,loading:false});
  const lng=coordinate?.[0],lat=coordinate?.[1];
  useEffect(()=>{
    let live=true;setResult({value:null,loading:lng!==undefined&&lat!==undefined});
    const timer=setTimeout(()=>{if(lng===undefined||lat===undefined)return;sampleElevation([lng,lat]).then(value=>{if(live)setResult({value,loading:false});}).catch(()=>{if(live)setResult({value:null,loading:false});});},180);
    return()=>{live=false;clearTimeout(timer);};
  },[lng,lat]);
  return result;
}
