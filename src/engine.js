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
// One formatter, made once (building an Intl formatter per call was a large share of each render).
const USD=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
export const money = n => USD.format(n);
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
// state.placements maps a slot to the batch eaten there. Only adding a batch and planning
// fill slots, and only empty ones. After that a meal moves when she moves it; nothing else
// on the calendar shifts on its own. There is no hidden "home" or pin: a swap is just a swap.
// Lock in: a batch is locked unless b.autoPlanned is set. Plan my week's suggestions start unlocked
// (autoPlanned: it may replace them); anything she adds, and any batch she edits in batch details,
// is locked. Only the Lock in / Unlock button (and an edit) changes it: moves never do. A lock only
// stops Plan my week / Re-plan open meals from replacing the batch; her own moves are never blocked.
const LEAD=type=>type==='breakfast'||type==='lunch'?1:0; // packed meals are made the evening before
// A dinner can be cooked the evening before too (batch.nightBefore); that choice follows the batch.
const leadOf=(b,type)=>b.nightBefore?1:LEAD(type);
const daysBetween=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
const WEEKDAY=new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:'UTC'}),MONTH_DAY=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
const weekday=date=>WEEKDAY.format(new Date(date+'T12:00:00Z'));
const titleOf=b=>recipeById[b.recipeId].title;
const isDate=d=>typeof d==='string' && /^20\d{2}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d+'T12:00:00Z')) && new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const isSlot=id=>typeof id==='string' && id.split('|').length===2 && isDate(dayOf(id)) && TYPES.includes(typeOf(id));
const byRank=(a,b)=>rank(a)-rank(b);
const mealsOf=(placements,batchId)=>Object.keys(placements).filter(id=>placements[id]===batchId).sort(byRank);
// How messages name a day or a slot: "Wed" / "Wed lunch" inside the week on screen, with
// the date when it is outside that week ("Thu Oct 1 lunch"), so a name is never ambiguous.
export const dayName=(date,week)=>week&&(date<week||date>addDays(week,6))?`${weekday(date)} ${MONTH_DAY.format(new Date(date+'T12:00:00Z'))}`:weekday(date);
export const slotName=(id,week)=>`${dayName(dayOf(id),week)} ${SLOT_LABELS[typeOf(id)].toLowerCase()}`;
export const batchWindow=b=>({cookDay:preparationDate(b),enjoyBy:b.useBy});
// Food counts as cooked once its cook day is over. That is only information now: cooked food
// moves like any other (the calendar is her record too).
export const isCooked=(b,now=new Date())=>preparationDate(b)<localDate(now);
// The kind of food a slot is meant for. Any food may go in any slot (a small note says
// "dinner at breakfast"); Plan my week, adding recipes and Straighten only use matching slots.
export const fitsType=(b,id)=>{const kind=recipeById[b.recipeId].kind,type=typeOf(id);return kind==='snack'?type.startsWith('snack'):kind==='breakfast'?type==='breakfast':type==='lunch'||type==='dinner';};
function suits(state,b,id) {return activeTypes(state.snackCount).includes(typeOf(id))&&fitsType(b,id);}
// Food is at its best until its enjoy-by date; after that it is "mushy" but fine until four days
// after cooking (USDA: cooked leftovers keep 3–4 days in the fridge). From day 5 it is past
// fridge-safe. Both are shown on the card and the string, never enforced.
export const SAFE_DAYS=4;
// Planning (Plan my week, prep days, adding a recipe) reaches at most three days past a prep day.
export const PREP_REACH=3;
export const keepsUntil=b=>addDays(preparationDate(b),SAFE_DAYS);
export const daysAfterCooking=(b,id)=>daysBetween(preparationDate(b),dayOf(id));
export function freshness(b,id) {
  const d=dayOf(id);
  return d<preparationDate(b)?'early':d>keepsUntil(b)?'unsafe':d<=b.useBy?'fresh':'mushy';
}
const inWindow=(b,id)=>dayOf(id)>=preparationDate(b)&&dayOf(id)<=keepsUntil(b);
const inFresh=(b,id)=>dayOf(id)>=preparationDate(b)&&dayOf(id)<=b.useBy;
const planReach=b=>{const r=addDays(preparationDate(b),PREP_REACH);return b.useBy>r?b.useBy:r;};
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
  const placements={};
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
  }
  // Pins are gone: the placements are kept exactly, nothing remembers who put them there.
  return {placements};
}
function allocated(state) {
  if(state.placements) return state;
  const next=structuredClone(state);
  Object.assign(next,legacyAllocation(state));
  delete next.pins;delete next.skips;delete next.auto;
  for(const b of next.batches) {delete b.priority;delete b.home;}
  return next;
}

// The read API: one cell per slot of the shown week plus every placed portion (in any
// week), in calendar order. remaining = portions not on the calendar (extras in the fridge).
export function schedule(state) {
  state=allocated(state);
  const remaining=Object.fromEntries(state.batches.map(b=>[b.id,b.portions]));
  const week=Array.from({length:7},(_,i)=>addDays(state.week,i)).flatMap(d=>activeTypes(state.snackCount).map(t=>slot(d,t)));
  const cells={};
  for(const id of [...new Set([...week,...Object.keys(state.placements),...Object.keys(skipsOf(state))])].sort((a,b)=>rank(a)-rank(b))) {
    const bid=state.placements[id]??null,skip=skipsOf(state)[id];
    cells[id]={id,chosen:bid,...(skip?{skip}:{})};
    if(bid) remaining[bid]--;
  }
  return {cells,remaining};
}

// The cook day follows the batch's earliest meal. When a move changes which meal is first:
// - a batch whose dates follow its first meal (the usual case: cooked for it, the evening before
//   a packed breakfast or lunch or a night-before dinner) is cooked for the new first meal;
// - any other batch (a separate prep date, an older same-day lunch, or dates set by hand or kept
//   when its first meal was skipped) slides all its dates by the days its first meal moved.
// Either way the window length is kept, so moving a meal away and back restores the batch
// exactly, and nothing is remembered anywhere. An extra from the fridge put on or after the
// batch's cook day keeps the batch's dates while that day is fridge-safe, once the food is cooked,
// and while other meals of the batch are on the calendar (later is shown as past fridge-safe:
// cooked food never claims a new cook day, and a skipped meal dropped back is exactly where it
// was). Only an uncooked batch with nothing else on the calendar is cooked for the extra instead.
// Nothing is refused: meals that end up after enjoy-by are "mushy", after day 4 "past fridge-safe".
const cookFor=(b,id)=>addDays(dayOf(id),-leadOf(b,typeOf(id)));
const followsFirst=(b,first)=>b.prepDate?b.startSlot===first:b.startSlot===first&&!!b.prepAhead===!!leadOf(b,typeOf(first));
function settleWindow(before,next,batchId,to,placing=false,now=new Date()) {
  const old=before.batches.find(b=>b.id===batchId),b=next.batches.find(b=>b.id===batchId);
  const oldFirst=mealsOf(before.placements,batchId)[0],first=mealsOf(next.placements,batchId)[0];
  if(!first||first===oldFirst) return;
  if(placing&&first===to&&dayOf(to)>=preparationDate(old)&&(inWindow(old,to)||isCooked(old,now)||oldFirst)) return;
  let days;
  if(!oldFirst||followsFirst(old,oldFirst)) {
    days=old.prepDate?daysBetween(dayOf(old.startSlot),dayOf(first)):daysBetween(preparationDate(old),cookFor(old,first));
    b.startSlot=first;
    if(!old.prepDate) {if(leadOf(old,typeOf(first))) b.prepAhead=true; else delete b.prepAhead;}
  } else {
    // Slide by the days between the old and new first meal, so a meal can never land before cooking.
    days=daysBetween(dayOf(oldFirst),dayOf(first));
    b.startSlot=slot(addDays(dayOf(old.startSlot),days),typeOf(old.startSlot));
  }
  b.useBy=addDays(old.useBy,days);
  if(old.prepDate) b.prepDate=addDays(old.prepDate,days);
}
// Meals of these batches that are mushy or past fridge-safe now and weren't before (toasts, card tags).
function newlyLate(before,next,ids) {
  const out=[];
  for(const bid of new Set(ids)) {
    const b=next.batches.find(x=>x.id===bid),old=before.batches.find(x=>x.id===bid);if(!b)continue;
    for(const id of mealsOf(next.placements,bid)) {
      const now=freshness(b,id);
      if((now==='mushy'||now==='unsafe')&&!(old&&before.placements[id]===bid&&freshness(old,id)===now)) out.push({batchId:bid,slot:id,state:now,day:daysAfterCooking(b,id)});
    }
  }
  return out;
}

// Drag a card, one meal moves. from=null places one of the batch's unplaced portions (an
// extra in the fridge). Dropping onto another meal swaps the two; an extra dropped onto a meal
// takes its slot and that meal waits in the fridge instead (bumped). A skip in the way swaps
// with the meal (or gives way to an extra). Past slots, any meal type and any freshness are
// allowed; the only limit is one thing per slot. A drop that changes nothing returns changed:false.
export function moveMeal(state,batchId,from,to,{now=new Date()}={}) {
  state=allocated(state);
  const b=state.batches.find(b=>b.id===batchId);
  if(!b) throw Error('That meal is no longer planned.');
  if(!isSlot(to)) throw Error('Choose a meal slot.');
  if(!activeTypes(state.snackCount).includes(typeOf(to))) throw Error('Turn on that snack slot first (Show snacks).');
  const placed=state.placements,title=titleOf(b),skips=skipsOf(state);
  if(from!==null&&placed[from]!==batchId) throw Error('That meal has moved. Try again.');
  if(from===null&&mealsOf(placed,batchId).length>=b.portions) throw Error(`Every portion of ${title} is already on the calendar.`);
  if(to===from||placed[to]===batchId) return {state,changed:false};
  const partnerId=placed[to],skip=skips[to],next=structuredClone(state);
  let bumped=null,skipGone=null;
  if(partnerId) {
    if(from===null) bumped={batchId:partnerId,slot:to};
    else next.placements[from]=partnerId;
  } else {
    if(from!==null) delete next.placements[from];
    if(skip) {
      delete next.skipped[to];
      if(from!==null) next.skipped[from]=skip; else skipGone={slot:to,...skip};
    }
  }
  next.placements[to]=batchId;
  settleWindow(state,next,batchId,to,from===null,now);
  if(partnerId&&from!==null) settleWindow(state,next,partnerId,from);
  const swapped=partnerId&&from!==null?{swapped:{batchId:partnerId,slot:from}}:{};
  return {state:next,changed:true,...swapped,...(bumped?{bumped}:{}),...(skipGone?{skipGone}:{}),late:newlyLate(state,next,[batchId,...(swapped.swapped?[partnerId]:[])])};
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
  if(!activeTypes(state.snackCount).includes(typeOf(to))) throw Error('Turn on that snack slot first (Show snacks).');
  const bid=state.placements[to];
  if(bid) {const r=moveMeal(state,bid,to,from,{now});return {state:r.state,changed:true,swapped:{batchId:bid,slot:from},late:r.late};}
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
// "Put back": one extra goes on the earliest free suitable slot while it is still fridge-safe
// (fresh ones first). With none free, the refusal names the way out: Choose a slot (a meal
// there waits in the fridge instead) or Toss.
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
  if(!spot) throw Error(`No free spot for ${titleOf(b)} while it’s fridge-safe. Tap “Choose a slot” to put it anywhere (a meal there waits in the fridge instead), or toss it.`);
  return {...moveMeal(state,batchId,null,spot,{now}),slot:spot};
}

// Whole-batch move ("Cook it another day", dragging the knot, Move whole batch): every meal,
// the cook day and enjoy-by shift by the same number of days, in the past or into another week,
// cooked or not. A meal of another batch in the way waits in the fridge as an extra (bumped;
// that batch keeps its dates), and a skip in the way gives way. A move never changes the lock.
export function slideBatch(state,batchId,days,{now=new Date()}={}) {
  state=allocated(state);
  const b=state.batches.find(b=>b.id===batchId);
  if(!b) throw Error('That meal is no longer planned.');
  if(!Number.isInteger(days)||Math.abs(days)>366) throw Error('Choose a day.');
  if(!days) return {state,changed:false};
  const shift=id=>slot(addDays(dayOf(id),days),typeOf(id));
  const next=structuredClone(state),moved=next.batches.find(x=>x.id===batchId),bumped=[],skipsGone=[];
  const meals=mealsOf(state.placements,batchId);
  for(const id of meals) delete next.placements[id];
  for(const id of meals) {
    const to=shift(id),other=next.placements[to];
    if(other) bumped.push({batchId:other,slot:to});
    if(Object.hasOwn(skipsOf(next),to)) {skipsGone.push({slot:to,...next.skipped[to]});delete next.skipped[to];}
    next.placements[to]=batchId;
  }
  moved.startSlot=shift(moved.startSlot);moved.useBy=addDays(moved.useBy,days);
  if(moved.prepDate) moved.prepDate=addDays(moved.prepDate,days);
  return {state:next,changed:true,bumped,skipsGone,late:newlyLate(state,next,[batchId])};
}
// The whole-batch move that puts the meal the knot sits on (`anchor`, by default the batch's first
// meal) on `target`'s day.
export function slideDaysTo(state,batchId,target,anchor=null) {
  state=allocated(state);
  const b=state.batches.find(b=>b.id===batchId);if(!b)return 0;
  const first=anchor&&state.placements[anchor]===batchId?anchor:mealsOf(state.placements,batchId)[0]||b.startSlot;
  return daysBetween(dayOf(first),dayOf(target));
}
// Lock in / Unlock (see the top of this file). One Undo; nothing on the calendar moves.
export const isLocked=b=>!b.autoPlanned;
export function setLocked(state,batchId,locked) {
  state=allocated(state);
  const b=state.batches.find(b=>b.id===batchId);
  if(!b) throw Error('That meal is no longer planned.');
  if(isLocked(b)===!!locked) return {state,changed:false};
  const next=structuredClone(state),x=next.batches.find(b=>b.id===batchId);
  if(locked) delete x.autoPlanned; else x.autoPlanned=true;
  return {state:next,changed:true};
}

// Straighten string: the batch's first meal stays; its other meals on the calendar go, in
// order, to the earliest free slots of their kind after it while the food is fridge-safe.
// Never moves another batch or a skip; what doesn't fit waits in the fridge as an extra.
// Running it twice changes nothing the second time.
export function straightenBatch(state,batchId) {
  state=allocated(state);
  const b=state.batches.find(b=>b.id===batchId);
  if(!b) throw Error('That meal is no longer planned.');
  const meals=mealsOf(state.placements,batchId),first=meals[0];
  if(!first) return {state,changed:false,placed:[],fridged:0,from:[]};
  const rest=meals.slice(1),next=structuredClone(state);
  for(const id of rest) delete next.placements[id];
  const open=[];
  for(let d=dayOf(first);d<=keepsUntil(b)&&open.length<rest.length;d=addDays(d,1)) for(const t of activeTypes(state.snackCount)) {
    const id=slot(d,t);
    if(rank(id)>rank(first)&&!taken(next,id)&&suits(next,b,id)&&inWindow(b,id)&&open.length<rest.length) open.push(id);
  }
  for(const id of open) next.placements[id]=batchId;
  const changed=rest.length!==open.length||rest.some((id,i)=>id!==open[i]);
  return changed?{state:next,changed,placed:open,fridged:rest.length-open.length,from:rest}:{state,changed:false,placed:rest,fridged:0,from:rest};
}
// Batches with a meal in the week on screen (or cooked in it), first meal first.
export function weekBatches(state) {
  state=allocated(state);
  const end=addDays(state.week,6),first=id=>mealsOf(state.placements,id)[0];
  return state.batches.filter(b=>mealsOf(state.placements,b.id).some(id=>dayOf(id)>=state.week&&dayOf(id)<=end))
    .sort((a,b)=>rank(first(a.id))-rank(first(b.id))||a.id.localeCompare(b.id));
}
// Tidy week: straighten every string with a meal in the week on screen. Each batch only takes
// free slots, so no batch pushes another; it repeats until nothing changes (so it is idempotent).
export function tidyWeek(state) {
  state=allocated(state);
  let next=state;const touched=new Set();let fridged=0;
  for(let pass=0;pass<50;pass++) {
    let changed=false;
    for(const b of weekBatches(next)) {const r=straightenBatch(next,b.id);if(r.changed){next=r.state;changed=true;touched.add(b.id);fridged+=r.fridged;}}
    if(!changed) break;
  }
  return {state:next,changed:next!==state,straightened:[...touched],fridged};
}
// "Put the late meal in the fridge": meals past fridge-safe come off the calendar as extras.
export function fridgeLate(state,batchId) {
  state=allocated(state);
  const b=state.batches.find(b=>b.id===batchId);
  if(!b) throw Error('That meal is no longer planned.');
  const late=mealsOf(state.placements,batchId).filter(id=>freshness(b,id)==='unsafe');
  if(!late.length) return {state,changed:false,slots:[]};
  const next=structuredClone(state);for(const id of late) delete next.placements[id];
  return {state:next,changed:true,slots:late};
}
// Meals of a batch on the calendar, in order (the string's beads).
export const batchMeals=(state,batchId)=>mealsOf(allocated(state).placements,batchId);

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
}
// A prep day today still counts until 8pm; after that the earliest prep day is tomorrow.
export const PREP_CUTOFF_HOUR=20;
export const prepFloor=now=>now?(now.getHours()<PREP_CUTOFF_HOUR?localDate(now):addDays(localDate(now),1)):null;
// Prep day(s): the latest prep day on or before a meal (before it, for a packed breakfast or
// lunch) that is not over yet and is at most three days before it. null: cook on the day.
export function prepDayFor(style,target,today=null) {
  if(style?.mode!=='prep') return null;
  const d=dayOf(target),latest=LEAD(typeOf(target))?addDays(d,-1):d;
  for(let p=latest;p>=addDays(d,-PREP_REACH);p=addDays(p,-1)) {
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

// Adding a recipe: the first portion goes exactly where she dropped it, on any day and in any
// slot (a breakfast dropped on a dinner slot shows a small note). A meal already there waits in
// the fridge as an extra and a skip there gives way (the toast says so, with Undo). The rest fill
// the following free slots of their kind before its enjoy-by (up to three days after a prep day).
export function addBatchAt(state,recipeId,target,{now}={}) {
  const recipe=recipeById[recipeId];
  if(!recipe) throw Error('Unknown meal.');
  if(!isSlot(target)) throw Error('Choose a meal slot.');
  if(!activeTypes(state.snackCount).includes(typeOf(target))) throw Error('Turn on that snack slot first (Show snacks).');
  const next=structuredClone(allocated(state)),id=globalThis.crypto.randomUUID(),style=state.cookStyle||DEFAULT_COOK_STYLE,today=prepFloor(now);
  const batch=styledBatch(recipeId,target,style,today,id),reach=style.mode==='prep'?planReach(batch):batch.useBy;
  delete next.placements[target];
  if(next.skipped) delete next.skipped[target];
  next.batches.push(batch);next.placements[batch.startSlot]=batch.id;
  fillFreeSlots(next,batch,reach);
  if(recipe.kind==='snack'||typeOf(target).startsWith('snack')) next.showSnacks=true;
  return next;
}

// Saving the batch form (an edit locks the batch). A new batch fills free slots from its first available slot. An
// edited batch keeps its meals: a new available date moves them by the same number of
// days, meals that no longer fit its dates or portion count wait under Your batches, and
// portions that are missing take free slots in its window.
export function saveBatch(state,batch) {
  const next=structuredClone(allocated(state)),old=next.batches.find(b=>b.id===batch.id),b=structuredClone(batch);
  delete b.home;delete b.autoPlanned;
  if(old) {
    const days=daysBetween(dayOf(old.startSlot),dayOf(b.startSlot)),shift=id=>slot(addDays(dayOf(id),days),typeOf(id));
    const meals=mealsOf(next.placements,b.id);
    for(const id of meals) delete next.placements[id];
    next.batches=next.batches.map(x=>x.id===b.id?b:x);
    // Her meals stay where they are (moved with a new date), mushy or not, in any kind of slot;
    // only a meal the new dates put before cooking waits in the fridge.
    // Fewer portions: the extras in the fridge go first, then the latest meals.
    for(const id of meals.map(shift).filter(id=>dayOf(id)>=preparationDate(b)&&activeTypes(next.snackCount).includes(typeOf(id))&&!taken(next,id)).slice(0,b.portions)) next.placements[id]=b.id;
    // Extras already in the fridge stay there; only portions added here (or a meal the new
    // dates pushed off a taken slot) look for a free slot.
    fillFreeSlots(next,b,b.useBy,meals.length+Math.max(0,b.portions-old.portions));
  } else {next.batches.push(b);fillFreeSlots(next,b);}
  if(recipeById[b.recipeId].kind==='snack'||typeOf(b.startSlot).startsWith('snack')) next.showSnacks=true;
  return next;
}

// Snack slots per gap (Show snacks → "1 between meals" / "2 between meals"). Going down to one,
// a meal or a skip still on a second snack slot is named (move it first); a batch that only
// started on one (its meal since moved or skipped) now starts on the first snack slot of that
// gap: same day, so the same cook day and enjoy-by.
export function setSnackCount(state,n) {
  state=allocated(state);
  if(![1,2].includes(n)) throw Error('Choose 1 or 2 snack slots.');
  const next=structuredClone(state);next.snackCount=n;
  if(n===1) {
    const second=id=>typeOf(id).endsWith('-2'),skips=skipsOf(state);
    const held=[...Object.keys(state.placements).filter(second).map(id=>`${titleOf(state.batches.find(b=>b.id===state.placements[id]))} (${slotName(id,state.week)})`),
      ...Object.keys(skips).filter(second).map(id=>`the skip on ${slotName(id,state.week)}`)];
    if(held.length) throw Error(`Move ${held.join(', ')} out of the second snack slots first.`);
    for(const b of next.batches) if(second(b.startSlot)) b.startSlot=slot(dayOf(b.startSlot),typeOf(b.startSlot).replace(/-2$/,'-1'));
  }
  return next;
}

// Removing batches frees their slots.
export function removeBatches(state,batchIds) {
  const next=structuredClone(allocated(state)),gone=new Set(batchIds);
  next.batches=next.batches.filter(b=>!gone.has(b.id));
  for(const [id,bid] of Object.entries(next.placements)) if(gone.has(bid)) delete next.placements[id];
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
    if(!obj(b)||typeof b.id!=='string'||!/^[\w-]{1,80}$/.test(b.id)||ids.has(b.id)||!Object.hasOwn(recipeById,b.recipeId)||!validSlot(b.startSlot)||!activeTypes(s.snackCount).includes(typeOf(b.startSlot))||!date(b.useBy)||b.useBy>addDays(dayOf(b.startSlot),8)||!Number.isFinite(b.scale)||b.scale<0.25||b.scale>4||!Number.isInteger(b.portions)||b.portions<1||b.portions>30) fail();
    if(b.autoPlanned!==undefined&&typeof b.autoPlanned!=='boolean')fail();
    if(b.prepAhead!==undefined&&typeof b.prepAhead!=='boolean')fail();
    if(b.nightBefore!==undefined&&typeof b.nightBefore!=='boolean')fail();
    if(b.prepDate!==undefined&&(!date(b.prepDate)||b.prepDate>dayOf(b.startSlot)||b.prepDate<addDays(dayOf(b.startSlot),-7)))fail();
    // Enjoy-by can't be before the food is cooked (it may be before a meal eaten "mushy").
    if(b.useBy<(b.prepDate||(b.prepAhead||b.nightBefore?addDays(dayOf(b.startSlot),-1):dayOf(b.startSlot))))fail();
    if(b.priority!==undefined&&(!Number.isInteger(b.priority)||b.priority<1||b.priority>1000000))fail();
    // Older saves may carry remembered dates (b.home); they are dropped.
    if(b.mealTypes!==undefined&&(!Array.isArray(b.mealTypes)||!b.mealTypes.length||b.mealTypes.length>3||b.mealTypes.some(t=>!['breakfast','lunch','dinner'].includes(t))))fail();
    ids.add(b.id);return {id:b.id,recipeId:b.recipeId,startSlot:b.startSlot,useBy:b.useBy,scale:b.scale,portions:b.portions,...(b.autoPlanned?{autoPlanned:true}:{}),...((b.prepAhead||b.nightBefore)&&!b.prepDate?{prepAhead:true}:{}),...(b.nightBefore&&!b.prepDate?{nightBefore:true}:{}),...(b.prepDate?{prepDate:b.prepDate}:{}),...(b.priority?{priority:b.priority}:{}),...(b.mealTypes?{mealTypes:[...new Set(b.mealTypes)]}:{})};
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
    if(!obj(input.placements)) fail();
    const byId=Object.fromEntries(s.batches.map(b=>[b.id,b]));
    s.placements={};
    // Any food may be in any slot, on any day; one thing per slot. (Older saves' input.auto,
    // the pin record, is ignored.)
    for(const [id,bid] of Object.entries(input.placements)) {
      const b=byId[bid];
      if(!validSlot(id)||!b||!activeTypes(s.snackCount).includes(typeOf(id))||Object.hasOwn(s.skipped,id)) fail();
      s.placements[id]=bid;
    }
    for(const b of s.batches) if(mealsOf(s.placements,b.id).length>b.portions) fail();
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
