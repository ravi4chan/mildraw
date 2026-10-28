import type {Project} from './model';
/** Deletion is by immutable ID, so overlapping or identical-looking symbols stay independent. */
export function deleteObjects(project:Project,ids:readonly string[]):Project {
 const selected=new Set(ids);
 return {...project,items:project.items.filter(i=>!selected.has(i.id)),drawings:project.drawings.filter(d=>!selected.has(d.id))};
}
