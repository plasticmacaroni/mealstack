import {schedule,recipeById,dayOf,addDays,preparationDate} from './engine.js';
import {inventoryProjection} from './inventory.js';

// End of day includes all that day's servings and evening preparation for
// tomorrow. Calendar servings spend cooked portions, never raw ingredients.
export function endOfDay(state,date,result=schedule(state)) {
  const spent={};
  for(const cell of Object.values(result.cells))if(cell.chosen&&dayOf(cell.id)<=date)spent[cell.chosen]=(spent[cell.chosen]||0)+1;
  const cooked=state.batches.filter(b=>b.useBy>=state.week&&preparationDate(b)<=date)
    .map(b=>({...b,title:recipeById[b.recipeId].title,remaining:b.portions-(spent[b.id]||0)}))
    .filter(b=>b.remaining>0).sort((a,b)=>a.useBy.localeCompare(b.useBy)||a.title.localeCompare(b.title));
  const ready=cooked.filter(b=>b.useBy>=date),past=cooked.filter(b=>b.useBy<date);
  const stock=inventoryProjection(state,date).items;
  const ingredients=stock.filter(i=>i.remaining>0).sort((a,b)=>(a.useBy||'9999').localeCompare(b.useBy||'9999')
    ||Number(b.events.some(e=>e.date===date))-Number(a.events.some(e=>e.date===date))||a.name.localeCompare(b.name));
  const expiries=[...cooked.map(b=>({kind:'batch',id:b.id,name:b.title,useBy:b.useBy,remaining:b.remaining})),
    ...stock.filter(i=>i.useBy&&(i.remaining>0||i.events.some(e=>e.date===date&&e.date>i.useBy)))
      .map(i=>({kind:'ingredient',id:i.id,name:i.name,useBy:i.useBy,remaining:i.remaining,unit:i.unit,usedAfterDate:i.events.some(e=>e.date===date&&e.date>i.useBy)}))]
    .filter(e=>e.useBy<=addDays(date,1)).sort((a,b)=>a.useBy.localeCompare(b.useBy)||a.name.localeCompare(b.name));
  return {date,ready,past,ingredients,expiries,portions:ready.reduce((n,b)=>n+b.remaining,0),
    due:expiries.filter(e=>e.useBy===date),overdue:expiries.filter(e=>e.useBy<date),soon:expiries.filter(e=>e.useBy>date)};
}
