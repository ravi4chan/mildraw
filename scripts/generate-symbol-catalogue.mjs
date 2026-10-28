// Reproducible catalogue from the MIT-licensed milsymbol SIDC definitions.
import fs from 'node:fs';
import ms from 'milsymbol';
const collections=[['landunit','10','Units','Infantry'],['landequipment','15','Equipment','Equipment'],['air','01','Air','Aviation'],['sea','30','Sea','Naval'],['landinstallation','20','Installations','Installations'],['control-measure','25','Control Measures','Control Measures']];
const clean=s=>s.replace(/^(?:GR\.(?:IN\.)?(?:IC|EQ|I)\.(?:FF\.)?|AR\.I\.|SE\.IC\.|TP\.|ST\.IC\.)/,'').replace(/^(?:GR|AR|SE|ST|AC|SOF)\.(?:IN\.)?(?:IC|EQ|I|M1|M2|MC)\./,'').replace(/DSymbol/g,'').replace(/\b(?:BLACK|BLUE|WHITE|ICN|ICON)\b/g,'').trim();
const title=s=>s.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()).replace(/\b(Cbrn|Uav|Ew|Ied|Hq|Rpv|Aew|Vtol|Sof|Miso)\b/g,c=>c.toUpperCase());
const entries=[];
for(const [file,set,family,baseCategory] of collections){
 const src=fs.readFileSync(`node_modules/milsymbol/src/numbersidc/sidc/${file}.js`,'utf8');
 const records=new Map();
 for(const m of src.matchAll(/(?:sId|sidc)\["(\d{6})"\]\s*=\s*([^;]+);([^\r\n]*)/g)){
  const parts=[...m[2].matchAll(/icn\["([^"]+)"\]/g)].map(x=>clean(x[1]));
  if(!parts.length)continue;
  const sidc=`1003${set}0000${m[1]}0000`;
  if(!new ms.Symbol(sidc).isValid())continue;
  const comment=m[3].replace(/^\s*\/\/\s*/,'').trim();
  const name=title(family==='Control Measures'&&comment?comment.split('/').slice(-2).join(' / '):[...new Set(parts)].join(' / '));
  let category=baseCategory;
  if(family==='Units'){
   const text=parts.join(' ');
   category=/AIR DEFEN|AIR DEFEN|ARTILLERY|MORTAR|ROCKET/.test(text)?'Artillery':/ARMOU?R|TANK|CAVALRY|RECONNAISSANCE/.test(text)?'Armour':/ENGINEER|BRIDGE|MINE|CBRN/.test(text)?'Engineers':/SIGNAL|RADIO|COMMUNICATION|ELECTRONIC|JAMM/.test(text)?'Signals':/AVIATION|HELICOPTER/.test(text)?'Aviation':/SUPPLY|LOGISTIC|MEDICAL|MAINTENANCE|TRANSPORT|SUPPORT/.test(text)?'Logistics':/SPECIAL FORCES|SPECIAL OPERATIONS/.test(text)?'Special Forces':'Infantry';
  }
  records.set(m[1],{id:`std-${set}-${m[1]}`,name,category,kind:'standard',level:'',aliases:[sidc,...parts,...(name.includes("Machine Gun")?["LMG","MMG","HMG","machinegun"]:[]),...(name.includes("Air Defence")&&name.includes("Short Range")?["SHORAD"]:[]),...(name.includes("Air Defence")&&name.includes("Intermediate Range")?["MRAD"]:[]),...(name.includes("Air Defence")&&name.includes("Long Range")?["LRAD"]:[]),parts.map(x=>x.split(/[\s/-]+/).map(w=>w[0]).join('')).join(' ')],rotation:true,sidc,family});
 }
 entries.push(...records.values());
}
fs.writeFileSync('src/standard-catalogue.json',JSON.stringify(entries,null,2)+'\n');
console.log('Generated',entries.length,'standard symbols',Object.fromEntries(collections.map(c=>[c[2],entries.filter(e=>e.family===c[2]).length])));
