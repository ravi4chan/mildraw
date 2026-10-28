import {describe,it,expect} from 'vitest';
import {createProject,makeItem,historyReducer,validateProject} from './model';
import {deleteObjects} from './project-actions';
describe('empty launch and exact deletion',()=>{
 it('launches with no symbols, image or drawings',()=>{const p=createProject();expect(p.items).toEqual([]);expect(p.drawings).toEqual([]);expect(p.sketchImage).toBeUndefined();});
 it('deletes the exact overlapping symbol ID without mutating the source',()=>{const p=createProject();const a=makeItem('tank'),b=makeItem('tank');a.coordinate=[76.9,30.7];b.coordinate=[76.9,30.7];p.items=[a,b];const next=deleteObjects(p,[b.id]);expect(next.items.map(i=>i.id)).toEqual([a.id]);expect(p.items).toHaveLength(2);});
 it('keeps an empty project empty through save/load and restores deletion only on Undo',()=>{const p=createProject(),i=makeItem('tank');p.items=[i];const next=deleteObjects(p,[i.id]);expect(validateProject(JSON.parse(JSON.stringify(next))).items).toEqual([]);const h=historyReducer({past:[],present:p,future:[]},{type:'commit',project:next});expect(historyReducer(h,{type:'undo'}).present.items[0].id).toBe(i.id);});
});
