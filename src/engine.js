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
// How she cooks (Settings → How I cook): leftovers from one batch (default), a fresh single portion
// for each meal, or batches cooked on her prep day(s) (0 = Sunday … 6 = Saturday).
export const DEFAULT_COOK_STYLE=Object.freeze({mode:'leftovers'});
export const COOK_MODES=['leftovers','fresh','prep'];
export const emptyState = (today=localDate()) => ({version:1,week:monday(today),snackCount:2,showSnacks:false,batches:[],skipped:{},cookStyle:{...DEFAULT_COOK_STYLE},prices:{},packageSizes:{},estimates:{},haveEnough:{},pantryQty:{},purchased:{},ingredientDates:{},favorites:[],avoid:''});
// Settings → Reset to defaults: factory settings, the meals stay.
export const resetSettings=state=>({...structuredClone(state),cookStyle:{...DEFAULT_COOK_STYLE}});
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
// A dinner can be cooked the evening before too (batch.nightBefore); that choice follows the batch.
const leadOf=(b,type)=>b.nightBefore?1:LEAD(type);
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
// Food is at its best until its enjoy-by date and still fine, a little softer, until three days
// after it was cooked (or its enjoy-by, if she set that later). After that it is too old.
export const SOFT_DAYS=3;
export const keepsUntil=b=>{const soft=addDays(preparationDate(b),SOFT_DAYS);return b.useBy>soft?b.useBy:soft;};
export function freshness(b,id) {
  const d=dayOf(id);
  return d<preparationDate(b)?'early':d<=b.useBy?'fresh':d<=keepsUntil(b)?'softer':'too-long';
}
const inWindow=(b,id)=>dayOf(id)>=preparationDate(b)&&dayOf(id)<=keepsUntil(b);
const inFresh=(b,id)=>dayOf(id)>=preparationDate(b)&&dayOf(id)<=b.useBy;
const skipsOf=state=>state.skipped||{};
const taken=(state,id)=>!!state.placements[id]||Object.hasOwn(skipsOf(state),id);

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
    if(!suits(state,chosen,id)||!inFresh(chosen,id)) continue;
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
  for(const id of [...new Set([...week,...Object.keys(state.placements),...Object.keys(skipsOf(state))])].sort((a,b)=>rank(a)-rank(b))) {
    const bid=state.placements[id]??null,skip=skipsOf(state)[id];
    cells[id]={id,chosen:bid,manual:!!bid&&!autoSlots(state,bid).includes(id),...(skip?{skip}:{})};
    if(bid) remaining[bid]--;
  }
  return {cells,remaining};
}

// After a move, a batch that isn't cooked yet is cooked for whichever of its meals is now
// first (the evening before a breakfast or lunch, or a dinner she cooks the night before) and
// keeps the length of its window; a separate prep date keeps its distance from the first meal.
// Cooked food keeps its dates. Every meal of the batch has to be ready and not too old
// (keepsUntil); a meal after its enjoy-by is allowed and reported as "softer".
// A batch whose cook day doesn't follow that rule (an older same-day lunch, or a batch
// whose chosen slot was taken) remembers its dates in b.home the first time a move
// changes them; when its first meal is back on home.first, those exact dates return, so
// moving a meal away and back always restores the batch as it was.
// swap = {dragged, from}: this batch is the swap partner, so the message starts with the meal she dragged.
const HOME_DEPTH=4;
const nestedHome=(h,depth=1)=>{if(!h.home)return h;if(depth>=HOME_DEPTH){const {home:_,...rest}=h;return rest;}return {...h,home:nestedHome(h.home,depth+1)};};
function settleWindow(before,next,batchId,to,now,swap=null,placing=false) {
  const old=before.batches.find(b=>b.id===batchId),b=next.batches.find(b=>b.id===batchId),week=next.week;
  const oldFirst=mealsOf(before.placements,batchId)[0],first=mealsOf(next.placements,batchId)[0],cooked=isCooked(old,now);
  // An extra from the fridge placed on or after the batch's first slot while its dates still fit
  // (a skipped meal put back) takes nothing away from the batch: it keeps the dates it was cooked for.
  const kept=placing&&first===to&&rank(to)>=rank(old.startSlot)&&inWindow(old,to);
  let changed=false;
  if(!cooked&&!kept&&first&&first!==oldFirst) {
    if(old.home?.first===first) {
      const {first:_,...dates}=old.home;
      for(const k of ['startSlot','useBy','prepAhead','prepDate','home']) delete b[k];
      Object.assign(b,dates);
    } else {
      const length=daysBetween(preparationDate(old),old.useBy);
      const cook=addDays(dayOf(first),-(old.prepDate?daysBetween(old.prepDate,dayOf(old.startSlot)):leadOf(old,typeOf(first))));
      const title=titleOf(b),lead=swap?`${swap.dragged} can’t swap with ${title}. `:'';
      if(cook<localDate(now)) throw Error(`${lead}Too late to cook ${title} for ${slotName(first,week)}.`);
      const gap=oldFirst&&daysBetween(preparationDate(old),dayOf(oldFirst));
      // Dates that don't follow the first meal are remembered (an earlier memory rides along inside,
      // so moving back restores it too).
      if(oldFirst&&(old.prepDate?old.startSlot!==oldFirst:gap!==leadOf(old,typeOf(oldFirst))||old.startSlot!==oldFirst))
        b.home=nestedHome({first:oldFirst,startSlot:old.startSlot,useBy:old.useBy,...(old.prepAhead?{prepAhead:true}:{}),...(old.prepDate?{prepDate:old.prepDate}:{}),...(old.home?{home:old.home}:{})});
      b.startSlot=first;b.useBy=addDays(cook,length);
      if(old.prepDate) b.prepDate=cook;
      else if(leadOf(old,typeOf(first))) b.prepAhead=true;
      else delete b.prepAhead;
    }
    changed=preparationDate(b)!==preparationDate(old)||b.useBy!==old.useBy;
  }
  // A refusal after a date change describes the move ("Moved there, it would cook Tue"),
  // never as if it were the window the cards show now.
  const {cookDay}=batchWindow(b),keeps=keepsUntil(b),title=titleOf(b),day=d=>dayName(d,week);
  const there=swap?`Moved to ${slotName(swap.from,week)}`:'Moved there';
  const would=`${there}, it would cook ${day(cookDay)} and keep until ${day(keeps)}.`;
  const dates=`${cooked?'Cooked':'Cooks'} ${day(cookDay)} · keeps until ${day(keeps)}.`;
  const lead=swap?`${swap.dragged} can’t swap with ${title}. `:'';
  for(const id of mealsOf(next.placements,batchId)) {
    const late=dayOf(id)>keeps,early=dayOf(id)<cookDay;
    if(!late&&!early) continue;
    const says=`${title} ${late?'won’t keep until':'isn’t ready by'} ${slotName(id,week)}.`;
    if(!changed) throw Error(`${lead}${says} ${dates}`);
    if(id===to) throw Error(`${lead}${says} ${would}`);
    throw Error(`${lead}${title}’s ${slotName(id,week)} meal ${late?'wouldn’t keep':'wouldn’t be ready'}. ${would}`);
  }
}
// Meals of these batches that are "softer" now and weren't before this change (for the toast and card tag).
function newlySofter(before,next,ids) {
  const out=[];
  for(const bid of ids) {
    const b=next.batches.find(x=>x.id===bid),old=before.batches.find(x=>x.id===bid);if(!b)continue;
    for(const id of mealsOf(next.placements,bid)) if(freshness(b,id)==='softer'&&!(before.placements[id]===bid&&freshness(old,id)==='softer')) out.push({batchId:bid,slot:id});
  }
  return out;
}

// Drag a card, one meal moves. from=null places one of the batch's unplaced portions (an
// extra in the fridge). Dropping onto another meal swaps the two; an extra dropped onto a meal
// takes its slot and that meal waits in the fridge instead (bumped). A skip in the way swaps
// with the meal (or gives way to an extra). A refusal throws a short sentence for her and
// changes nothing; a drop that changes nothing returns changed:false.
export function moveMeal(state,batchId,from,to,{now=new Date()}={}) {
  state=allocated(state);
  const b=state.batches.find(b=>b.id===batchId);
  if(!b) throw Error('That meal is no longer planned.');
  if(!isSlot(to)) throw Error('Choose a meal slot.');
  const placed=state.placements,title=titleOf(b),today=localDate(now),skips=skipsOf(state);
  if(from!==null&&placed[from]!==batchId) throw Error('That meal has moved. Try again.');
  if(from===null&&mealsOf(placed,batchId).length>=b.portions) throw Error(`Every portion of ${title} is already on the calendar.`);
  if(to===from||placed[to]===batchId) return {state,changed:false};
  if(!suits(state,b,to)) throw Error(`${title} can’t go in ${slotName(to,state.week)}.`);
  if(dayOf(to)<today) throw Error(`${slotName(to,state.week)} is already over.`);
  const partnerId=placed[to],skip=skips[to],next=structuredClone(state);
  let bumped=null,skipGone=null;
  if(partnerId) {
    if(from===null) bumped={batchId:partnerId,slot:to};
    else {
      const partner=titleOf(state.batches.find(x=>x.id===partnerId));
      if(!suits(state,state.batches.find(x=>x.id===partnerId),from)) throw Error(`${title} can’t swap with ${partner}. ${partner} can’t go in ${slotName(from,state.week)}.`);
      if(dayOf(from)<today) throw Error(`${title} can’t swap with ${partner}. ${partner} can’t move to ${slotName(from,state.week)}. That day is over.`);
      next.placements[from]=partnerId;
    }
  } else {
    if(from!==null) delete next.placements[from];
    if(skip) {
      delete next.skipped[to];
      if(from!==null) next.skipped[from]=skip; else skipGone={slot:to,...skip};
    }
  }
  next.placements[to]=batchId;
  settleWindow(state,next,batchId,to,now,null,from===null);
  if(partnerId&&from!==null) settleWindow(state,next,partnerId,from,now,{dragged:title,from});
  const swapped=partnerId&&from!==null?{swapped:{batchId:partnerId,slot:from}}:{};
  return {state:next,changed:true,...swapped,...(bumped?{bumped}:{}),...(skipGone?{skipGone}:{}),softer:newlySofter(state,next,[batchId,...(swapped.swapped?[partnerId]:[])])};
}

// ------------------------------------------------ Skips ------------------------------------------------
// A skip holds a slot ("Skipped", "Eating out"): nothing is cooked for it and planning leaves it alone.
// Its details are optional: a label, a cost (counted in the week's food spend) and a note.
// Skipping a meal never throws food away: it waits as an extra in the fridge (an unplaced portion)
// until she puts it back, drags it somewhere, or tosses it. Its batch keeps its dates.
export function skipSlot(state,id,{now=new Date()}={}) {
  state=allocated(state);
  if(!isSlot(id)) throw Error('Choose a meal slot.');
  if(!activeTypes(state.snackCount).includes(typeOf(id))) throw Error('Enable that snack slot first.');
  if(Object.hasOwn(skipsOf(state),id)) return {state,changed:false};
  const bid=state.placements[id];
  if(!bid&&dayOf(id)<localDate(now)) throw Error(`${slotName(id,state.week)} is already over.`);
  const next=structuredClone(state);next.skipped={...skipsOf(next),[id]:{}};
  if(bid) delete next.placements[id];
  return {state:next,changed:true,...(bid?{extra:bid}:{})};
}
// Drag a skip: to an empty slot it moves, onto a meal the two swap (checked like dragging that meal).
export function moveSkip(state,from,to,{now=new Date()}={}) {
  state=allocated(state);
  const skips=skipsOf(state),data=skips[from];
  if(!data) throw Error('That skip has moved. Try again.');
  if(!isSlot(to)) throw Error('Choose a meal slot.');
  if(to===from) return {state,changed:false};
  if(!activeTypes(state.snackCount).includes(typeOf(to))) throw Error('Enable that snack slot first.');
  if(dayOf(to)<localDate(now)) throw Error(`${slotName(to,state.week)} is already over.`);
  const bid=state.placements[to];
  if(bid) {const r=moveMeal(state,bid,to,from,{now});return {state:r.state,changed:true,swapped:{batchId:bid,slot:from},softer:r.softer};}
  const next=structuredClone(state),other=skips[to];
  if(other&&JSON.stringify(other)===JSON.stringify(data)) return {state,changed:false};
  next.skipped[to]=data;
  if(other) next.skipped[from]=other; else delete next.skipped[from];
  return {state:next,changed:true};
}
export function removeSkip(state,id) {
  state=allocated(state);
  if(!Object.hasOwn(skipsOf(state),id)) return state;
  const next=structuredClone(state);delete next.skipped[id];return next;
}
export const SKIP_LIMITS={label:60,note:300,cost:1000};
function skipDetails({label,cost,note}={}) {
  const out={},text=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
  if(text(label,SKIP_LIMITS.label)) out.label=text(label,SKIP_LIMITS.label);
  if(cost!==null&&cost!==undefined&&cost!=='') {
    const n=Number(cost);
    if(!Number.isFinite(n)||n<0||n>SKIP_LIMITS.cost) throw Error('Enter a cost from $0 to $1,000, or leave it blank.');
    out.cost=Math.round(n*100)/100;
  }
  if(text(note,SKIP_LIMITS.note)) out.note=text(note,SKIP_LIMITS.note);
  return out;
}
export function updateSkip(state,id,details) {
  state=allocated(state);
  if(!Object.hasOwn(skipsOf(state),id)) throw Error('That skip has moved. Try again.');
  const next=structuredClone(state);next.skipped[id]=skipDetails(details);return next;
}
// The optional costs of skips in the shown week (eating out counts toward the week's food spend).
export function skipSpend(state) {
  const end=addDays(state.week,6);
  return Object.entries(skipsOf(state)).filter(([id])=>dayOf(id)>=state.week&&dayOf(id)<=end).reduce((n,[,x])=>n+(x.cost||0),0);
}

// ------------------------------------------------ Extras ------------------------------------------------
const extrasOf=(state,b)=>b.portions-mealsOf(state.placements,b.id).length;
// Toss one extra: it is gone for good. The groceries were bought and cooked, so they stay.
export function tossExtra(state,batchId) {
  state=allocated(state);
  const b=state.batches.find(b=>b.id===batchId);
  if(!b) throw Error('That meal is no longer planned.');
  if(extrasOf(state,b)<1) throw Error(`${titleOf(b)} has no extra to toss.`);
  if(b.portions===1) return removeBatches(state,[batchId]);
  const next=structuredClone(state);next.batches.find(x=>x.id===batchId).portions--;return next;
}
// A quarter batch is the smallest; below that the groceries can't go down.
export const canCookSmaller=b=>b.portions===1||b.scale>MIN_SCALE;
const MIN_SCALE=.25;
// Not cooked yet: cook one portion less, with fewer ingredients (lower groceries).
export function cookSmaller(state,batchId,{now=new Date()}={}) {
  state=allocated(state);
  const b=state.batches.find(b=>b.id===batchId);
  if(!b) throw Error('That meal is no longer planned.');
  if(extrasOf(state,b)<1) throw Error(`${titleOf(b)} has no extra to cook less of.`);
  if(isCooked(b,now)) throw Error(`${titleOf(b)} is already cooked. Toss the extra instead.`);
  if(b.portions===1) return removeBatches(state,[batchId]);
  if(!canCookSmaller(b)) throw Error(`${titleOf(b)} is already the smallest batch it can be. Toss the extra instead.`);
  const next=structuredClone(state),x=next.batches.find(x=>x.id===batchId);
  x.scale=Math.max(MIN_SCALE,Math.round(x.scale*(x.portions-1)/x.portions*10000)/10000);x.portions--;
  return next;
}
// "Put back": one extra goes on the earliest free suitable slot it keeps until (fresh ones first).
export function placeExtra(state,batchId,{now=new Date()}={}) {
  state=allocated(state);
  const b=state.batches.find(b=>b.id===batchId);
  if(!b) throw Error('That meal is no longer planned.');
  if(extrasOf(state,b)<1) throw Error(`Every portion of ${titleOf(b)} is already on the calendar.`);
  const today=localDate(now),from=dayOf(b.startSlot)>today?b.startSlot:slot(today,TYPES[0]),open=[];
  for(let d=dayOf(from);d<=keepsUntil(b);d=addDays(d,1)) for(const t of activeTypes(state.snackCount)) {
    const id=slot(d,t);
    if(rank(id)>=rank(from)&&rank(id)>=rank(b.startSlot)&&!taken(state,id)&&suits(state,b,id)&&inWindow(b,id)) open.push(id);
  }
  const spot=open.find(id=>freshness(b,id)==='fresh')||open[0];
  if(!spot) throw Error(`No free spot for ${titleOf(b)} before it’s too old. Choose a slot with a meal for it (that meal waits in the fridge instead), or toss it.`);
  return {...moveMeal(state,batchId,null,spot,{now}),slot:spot};
}

// The pin's × puts a meal she moved back where it was placed automatically, if that
// spot is still free. It never pushes another meal out.
export function putBack(state,batchId,from,{now=new Date()}={}) {
  state=allocated(state);
  if(state.placements[from]!==batchId) throw Error('That meal has moved. Try again.');
  if(autoSlots(state,batchId).includes(from)) return {state,changed:false};
  const spot=originalSpot(state,batchId);
  if(!spot) throw Error('You placed this meal yourself, so it has no other spot to go back to.');
  if(taken(state,spot)) throw Error(`Its original spot, ${slotName(spot,state.week)}, is taken now.`);
  return moveMeal(state,batchId,from,spot,{now});
}
// Where the pin's × would put a moved meal of this batch: a free original slot if
// there is one, otherwise the first original slot (taken now), or null.
export function originalSpot(state,batchId) {
  state=allocated(state);
  const spots=autoSlots(state,batchId).filter(id=>state.placements[id]!==batchId);
  return spots.find(id=>!taken(state,id))??spots[0]??null;
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
    if(Object.hasOwn(skipsOf(next),to)) throw Error(`${slotName(to,state.week)} is skipped. Remove the skip first.`);
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

function freeSlots(state,b,from=b.startSlot,until=b.useBy) {
  const open=[];
  for(let d=dayOf(from);d<=until;d=addDays(d,1)) for(const t of activeTypes(state.snackCount)) {
    const id=slot(d,t);
    if(rank(id)>=rank(from)&&!taken(state,id)&&suits(state,b,id)) open.push(id);
  }
  return open;
}
// Portions of a new or edited batch that aren't on the calendar take the next free
// suitable slots in its window. What doesn't fit waits under Your batches.
function fillFreeSlots(state,b,until=b.useBy,count=b.portions) {
  const missing=Math.min(b.portions,count)-mealsOf(state.placements,b.id).length;
  const open=freeSlots(state,b,b.startSlot,until).slice(0,Math.max(0,missing));
  for(const id of open) state.placements[id]=b.id;
  if(open.length) state.auto[b.id]=[...new Set([...autoSlots(state,b.id),...open])].sort(byRank);
}
// A prep day today still counts until 8pm; after that the earliest prep day is tomorrow.
export const PREP_CUTOFF_HOUR=20;
export const prepFloor=now=>now?(now.getHours()<PREP_CUTOFF_HOUR?localDate(now):addDays(localDate(now),1)):null;
// Prep day(s): the latest prep day on or before a meal (before it, for a packed breakfast or
// lunch) that is not over yet and is at most three days before it. null: cook on the day.
export function prepDayFor(style,target,today=null) {
  if(style?.mode!=='prep') return null;
  const d=dayOf(target),latest=LEAD(typeOf(target))?addDays(d,-1):d;
  for(let p=latest;p>=addDays(d,-SOFT_DAYS);p=addDays(p,-1)) {
    if(today&&p<today) break;
    if(style.days.includes(new Date(p+'T12:00:00Z').getUTCDay())) return p;
  }
  return null;
}
// A new batch as "How I cook" makes it: fresh = one portion with the ingredients scaled down;
// prep = cooked on her prep day; otherwise cooked for its first meal (the evening before a packed one).
export function styledBatch(recipeId,start,style=DEFAULT_COOK_STYLE,today=null,id) {
  const recipe=recipeById[recipeId],b={...makeBatch(recipeId,start),...(id?{id}:{})};
  if(style?.mode==='fresh'){b.portions=1;b.scale=Math.max(.25,Math.round(10000/recipe.servings)/10000);}
  const prep=prepDayFor(style,start,today);
  if(prep){b.prepDate=prep;b.useBy=addDays(prep,recipe.qualityDays);}
  else if(LEAD(typeOf(start))){b.prepAhead=true;b.useBy=addDays(b.useBy,-1);}
  return b;
}

// Adding a recipe: the first portion goes where she dropped it. A meal already there waits in
// the fridge as an extra and a skip there gives way (the toast says so, with Undo). Dropped on
// a slot of the wrong kind, it starts at the next free suitable slot. The rest fill the
// following free slots before its enjoy-by (up to three days after a prep day). It never
// creates a batch with no meal on the calendar. With now, a slot that is already over is
// refused like a move (the example week and older code paths build plans without it).
export function addBatchAt(state,recipeId,target,{now}={}) {
  const recipe=recipeById[recipeId];
  if(!recipe) throw Error('Unknown meal.');
  if(!isSlot(target)) throw Error('Choose a meal slot.');
  if(now&&dayOf(target)<localDate(now)) throw Error(`${slotName(target,state.week)} is already over.`);
  if(!activeTypes(state.snackCount).includes(typeOf(target))) throw Error('Enable that snack slot first.');
  const next=structuredClone(allocated(state)),id=globalThis.crypto.randomUUID(),style=state.cookStyle||DEFAULT_COOK_STYLE,today=prepFloor(now);
  const make=start=>styledBatch(recipeId,start,style,today,id),reach=b=>style.mode==='prep'?keepsUntil(b):b.useBy;
  let batch=make(target);
  if(suits(next,batch,target)) {
    delete next.placements[target];
    if(next.skipped) delete next.skipped[target];
  } else {
    const first=freeSlots(next,batch,target,reach(batch))[0];
    if(!first) {
      const kind=recipe.kind==='snack'?'snack':recipe.kind==='breakfast'?'breakfast':'lunch or dinner';
      throw Error(`${recipe.title} needs a ${kind} slot, and none is free before it would be too old. Drop it on a ${kind} slot.`);
    }
    batch=make(first);
  }
  next.batches.push(batch);next.placements[batch.startSlot]=batch.id;next.auto[batch.id]=[batch.startSlot];
  fillFreeSlots(next,batch,reach(batch));
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
    // Fewer portions: the extras in the fridge go first, then the latest meals.
    for(const id of meals.map(shift).filter(id=>inWindow(b,id)&&suits(next,b,id)&&!taken(next,id)).slice(0,b.portions)) next.placements[id]=b.id;
    // Extras already in the fridge stay there; only portions added here (or a meal the new
    // dates pushed off a taken slot) look for a free slot.
    fillFreeSlots(next,b,b.useBy,meals.length+Math.max(0,b.portions-old.portions));
  } else {next.batches.push(b);fillFreeSlots(next,b);}
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
    if(!obj(b)||typeof b.id!=='string'||!/^[\w-]{1,80}$/.test(b.id)||ids.has(b.id)||!Object.hasOwn(recipeById,b.recipeId)||!validSlot(b.startSlot)||!activeTypes(s.snackCount).includes(typeOf(b.startSlot))||!date(b.useBy)||b.useBy>addDays(dayOf(b.startSlot),7)||!Number.isFinite(b.scale)||b.scale<0.25||b.scale>4||!Number.isInteger(b.portions)||b.portions<1||b.portions>30) fail();
    if(b.autoPlanned!==undefined&&typeof b.autoPlanned!=='boolean')fail();
    if(b.prepAhead!==undefined&&typeof b.prepAhead!=='boolean')fail();
    if(b.nightBefore!==undefined&&typeof b.nightBefore!=='boolean')fail();
    if(b.prepDate!==undefined&&(!date(b.prepDate)||b.prepDate>dayOf(b.startSlot)||b.prepDate<addDays(dayOf(b.startSlot),-7)))fail();
    // Enjoy-by can't be before the food is cooked (it may be before a meal eaten "softer").
    if(b.useBy<(b.prepDate||(b.prepAhead||b.nightBefore?addDays(dayOf(b.startSlot),-1):dayOf(b.startSlot))))fail();
    if(b.priority!==undefined&&(!Number.isInteger(b.priority)||b.priority<1||b.priority>1000000))fail();
    // Remembered dates (see settleWindow), possibly with an earlier memory inside.
    const cleanHome=(home,depth=1)=>{
      if(!obj(home)||depth>HOME_DEPTH||!validSlot(home.first)||!validSlot(home.startSlot)||!date(home.useBy)||(home.prepDate===undefined&&home.useBy<addDays(dayOf(home.startSlot),-1))||home.useBy>addDays(dayOf(home.startSlot),7)||(home.prepAhead!==undefined&&home.prepAhead!==true)
        ||(home.prepDate!==undefined&&(!date(home.prepDate)||home.prepDate>dayOf(home.startSlot)||home.prepDate<addDays(dayOf(home.startSlot),-7)||home.useBy<home.prepDate)))fail();
      return {first:home.first,startSlot:home.startSlot,useBy:home.useBy,...(home.prepAhead&&!home.prepDate?{prepAhead:true}:{}),...(home.prepDate?{prepDate:home.prepDate}:{}),...(home.home!==undefined&&!home.prepDate===!home.home.prepDate?{home:cleanHome(home.home,depth+1)}:{})};
    };
    const home=b.home===undefined?undefined:cleanHome(b.home);
    if(b.mealTypes!==undefined&&(!Array.isArray(b.mealTypes)||!b.mealTypes.length||b.mealTypes.length>3||b.mealTypes.some(t=>!['breakfast','lunch','dinner'].includes(t))))fail();
    ids.add(b.id);return {id:b.id,recipeId:b.recipeId,startSlot:b.startSlot,useBy:b.useBy,scale:b.scale,portions:b.portions,...(b.autoPlanned?{autoPlanned:true}:{}),...((b.prepAhead||b.nightBefore)&&!b.prepDate?{prepAhead:true}:{}),...(b.nightBefore&&!b.prepDate?{nightBefore:true}:{}),...(b.prepDate?{prepDate:b.prepDate}:{}),...(b.priority?{priority:b.priority}:{}),...(b.mealTypes?{mealTypes:[...new Set(b.mealTypes)]}:{}),...(home&&!b.prepDate===!home.prepDate?{home}:{})};
  });
  // Skips: a slot with no meal, optional label / cost / note.
  if(input.skipped!==undefined&&!obj(input.skipped))fail();
  if(Object.keys(input.skipped||{}).length>400)fail();
  for(const [id,x] of Object.entries(input.skipped||{})){
    if(!validSlot(id)||!activeTypes(s.snackCount).includes(typeOf(id))||!obj(x))fail();
    if(x.label!==undefined&&(typeof x.label!=='string'||x.label.length>SKIP_LIMITS.label))fail();
    if(x.note!==undefined&&(typeof x.note!=='string'||x.note.length>SKIP_LIMITS.note))fail();
    if(x.cost!==undefined&&(!Number.isFinite(x.cost)||x.cost<0||x.cost>SKIP_LIMITS.cost))fail();
    s.skipped[id]={...(x.label?{label:x.label}:{}),...(x.cost!==undefined?{cost:x.cost}:{}),...(x.note?{note:x.note}:{})};
  }
  // How I cook: older saves have none and cook leftovers, the default. Prep days default to Sunday.
  const style=input.cookStyle;
  if(style!==undefined){
    if(!obj(style)||!COOK_MODES.includes(style.mode))fail();
    if(style.days!==undefined&&(!Array.isArray(style.days)||!style.days.length||style.days.length>7||style.days.some(d=>!Number.isInteger(d)||d<0||d>6)))fail();
    s.cookStyle=style.mode==='prep'?{mode:'prep',days:[...new Set(style.days||[0])].sort((a,b)=>a-b)}:{mode:style.mode};
  }
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
      if(!validSlot(id)||!b||!suits(s,b,id)||!inWindow(b,id)||Object.hasOwn(s.skipped,id)) fail();
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
