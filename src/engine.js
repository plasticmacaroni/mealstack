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
export const emptyState = (today=localDate()) => ({version:1,week:monday(today),snackCount:2,showSnacks:false,batches:[],pins:{},skips:{},prices:{},packageSizes:{},estimates:{},haveEnough:{},pantryQty:{},purchased:{},ingredientDates:{},favorites:[],avoid:''});
export function makeBatch(recipeId,startSlot,scale=1,portions) {
  const recipe=recipeById[recipeId];
  if(!recipe) throw Error('Unknown meal.');
  return {id:globalThis.crypto.randomUUID(),recipeId,startSlot,scale,portions:portions??yieldFor(recipe,scale),useBy:addDays(dayOf(startSlot),recipe.qualityDays)};
}
export function demoState(today=localDate()) {
  const s=emptyState(today);
  for(const [id,day,type] of [['egg-muffins',0,'breakfast'],['crispy-gnocchi',0,'dinner'],['beef-stroganoff',1,'dinner'],['spinach-ravioli',3,'dinner'],['berry-yogurt',3,'breakfast'],['shrimp-fajitas',5,'lunch']]) s.batches.push(makeBatch(id,slot(addDays(s.week,day),type)));
  return s;
}
function inWindow(b,id) {return rank(id)>=rank(b.startSlot) && dayOf(id)<=b.useBy;}
function fits(b,id) {
  if(id===b.startSlot) return true;
  const kind=recipeById[b.recipeId].kind, type=typeOf(id);
  if(b.autoPlanned&&b.mealTypes&&!b.mealTypes.includes(type))return false;
  if(b.autoPlanned&&type==='lunch'&&recipeById[b.recipeId].fit.lunch==='home')return false;
  return kind==='snack'?type.startsWith('snack'):kind==='breakfast'?type==='breakfast':['lunch','dinner'].includes(type);
}
function pinValid(b,id,state) {return b && inWindow(b,id) && activeTypes(state.snackCount).includes(typeOf(id)) && !state.skips[id]?.includes(b.id);}

// One chosen batch consumes exactly one portion. Alternatives in a stack consume none.
// Reserve future manual choices before allocating automatic portions chronologically.
export function schedule(state) {
  const days=new Set(Array.from({length:7},(_,i)=>addDays(state.week,i)));
  const batches=state.batches, byId=Object.fromEntries(batches.map(b=>[b.id,b]));
  for(const b of batches) for(let d=dayOf(b.startSlot); d<=b.useBy; d=addDays(d,1)) days.add(d);
  const slots=[...days].sort().flatMap(d=>activeTypes(state.snackCount).map(t=>slot(d,t)));
  const remaining=Object.fromEntries(batches.map(b=>[b.id,b.portions]));
  const reserved=Object.fromEntries(batches.map(b=>[b.id,0]));
  const validPins={};
  for(const [id,bid] of Object.entries(state.pins).sort(([a],[b])=>rank(a)-rank(b))) {
    if(pinValid(byId[bid],id,state) && reserved[bid]<byId[bid].portions) {validPins[id]=bid;reserved[bid]++;}
  }
  const cells={}, used={},starts=Object.fromEntries(batches.map(b=>[b.id,rank(b.startSlot)]));
  for(const id of slots) {
    const position=rank(id),date=dayOf(id);
    const pinned=validPins[id];
    if(pinned) reserved[pinned]--;
    const candidates=batches.filter(b=>starts[b.id]<=position && date<=b.useBy && !state.skips[id]?.includes(b.id) && (b.id===pinned || fits(b,id)) && remaining[b.id]>(b.id===pinned?0:reserved[b.id]));
    const room=b=> {
      let count=0;
      for(let d=dayOf(id);d<=b.useBy;d=addDays(d,1)) for(const t of activeTypes(state.snackCount)) {const next=slot(d,t);if(rank(next)>=rank(id) && fits(b,next) && !state.skips[next]?.includes(b.id)) count++;}
      return Math.max(1,count);
    };
    candidates.sort((a,b)=>(b.priority||0)-(a.priority||0) || a.useBy.localeCompare(b.useBy) || remaining[b.id]/room(b)-remaining[a.id]/room(a) || rank(a.startSlot)-rank(b.startSlot) || a.id.localeCompare(b.id));
    const chosen=(pinned && candidates.find(b=>b.id===pinned)) || candidates[0];
    // Planner reservations keep generated batches in place but are not the user's choices.
    cells[id]={id,chosen:chosen?.id??null,candidates:candidates.map(b=>({id:b.id,left:remaining[b.id]})),manual:!!pinned&&!byId[pinned].autoPlanned};
    if(chosen) {remaining[chosen.id]--;used[chosen.id]=(used[chosen.id]||0)+1;}
  }
  // "Also in this stack" offers only food nobody is going to eat yet. A batch whose
  // portions are all placed elsewhere would just be pulled out of its own later slots,
  // so it is never an alternative, and the chosen batch never lists itself.
  for(const cell of Object.values(cells))cell.alternatives=cell.candidates
    .filter(c=>c.id!==cell.chosen&&remaining[c.id]>0).map(c=>({id:c.id,left:remaining[c.id]}));
  return {cells,remaining,used};
}
export function choosePortion(state,batchId,target,from=null) {
  const b=state.batches.find(b=>b.id===batchId);
  if(!b || !TYPES.includes(typeOf(target))) throw Error('Choose a meal slot.');
  if(!inWindow(b,target)) throw Error('That slot is outside this batch’s available dates. Edit its dates first.');
  if(!activeTypes(state.snackCount).includes(typeOf(target))) throw Error('Enable that snack slot first.');
  if(from===target) return state;
  const next=structuredClone(state);
  // A manually moved or chosen suggested batch becomes part of the user's fixed plan.
  const chosen=next.batches.find(batch=>batch.id===batchId);
  // Choosing one portion adopts a suggested batch; its other planner reservations
  // are released so they flow automatically instead of all turning into pins.
  if(chosen.autoPlanned)for(const [id,bid] of Object.entries(next.pins))if(bid===batchId&&id!==from)delete next.pins[id];
  delete chosen.autoPlanned;
  // This action moves eating only. Keep the actual prep date independent.
  chosen.prepDate=preparationDate(b);delete chosen.prepAhead;
  if(from) {
    if(schedule(state).cells[from]?.chosen!==batchId) throw Error('That portion has moved. Try again.');
    delete next.pins[from];
    next.skips[from]=[...new Set([...(next.skips[from]||[]),batchId])];
  }
  next.skips[target]=(next.skips[target]||[]).filter(id=>id!==batchId);
  next.pins[target]=batchId;
  if(Object.values(next.pins).filter(id=>id===batchId).length>b.portions) throw Error('All portions are already placed manually. Move one of those portions instead.');
  return settleBatchStarts(next,new Set(next.batches.filter(batch=>batch.id!==batchId&&dayOf(batch.startSlot)<=dayOf(target)&&batch.useBy>=dayOf(target)).map(batch=>batch.id)),batchId);
}

// Unpinning hands portions back to automatic placement: only those slots' manual choices are dropped.
export function unpin(state,...slotIds) {
  if(!slotIds.length||slotIds.some(id=>!state.pins[id])) throw Error('That meal is no longer pinned.');
  const next=structuredClone(state);
  for(const id of slotIds) delete next.pins[id];
  return next;
}

// A covered first serving is a deferred cook, unless the user deliberately
// chose a separate prep date (or moved a single serving in an older plan).
// Work on the transaction's clone: callers still validate/save/undo atomically.
function settleBatchStarts(next,affected,anchoredId) {
  const explicitSkips=new Set(Object.values(next.skips).flat());
  const movable=b=>!b.prepDate&&!explicitSkips.has(b.id);
  if(!next.batches.some(b=>affected.has(b.id)&&movable(b)))return next;
  const originalPriorities=new Map(next.batches.map(b=>[b.id,b.priority]));
  const initial=schedule(next),firsts=new Map();
  for(const c of Object.values(initial.cells))if(c.chosen&&!firsts.has(c.chosen))firsts.set(c.chosen,rank(c.id));
  // Freeze the queue before changing dates. Otherwise refreshing an enjoy-by
  // window can make equally ranked batches leapfrog each other indefinitely.
  // Existing drop precedence comes first, then the current eating order.
  const queue=[...next.batches].sort((a,b)=>(b.priority||0)-(a.priority||0)||
    (firsts.get(a.id)??Infinity)-(firsts.get(b.id)??Infinity)||rank(a.startSlot)-rank(b.startSlot)||a.id.localeCompare(b.id));
  const window=new Map(queue.map(b=>[b.id,Math.round((Date.parse(b.useBy)-Date.parse(dayOf(b.startSlot)))/86400000)]));
  // Unique, bounded ranks also preserve this ordering after save/reload.
  queue.forEach((b,i)=>b.priority=queue.length-i);
  for(let pass=0;pass<=queue.length;pass++){
    let changed=false;
    for(const b of queue){
      if(!affected.has(b.id)||!movable(b))continue;
      let result=schedule(next),first=Object.values(result.cells).find(c=>c.chosen===b.id)?.id;
      if(!first){
        // A covered window defers cooking; it never extends already-prepped food.
        const old=b.useBy;
        let horizon=addDays(old,8),extended=true;
        // Follow only nearby occupied windows; a distant future plan must not
        // cause a years-long calendar to be materialized for this one lookup.
        while(extended){extended=false;for(const other of queue)if(dayOf(other.startSlot)<=horizon&&other.useBy>horizon){horizon=addDays(other.useBy,8);extended=true;}}
        b.useBy=horizon;
        try {result=schedule(next);first=Object.values(result.cells).find(c=>c.chosen===b.id)?.id;} finally {b.useBy=old;}
      }
      if(first&&rank(first)>rank(b.startSlot)){
        const previous=dayOf(b.startSlot);
        b.startSlot=first;b.useBy=addDays(dayOf(first),window.get(b.id));changed=true;
        // A delayed start can cross into a later week and cover another head.
        for(const other of queue)if(other.id!==b.id&&other.id!==anchoredId&&dayOf(other.startSlot)<=b.useBy&&other.useBy>=previous)affected.add(other.id);
      }
    }
    if(!changed){
      for(const b of queue)if(!affected.has(b.id)&&b.id!==anchoredId){
        if(originalPriorities.get(b.id))b.priority=originalPriorities.get(b.id);else delete b.priority;
      }
      return next;
    }
  }
  throw Error('These starts could not be settled. Try a different slot or keep a separate prep date.');
}

// Moving the start is different from moving one already-cooked serving. Rebuild
// automatic placements, preserve unrelated explicit choices, and anchor the drop.
export function placeBatch(state,batchId,target) {
  const original=state.batches.find(b=>b.id===batchId),date=dayOf(target);
  if(!original||!/^20\d{2}-\d{2}-\d{2}$/.test(date)||!TYPES.includes(typeOf(target))||target.split('|').length!==2)throw Error('Choose a meal slot.');
  if(date!==addDays(date,0))throw Error('Choose a valid date.');
  if(!activeTypes(state.snackCount).includes(typeOf(target)))throw Error('Enable that snack slot first.');
  const next=structuredClone(state),batch=next.batches.find(b=>b.id===batchId);
  const offset=Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(dayOf(batch.startSlot)+'T12:00:00Z'))/86400000);
  batch.startSlot=target;batch.useBy=addDays(batch.useBy,offset);
  if(batch.prepDate)batch.prepDate=addDays(batch.prepDate,offset);
  // Clear generated reservations in both affected weeks, including batches
  // crossing their edges. Manual choices elsewhere continue to be respected.
  const first=monday(dayOf(original.startSlot))<monday(date)?monday(dayOf(original.startSlot)):monday(date);
  const last=addDays(monday(dayOf(original.startSlot))>monday(date)?monday(dayOf(original.startSlot)):monday(date),6);
  const released=new Set(next.batches.filter(b=>b.id===batchId||(b.autoPlanned&&dayOf(b.startSlot)<=last&&b.useBy>=first)).map(b=>b.id));
  for(const [id,bid] of Object.entries(next.pins))if(released.has(bid))delete next.pins[id];
  for(const [id,bids] of Object.entries(next.skips)){next.skips[id]=bids.filter(bid=>!released.has(bid));if(!next.skips[id].length)delete next.skips[id];}
  const priorities=[...new Set(next.batches.filter(b=>b.id!==batchId&&b.priority).map(b=>b.priority))].sort((a,b)=>a-b);
  for(const b of next.batches)if(b.priority)b.priority=priorities.indexOf(b.priority)+1;
  batch.priority=priorities.length+1;delete batch.autoPlanned;delete batch.mealTypes;
  next.pins[target]=batchId;
  if(typeOf(target).startsWith('snack')||recipeById[batch.recipeId].kind==='snack')next.showSnacks=true;
  const affected=new Set(next.batches.filter(b=>b.id!==batchId&&dayOf(b.startSlot)<=last&&b.useBy>=first).map(b=>b.id));
  return settleBatchStarts(next,affected,batchId);
}

export function addBatchAt(state,recipeId,target) {
  const next=structuredClone(state),batch=makeBatch(recipeId,target);
  next.batches.push(batch);
  return placeBatch(next,batch.id,target);
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
  const date=d=>typeof d==='string' && /^20\d{2}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d+'T12:00:00Z')) && new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
  const validSlot=id=>typeof id==='string' && id.split('|').length===2 && date(dayOf(id)) && TYPES.includes(typeOf(id));
  if(!obj(input)||input.version!==1||!date(input.week)||monday(input.week)!==input.week||![1,2].includes(input.snackCount)||typeof input.showSnacks!=='boolean'||!Array.isArray(input.batches)||input.batches.length>200) fail();
  const s=emptyState(input.week);s.snackCount=input.snackCount;s.showSnacks=input.showSnacks;
  const ids=new Set();
  s.batches=input.batches.map(b=>{
    if(!obj(b)||typeof b.id!=='string'||!/^[\w-]{1,80}$/.test(b.id)||ids.has(b.id)||!Object.hasOwn(recipeById,b.recipeId)||!validSlot(b.startSlot)||!activeTypes(s.snackCount).includes(typeOf(b.startSlot))||!date(b.useBy)||b.useBy<dayOf(b.startSlot)||b.useBy>addDays(dayOf(b.startSlot),7)||!Number.isFinite(b.scale)||b.scale<0.25||b.scale>4||!Number.isInteger(b.portions)||b.portions<1||b.portions>30) fail();
    if(b.autoPlanned!==undefined&&typeof b.autoPlanned!=='boolean')fail();
    if(b.prepAhead!==undefined&&typeof b.prepAhead!=='boolean')fail();
    if(b.prepDate!==undefined&&(!date(b.prepDate)||b.prepDate>dayOf(b.startSlot)||b.prepDate<addDays(dayOf(b.startSlot),-7)))fail();
    if(b.priority!==undefined&&(!Number.isInteger(b.priority)||b.priority<1||b.priority>1000000))fail();
    if(b.mealTypes!==undefined&&(!Array.isArray(b.mealTypes)||!b.mealTypes.length||b.mealTypes.length>3||b.mealTypes.some(t=>!['breakfast','lunch','dinner'].includes(t))))fail();
    ids.add(b.id);return {id:b.id,recipeId:b.recipeId,startSlot:b.startSlot,useBy:b.useBy,scale:b.scale,portions:b.portions,...(b.autoPlanned?{autoPlanned:true}:{}),...(b.prepAhead&&!b.prepDate?{prepAhead:true}:{}),...(b.prepDate?{prepDate:b.prepDate}:{}),...(b.priority?{priority:b.priority}:{}),...(b.mealTypes?{mealTypes:[...new Set(b.mealTypes)]}:{})};
  });
  if(!obj(input.prices)||!obj(input.pins)||!obj(input.skips)||(!Array.isArray(input.haveEnough)&&!obj(input.haveEnough))) fail();
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
  for(const [id,bid] of Object.entries(input.pins)) {if(!validSlot(id)||!ids.has(bid)) fail();s.pins[id]=bid;}
  for(const [id,bids] of Object.entries(input.skips)) {if(!validSlot(id)||!Array.isArray(bids)||bids.length>200||bids.some(bid=>!ids.has(bid))) fail();s.skips[id]=[...new Set(bids)];}
  for(const b of s.batches) if(Object.values(s.pins).filter(id=>id===b.id).length>b.portions) fail();
  for(const [id,bid] of Object.entries(s.pins)) if(!pinValid(s.batches.find(b=>b.id===bid),id,s)) fail();
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
