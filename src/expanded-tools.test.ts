import {describe,it,expect} from 'vitest';
import ms from 'milsymbol';
import {catalogue,createProject,makeItem,validateProject,historyReducer,type Drawing} from './model';
import {symbolMarkup} from './Symbol';
import {drawingMarkup} from './drawing';
import {shapePath,groundDistance,projectKML,geographicDrawingPoints} from './extra-tools';
describe('expanded symbol library',()=>{
 it('renders every generated SIDC in every affiliation without fallback',()=>{
  for(const t of catalogue.filter(t=>t.sidc))for(const identity of ['3','6','4','1'])expect(new ms.Symbol(t.sidc!.slice(0,3)+identity+t.sidc!.slice(4)).isValid(),t.id).toBe(true);
 });
 it('preserves affiliation and rotation through save and undo',()=>{
  const p=createProject();p.items=[{...makeItem('std-10-121100'),affiliation:'hostile',rotation:90}];
  expect(validateProject(JSON.parse(JSON.stringify(p))).items[0].affiliation).toBe('hostile');
  const h=historyReducer({past:[],present:p,future:[]},{type:'commit',project:{...p,items:[]}});expect(historyReducer(h,{type:'undo'}).present.items[0].affiliation).toBe('hostile');
 });
 it('exports different friendly and hostile frames with chosen ink',()=>{
  const t=catalogue.find(t=>t.id==='std-10-121100')!;
  const f=symbolMarkup(t,'1','#ff0000',45,'brigade','friendly'),h=symbolMarkup(t,'1','#ff0000',45,'brigade','hostile');
  expect(f).not.toBe(h);expect(h).toContain('#ff0000');expect(h).toContain('rotate(45 50 38)');expect(h).toContain('>X</text>');
 });
});
describe('shapes, measurement and KML',()=>{
 const d:Drawing={id:'shape',type:'line',shape:'polygon',points:[[76,30],[77,30],[77,31]],text:'',color:'#000000',dash:'dashed',fill:'#008000',opacity:.5};
 it('roundtrips polygon style and exports a closed path',()=>{
  const p=createProject();p.drawings=[d];expect(validateProject(p).drawings[0]).toEqual(d);
  expect(shapePath([[0,0],[20,0],[20,20]],'polygon')).toBe('M0 0 L20 0 L20 20 Z');
  expect(drawingMarkup(d,[[0,0],[20,0],[20,20]])).toContain('stroke-dasharray="10 6"');
  expect(drawingMarkup(d,[[0,0],[20,0],[20,20]])).toContain('fill="#008000"');
 });
 it('measures geographic metres independently of zoom',()=>{expect(groundDistance([0,0],[1,0])).toBeCloseTo(111195.08,0);expect(groundDistance([76,30],[76,30])).toBe(0);});
 it('serialises closed shape geometry and escaped labels as KML',()=>{const p=createProject();p.title='A & B';p.drawings=[d];const xml=projectKML(p);expect(xml).toContain('A &amp; B');expect(xml).toContain('<Polygon>');expect(geographicDrawingPoints(d)).toHaveLength(4);p.mode='sketch';expect(()=>projectKML(p)).toThrow();});
 it('samples curves and circles for geographic exports',()=>{expect(geographicDrawingPoints({...d,shape:'circle',points:[[76,30],[76.1,30.1]]})).toHaveLength(65);expect(geographicDrawingPoints({...d,shape:undefined,curve:'parabolic'})).toHaveLength(49);});
});
