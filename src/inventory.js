import {recipeById,dayOf,addDays,rank,purchaseFor,preparationDate} from './engine.js';
import {trackStock} from './packages.js';
import {quantity} from './measurements.js';

// Use package weights for stock: kitchen cup rounding can otherwise make a
// partly used bag/tub look full. Liquid packages use familiar fluid ounces.
export const stockQuantity=(amount,unit)=>quantity(amount,unit,'',unit==='ml'?'package':'recipe');

const clean=n=>Math.abs(n)<1e-8?0:n;

// A projection of this shopping week's food, not an automatic consumption log.
// Ingredients leave stock when a batch is prepared, once per batch. Its later
// meal portions never consume the ingredients again.
export function inventoryProjection(state,through=addDays(state.week,6)) {
  const end=addDays(state.week,6),uses=new Map();
  const batches=state.batches.filter(b=>dayOf(b.startSlot)>=state.week&&dayOf(b.startSlot)<=end)
    .sort((a,b)=>{
      return preparationDate(a).localeCompare(preparationDate(b))||Number(preparationDate(a)<dayOf(a.startSlot))-Number(preparationDate(b)<dayOf(b.startSlot))||rank(a.startSlot)-rank(b.startSlot)||a.id.localeCompare(b.id);
    });
  for(const b of batches){
    const recipe=recipeById[b.recipeId],amounts=new Map();
    for(const i of recipe.ingredients)if(trackStock(i.id))amounts.set(i.id,(amounts.get(i.id)||0)+i.qty*b.scale);
    for(const [id,qty] of amounts){
      if(!uses.has(id))uses.set(id,[]);
      uses.get(id).push({batchId:b.id,recipeId:b.recipeId,title:recipe.title,qty,prepAhead:!!b.prepAhead,
        date:preparationDate(b),available:dayOf(b.startSlot),slot:b.startSlot});
    }
  }
  // Food already bought stays visible even if its recipe is deleted or rerolled.
  const ids=new Set([...uses.keys(),...Object.keys(state.pantryQty?.[state.week]||{}),...Object.keys(state.purchased?.[state.week]||{})]);
  const items=[...ids].filter(trackStock).map(id=>{
    const events=uses.get(id)||[],qty=events.reduce((n,e)=>n+e.qty,0),purchase=purchaseFor(state,id,qty);
    let running=purchase.supply;
    const timeline=events.map(e=>({...e,remaining:Math.max(0,clean(running-=e.qty))}));
    const used=through===null?0:events.filter(e=>e.date<=through).reduce((n,e)=>n+e.qty,0);
    return {...purchase,useBy:state.ingredientDates?.[state.week]?.[id]||null,events:timeline,used,remaining:Math.max(0,clean(purchase.supply-used)),
      reserved:Math.max(0,clean(qty-used)),leftover:Math.max(0,clean(purchase.supply-qty))};
  }).filter(i=>i.qty>0||i.supply>0).sort((a,b)=>a.name.localeCompare(b.name));
  return {week:state.week,through,dates:[...new Set([...Array.from({length:8},(_,n)=>addDays(state.week,n-1)),...batches.map(preparationDate)])].sort(),items};
}
