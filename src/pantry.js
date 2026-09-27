import {INGREDIENTS} from './data.js';
import {shopping,purchaseFor} from './engine.js';
import {canonicalIngredientId} from './ingredient-identity.js';
import {searchIngredients,ingredientIds} from './ingredients.js';

export function pantryChoices(state,query='',all=false){
  const needed=new Map(shopping(state).items.map(i=>[i.id,i]));
  return searchIngredients(query,all?ingredientIds:[...needed.keys()]).map(id=>needed.get(id)||{...purchaseFor(state,id,0),recipes:[]});
}
export const pantryGap=item=>Math.max(0,item.qty-item.pantry-item.bought);

// Quick copies retain the exact stored ingredient and amount, never a rounded
// display value. Bought food already covers part of the need and stays intact.
export function updatePantry(state,id,action,amount){
  id=canonicalIngredientId(id);
  if(!Object.hasOwn(INGREDIENTS,id))throw Error('Choose an ingredient from the list.');
  const item=shopping(state).items.find(i=>i.id===id)||purchaseFor(state,id,0);
  let qty;
  if(action==='match')qty=item.pantry+pantryGap(item);
  else if(action==='package')qty=item.pantry+item.packQty;
  else if(action==='set')qty=amount;
  else throw Error('Choose an amount to add.');
  if(!Number.isFinite(qty)||qty<0||qty>1e7)throw Error('Enter a valid amount at home.');
  const next=structuredClone(state);
  next.pantryQty[next.week]??={};next.pantryQty[next.week][id]=qty;
  next.haveEnough[next.week]=(next.haveEnough[next.week]||[]).filter(key=>canonicalIngredientId(key)!==id);
  return next;
}
