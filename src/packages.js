import {canonicalIngredientId} from './ingredient-identity.js';
import {INGREDIENTS} from './data.js';
import {quantity,parseAmount,OZ,CUP} from './measurements.js';

export const packageSize=(id,sizes={})=>sizes[canonicalIngredientId(id)]??INGREDIENTS[canonicalIngredientId(id)].packQty;
const groups={
  bag:'rice pasta noodles orzo lasagna ravioli tortellini pierogi dumplings frozenBroccoli frozenCarrots broccoli spinach kale sprouts cabbage carrots potato sweetpotato hash popcornChicken meatballs flour oats granola nuts raisins popcorn seaweed tortillaStrips crispyOnions',
  can:'tuna corn tomatoes chickpeas blackBeans pintoBeans mushroomSoup chickenSoup tomatoSauce tomatoPaste crushedTomatoes',
  jar:'marinara pesto alfredoSauce chickenGravy peanut jelly pickles sunTomatoes',
  tub:'cottage yogurt sourcream hummus onionDip',
  carton:'eggs broth milk heavyCream',
  bottle:'oil sesameOil soy vinegar worcestershire honey bbq mustard balsamicGlaze kewpie',
  loaf:'bread',pouch:'readyRice',bunch:'asparagus greenOnion',box:'couscous cornbread crackers',
};
export const packageKind=id=>Object.entries(groups).find(([,ids])=>ids.split(' ').includes(canonicalIngredientId(id)))?.[0]||'package';
export const drainedNet={tuna:'5 oz',corn:'15¼ oz',blackBeans:'15 oz',pintoBeans:'15 oz',chickpeas:'15 oz'};
export const isDrained=id=>/drained/i.test(INGREDIENTS[id].name);
export function packageLabel(id,size=INGREDIENTS[id].packQty) {
  id=canonicalIngredientId(id);
  const i=INGREDIENTS[id],amount=quantity(size,i.unit,id,'package');
  if(isDrained(id))return `${size===i.packQty&&drainedNet[id]?drainedNet[id]+' ':''}${packageKind(id)} · about ${amount} drained`;
  if(i.unit==='each')return size===1?'1 each':`${amount}-count ${packageKind(id)}`;
  if(i.unit==='slice')return `${packageKind(id)} · ${amount}`;
  return `${amount} ${packageKind(id)}`;
}
export const packageMeasure=unit=>unit==='g'?{unit:'oz',factor:OZ}:unit==='ml'?{unit:'fl oz',factor:CUP/8}:{unit:unit==='slice'?'slices':'items',factor:1};
export const packageValue=(amount,unit)=>{const value=amount/packageMeasure(unit).factor;return String(Number(value.toFixed(value<.1?2:1)));};
export function packageAmount(value,item) {
  const n=parseAmount(value);
  if(!Number.isFinite(n)||n<=0)return NaN;
  if(n===Number(packageValue(item.packQty,item.unit)))return item.packQty;
  // Returning to a catalog label restores its original usable amount too:
  // a nominal 16 oz pack recorded as 454 g must not suddenly become short.
  const original=INGREDIENTS[item.id];
  if(original&&n===Number(packageValue(original.packQty,original.unit)))return original.packQty;
  return n*packageMeasure(item.unit).factor;
}

// Track food worth planning around; don't turn the view into a spice inventory.
const staples=new Set('herbs italianHerbs garlicPowder onionPowder sweetPaprika cumin cinnamon coriander turmeric dill oil sesameOil soy vinegar worcestershire honey mustard balsamicGlaze garlic ginger cornstarch cocoa'.split(' '));
export const trackStock=id=>Object.hasOwn(INGREDIENTS,id)&&!staples.has(id)&&canonicalIngredientId(id)===id;
