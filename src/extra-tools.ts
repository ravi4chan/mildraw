import {escapeXML,nameOf,templateById,type Coordinate,type Project,type Drawing,type ShapeKind} from './model';
export function shapePath(points:Coordinate[],shape:ShapeKind):string {
 const [a=[0,0],b=a]=points;
 if(shape==='polygon')return points.map((p,i)=>`${i?'L':'M'}${p[0]} ${p[1]}`).join(' ')+' Z';
 const [x,y]=a,[u,v]=b;
 if(shape==='rectangle')return `M${x} ${y} L${u} ${y} L${u} ${v} L${x} ${v} Z`;
 if(shape==='circle'){const r=Math.hypot(u-x,v-y);return `M${x-r} ${y} A${r} ${r} 0 1 0 ${x+r} ${y} A${r} ${r} 0 1 0 ${x-r} ${y} Z`;}
 const r=Math.hypot(u-x,v-y),angle=Math.atan2(v-y,u-x);return Array.from({length:10},(_,i)=>{const t=angle+i*Math.PI/5,R=i%2?r*.42:r;return `${i?'L':'M'}${x+Math.cos(t)*R} ${y+Math.sin(t)*R}`;}).join(' ')+' Z';
}
export const dashArray=(dash?:Drawing['dash'])=>dash==='dashed'?'10 6':dash==='dotted'?'1 5':dash==='dash-dot'?'10 4 1 4':undefined;
export function groundDistance(a:Coordinate,b:Coordinate){const rad=Math.PI/180,dLat=(b[1]-a[1])*rad,dLon=(b[0]-a[0])*rad,q=Math.sin(dLat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dLon/2)**2;return 6371008.8*2*Math.atan2(Math.sqrt(q),Math.sqrt(Math.max(0,1-q)));}
export function geographicDrawingPoints(d:Drawing):Coordinate[] {
 const R=6378137;
 const toXY=([lon,lat]:Coordinate):Coordinate=>[R*lon*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))];
 const toGeo=([x,y]:Coordinate):Coordinate=>[x/R*180/Math.PI,(2*Math.atan(Math.exp(y/R))-Math.PI/2)*180/Math.PI];
 const pts=d.points.map(toXY),a=pts[0],b=pts[1];if(!b)return d.points;
 let out:Coordinate[]=pts;
 if(d.shape==='rectangle')out=[a,[b[0],a[1]],b,[a[0],b[1]],a];
 if(d.shape==='polygon')out=[...pts,a];
 if(d.shape==='circle'||d.shape==='star') {const r=Math.hypot(b[0]-a[0],b[1]-a[1]),angle=Math.atan2(b[1]-a[1],b[0]-a[0]),steps=d.shape==='star'?10:64;out=Array.from({length:steps+1},(_,i)=>{const radius=d.shape==='star'&&i%2?r*.42:r,t=angle+i*2*Math.PI/steps;return[a[0]+Math.cos(t)*radius,a[1]+Math.sin(t)*radius];});}
 if(!d.shape&&d.curve==='parabolic'&&pts[2]) {const c=[2*pts[2][0]-(a[0]+b[0])/2,2*pts[2][1]-(a[1]+b[1])/2];out=Array.from({length:49},(_,i)=>{const t=i/48,u=1-t;return[u*u*a[0]+2*u*t*c[0]+t*t*b[0],u*u*a[1]+2*u*t*c[1]+t*t*b[1]];});}
 if(!d.shape&&d.curve==='arc'&&pts[2]) {const bx=b[0]-a[0],by=b[1]-a[1],mx=pts[2][0]-a[0],my=pts[2][1]-a[1],det=2*(bx*my-by*mx);if(Math.abs(det)>1e-5){const cx=((bx*bx+by*by)*my-(mx*mx+my*my)*by)/det,cy=(bx*(mx*mx+my*my)-mx*(bx*bx+by*by))/det,r=Math.hypot(cx,cy),start=Math.atan2(-cy,-cx),end=Math.atan2(by-cy,bx-cx),middle=Math.atan2(my-cy,mx-cx),positive=(v:number)=>(v+Math.PI*4)%(Math.PI*2),span=positive(end-start),sweep=positive(middle-start)<=span?span:span-2*Math.PI;out=Array.from({length:49},(_,i)=>[a[0]+cx+r*Math.cos(start+sweep*i/48),a[1]+cy+r*Math.sin(start+sweep*i/48)]);}}
 return out.map(toGeo);
}
export function projectKML(p:Project):string {
 if(p.mode!=='terrain')throw Error('KML requires geographic terrain coordinates.');
 const point=(c:Coordinate)=>`${c[0]},${c[1]},0`;
 const markers=p.items.filter(i=>i.coordinate).map(i=>`<Placemark><name>${escapeXML(nameOf(i))}</name><description>${escapeXML(i.notes)}</description><ExtendedData><Data name="SIDC"><value>${escapeXML(templateById(i.templateId).sidc||i.templateId)}</value></Data><Data name="Affiliation"><value>${i.affiliation||"friendly"}</value></Data></ExtendedData><Point><coordinates>${point(i.coordinate!)}</coordinates></Point></Placemark>`);
 const drawings=p.drawings.map(d=>{const color='ff'+d.color.slice(5,7)+d.color.slice(3,5)+d.color.slice(1,3),coordinates=geographicDrawingPoints(d).map(point).join(' ');return `<Placemark><name>${escapeXML(d.text||d.shape||d.type)}</name><Style><LineStyle><color>${color}</color><width>${d.width||2.5}</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style>${d.type==='text'?`<Point><coordinates>${point(d.points[0])}</coordinates></Point>`:d.shape?`<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordinates}</coordinates></LinearRing></outerBoundaryIs></Polygon>`:`<LineString><tessellate>1</tessellate><coordinates>${coordinates}</coordinates></LineString>`}</Placemark>`;});
 return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXML(p.title)}</name>${markers.join('')}${drawings.join('')}</Document></kml>`;
}
