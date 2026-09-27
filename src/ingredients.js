import {INGREDIENTS} from './data.js';
import {canonicalIngredientId,ingredientAliases,normalizeIngredientName} from './ingredient-identity.js';

export const ingredientIds=Object.keys(INGREDIENTS).filter(id=>canonicalIngredientId(id)===id&&id!=='herbs');
export function searchIngredients(query='',ids=ingredientIds){
  const q=normalizeIngredientName(query),terms=q.split(' ').filter(Boolean);
  return [...new Set(ids.map(canonicalIngredientId))].filter(id=>Object.hasOwn(INGREDIENTS,id))
    .map(id=>{
      const names=[INGREDIENTS[id].name,...ingredientAliases(id)].map(normalizeIngredientName);
      return {id,name:INGREDIENTS[id].name,exact:names.includes(q),matches:!q||names.some(name=>terms.every(term=>name.includes(term)))};
    }).filter(i=>i.matches).sort((a,b)=>Number(b.exact)-Number(a.exact)||a.name.localeCompare(b.name)).map(i=>i.id);
}
