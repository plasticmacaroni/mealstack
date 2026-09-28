import {canonicalIngredientId} from './ingredient-identity.js';
import { RECIPES, INGREDIENTS } from './data.js';
import {RECIPE_ALIASES} from './real-recipes.js';
import {packageSize} from './packages.js';

export const recipeById = Object.fromEntries(RECIPES.map(r => [r.id,r]));
export const SLOT_LABELS = {breakfast:'Breakfast','snack-am-1':'Morning snack 1','snack-am-2':'Morning snack 2',lunch:'Lunch','snack-pm-1':'Afternoon snack 1','snack-pm-2':'Afternoon snack 2',dinner:'Dinner','snack-evening-1':'Evening snack'};
export const TYPES = Object.keys(SLOT_LABELS);
export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const addDays = (date,n) => new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export const monday = date => addDays(date,-((new Date(date+'T12:00:00Z').getUTCDay()+6)%7));
export const slot = (day,type) => `${day}|${type}`;
export const dayOf = id => id.split('|')[0];
export const preparationDate = batch => batch.prepDate || (batch.prepAhead?addDays(dayOf(batch.startSlot),-1):dayOf(batch.startSlot));
export const typeOf = id => id.split('|')[1];
export const rank = id => Date.parse(dayOf(id)+'T12:00:00Z')/86400000*10 + TYPES.indexOf(typeOf(id));
export const activeTypes = count => TYPES.filter(t=>count===2 || !t.endsWith('-2'));
export const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
export const price = (id,prices={}) => prices[canonicalIngredientId(id)] ?? INGREDIENTS[canonicalIngredientId(id)].packCost;
export const ingredientCost = (item,scale=1,prices={},packageSizes={}) => item.qty*scale/packageSize(item.id,packageSizes)*price(item.id,prices);
export const batchCost = (recipe,scale=1,prices={},packageSizes={}) => recipe.ingredients.reduce((n,i)=>n+ingredientCost(i,scale,prices,packageSizes),0);
export const yieldFor = (recipe,scale) => Math.max(1,Math.floor(recipe.servings*scale));
export {quantity} from './measurements.js';
// A new plan has no placements yet; adding the first batch creates them (see allocated()).
export const emptyState = (today=localDate()) => ({version:1,week:monday(today),snackCount:2,showSnacks:false,batches:[],prices:{},packageSizes:{},estimates:{},haveEnough:{},pantryQty:{},purchased:{},ingredientDates:{},favorites:[],avoid:''});
export function makeBatch(recipeId,startSlot,scale=1,portions) {
  const recipe=recipeById[recipeId];
  if(!recipe) throw Error('Unknown meal.');
  return {id:globalThis.crypto.randomUUID(),recipeId,startSlot,scale,portions:portions??yieldFor(recipe,scale),useBy:addDays(dayOf(startSlot),recipe.qualityDays)};
}
export function demoState(today=localDate()) {
  let s=emptyState(today);
  for(const [id,day,type] of [['egg-muffins',0,'breakfast'],['crispy-gnocchi',0,'dinner'],['beef-stroganoff',1,'dinner'],['spinach-ravioli',3,'dinner'],['berry-yogurt',3,'breakfast'],['shrimp-fajitas',5,'lunch']]) s=addBatchAt(s,id,slot(addDays(s.week,day),type));
  return s;
}
// Where meals are. Every portion card on the calendar is an explicit placement:
// state.placements maps a slot to the batch eaten there, and state.auto lists, per batch,
// the slots adding a recipe or Plan my week gave its portions. A card in a slot not on
// that list was moved by her (the pin), and moving it back clears the pin again.
// Only adding a batch and planning fill slots, and only empty ones. After that a meal
// moves when she moves it; nothing else on the calendar shifts on its own.
const LEAD=type=>type==='breakfast'||type==='lunch'?1:0; // packed meals are made the evening before
const daysBetween=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
const weekday=date=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',timeZone:'UTC'});
const titleOf=b=>recipeById[b.recipeId].title;
const isDate=d=>typeof d==='string' && /^20\d{2}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d+'T12:00:00Z')) && new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const isSlot=id=>typeof id==='string' && id.split('|').length===2 && isDate(dayOf(id)) && TYPES.includes(typeOf(id));
const byRank=(a,b)=>rank(a)-rank(b);
const mealsOf=(placements,batchId)=>Object.keys(placements).filter(id=>placements[id]===batchId).sort(byRank);
const autoSlots=(state,batchId)=>state.auto[batchId]||[];
// How messages name a day or a slot: "Wed" / "Wed lunch" inside the week on screen, with
// the date when it is outside that week ("Thu Oct 1 lunch"), so a name is never ambiguous.
export const dayName=(date,week)=>week&&(date<week||date>addDays(week,6))?`${weekday(date)} ${new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'})}`:weekday(date);
export const slotName=(id,week)=>`${dayName(dayOf(id),week)} ${SLOT_LABELS[typeOf(id)].toLowerCase()}`;
export const batchWindow=b=>({cookDay:preparationDate(b),enjoyBy:b.useBy});
// Food counts as cooked once its cook day is over; on the cook day itself it can still move.
export const isCooked=(b,now=new Date())=>preparationDate(b)<localDate(now);
function suits(state,b,id) {
  const kind=recipeById[b.recipeId].kind,type=typeOf(id);
  if(!activeTypes(state.snackCount).includes(type))return false;
  return kind==='snack'?type.startsWith('snack'):kind==='breakfast'?type==='breakfast':type==='lunch'||type==='dinner';
}
const inWindow=(b,id)=>dayOf(id)>=preparationDate(b)&&dayOf(id)<=b.useBy;

// Older saves stored pins and skips and recomputed every portion on each read. They
// are allocated once, exactly as that calendar showed them, and then kept as placements.
// A state built in code without placements is allocated the same way.
function legacyFits(b,id) {
  if(id===b.startSlot) return true;
  const kind=recipeById[b.recipeId].kind, type=typeOf(id);
  if(b.autoPlanned&&b.mealTypes&&!b.mealTypes.includes(type))return false;
  if(b.autoPlanned&&type==='lunch'&&recipeById[b.recipeId].fit.lunch==='home')return false;
  return kind==='snack'?type.startsWith('snack'):kind==='breakfast'?type==='breakfast':['lunch','dinner'].includes(type);
}
function legacyAllocation(state) {
  const pins=state.pins||{},skips=state.skips||{},types=activeTypes(state.snackCount);
  const days=new Set(Array.from({length:7},(_,i)=>addDays(state.week,i)));
  const batches=state.batches, byId=Object.fromEntries(batches.map(b=>[b.id,b]));
  for(const b of batches) for(let d=dayOf(b.startSlot); d<=b.useBy; d=addDays(d,1)) days.add(d);
  const slots=[...days].sort().flatMap(d=>types.map(t=>slot(d,t)));
  const skipped=(b,id)=>skips[id]?.includes(b.id);
  const remaining=Object.fromEntries(batches.map(b=>[b.id,b.portions]));
  const reserved=Object.fromEntries(batches.map(b=>[b.id,0]));
  const validPins={};
  for(const [id,bid] of Object.entries(pins).sort(([a],[b])=>rank(a)-rank(b))) {
    const b=byId[bid];
    if(b&&rank(id)>=rank(b.startSlot)&&dayOf(id)<=b.useBy&&types.includes(typeOf(id))&&!skipped(b,id)&&reserved[bid]<b.portions) {validPins[id]=bid;reserved[bid]++;}
  }
  const placements={},auto={};
  for(const id of slots) {
    const date=dayOf(id),pinned=validPins[id];
    if(pinned) reserved[pinned]--;
    const candidates=batches.filter(b=>rank(b.startSlot)<=rank(id) && date<=b.useBy && !skipped(b,id) && (b.id===pinned || legacyFits(b,id)) && remaining[b.id]>(b.id===pinned?0:reserved[b.id]));
    const room=b=> {
      let count=0;
      for(let d=date;d<=b.useBy;d=addDays(d,1)) for(const t of types) {const next=slot(d,t);if(rank(next)>=rank(id) && legacyFits(b,next) && !skipped(b,next)) count++;}
      return Math.max(1,count);
    };
    candidates.sort((a,b)=>(b.priority||0)-(a.priority||0) || a.useBy.localeCompare(b.useBy) || remaining[b.id]/room(b)-remaining[a.id]/room(a) || rank(a.startSlot)-rank(b.startSlot) || a.id.localeCompare(b.id));
    const chosen=(pinned && candidates.find(b=>b.id===pinned)) || candidates[0];
    if(!chosen) continue;
    // Keep only what the rules below allow, so a migrated plan loads like any other.
    if(!suits(state,chosen,id)||!inWindow(chosen,id)) continue;
    remaining[chosen.id]--;placements[id]=chosen.id;
    // Her own pins were the only moves; planner reservations were automatic.
    if(chosen.id!==pinned||chosen.autoPlanned) (auto[chosen.id]??=[]).push(id);
  }
  return {placements,auto};
}
function allocated(state) {
  if(state.placements) return state;
  const next=structuredClone(state);
  Object.assign(next,legacyAllocation(state));
  delete next.pins;delete next.skips;
  for(const b of next.batches) delete b.priority;
  return next;
}

// The read API: one cell per slot of the shown week plus every placed portion (in any
// week), in calendar order. remaining = portions not on the calendar.
// manual = moved by her (shown as a pin); portions placed automatically are not.
export function schedule(state) {
  state=allocated(state);
  const remaining=Object.fromEntries(state.batches.map(b=>[b.id,b.portions]));
  const week=Array.from({length:7},(_,i)=>addDays(state.week,i)).flatMap(d=>activeTypes(state.snackCount).map(t=>slot(d,t)));
  const cells={};
  for(const id of [...new Set([...week,...Object.keys(state.placements)])].sort((a,b)=>rank(a)-rank(b))) {
    const bid=state.placements[id]??null;
    cells[id]={id,chosen:bid,manual:!!bid&&!autoSlots(state,bid).includes(id)};
    if(bid) remaining[bid]--;
  }
  return {cells,remaining};
}

// After a move, a batch that isn't cooked yet is cooked for whichever of its meals is now
// first (the evening before a breakfast or lunch) and keeps the length of its window; a
// separate prep date keeps its distance from the first meal. Cooked food keeps its dates.
// Either way every meal of the batch has to stay inside its window.
// A batch whose cook day doesn't follow that rule (an older same-day lunch, or a batch
// whose chosen slot was taken) remembers its dates in b.home the first time a move
// changes them; when its first meal is back on home.first, those exact dates return, so
// moving a meal away and back always restores the batch as it was.
function settleWindow(before,next,batchId,to,now) {
  const old=before.batches.find(b=>b.id===batchId),b=next.batches.find(b=>b.id===batchId),week=next.week;
  const oldFirst=mealsOf(before.placements,batchId)[0],first=mealsOf(next.placements,batchId)[0],cooked=isCooked(old,now);
  let changed=false;
  if(!cooked&&first&&first!==oldFirst) {
    if(old.home?.first===first) {
      const {first:_,...dates}=old.home;
      for(const k of ['startSlot','useBy','prepAhead','prepDate','home']) delete b[k];
      Object.assign(b,dates);
    } else {
      const length=daysBetween(preparationDate(old),old.useBy);
      const cook=addDays(dayOf(first),-(old.prepDate?daysBetween(old.prepDate,dayOf(old.startSlot)):LEAD(typeOf(first))));
      if(cook<localDate(now)) throw Error(`Too late to cook ${titleOf(b)} for ${slotName(first,week)}.`);
      const lead=oldFirst&&daysBetween(preparationDate(old),dayOf(oldFirst));
      if(!old.home&&oldFirst&&!old.prepDate&&(lead!==LEAD(typeOf(oldFirst))||old.startSlot!==oldFirst))
        b.home={first:oldFirst,startSlot:old.startSlot,useBy:old.useBy,...(old.prepAhead?{prepAhead:true}:{})};
      b.startSlot=first;b.useBy=addDays(cook,length);
      if(old.prepDate) b.prepDate=cook;
      else if(LEAD(typeOf(first))) b.prepAhead=true;
      else delete b.prepAhead;
    }
    changed=preparationDate(b)!==preparationDate(old)||b.useBy!==old.useBy;
  }
  // A refusal after a date change describes the move ("Moved there, it would cook Tue"),
  // never as if it were the window the cards show now.
  const {cookDay,enjoyBy}=batchWindow(b),title=titleOf(b),day=d=>dayName(d,week);
  const would=`it would cook ${day(cookDay)} and be good until ${day(enjoyBy)}.`;
  const dates=`${cooked?'Cooked':'Cooks'} ${day(cookDay)} · good until ${day(enjoyBy)}.`;
  for(const id of mealsOf(next.placements,batchId)) {
    const late=dayOf(id)>enjoyBy,early=dayOf(id)<cookDay;
    if(!late&&!early) continue;
    if(!changed) throw Error(`${title} ${late?'won’t keep until':'isn’t ready by'} ${slotName(id,week)}. ${dates}`);
    if(id===to) throw Error(`${title} ${late?'won’t keep until':'isn’t ready by'} ${slotName(id,week)}. Moved there, ${would}`);
    throw Error(`${title}’s ${slotName(id,week)} meal ${late?'wouldn’t keep':'wouldn’t be ready'}. Moved there, ${would}`);
  }
}

// Drag a card, one meal moves. from=null places one of the batch's unplaced portions.
// Dropping onto another meal swaps the two. A refusal throws a short sentence for her
// and changes nothing; a drop that changes nothing returns changed:false.
export function moveMeal(state,batchId,from,to,{now=new Date()}={}) {
  state=allocated(state);
  const b=state.batches.find(b=>b.id===batchId);
  if(!b) throw Error('That meal is no longer planned.');
  if(!isSlot(to)) throw Error('Choose a meal slot.');
  const placed=state.placements,title=titleOf(b),today=localDate(now);
  if(from!==null&&placed[from]!==batchId) throw Error('That meal has moved. Try again.');
  if(from===null&&mealsOf(placed,batchId).length>=b.portions) throw Error(`Every portion of ${title} is already on the calendar.`);
  if(to===from||placed[to]===batchId) return {state,changed:false};
  if(!suits(state,b,to)) throw Error(`${title} can’t go in ${slotName(to,state.week)}.`);
  if(dayOf(to)<today) throw Error(`${slotName(to,state.week)} is already over.`);
  const partnerId=placed[to],next=structuredClone(state);
  if(partnerId) {
    const partner=titleOf(state.batches.find(x=>x.id===partnerId));
    if(from===null) throw Error(`${slotName(to,state.week)} already has ${partner}.`);
    if(!suits(state,state.batches.find(x=>x.id===partnerId),from)) throw Error(`${partner} can’t go in ${slotName(from,state.week)}.`);
    if(dayOf(from)<today) throw Error(`${partner} can’t move to ${slotName(from,state.week)}. That day is over.`);
    next.placements[from]=partnerId;
  } else if(from!==null) delete next.placements[from];
  next.placements[to]=batchId;
  settleWindow(state,next,batchId,to,now);
  if(partnerId) settleWindow(state,next,partnerId,from,now);
  return {state:next,changed:true,...(partnerId?{swapped:{batchId:partnerId,slot:from}}:{})};
}

// The pin's × puts a meal she moved back where it was placed automatically, if that
// spot is still free. It never pushes another meal out.
export function putBack(state,batchId,from,{now=new Date()}={}) {
  state=allocated(state);
  if(state.placements[from]!==batchId) throw Error('That meal has moved. Try again.');
  if(autoSlots(state,batchId).includes(from)) return {state,changed:false};
  const spot=originalSpot(state,batchId);
  if(!spot) throw Error('You placed this meal yourself, so it has no other spot to go back to.');
  if(state.placements[spot]) throw Error(`Its original spot, ${slotName(spot,state.week)}, is taken now.`);
  return moveMeal(state,batchId,from,spot,{now});
}
// Where the pin's × would put a moved meal of this batch: a free original slot if
// there is one, otherwise the first original slot (taken now), or null.
export function originalSpot(state,batchId) {
  state=allocated(state);
  const spots=autoSlots(state,batchId).filter(id=>state.placements[id]!==batchId);
  return spots.find(id=>!state.placements[id])??spots[0]??null;
}

// "Move whole batch": every meal, the cook day and enjoy-by shift by the same number of
// days. No swaps: another meal in the way refuses the move, and so does cooked food.
// Its automatic spots move along (no pins), and like an edit in batch details the batch
// is hers from then on: Plan my week no longer replaces it.
export function slideBatch(state,batchId,days,{now=new Date()}={}) {
  state=allocated(state);
  const b=state.batches.find(b=>b.id===batchId);
  if(!b) throw Error('That meal is no longer planned.');
  if(!Number.isInteger(days)) throw Error('Choose a day.');
  if(!days) return {state,changed:false};
  const title=titleOf(b),today=localDate(now),shift=id=>slot(addDays(dayOf(id),days),typeOf(id));
  if(isCooked(b,now)) throw Error(`${title} is already cooked, so its cook day can’t move.`);
  const next=structuredClone(state),moved=next.batches.find(x=>x.id===batchId);
  const meals=mealsOf(state.placements,batchId);
  for(const id of meals) delete next.placements[id];
  for(const id of meals) {
    const to=shift(id),other=next.placements[to];
    if(dayOf(to)<today) throw Error(`${slotName(to,state.week)} is already over.`);
    if(other) throw Error(`${titleOf(state.batches.find(x=>x.id===other))} is on ${slotName(to,state.week)}.`);
    next.placements[to]=batchId;
  }
  if(next.auto[batchId]) next.auto[batchId]=next.auto[batchId].map(shift);
  delete moved.autoPlanned;
  delete moved.home;
  moved.startSlot=shift(moved.startSlot);moved.useBy=addDays(moved.useBy,days);
  if(moved.prepDate) moved.prepDate=addDays(moved.prepDate,days);
  if(preparationDate(moved)<today) throw Error(`Too late to cook ${title} then.`);
  return {state:next,changed:true};
}

function freeSlots(state,b,from=b.startSlot) {
  const open=[];
  for(let d=dayOf(from);d<=b.useBy;d=addDays(d,1)) for(const t of activeTypes(state.snackCount)) {
    const id=slot(d,t);
    if(rank(id)>=rank(from)&&!state.placements[id]&&suits(state,b,id)) open.push(id);
  }
  return open;
}
// Portions of a new or edited batch that aren't on the calendar take the next free
// suitable slots in its window. What doesn't fit waits under Your batches.
function fillFreeSlots(state,b) {
  const missing=b.portions-mealsOf(state.placements,b.id).length;
  const open=freeSlots(state,b).slice(0,Math.max(0,missing));
  for(const id of open) state.placements[id]=b.id;
  if(open.length) state.auto[b.id]=[...new Set([...autoSlots(state,b.id),...open])].sort(byRank);
}

// Adding a recipe: the first portion goes to the drop (or the next free suitable slot
// when that one is taken), the rest fill the following free slots before its enjoy-by.
// Breakfasts and lunches are made the evening before, as with any move.
// With now, a slot that is already over is refused like a move (the example week and
// older code paths build plans without it).
export function addBatchAt(state,recipeId,target,{now}={}) {
  const recipe=recipeById[recipeId];
  if(!recipe) throw Error('Unknown meal.');
  if(!isSlot(target)) throw Error('Choose a meal slot.');
  if(now&&dayOf(target)<localDate(now)) throw Error(`${slotName(target,state.week)} is already over.`);
  if(!activeTypes(state.snackCount).includes(typeOf(target))) throw Error('Enable that snack slot first.');
  const next=structuredClone(allocated(state)),id=globalThis.crypto.randomUUID();
  const startingAt=start=>{const b={...makeBatch(recipeId,start),id};if(LEAD(typeOf(start))){b.prepAhead=true;b.useBy=addDays(b.useBy,-1);}return b;};
  let batch=startingAt(target);
  const first=freeSlots(next,batch)[0];
  if(first&&first!==target) batch=startingAt(first);
  next.batches.push(batch);fillFreeSlots(next,batch);
  if(recipe.kind==='snack'||typeOf(target).startsWith('snack')) next.showSnacks=true;
  return next;
}

// Saving the batch form. A new batch fills free slots from its first available slot. An
// edited batch keeps its meals: a new available date moves them by the same number of
// days, meals that no longer fit its dates or portion count wait under Your batches, and
// portions that are missing take free slots in its window.
export function saveBatch(state,batch) {
  const next=structuredClone(allocated(state)),old=next.batches.find(b=>b.id===batch.id),b=structuredClone(batch);
  delete b.home;
  if(old) {
    const days=daysBetween(dayOf(old.startSlot),dayOf(b.startSlot)),shift=id=>slot(addDays(dayOf(id),days),typeOf(id));
    const meals=mealsOf(next.placements,b.id);
    for(const id of meals) delete next.placements[id];
    if(next.auto[b.id]) next.auto[b.id]=next.auto[b.id].map(shift);
    next.batches=next.batches.map(x=>x.id===b.id?b:x);
    for(const id of meals.map(shift).filter(id=>inWindow(b,id)&&suits(next,b,id)&&!next.placements[id]).slice(0,b.portions)) next.placements[id]=b.id;
  } else next.batches.push(b);
  fillFreeSlots(next,b);
  if(recipeById[b.recipeId].kind==='snack'||typeOf(b.startSlot).startsWith('snack')) next.showSnacks=true;
  return next;
}

// Removing batches frees their slots.
export function removeBatches(state,batchIds) {
  const next=structuredClone(allocated(state)),gone=new Set(batchIds);
  next.batches=next.batches.filter(b=>!gone.has(b.id));
  for(const [id,bid] of Object.entries(next.placements)) if(gone.has(bid)) delete next.placements[id];
  for(const id of gone) delete next.auto[id];
  return next;
}
export function purchaseFor(state,id,qty) {
  id=canonicalIngredientId(id);
  const ing=INGREDIENTS[id],packQty=packageSize(id,state.packageSizes),packCost=price(id,state.prices);
  const pantry=state.pantryQty?.[state.week]?.[id]??((state.haveEnough[state.week]||[]).includes(id)?qty:0);
  const need=Math.max(0,qty-pantry),packs=Math.max(0,Math.ceil((need-1e-9)/packQty));
  // Purchases are physical quantities. A different package size must not erase
  // partial stock or count a previous purchase a second time.
  const bought=state.purchased?.[state.week]?.[id]||0;
  const remainingPacks=Math.max(0,Math.ceil((need-bought-1e-9)/packQty));
  const incoming=remainingPacks*packQty,supply=pantry+bought+incoming;
  return {id,...ing,packQty,packCost,qty,pantry,need,packs,bought,remainingPacks,incoming,supply,
    leftover:Math.max(0,supply-qty),checked:need>1e-9&&remainingPacks===0,
    buyCost:packs*packCost,usedCost:qty/packQty*packCost};
}
export function shopping(state) {
  const end=addDays(state.week,6), amounts={};
  const batches=state.batches.filter(b=>dayOf(b.startSlot)>=state.week && dayOf(b.startSlot)<=end);
  for(const b of batches) for(const i of recipeById[b.recipeId].ingredients) amounts[i.id]=(amounts[i.id]||0)+i.qty*b.scale;
  const items=Object.entries(amounts).map(([id,qty])=>{
    const recipes=[...new Set(batches.filter(b=>recipeById[b.recipeId].ingredients.some(i=>i.id===id)).map(b=>recipeById[b.recipeId].title))];
    return {...purchaseFor(state,id,qty),recipes};
  }).sort((a,b)=>a.name.localeCompare(b.name));
  return {items,batches: batches.length,basket:items.reduce((n,i)=>n+i.buyCost,0),remainingCost:items.reduce((n,i)=>n+i.remainingPacks*i.packCost,0),used:items.reduce((n,i)=>n+i.usedCost,0)};
}
// Saved plans can name recipe ids that were later replaced; point them at the replacement.
export const currentRecipeId=id=>Object.hasOwn(RECIPE_ALIASES,id)?RECIPE_ALIASES[id]:id;
function migrateRecipeIds(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return input;
  const next={...input};
  if(Array.isArray(input.batches))next.batches=input.batches.map(b=>b&&typeof b==='object'&&typeof b.recipeId==='string'?{...b,recipeId:currentRecipeId(b.recipeId)}:b);
  if(Array.isArray(input.favorites))next.favorites=input.favorites.map(id=>typeof id==='string'?currentRecipeId(id):id);
  if(input.estimates&&typeof input.estimates==='object'&&!Array.isArray(input.estimates))next.estimates=Object.fromEntries(Object.entries(input.estimates).map(([id,e])=>[currentRecipeId(id),e]));
  return next;
}
export function validateState(input) {
  input=migrateRecipeIds(input);
  const fail=()=>{throw Error('This file is not a valid Mealstack plan.');};
  const obj=x=>x && typeof x==='object' && !Array.isArray(x);
  const date=isDate,validSlot=isSlot;
  if(!obj(input)||input.version!==1||!date(input.week)||monday(input.week)!==input.week||![1,2].includes(input.snackCount)||typeof input.showSnacks!=='boolean'||!Array.isArray(input.batches)||input.batches.length>200) fail();
  const s=emptyState(input.week);s.snackCount=input.snackCount;s.showSnacks=input.showSnacks;
  const ids=new Set();
  s.batches=input.batches.map(b=>{
    if(!obj(b)||typeof b.id!=='string'||!/^[\w-]{1,80}$/.test(b.id)||ids.has(b.id)||!Object.hasOwn(recipeById,b.recipeId)||!validSlot(b.startSlot)||!activeTypes(s.snackCount).includes(typeOf(b.startSlot))||!date(b.useBy)||b.useBy<dayOf(b.startSlot)||b.useBy>addDays(dayOf(b.startSlot),7)||!Number.isFinite(b.scale)||b.scale<0.25||b.scale>4||!Number.isInteger(b.portions)||b.portions<1||b.portions>30) fail();
    if(b.autoPlanned!==undefined&&typeof b.autoPlanned!=='boolean')fail();
    if(b.prepAhead!==undefined&&typeof b.prepAhead!=='boolean')fail();
    if(b.prepDate!==undefined&&(!date(b.prepDate)||b.prepDate>dayOf(b.startSlot)||b.prepDate<addDays(dayOf(b.startSlot),-7)))fail();
    if(b.priority!==undefined&&(!Number.isInteger(b.priority)||b.priority<1||b.priority>1000000))fail();
    const home=b.home;
    if(home!==undefined&&(!obj(home)||!validSlot(home.first)||!validSlot(home.startSlot)||!date(home.useBy)||home.useBy<dayOf(home.startSlot)||home.useBy>addDays(dayOf(home.startSlot),7)||(home.prepAhead!==undefined&&home.prepAhead!==true)))fail();
    if(b.mealTypes!==undefined&&(!Array.isArray(b.mealTypes)||!b.mealTypes.length||b.mealTypes.length>3||b.mealTypes.some(t=>!['breakfast','lunch','dinner'].includes(t))))fail();
    ids.add(b.id);return {id:b.id,recipeId:b.recipeId,startSlot:b.startSlot,useBy:b.useBy,scale:b.scale,portions:b.portions,...(b.autoPlanned?{autoPlanned:true}:{}),...(b.prepAhead&&!b.prepDate?{prepAhead:true}:{}),...(b.prepDate?{prepDate:b.prepDate}:{}),...(b.priority?{priority:b.priority}:{}),...(b.mealTypes?{mealTypes:[...new Set(b.mealTypes)]}:{}),...(home&&!b.prepDate?{home:{first:home.first,startSlot:home.startSlot,useBy:home.useBy,...(home.prepAhead?{prepAhead:true}:{})}}:{})};
  });
  const legacy=input.placements===undefined;
  if(!obj(input.prices)||(legacy&&[input.pins,input.skips].some(x=>x!==undefined&&!obj(x)))||(!Array.isArray(input.haveEnough)&&!obj(input.haveEnough))) fail();
  if(input.estimates!==undefined&&!obj(input.estimates))fail();
  for(const [id,e] of Object.entries(input.estimates||{})){
    if(!Object.hasOwn(recipeById,id)||!obj(e)||!Number.isInteger(e.active)||!Number.isInteger(e.total)||!Number.isInteger(e.cleanup)||e.active<0||e.active>e.total||e.total<1||e.total>1440||e.cleanup<0||e.cleanup>50)fail();
    s.estimates[id]={active:e.active,total:e.total,cleanup:e.cleanup};
  }
  for(const [id,cost] of Object.entries(input.prices)) {if(!Object.hasOwn(INGREDIENTS,id)||!Number.isFinite(cost)||cost<0||cost>1000) fail();const canonical=canonicalIngredientId(id);if(id===canonical||input.prices[canonical]===undefined)s.prices[canonical]=cost;}
  if(input.packageSizes!==undefined&&!obj(input.packageSizes))fail();
  for(const [id,qty] of Object.entries(input.packageSizes||{})){
    if(!Object.hasOwn(INGREDIENTS,id)||!Number.isFinite(qty)||qty<1||qty>1e7||(['each','slice'].includes(INGREDIENTS[id].unit)&&!Number.isInteger(qty)))fail();
    const canonical=canonicalIngredientId(id);if(id===canonical||input.packageSizes[canonical]===undefined)s.packageSizes[canonical]=qty;
  }
  // Older custom onion prices referred to a three-onion purchase.
  if(input.packageSizes===undefined&&input.prices.onion!==undefined)s.packageSizes.onion=3;
  // A state with neither placements nor pins has nothing placed yet (a new plan, or
  // batches built in code); schedule() allocates it when read.
  if(legacy&&(input.pins!==undefined||input.skips!==undefined)) {
    // An older save: pins, skips and drop priorities become explicit placements once.
    const pins={},skips={};
    for(const [id,bid] of Object.entries(input.pins||{})) {if(!validSlot(id)||!ids.has(bid)) fail();pins[id]=bid;}
    for(const [id,bids] of Object.entries(input.skips||{})) {if(!validSlot(id)||!Array.isArray(bids)||bids.length>200||bids.some(bid=>!ids.has(bid))) fail();skips[id]=[...new Set(bids)];}
    for(const b of s.batches) if(Object.values(pins).filter(id=>id===b.id).length>b.portions) fail();
    Object.assign(s,allocated({...s,pins,skips}));
  } else if(!legacy) {
    if(!obj(input.placements)||(input.auto!==undefined&&!obj(input.auto))) fail();
    const byId=Object.fromEntries(s.batches.map(b=>[b.id,b]));
    s.placements={};s.auto={};
    for(const [id,bid] of Object.entries(input.placements)) {
      const b=byId[bid];
      if(!validSlot(id)||!b||!suits(s,b,id)||!inWindow(b,id)) fail();
      s.placements[id]=bid;
    }
    for(const b of s.batches) if(mealsOf(s.placements,b.id).length>b.portions) fail();
    for(const [bid,slots] of Object.entries(input.auto||{})) {
      if(!ids.has(bid)||!Array.isArray(slots)||slots.length>30||slots.some(id=>!validSlot(id))) fail();
      if(slots.length) s.auto[bid]=[...new Set(slots)].sort(byRank);
    }
    for(const b of s.batches) delete b.priority;
  }
  const pantry=Array.isArray(input.haveEnough)?{[input.week]:input.haveEnough}:input.haveEnough;
  for(const [week,items] of Object.entries(pantry)) {
    if(!date(week)||monday(week)!==week||!Array.isArray(items)||items.some(id=>!Object.hasOwn(INGREDIENTS,id)))fail();
    s.haveEnough[week]=[...new Set(items.map(canonicalIngredientId))];
  }
  for(const key of ['pantryQty','purchased']) {
    if(input[key]!==undefined&&!obj(input[key]))fail();
    for(const [week,items] of Object.entries(input[key]||{})) {
      if(!date(week)||monday(week)!==week||!obj(items))fail();
      s[key][week]={};
      for(const [id,qty] of Object.entries(items)) {
        if(!Object.hasOwn(INGREDIENTS,id)||!Number.isFinite(qty)||qty<0||qty>1e7)fail();
        const canonical=canonicalIngredientId(id);
        s[key][week][canonical]=(s[key][week][canonical]||0)+qty;
      }
    }
  }
  if(input.pantryQty===undefined)for(const [week,items] of Object.entries(s.haveEnough)) {
    s.pantryQty[week]={};
    for(const id of items)s.pantryQty[week][id]=s.batches.filter(b=>dayOf(b.startSlot)>=week&&dayOf(b.startSlot)<=addDays(week,6)).reduce((n,b)=>n+recipeById[b.recipeId].ingredients.filter(i=>i.id===id).reduce((sum,i)=>sum+i.qty*b.scale,0),0);
  }
  if(input.ingredientDates!==undefined&&!obj(input.ingredientDates))fail();
  for(const [week,items] of Object.entries(input.ingredientDates||{})){
    if(!date(week)||monday(week)!==week||!obj(items))fail();
    s.ingredientDates[week]={};
    for(const [id,useBy] of Object.entries(items)){
      if(!Object.hasOwn(INGREDIENTS,id)||!date(useBy))fail();
      const canonical=canonicalIngredientId(id),old=s.ingredientDates[week][canonical];
      s.ingredientDates[week][canonical]=old&&old<useBy?old:useBy;
    }
  }
  if(input.favorites!==undefined&&(!Array.isArray(input.favorites)||input.favorites.length>200||input.favorites.some(id=>!Object.hasOwn(recipeById,id))))fail();
  s.favorites=[...new Set(input.favorites||[])];
  if(input.avoid!==undefined&&(typeof input.avoid!=='string'||input.avoid.length>300))fail();
  s.avoid=input.avoid||'';
  return s;
}
