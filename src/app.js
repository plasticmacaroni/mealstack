import {ingredientAliases,normalizeIngredientName} from './ingredient-identity.js';
import {pantryChoices,pantryGap,updatePantry} from './pantry.js';
import {packageSize,packageLabel,packageMeasure,packageValue,packageAmount,isDrained} from './packages.js';
import {endOfDay} from './day-summary.js';
import {inventoryProjection,stockQuantity} from './inventory.js';
import {LOW_CLEANUP_LIMIT,preparationDays,cookingKey,readCookingProgress} from './workflow.js';
import {cleanupFor} from './equipment.js';
import {pantryMeasure,pantryValue,pantryAmount,pantryShortfall,formatNumber} from './measurements.js';
import {RECIPES,INGREDIENTS,SOURCES,METHOD_NAMES,DATA_NOTE} from './data.js';
import {recipeById,localDate,addDays,monday,slot,dayOf,preparationDate,typeOf,SLOT_LABELS,TYPES,activeTypes,money,price,ingredientCost,batchCost,yieldFor,quantity,emptyState,makeBatch,demoState,schedule,choosePortion,placeBatch,unpin,addBatchAt,shopping,validateState,currentRecipeId} from './engine.js';
import {cookingSteps,STORAGE_GUIDANCE,SAFETY_URL,STORAGE_URL} from './cookbook.js';
import {matchesQuery,parseQuery,CRAVINGS,featuredOrder} from './discovery.js';
import {suggestPlan,planningWeek,AISLES,aisleFor} from './planning.js';
import {count,pluralize} from './text.js';
import {ingredientRat,IR_CSS,IR_TOKENS} from './ingredient-rats.js';
import {watchRats} from './rat-watch.js';
import {injectMascots,rat,ratLive,deco,icon as uiIcon} from './mascots.js';
import {reduceMotion,markViewEnter,runFlashes,flashAfterRender,fx,hop,syncLoops,fetchCard,duck} from './motion.js';

const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORE='mealstack.v1';
let state,loadError='',hasSavedPlan=false;
try {const raw=localStorage.getItem(STORE);hasSavedPlan=!!raw;state=raw?validateState(JSON.parse(raw)):emptyState();} catch {state=emptyState();loadError='Your saved plan could not be opened. An empty week is shown; the old save has not been overwritten.';}
const ui={view:'week',plannerView:'calendar',ingredient:null,q:'',kind:'all',method:'all',protein:'all',sort:'featured',cheap:false,quick:false,easy:false,onepot:false,dump:false,veg:false,favorites:false,pick:null,history:[],isExample:false,firstRun:!hasSavedPlan&&!loadError,showLibrary:true,shoppingMode:true,stockMode:false,stockDays:{},dayOpen:null,showUsedStock:false,hideBought:false,pantryQuery:'',pantryAll:false,pantryEdits:0,cookProgress:{},recentPlans:[]};
const MATCH_INGREDIENTS_STORE='mealstack.match-ingredients';
ui.matchIngredients=true;
try {ui.matchIngredients=localStorage.getItem(MATCH_INGREDIENTS_STORE)!=='false';} catch {}
const COOKING_STORE='mealstack.cooking.v1';
try {ui.cookProgress=readCookingProgress(localStorage.getItem(COOKING_STORE));} catch {}
// Keep only a small recipe-ID history; previews never mutate the saved meal plan.
const RECENT_PLANS_STORE='mealstack.recent-plans.v1';
try {const saved=JSON.parse(localStorage.getItem(RECENT_PLANS_STORE)||'[]');if(Array.isArray(saved))ui.recentPlans=saved.slice(-12).filter(ids=>Array.isArray(ids)&&ids.length<=200).map(ids=>ids.map(currentRecipeId)).filter(ids=>ids.every(id=>Object.hasOwn(recipeById,id)));} catch {}
const fmt=(date,options)=>new Date(date+'T12:00:00').toLocaleDateString('en-US',options);
const shortDate=date=>fmt(date,{month:'short',day:'numeric'});
const days=()=>Array.from({length:7},(_,i)=>addDays(state.week,i));
const estimate=r=>state.estimates[r.id]||{active:r.active,total:r.total,cleanup:r.dishes.length};
const colors=r=>`--h:${r.hue}`;
// Recipe photos: lazy, fixed intrinsic size (no layout shift), and a flat hue tile with a rat when missing.
const ratFor=r=>['sit','chef','cheese','love','wave','basket'][r.id.length%6];
// A photo that fails to load (a server hiccup, a dropped connection) shows the tile while it is retried: twice after a
// short wait, then again whenever the connection returns, the page becomes visible or the view changes. Nothing is
// ever blacklisted for the session; a successful retry swaps the real photo into every tile waiting for it.
const RETRY_MS=[800,3000],photoRetries=new Map(); // src -> {tries,timer,loading}
const fallbackTile=(r,cls='',src='')=>`<span class="card-img card-fallback ${cls}" aria-hidden="true" data-rat="${ratFor(r)}"${src?` data-src="${esc(src)}" data-cls="${esc(cls)}"`:''}>${rat(ratFor(r))}</span>`;
const photoTag=(src,cls,ratPose)=>`<img class="card-img ${cls}" src="${esc(src)}" alt="" loading="lazy" decoding="async" width="600" height="450" draggable="false" data-rat="${ratPose}">`;
const media=(r,cls='')=>{if(r.photo===false)return fallbackTile(r,cls);const src=r.image||`assets/recipes/${r.id}.webp`;return photoRetries.has(src)?fallbackTile(r,cls,src):photoTag(src,cls,ratFor(r));};
function photoFailed(src) {
  const p=photoRetries.get(src)||{tries:0,timer:0,loading:false};photoRetries.set(src,p);
  if(p.timer||p.loading||p.tries>=RETRY_MS.length)return; // after the quick retries, wait for a wake-up below
  p.timer=setTimeout(()=>{p.timer=0;retryPhoto(src);},RETRY_MS[p.tries]);
}
function retryPhoto(src) {
  const p=photoRetries.get(src);if(!p||p.loading)return;
  p.tries++;p.loading=true;const probe=new Image();
  probe.onload=()=>{photoRetries.delete(src);for(const tile of document.querySelectorAll('.card-fallback[data-src]'))if(tile.dataset.src===src)tile.outerHTML=photoTag(src,tile.dataset.cls||'',tile.dataset.rat||'sit');};
  probe.onerror=()=>{p.loading=false;photoFailed(src);};
  probe.src=src;
}
function wakePhotos() {for(const [src,p] of photoRetries)if(!p.timer&&!p.loading){p.tries=0;retryPhoto(src);}}
if(typeof document!=='undefined'){
  document.addEventListener('error',e=>{const img=e.target;if(!(img instanceof HTMLImageElement)||!img.classList.contains('card-img'))return;const src=img.getAttribute('src');
    const tile=document.createElement('span');tile.className=`${img.className} card-fallback`;tile.setAttribute('aria-hidden','true');tile.dataset.rat=img.dataset.rat||'sit';tile.dataset.src=src;tile.dataset.cls=img.className.replace(/\bcard-img\b/,'').trim();tile.innerHTML=rat(tile.dataset.rat);img.replaceWith(tile);photoFailed(src);},true);
  addEventListener('online',wakePhotos);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)wakePhotos();});
}
// Ingredient rats: tiny inline icons before ingredient names (decorative, aria-hidden).
const IR_ALIAS={herbs:'italianHerbs',longRice:'rice'};
const irat=id=>ingredientRat(IR_ALIAS[id]||id,'ing-rat');
const ingName=(id,name,tag='span')=>`<span class="ing">${irat(id)}<${tag}>${esc(name)}</${tag}></span>`;
function injectIngredientRats() {
  if(document.getElementById('ir-style'))return;
  // Tokens live on :root (dark default, light override) like styles.css; --outline is renamed so the app's own outline token is untouched.
  // Dark mode: instead of the 4x drop-shadow halo (a filter per icon, measurably slower to repaint), the lines turn a
  // flat light lilac while the eyes stay dark ink, so the outline reads on the dark page at no paint cost.
  const vars=(t,extra)=>Object.entries({...t,...extra}).map(([k,v])=>k==='--outline'?`--ir-outline:${v}`:`${k}:${v}`).join(';');
  const style=document.createElement('style');style.id='ir-style';
  style.textContent=`:root,:root[data-theme="dark"]{${vars(IR_TOKENS.dark,{'--outline':'#B7A3EA','--ir-ink':IR_TOKENS.dark['--outline'],'--ir-halo':'none'})}}:root[data-theme="light"]{${vars(IR_TOKENS.light,{'--ir-ink':IR_TOKENS.light['--outline'],'--ir-halo':'none'})}}.ir{--outline:var(--ir-outline)}${IR_CSS}.ir .ink{fill:var(--ir-ink)}@media print{.ir{--outline:#000;--ir-ink:#000}}`;
  document.head.append(style);
}
const recipeByTitle=Object.fromEntries(RECIPES.map(r=>[r.title,r]));
const usedChip=t=>`<span class="used-chip">${recipeByTitle[t]?media(recipeByTitle[t],'mini'):''}${esc(t)}</span>`;
const mealCounts=Object.fromEntries(['main','breakfast','snack'].map(kind=>[kind,RECIPES.filter(r=>r.kind===kind).length]));
const searchTerms=query=>parseQuery(query);
const matchesMeal=(recipe,terms)=>matchesQuery(recipe,terms,{prices:state.prices,packageSizes:state.packageSizes,estimates:state.estimates,avoid:state.avoid});
// Tone adds a small aria-hidden mascot; the message itself always lives in .toast-text.
const toast=(message,tone='',action=null)=>{const t=$('#toast'),text=document.createElement('span');t.dataset.tone=tone;t.innerHTML=tone==='success'?rat('cheer','toast-rat'):tone==='error'?rat('worry','toast-rat'):'';text.className='toast-text';text.textContent=message;t.append(text);
  // An optional one-tap follow-up (e.g. Undo) lives inside the toast and keeps it up a little longer.
  if(action){const b=document.createElement('button');b.type='button';b.className='toast-action';b.dataset.action=action.action;b.textContent=action.label;t.append(b);}t.classList.toggle('has-action',!!action);if(t.showPopover&&document.querySelector('dialog[open]')){try{t.hidePopover();t.showPopover();}catch{}}t.classList.add('visible');duck(t);setTimeout(()=>duck(t),260);clearTimeout(toast.timer);toast.timer=setTimeout(()=>{t.classList.remove('visible');duck(t);},action?9000:4500);};
function save() {try {localStorage.setItem(STORE,JSON.stringify(state));} catch {toast('Browser storage is unavailable. Export your plan to keep it.');}}
function commit(next,message) {try {next=validateState(next);} catch(e) {toast(e.message,'error');return false;} ui.history.push(structuredClone(state));if(ui.history.length>30)ui.history.shift();state=next;ui.isExample=false;save();render();if(message)toast(message,'success');return true;}
function mutate(fn,message) {const next=structuredClone(state);fn(next);return commit(next,message);}
function mealList() {
  const terms=searchTerms(ui.q);
  const list=RECIPES.filter(r=>(!ui.ingredient||r.ingredients.some(i=>i.id===ui.ingredient))&&(ui.kind==='all'||r.kind===ui.kind)&&(ui.method==='all'||r.method===ui.method)&&(ui.protein==='all'||r.protein===ui.protein)&&(!ui.cheap||batchCost(r,1,state.prices,state.packageSizes)/r.servings<=3)&&(!ui.quick||estimate(r).total<=30)&&(!ui.easy||estimate(r).cleanup<=LOW_CLEANUP_LIMIT)&&(!ui.onepot||r.onePot)&&(!ui.dump||r.dump)&&(!ui.veg||r.vegetableGrams>=100)&&(!ui.favorites||state.favorites.includes(r.id))&&matchesMeal(r,terms));
  if(ui.sort==='cost')list.sort((a,b)=>batchCost(a,1,state.prices,state.packageSizes)/a.servings-batchCost(b,1,state.prices,state.packageSizes)/b.servings);
  if(ui.sort==='time')list.sort((a,b)=>estimate(a).active-estimate(b).active||estimate(a).total-estimate(b).total);
  if(ui.sort==='cleanup')list.sort((a,b)=>estimate(a).cleanup-estimate(b).cleanup);
  if(ui.sort==='featured')return featuredOrder(list,localDate(),r=>state.favorites.includes(r.id));
  return list;
}
// Library + cooking decorations (aria-hidden, no text, hidden in print).
const FAV_HEART='<svg class="fav-heart" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20.3C5.2 16 2.6 12.1 2.6 8.7 2.6 5.8 4.8 3.7 7.5 3.7c1.9 0 3.5 1 4.5 2.6 1-1.6 2.6-2.6 4.5-2.6 2.7 0 4.9 2.1 4.9 5 0 3.4-2.6 7.3-9.4 11.6Z"/><path class="fav-shine" d="M6.4 7.4q.6-1.4 2-1.6"/></svg>';
const STEAM='<svg class="deco deco--steam live-steam" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="d-steam" d="M6 21q-3-4 0-8t0-8"/><path class="d-steam" d="M12 21q-3-4 0-8t0-8"/><path class="d-steam" d="M18 21q-3-4 0-8t0-8"/></svg>';
const BUBBLES='<svg class="deco cleanup-bubbles" viewBox="0 0 44 34" aria-hidden="true" focusable="false"><circle class="b-soap" cx="14" cy="21" r="9"/><circle class="b-soap" cx="29.5" cy="12" r="6.5"/><circle class="b-soap" cx="35" cy="27" r="4.2"/><path class="b-shine" d="M9 18.5a5.5 5.5 0 0 1 4.5-4.2M26.4 10a3.4 3.4 0 0 1 2.6-2"/></svg>';
function cookCheer(input,done,total) {
  const li=input.closest('li'),track=$('.cook-track');track?.style.setProperty('--p',done/total);track?.classList.toggle('all-done',done===total);
  li.classList.remove('just-done');if(!input.checked)return;void li.offsetWidth;li.classList.add('just-done');fx('spark',input);
  if(done===total){fx('confetti');hop($('.cook-rat'));toast('All steps complete. Enjoy your meal and pack the extra portions.','success');}
}
function mealCard(r) {const fav=state.favorites.includes(r.id);return `<article class="recipe-card" style="${colors(r)}" draggable="true" data-recipe="${r.id}">
  <div class="recipe-media">${media(r)}<button class="favorite-button ${fav?'selected':''}" data-action="favorite" data-id="${r.id}" aria-label="Favorite ${esc(r.title)}" aria-pressed="${fav}">${FAV_HEART}</button><button class="drag-handle" data-action="place" data-id="${r.id}" aria-label="Place ${esc(r.title)} on the week" title="Drag, or click then choose a slot">${uiIcon('drag')}</button><button class="recipe-title sticker" data-action="details" data-id="${r.id}">${esc(r.title)}</button></div>
  <div class="recipe-body"><p>${esc(r.description)}</p>
  <div class="recipe-price"><strong>${count(r.servings,r.kind==='snack'?'snack':'meal')}</strong><span>per batch · ${money(batchCost(r,1,state.prices,state.packageSizes)/r.servings)} / ${r.kind==='snack'?'snack':'meal'}</span></div>
  <div class="recipe-meta"><span title="Active / total time">◷ ${estimate(r).active}m active · ${estimate(r).total}m total</span><button class="cleanup-link" data-action="details" data-id="${r.id}" title="${state.estimates[r.id]?'Your saved cleanup estimate':'Includes prep, measuring tools, and one place setting'}">${estimate(r).cleanup} to wash</button></div>
  <div class="recipe-tags"><span class="recipe-equipment">${r.cookware.length?`${count(r.cookware.length,'cooking vessel')} · `:'No cooking · '}${r.vegetableGrams>=100?'Veg-forward':esc(r.protein)}</span><span class="recipe-fit-label">${r.storeBought?'Grab & go · eat cold':r.fit.lunch==='home'?'Best fresh / re-crisp at home':r.fit.lunch==='assemble'?'Pack components separately':'Microwave friendly'}</span></div><div class="recipe-bottom"><span>${r.dump?(r.method==='slow'?'Dump & slow cook':'Dump & bake'):r.onePot?'One pot':esc(METHOD_NAMES[r.method])} · ${count(r.steps.length,'step')}</span><button data-action="details" data-id="${r.id}" aria-label="See recipe for ${esc(r.title)}">Recipe & plan ↗</button></div></div>
  </article>`;}
function filters() {return `${ui.ingredient?`<div class="ingredient-search-note">Using <strong>${esc(INGREDIENTS[ui.ingredient].name)}</strong><button data-action="reset-filters" aria-label="Clear ingredient search">✕</button></div>`:''}<div class="search-wrap">${rat('peek','search-peek')}<span aria-hidden="true">⌕</span><input id="meal-search" type="search" placeholder="What are you hungry for?" aria-label="Search meals and details" aria-describedby="search-help" value="${esc(ui.q)}"></div><p id="search-help" class="search-help">Try “creamy pasta under $3” or “chicken without mushrooms”.</p><div class="craving-chips">${CRAVINGS.map(([label,q])=>`<button data-action="craving" data-id="${q}" class="${ui.q===q?'selected':''}" aria-pressed="${ui.q===q}">${label}</button>`).join('')}</div>
  <div class="kind-tabs" aria-label="Meal type">${[['all','All'],['main','Mains'],['breakfast','Breakfast'],['snack','Snacks']].map(([v,l])=>`<button data-action="kind" data-id="${v}" class="${ui.kind===v?'active':''}" aria-pressed="${ui.kind===v}">${l}</button>`).join('')}</div>
  <div class="filter-chips">${[['cheap','≤ $3 / portion'],['quick','≤ 30 min total'],['onepot','One pot'],['dump','Dump dinners'],['veg','Veg-forward'],['favorites','♥ Favorites'],['easy',`≤ ${LOW_CLEANUP_LIMIT} to wash`]].map(([v,l])=>`<button class="chip ${ui[v]?'selected':''}" aria-pressed="${ui[v]}" data-action="filter" data-id="${v}">${l}</button>`).join('')}</div><details class="avoid-filter more-filters" ${state.avoid||ui.method!=='all'||ui.protein!=='all'||ui.moreFilters?'open':''}><summary>More filters${state.avoid||ui.method!=='all'||ui.protein!=='all'?' · active':''}</summary><div class="filter-selects"><select id="method-filter" aria-label="Cooking method"><option value="all">Every cooking method</option>${Object.entries(METHOD_NAMES).map(([v,l])=>`<option value="${v}" ${ui.method===v?'selected':''}>${l}</option>`).join('')}</select><select id="protein-filter" aria-label="Protein"><option value="all">All proteins</option>${[...new Set(RECIPES.map(r=>r.protein))].sort().map(v=>`<option ${ui.protein===v?'selected':''}>${v}</option>`).join('')}</select></div><label>Ingredients to skip<input id="avoid-ingredients" placeholder="mushrooms, shrimp" maxlength="300" value="${esc(state.avoid)}"></label><p class="field-help">Comma-separated ingredients. Saved for search and suggestions. Check packaged-food labels for allergens.</p></details>${ui.veg||parseQuery(ui.q).vegetables?'<p class="search-help">Veg-forward = about 3½ oz or more non-starchy vegetables per portion; amounts are estimates.</p>':''}${ui.easy||Number.isFinite(parseQuery(ui.q).maxCleanup)?`<p class="search-help">Up to ${LOW_CLEANUP_LIMIT} pieces, including prep, measuring tools and one place setting.</p>`:''}${ui.ingredient||ui.q||ui.kind!=='all'||ui.method!=='all'||ui.protein!=='all'||['cheap','quick','easy','onepot','dump','veg','favorites'].some(k=>ui[k])?'<button class="text-button" data-action="reset-filters">Clear search & filters</button>':''}`;}
function library(large=false) {const list=mealList();return `<section class="library ${large?'expanded':''} ${ui.showLibrary?'':'collapsed'}" aria-label="Meal library"><div class="library-heading"><div><span class="eyebrow">A LITTLE INSPIRATION</span><h2>Find your next favorite<span class="count">${RECIPES.length}</span></h2></div>${large?'':'<button class="library-collapse icon-button" data-action="toggle-library" aria-label="Collapse meal library">−</button>'}</div>${filters()}<div class="library-results"><span>${count(list.length,'recipe')} <span class="muted">· costs estimated</span></span><select id="sort-filter" aria-label="Sort meals">${[['featured','Featured'],['cost','Lowest cost'],['time','Least effort'],['cleanup','Least cleanup']].map(([v,l])=>`<option value="${v}" ${ui.sort===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="library-scroll ${large?'meal-grid':''}">${list.map(mealCard).join('')||`<div class="empty-search">${ratLive('search','empty-rat')}${deco('sparkle','empty-spark s1 anim-twinkle')}${deco('sparkle','empty-spark s2 anim-twinkle')}<span>No meals match these filters.</span><button data-action="reset-filters" class="text-button">Reset filters</button></div>`}</div><p class="library-foot">${rat('sit','foot-rat')}Drag a meal onto your week, or open its details to add it.<br>Every recipe includes steps and cookware.</p></section>`;}
function portionCard(b,cell) {const r=recipeById[b.recipeId],prep=preparationDate(b),due=dayOf(cell.id)===b.useBy;return `<article class="portion" style="${colors(r)}" draggable="true" data-batch="${b.id}" data-from="${cell.id}"><div class="portion-media">${media(r)}<button class="drag-handle" data-action="move" data-id="${b.id}" data-from="${cell.id}" aria-label="Move batch start for ${esc(r.title)} from ${esc(SLOT_LABELS[typeOf(cell.id)])} ${shortDate(dayOf(cell.id))}" title="Move this batch’s start; all its portions will rebuild">${uiIcon('drag')}</button>${cell.manual?`<button class="pin-button" data-action="unpin" data-slot="${cell.id}" aria-label="Unpin ${esc(r.title)} from ${esc(SLOT_LABELS[typeOf(cell.id)])} ${fmt(dayOf(cell.id),{weekday:'long'})}" title="Unpin">${uiIcon('pin','pin-on')}${uiIcon('unpin','pin-off')}</button><span class="visually-hidden"> · pinned</span>`:''}<div class="portion-label"><button class="portion-name" data-action="batch" data-id="${b.id}" title="${esc(r.title)}">${esc(r.title)}</button><span class="portion-foot"><span>${prep<dayOf(cell.id)?(b.prepAhead&&b.startSlot===cell.id?'Prep night before':`Prepped ${shortDate(prep)}`):b.startSlot===cell.id?'Make batch':'Made today'}</span><span class="use-by ${due?'due':''}">${due?(dayOf(cell.id)===localDate(new Date())?'Eat today':'Last day'):`Enjoy by ${fmt(b.useBy,{weekday:'short'})}`}</span></span></div></div></article>`;}
function calendarCell(id,result,byId) {
  const cell=result.cells[id],type=typeOf(id),snack=type.startsWith('snack'),chosen=byId[cell?.chosen],alternates=cell?.alternatives||[];
  return `<div class="meal-slot ${snack?'snack-slot':''} ${ui.pick?'accepting':''}" data-slot="${id}" tabindex="0" role="group" aria-label="${esc(SLOT_LABELS[type])}, ${fmt(dayOf(id),{weekday:'long',month:'long',day:'numeric'})}. ${chosen?esc(recipeById[chosen.recipeId].title):'Empty'}. ${ui.pick?'Press Enter to place selected food.':''}"><div class="slot-label">${snack?SLOT_LABELS[type]:SLOT_LABELS[type]}${chosen?'<span class="filled-dot"></span>':''}</div>${chosen?portionCard(chosen,cell):`<button class="empty-slot" data-action="slot" data-slot="${id}" aria-label="Choose a meal for ${esc(SLOT_LABELS[type])} ${shortDate(dayOf(id))}"><span>＋</span><span>${ui.pick?'Place here':snack?'Optional':'Add a meal'}</span>${snack?'':rat('peek','slot-rat')}</button>`}${alternates.length?`<div class="alternatives"><span class="stack-label">ALSO IN THIS STACK</span>${alternates.map(c=>`<button class="alternative" style="${colors(recipeById[byId[c.id].recipeId])}" data-action="choose" data-id="${c.id}" data-slot="${id}" title="Choose this batch for this slot">${media(recipeById[byId[c.id].recipeId],'thumb')}<span>${esc(recipeById[byId[c.id].recipeId].title)} <b>${c.left} left</b></span></button>`).join('')}</div>`:''}</div>`;
}
// Prep is an event, not an eating slot: it never takes a portion from another meal.
function calendarPrep(date,result) {
  const batches=state.batches.filter(b=>b.prepDate===date&&(result.cells[b.startSlot]?.chosen!==b.id||date<dayOf(b.startSlot)));
  return batches.length?`<div class="day-prep" aria-label="Separate preparation for ${shortDate(date)}">${batches.map(b=>{
    const first=Object.values(result.cells).find(c=>c.chosen===b.id),r=recipeById[b.recipeId];
    return `<button class="prep-marker" data-action="batch" data-id="${b.id}"><span>Prep only <b>${count(b.portions,'portion')}</b></span><strong>${esc(r.title)}</strong><small>${first?`First meal · ${shortDate(dayOf(first.id))} ${SLOT_LABELS[typeOf(first.id)].toLowerCase()}`:'Meals still need a slot'}</small></button>`;
  }).join('')}</div>`:'';
}
// End of day: each day ends on a shelf. Closed, cooked portions stand on it as lidded tubs and food that needs using
// soon as ingredient rats with an urgency mark, named in one caption line. Open, a popover grows up over the day
// (phone: a bottom sheet) listing each food once: Use these first, Ready to eat, then the rest of the kitchen.
const DC_TAG={past:'Past date',now:'Today',soon:'Tmrw'},DC_SAY={past:'past date',now:'today',soon:'tomorrow'};
const DC_LIDS=['var(--candy-1)','var(--candy-4)','var(--candy-3)','var(--candy-5)','var(--candy-6)'],DC_TOKENS=4,DC_KITCHEN=9;
function daySummary(date,result) {
  const day=endOfDay(state,date,result),today=localDate(new Date()),open=ui.dayOpen===date,long=fmt(date,{weekday:'long'});
  const tone=useBy=>useBy<date?'past':useBy===date?'now':'soon';
  const batchOf=id=>state.batches.find(b=>b.id===id),qty=i=>stockQuantity(i.remaining,i.unit),wd=d=>fmt(d,{weekday:'short'});
  const dot=t=>`<i class="dc-dot is-${t}" aria-hidden="true"></i>`,tag=t=>`<span class="dc-tag is-${t}">${DC_TAG[t]}</span>`;
  // A past date is flagged on the day right after it and on today, not on every later day.
  const flags=day.expiries.filter(e=>e.useBy>=date||e.usedAfterDate||e.useBy===addDays(date,-1)||date===today);
  const flagOf=new Map(flags.map(e=>[e.kind+e.id,tone(e.useBy)]));
  // Shelf tokens: tubs for cooked food, rats for ingredients; when space runs out, the flagged ones stay.
  const tubs=[...day.ready,...day.past].filter(b=>day.ready.includes(b)||flagOf.has('batch'+b.id)).map(b=>({kind:'batch',b,t:flagOf.get('batch'+b.id)||''}));
  const rats=flags.filter(e=>e.kind==='ingredient').map(e=>({kind:'ingredient',e,t:tone(e.useBy)}));
  const all=[...tubs,...rats],keep=new Set([...all.filter(x=>x.t),...all.filter(x=>!x.t)].slice(0,DC_TOKENS));
  const lid=b=>DC_LIDS[Math.max(0,state.batches.indexOf(b))%DC_LIDS.length];
  const token=x=>x.kind==='batch'
    ?`<span class="dc-tub" style="--lid:${lid(batchOf(x.b.id)||x.b)}"><span class="dc-lid"></span>${media(recipeById[x.b.recipeId],'dc-tub-img')}${x.b.remaining>1?`<b class="dc-n">${x.b.remaining}</b>`:''}${x.t?dot(x.t):''}</span>`
    :`<span class="dc-shelf-rat">${irat(x.e.id)}${dot(x.t)}</span>`;
  const lc=s=>s.charAt(0).toLowerCase()+s.slice(1),bare=!day.portions&&!flags.length;
  const named=flags.length>1&&flags[0].name.length+flags[1].name.length<=26?2:1,names=flags.slice(0,named).map(e=>`<span class="dc-flag is-${tone(e.useBy)}">${esc(lc(e.name))}</span>`).join(', ');
  const label=`End of ${long}: ${count(day.portions,'portion')} ready, ${count(day.ingredients.length,'ingredient')} left${flags.length?`. Use soon: ${flags.map(e=>`${e.name} (${DC_SAY[tone(e.useBy)]})`).join(', ')}`:''}`;
  const shelf=`<button class="shelf ${bare?'is-bare':''}" data-action="day-close" data-id="${date}" aria-expanded="${open}" aria-controls="dc-panel-${date}" aria-label="${esc(label)}">
    <span class="dc-items" aria-hidden="true">${all.filter(x=>keep.has(x)).map(token).join('')}</span><span class="dc-plank" aria-hidden="true"></span>
    <span class="dc-cap">${day.portions?`<span class="dc-portions"><b>${day.portions}</b> ${pluralize(day.portions,'portion')} ready</span>`:'<span class="visually-hidden">0 portions ready</span>'}${flags.length?`<span class="dc-use">${dot(tone(flags[0].useBy))}<span>Use ${names}${flags.length>named?` <span class="dc-more">+${flags.length-named}</span>`:''}</span></span>`:''}</span></button>`;
  // Open: every food appears once.
  const soonIds=new Set(day.expiries.filter(e=>e.kind==='ingredient').map(e=>e.id)),dueBatches=new Set(day.expiries.filter(e=>e.kind==='batch').map(e=>e.id));
  const score=i=>(i.events.some(e=>e.date===date)?2:0)+(['Meat & seafood','Produce'].includes(aisleFor(i.id))?1:0);
  const rest=day.ingredients.filter(i=>!soonIds.has(i.id)).map((i,n)=>({i,n})).sort((a,b)=>score(b.i)-score(a.i)||a.n-b.n).map(x=>x.i);
  const ready=day.ready.filter(b=>!dueBatches.has(b.id)),worry=day.expiries.some(e=>e.useBy<date);
  const useRow=e=>{const t=tone(e.useBy),when=t==='past'?`was due ${shortDate(e.useBy)}`:t==='now'?'Use today':'Use by tomorrow';return e.kind==='batch'
    ?`<button class="day-close-date dc-row is-${t}" data-action="batch" data-id="${e.id}"><span class="dc-tok is-photo">${media(recipeById[batchOf(e.id).recipeId],'dc-thumb')}</span><span class="dc-row-main"><b class="dc-row-name">${esc(e.name)}</b><small>${count(e.remaining,'portion')} · <span class="dc-when">${t==='past'?when:`eat by ${wd(e.useBy)}`}</span></small></span>${tag(t)}</button>`
    :`<button class="day-close-date dc-row is-${t}" data-action="ingredient-date" data-id="${e.id}" aria-label="${esc(e.name)}, ${qty(e)} left, use by ${shortDate(e.useBy)}"><span class="dc-tok">${irat(e.id)}</span><span class="dc-row-main"><b class="dc-row-name">${esc(e.name)}</b><small>${e.remaining>0?qty(e):'Used up today'} · <span class="dc-when">${when}</span></small></span>${tag(t)}</button>`;};
  const sub=[day.portions?`${count(day.portions,'portion')} ready`:'',day.expiries.length?`${count(day.expiries.length,'thing')} to use up`:''].filter(Boolean).join(' · ')||(day.ingredients.length?`${count(day.ingredients.length,'ingredient')} still in the kitchen`:'Nothing left over');
  const panel=`<section class="day-close-body" id="dc-panel-${date}" role="dialog" aria-labelledby="dc-title-${date}" tabindex="-1" ${open?'':'hidden'}>
    <header class="dc-head"><span class="dc-day" aria-hidden="true"><span>${wd(date)}</span><b>${fmt(date,{day:'numeric'})}</b></span><div class="dc-title"><h3 id="dc-title-${date}">End of ${long}</h3><p>${sub}</p></div><button class="icon-button dc-x" data-action="day-close-x" aria-label="Close end of ${long}">✕</button></header>
    <div class="dc-body">${day.expiries.length?`<section class="dc-sec"><h4>${worry?ratLive('worry','dc-worry-rat'):''}Use these first</h4>${day.expiries.map(useRow).join('')}<p class="dc-hint">Tap one to change its date or mark it used.</p></section>`:''}
    ${ready.length?`<section class="dc-sec"><h4>${dueBatches.size?'Also ready to eat':'Ready to eat'}</h4><div class="dc-meals">${ready.map(b=>`<button class="day-close-meal dc-row dc-meal" data-action="batch" data-id="${b.id}">${media(recipeById[b.recipeId],'dc-meal-img')}<span class="dc-meal-label"><b>${esc(b.title)}</b><small>${count(b.remaining,'portion')} · by ${wd(b.useBy)}</small></span></button>`).join('')}</div>${ready.some(b=>dayOf(b.startSlot)>addDays(state.week,6))?'<p class="dc-hint">Prep for next week uses next week’s groceries.</p>':''}</section>`:''}
    ${rest.length?`<section class="dc-sec"><h4>Still in the kitchen <span class="dc-count">${rest.length}</span></h4><div class="dc-chips">${rest.map((i,n)=>`<button class="day-close-ingredient dc-chip ${n>=DC_KITCHEN?'is-extra':''}" data-action="ingredient-date" data-id="${i.id}" aria-label="${esc(i.name)}, ${qty(i)} left${i.useBy?`, use by ${shortDate(i.useBy)}`:', add package date'}">${irat(i.id)}<span>${esc(i.name)}</span><b>${qty(i)}</b></button>`).join('')}</div><p class="dc-hint">Tap one to add or change its use-by date.</p></section>`:''}
    ${!day.expiries.length&&!ready.length&&!rest.length?`<p class="dc-calm">${ratLive('sleep','dc-calm-rat')}<span>Nothing left over and nothing about to go off.</span></p>`:''}
    </div>${day.ingredients.length?`<footer class="dc-foot"><button class="text-button dc-all" data-action="day-stock" data-id="${date}">All ${count(day.ingredients.length,'ingredient')} in Food left ↗</button></footer>`:''}</section>`;
  return `<div class="day-close ${open?'is-open':''} ${days().indexOf(date)>=4?'is-flip':''}" data-day-close="${date}">${shelf}<div class="dc-scrim" data-action="day-close-x" ${open?'':'hidden'}></div>${panel}</div>`;
}
const isPhone=()=>matchMedia('(max-width:760px)').matches;
// One day's detail is open at a time; the choice survives re-renders. Opening moves focus in, closing returns it.
function setDayOpen(date,{focus=false}={}) {
  const prev=ui.dayOpen;ui.dayOpen=date||null;
  document.querySelectorAll('.day-close').forEach(el=>{const on=el.dataset.dayClose===ui.dayOpen;el.classList.toggle('is-open',on);el.querySelector('.shelf')?.setAttribute('aria-expanded',on);
    for(const part of el.querySelectorAll('.day-close-body,.dc-scrim'))part.hidden=!on;});
  const wrap=$('.day-close.is-open');
  if(wrap){placeDayPanel(true);const panel=wrap.querySelector('.day-close-body');
    if(!reduceMotion()){panel.classList.remove('dc-enter');void panel.offsetWidth;panel.classList.add('dc-enter');panel.addEventListener('animationend',()=>panel.classList.remove('dc-enter'),{once:true});}
    if(focus)panel.focus({preventScroll:true});}
  else if(focus&&prev)document.querySelector(`.day-close[data-day-close="${prev}"] .shelf`)?.focus({preventScroll:true});
}
// Desktop popover: grows up over its day, wide enough for rows to sit on one line, kept inside the week grid and the
// viewport, with its pointer on the shelf. Phone: a fixed bottom sheet, placed by CSS.
function placeDayPanel(reveal=false) {
  const wrap=$('.day-close.is-open'),panel=wrap?.querySelector('.day-close-body');if(!panel)return;
  panel.style.removeProperty('width');panel.style.removeProperty('max-height');panel.style.removeProperty('--dx');panel.style.removeProperty('--px');
  if(isPhone()||matchMedia('print').matches)return;
  const shelf=wrap.querySelector('.shelf').getBoundingClientRect(),col=wrap.closest('.day-column'),head=col.querySelector('.day-heading').getBoundingClientRect(),board=$('.week-scroll').getBoundingClientRect();
  const lo=Math.max(8,board.left+2),hi=Math.min(innerWidth-8,board.right-4),colW=col.getBoundingClientRect().width;
  panel.style.width=`${Math.round(Math.min(hi-lo,Math.max(440,Math.min(580,colW*3.2))))}px`;
  panel.style.maxHeight=`${Math.round(Math.max(260,Math.min(640,shelf.top-head.bottom-24,innerHeight-shelf.height-40)))}px`;
  const r=panel.getBoundingClientRect();let dx=0;if(r.right>hi)dx=hi-r.right;if(r.left+dx<lo)dx=lo-r.left;
  panel.style.setProperty('--dx',`${Math.round(dx)}px`);
  panel.style.setProperty('--px',`${Math.round(Math.max(28,Math.min(r.width-28,shelf.left+shelf.width/2-r.left-dx)))}px`);
  if(reveal){const top=panel.getBoundingClientRect().top,gap=top<10?top-10:shelf.bottom>innerHeight-8?shelf.bottom-innerHeight+12:0;if(gap)scrollBy({top:gap,behavior:reduceMotion()?'instant':'smooth'});}
}
addEventListener('resize',()=>placeDayPanel(),{passive:true});
document.addEventListener('scroll',e=>{if(ui.dayOpen&&e.target.classList?.contains('week-scroll'))placeDayPanel();},{capture:true,passive:true});
// A desktop popover closes when you click elsewhere (the phone sheet has its own scrim).
document.addEventListener('pointerdown',e=>{if(ui.dayOpen&&!isPhone()&&!e.target.closest('.day-close.is-open,dialog,#toast,.fetch-layer'))setDayOpen(null);});
// "What's next": today's cooking, tomorrow's packed lunch and the shopping run, each one tap away.
function nextUp() {
  const now=new Date(),today=localDate(now),tomorrow=addDays(today,1),current={...state,week:monday(today)};
  const groups=preparationDays(current),todays=groups.find(g=>g.date===today)?.batches||[];
  const lunchWeek=monday(tomorrow)===current.week?current:{...state,week:monday(tomorrow)};
  const lunchId=schedule(lunchWeek).cells[slot(tomorrow,'lunch')]?.chosen,items=[];
  const later=now.getHours()>=14;
  for(const b of todays){const r=recipeById[b.recipeId];items.push({action:'cook-batch',id:b.id,r,label:`${later||b.prepAhead?'Tonight':'Today'}: cook ${r.title}`,sub:b.id===lunchId?'Pack tomorrow’s lunch while you’re at it':`${count(b.portions,'meal')} · ${b.estimates?.active??estimate(r).active} min hands-on`});}
  const lunch=state.batches.find(b=>b.id===lunchId);
  if(lunch&&!todays.some(b=>b.id===lunchId))items.push({action:'batch',id:lunch.id,r:recipeById[lunch.recipeId],label:'Pack tomorrow’s lunch',sub:recipeById[lunch.recipeId].title});
  const g=shopping(state),toBuy=g.items.filter(i=>i.remainingPacks>0).length;
  if(toBuy)items.push({action:'go-shop',icon:'basket',label:`Shop ${count(toBuy,'thing')}`,sub:`About ${money(g.remainingCost)} · checklist ready`});
  if(!todays.length){const next=groups.find(g=>g.date>today);if(next){const b=next.batches[0],r=recipeById[b.recipeId];items.push({action:'cook-batch',id:b.id,r,label:`Next cook: ${fmt(next.date,{weekday:'long'})}`,sub:r.title});}}
  return items;
}
// A brand-new visitor starts on an empty week with one big, friendly button.
const welcome=()=>`<section class="home-top home-welcome" aria-label="Welcome"><span class="welcome-art" aria-hidden="true">${ratLive('wave','welcome-rat')}${deco('sparkle','welcome-deco w1 anim-twinkle')}${deco('heart','welcome-deco w2')}${deco('sparkle','welcome-deco w3 anim-twinkle')}</span><span class="eyebrow">WELCOME TO MEALSTACK</span><h1>Let’s plan your week.</h1><p>One tap picks cheap, easy meals and writes your grocery list. Change anything after, or undo.</p><button class="primary plan-cta" data-action="auto-plan">${deco('sparkle','cta-spark')}<span>Plan my week</span></button><button class="text-button plan-fine" data-action="suggest-plan">Preview & fine-tune</button></section>`;
function homeTop() {
  if(ui.firstRun&&!state.batches.length)return welcome();
  const items=nextUp(),planned=state.batches.length>0,cooking=items.some(i=>i.action==='cook-batch'&&/^(Today|Tonight)/.test(i.label));
  const mascot=!items.length?ratLive('sleep','next-rat'):cooking?ratLive('chef','next-rat'):items[0].action==='go-shop'?ratLive('cart','next-rat'):ratLive('wave','next-rat');
  const list=items.length?`<ul class="next-list">${items.map(i=>`<li><button class="next-item" data-action="${i.action}" ${i.id?`data-id="${esc(i.id)}"`:''}><span class="next-thumb" aria-hidden="true">${i.r?media(i.r,'thumb'):uiIcon(i.icon)}</span><span class="next-text"><strong>${esc(i.label)}</strong><small>${esc(i.sub)}</small></span><span class="next-go" aria-hidden="true">→</span></button></li>`).join('')}</ul>`
    :`<p class="next-empty"><strong>${planned?'Nothing to do today':'Nothing planned yet'}</strong><span>${planned?'Put your feet up. Everything is handled.':'One tap and I’ll pick cheap, easy meals and write your list.'}</span></p>`;
  return `<section class="home-top" aria-label="What’s next"><div class="next-card"><div class="next-head"><span class="next-art" aria-hidden="true">${mascot}</span><div><span class="eyebrow">WHAT’S NEXT</span><h1>${items.length?(cooking?'Here’s tonight.':'Here’s what’s up.'):planned?'All clear.':'Let’s plan your week.'}</h1></div></div>${list}</div>
    <div class="plan-card"><span class="plan-art" aria-hidden="true">${rat('love','plan-rat')}</span><button class="primary plan-cta" data-action="auto-plan">${deco('sparkle','cta-spark')}<span>Plan my week</span></button><p class="plan-card-note">Cheap, easy meals · groceries listed · undo anytime</p><button class="text-button plan-fine" data-action="suggest-plan">Preview & fine-tune</button></div></section>`;
}
const DEFAULT_PLAN_OPTIONS={budget:100,maxCost:3,maxActive:20,style:'simple',meals:['lunch','dinner']};
// One tap: plan with her saved (or default) settings, apply it, and offer Undo. The preview dialog stays one tap away.
function autoPlan() {
  const proposal=generatePlan({...(ui.planOptions||DEFAULT_PLAN_OPTIONS),matchIngredients:ui.matchIngredients});
  if(!proposal.added.length){toast(proposal.unfilled?'Nothing new fits right now. Try Preview & fine-tune.':'Your week is already full.');return;}
  ui.view='week';ui.plannerView='calendar';
  if(commit(proposal.state)){toast(`Planned! ${count(proposal.added.length,'easy batch','easy batches')}, groceries listed.`,'success',{action:'undo',label:'Undo'});fx('confetti');hop($('.next-rat'));}
}
function ingredientDateDialog(id) {
  const ingredient=INGREDIENTS[id];if(!ingredient)return;
  const useBy=state.ingredientDates[state.week]?.[id]||'';
  dialog('Ingredient date',`<form id="ingredient-date-form" data-id="${id}"><p class="package-name">${esc(ingredient.name)}</p><label>Use by / freeze by<input name="useBy" type="date" min="2000-01-01" max="2099-12-31" value="${useBy}"></label><p class="field-help">Use the date on your package or your own use-first reminder. For several packages, use the earliest date you need to watch. Leave blank to clear. This date belongs to the shopping week of ${shortDate(state.week)}.</p><div class="modal-actions"><button type="button" class="text-button" data-action="date-find-meals" data-id="${id}">Find meals using this ↗</button><button type="submit" class="primary">Save date</button></div></form>`);
}
function planner() {
  const result=schedule(state),byId=Object.fromEntries(state.batches.map(b=>[b.id,b]));
  const relevant=state.batches.filter(b=>dayOf(b.startSlot)<=addDays(state.week,6)&&b.useBy>=state.week);
  const pending=relevant.filter(b=>result.remaining[b.id]>0);
  const upcoming=state.batches.filter(b=>dayOf(b.startSlot)>addDays(state.week,6)).sort((a,b)=>a.startSlot.localeCompare(b.startSlot));
  const filled=days().reduce((sum,d)=>sum+['breakfast','lunch','dinner'].filter(t=>result.cells[slot(d,t)]?.chosen).length,0);
  const groceries=shopping(state);
  const snacks=days().reduce((n,d)=>n+activeTypes(state.snackCount).filter(t=>t.startsWith('snack')&&result.cells[slot(d,t)]?.chosen).length,0);
  return `<section class="planner" aria-label="Weekly meal planner"><div class="week-toolbar"><div class="week-title"><span class="eyebrow">YOUR WEEK, ONE PORTION AT A TIME</span><div class="week-navigation"><h2>${shortDate(state.week)} – ${shortDate(addDays(state.week,6))}</h2><div><button class="icon-button" data-action="prev-week" aria-label="Previous week">‹</button><button class="icon-button" data-action="next-week" aria-label="Next week">›</button></div></div></div>${state.week!==monday(localDate())?'<div class="week-actions"><button class="text-button today-button" data-action="today">This week</button></div>':''}</div>
  <p class="week-summary"><span><b>${filled}</b>/21 meals</span><span><b>${relevant.length}</b> ${pluralize(relevant.length,'batch')}</span><span title="Cost of quantities used by batches starting this week, including pantry ingredients. Not your checkout total."><b>${money(groceries.used)}</b> of food</span></p>
  <div class="planner-tools"><div class="segmented" aria-label="Week view"><button data-action="planner-view" data-id="calendar" aria-pressed="${ui.plannerView==='calendar'}" class="${ui.plannerView==='calendar'?'selected':''}">Meal calendar</button><button data-action="planner-view" data-id="prep" aria-pressed="${ui.plannerView==='prep'}" class="${ui.plannerView==='prep'?'selected':''}">Cooking & packing</button></div></div>
  ${ui.plannerView==='prep'?preparationView():''}<div class="calendar-panel" ${ui.plannerView==='prep'?'hidden':''}>
  <div class="board-controls"><div><label class="toggle"><input id="show-snacks" type="checkbox" ${state.showSnacks?'checked':''}><span></span>Show snacks${snacks&&!state.showSnacks?` (${snacks} planned)`:''}</label>${state.showSnacks?`<select id="snack-count" aria-label="Snack slots per gap"><option value="2" ${state.snackCount===2?'selected':''}>2 between meals</option><option value="1" ${state.snackCount===1?'selected':''}>1 between meals</option></select>`:''}</div><div><button class="text-button undo-button" data-action="undo" ${!ui.history.length?'disabled':''}>↶ Undo</button><button class="text-button clear-week" data-action="clear">Clear week</button></div></div>
  ${ui.pick?`<div class="placement-banner">${rat('sit','banner-rat')}<span><strong>${ui.pick.kind==='recipe'?'Place a new batch':ui.pick.kind==='portion'?'Move one portion':'Move batch start'}:</strong> ${esc(recipeById[ui.pick.kind==='recipe'?ui.pick.id:byId[ui.pick.id]?.recipeId]?.title||'meal')} · choose any slot</span><button data-action="cancel-pick" aria-label="Cancel placing">✕</button></div>`:''}
  ${ui.isExample?`<div class="demo-banner">${ratLive('wave','banner-rat')}<span>An example week to play with. Drag a meal from the library, or clear the week and start your own.</span></div>`:''}
  <nav class="day-jumps" aria-label="Jump to day">${days().map(d=>`<button data-action="jump-day" data-id="${d}" class="${d===localDate()?'is-today':''}" aria-label="Show ${fmt(d,{weekday:'long'})}, ${shortDate(d)}"><span>${fmt(d,{weekday:'short'})}</span><b>${fmt(d,{day:'numeric'})}</b></button>`).join('')}</nav><div class="week-scroll"><div class="week-grid">${days().map(d=>`<section data-day="${d}" class="day-column ${d===localDate()?'is-today':''}" aria-label="${fmt(d,{weekday:'long'})}"><header class="day-heading"><span>${fmt(d,{weekday:'short'})}</span><b>${fmt(d,{day:'numeric'})}</b>${d===localDate()?`${rat('face','today-rat')}<span class="today-dot">TODAY</span>`:''}</header>${activeTypes(state.snackCount).filter(t=>state.showSnacks||!t.startsWith('snack')).map(t=>calendarCell(slot(d,t),result,byId)).join('')}${calendarPrep(d,result)}${daySummary(d,result)}</section>`).join('')}</div></div>
  <div class="planner-footer"><span><i class="legend-dot"></i> Drag a card to move its batch’s start. Its portions rebuild around your drop.</span><button class="text-button mobile-library" data-action="toggle-library">${ui.showLibrary?'Hide':'Browse'} meal ideas</button><button class="text-button" data-action="how">How it works ↗</button></div>
  <section class="batches-section"><div class="section-heading">${rat('cheese','section-rat')}<div><span class="eyebrow">BATCH OVERVIEW</span><h3>Your batches</h3></div><span>${(n=>n?`${count(n,'portion won’t','portions won’t')} get eaten in time`:'Every portion gets eaten in time')(pending.reduce((n,b)=>n+result.remaining[b.id],0))}</span></div><div class="batch-list">${relevant.map(b=>{const r=recipeById[b.recipeId],left=result.remaining[b.id]||0;return `<button class="batch-pill" style="${colors(r)}" draggable="true" data-batch="${b.id}" title="Drag to move this batch’s start, or open its recipe" data-action="batch" data-id="${b.id}"><span class="batch-thumb">${media(r)}</span><span><strong>${esc(r.title)}</strong><small>${count(b.portions,'portion')} · ${shortDate(dayOf(b.startSlot))} → ${shortDate(b.useBy)}</small><small class="${left?'warning-text':''}">${left?`${count(left,'unplaced portion')} won’t get eaten in time · move the batch or make less`:'You’ll eat every portion before it goes bad'}</small></span><span>↗</span></button>`;}).join('')||`<p class="empty-batches">${ratLive('sleep','empty-rat')}<span>Add your first batch from the meal library. Its portions will fill the next suitable slots.</span></p>`}</div>${upcoming.length?`<button class="text-button upcoming-batches" data-action="plan-week" data-id="${monday(dayOf(upcoming[0].startSlot))}">${count(upcoming.filter(b=>monday(dayOf(b.startSlot))===monday(dayOf(upcoming[0].startSlot))).length,'batch')} in the week of ${shortDate(monday(dayOf(upcoming[0].startSlot)))} →</button>`:''}</section></div></section>`;
}
function cookingStatus(context) {
  const total=recipeById[context.id].steps.length;
  const done=(ui.cookProgress[cookingKey(context)]||[]).filter(step=>step<total);
  return {done,label:done.length===total?'Review steps':done.length?'Continue cooking':'Start cooking',text:done.length?`${done.length} of ${count(total,'step')} checked`:'Ready when you are'};
}
function saveCookingProgress(steps) {
  const key=cookingKey(ui.cookContext);
  delete ui.cookProgress[key];ui.cookProgress[key]=steps;
  ui.cookProgress=Object.fromEntries(Object.entries(ui.cookProgress).slice(-100));
  try {localStorage.setItem(COOKING_STORE,JSON.stringify(ui.cookProgress));} catch {toast('Cooking progress will last until this page closes. Browser storage is unavailable.');}
  for(const card of document.querySelectorAll('[data-prep-batch]'))if(card.dataset.prepBatch===ui.cookContext.batch){
    const status=cookingStatus(ui.cookContext);
    card.querySelector('.prep-progress').textContent=status.text;
    card.querySelector('[data-action="cook-batch"]').textContent=status.label+' →';
  }
}
function preparationView() {
  const groups=preparationDays(state);
  return `<section class="preparation-schedule" aria-label="Cooking and packing schedule"><p class="field-help">Each batch appears once, on the day you prepare it. Pack the next portions while you’re already in the kitchen. Step checkmarks are saved on this device.</p>${groups.length?groups.map(({date,batches})=>`<section class="prep-day"><header><h3>${date===localDate()?'Today':fmt(date,{weekday:'long'})}<span>${shortDate(date)}</span></h3><small>${date<state.week?(date===addDays(state.week,-1)&&batches.every(b=>b.prepAhead)?'Night before the week starts · ':'Before the week starts · '):''}${batches.reduce((n,b)=>n+(b.estimates?.active??estimate(recipeById[b.recipeId]).active),0)} min active · estimated</small></header>${batches.map(b=>{
    const r=recipeById[b.recipeId],c=cleanupFor(r,cleanupContext(b)),status=cookingStatus({id:r.id,batch:b.id,draft:b});
    const packing=c.containers?`Pack ${c.prepAhead&&c.containers>1?'all ':''}${count(c.containers,'portion')} in containers with lids. ${r.storeBought?'Keep chilled and eat cold; no microwave needed.':r.fit.lunch==='assemble'?'Keep bread, sauces and crunchy toppings separate; assemble when eating.':r.fit.lunch==='home'?'Keep toppings separate and re-crisp leftovers at home.':'Refrigerate for reheating. Keep any crunchy toppings separate.'}`:'Make this portion to eat fresh; no extra portions to pack.';
    return `<article class="prep-batch" data-prep-batch="${b.id}" style="${colors(r)}"><span class="prep-thumb">${media(r)}</span><div class="prep-body"><div class="prep-meta">${b.prepDate?`Separate prep · available ${shortDate(dayOf(b.startSlot))}`:b.prepAhead?`Evening prep · ${SLOT_LABELS[typeOf(b.startSlot)]} ${shortDate(dayOf(b.startSlot))}`:`Make for ${SLOT_LABELS[typeOf(b.startSlot)].toLowerCase()}`}</div><button class="prep-title" data-action="batch" data-id="${b.id}">${esc(r.title)}</button><p>${count(b.portions,'portion')} · ${b.estimates?.active??estimate(r).active} min active / ${b.estimates?.total??estimate(r).total} min total · ${b.estimates?.cleanup??state.estimates[r.id]?.cleanup??c.total} to wash</p><p class="prep-packing">${esc(packing)}</p>${dayOf(b.startSlot)>addDays(state.week,6)?`<button class="text-button prep-next-week" data-action="groceries-week" data-id="${monday(dayOf(b.startSlot))}">Next week’s groceries →</button>`:''}<div class="prep-actions"><button class="primary" data-action="cook-batch" data-id="${b.id}">${status.label} →</button><span class="prep-progress">${status.text}</span></div></div></article>`;
  }).join('')}</section>`).join(''):`<div class="empty-state"><span aria-hidden="true">${ratLive('sleep','empty-state-rat')}</span><h2>No batches to prepare yet.</h2><p>Plan some meals and their cooking days will appear here. Ready portions from earlier batches stay on your meal calendar.</p><button class="primary" data-action="auto-plan">Plan my week</button></div>`}</section>`;
}
function stockView() {
  const end=addDays(state.week,6),today=localDate();
  const through=Object.hasOwn(ui.stockDays,state.week)?ui.stockDays[state.week]:today<state.week?null:today>end?end:today;
  const stock=inventoryProjection(state,through),items=stock.items.filter(i=>ui.showUsedStock||i.remaining>0);
  const usedUp=stock.items.filter(i=>i.remaining===0).length,extra=stock.items.filter(i=>i.leftover>0).length;
  const label=through===null?'After shopping':`After ${fmt(through,{weekday:'long'})}’s prep`;
  return `<section class="stock-view" aria-label="Planned ingredient leftovers"><div class="stock-heading"><div><span class="eyebrow">ONE SHOP. EVERY INGREDIENT ACCOUNTED FOR.</span><h2>Watch the food go further.</h2><p>See what remains after each day’s planned cooking. Includes packages still to buy; these are estimates, not a live fridge count. Spices, oils and small seasonings stay off this view.</p></div><div class="stock-summary"><span class="stock-rat" aria-hidden="true">${ratLive('basket','anim-bob')}</span><span><b>${stock.items.length-usedUp}</b> foods left</span><span><b>${usedUp}</b> used up</span><span><b>${extra}</b> with extras after the week</span></div></div>
    <nav class="stock-days" aria-label="Show planned stock after a day"><button data-action="stock-day" data-id="start" aria-pressed="${through===null}"><span>Start</span><b>After shopping</b></button>${stock.dates.filter(d=>d>=state.week||stock.items.some(i=>i.events.some(e=>e.date===d))).map(d=>`<button data-action="stock-day" data-id="${d}" aria-pressed="${through===d}"><span>${d<state.week?`${fmt(d,{weekday:'short'})} prep`:fmt(d,{weekday:'short'})}</span><b>${shortDate(d)}</b></button>`).join('')}</nav>
    <div class="stock-asof"><h3>${label}</h3><span>Rounded package amounts · raw, dry or drained as named.</span></div>
    <div class="stock-grid">${items.map(i=>{
      const q=n=>stockQuantity(n,i.unit),next=i.events.find(e=>through===null||e.date>through),percent=i.supply?Math.min(100,i.remaining/i.supply*100):0;
      const sources=[i.pantry?`${q(i.pantry)} at home`:'',i.bought?`${q(i.bought)} bought`:'',i.remainingPacks?`${i.remainingPacks} × ${packageLabel(i.id,i.packQty)} still to buy`:''].filter(Boolean);
      return `<article class="stock-card ${i.remaining===0?'stock-empty':''}" data-stock-id="${i.id}"><header><div><span class="stock-aisle">${aisleFor(i.id)}</span><h4>${ingName(i.id,i.name)}</h4></div><span class="stock-balance">${i.remaining?q(i.remaining):'Used up'}<small>${i.remaining?'planned remaining':'by this day'}</small></span></header><div class="stock-meter ${percent>0&&percent<25?'low':''}" role="meter" aria-label="${esc(i.name)} planned remaining" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}" aria-valuetext="${q(i.remaining)} remaining from ${q(i.supply)}"><span style="width:${percent}%"></span></div><div class="stock-amounts"><span>Start with <b>${q(i.supply)}</b></span><span>Planned use so far <b>${q(i.used)}</b></span></div><p class="stock-supply">${esc(sources.join(' · '))}</p><div class="stock-next">${next?`<span>Next · ${shortDate(next.date)}${next.prepAhead?' evening':''}</span><button data-action="batch" data-id="${next.batchId}">${esc(next.title)} ↗</button><small>Uses ${q(next.qty)} · leaves ${q(next.remaining)}</small>`:i.remaining?`<span>${i.events.length?'After this week’s meals':'Not assigned to a meal'}</span><strong>${q(i.leftover)} left to use</strong>`:'<strong>This plan uses it all.</strong>'}</div>${next&&i.leftover?`<p class="stock-extra">${q(i.leftover)} stays unassigned after the week.</p>`:''}
        <div class="stock-date"><button class="text-button" data-action="ingredient-date" data-id="${i.id}">${i.useBy?`Use by ${shortDate(i.useBy)} · edit`:'＋ Add ingredient date'}</button></div><details class="stock-timeline"><summary>${i.events.length?`See the full week · ${count(i.events.length,'batch')}`:'Shopping breakdown'}</summary><p>Start with ${q(i.supply)} after shopping.</p><ol>${i.events.map(e=>`<li class="${through!==null&&e.date<=through?'stock-event-past':''}"><span>${shortDate(e.date)}${e.prepAhead?' · evening prep':''}</span><button data-action="batch" data-id="${e.batchId}">${esc(e.title)}</button><small>Use ${q(e.qty)} → ${q(e.remaining)} left</small></li>`).join('')}</ol><p>${q(i.leftover)} remains after all planned batches. Later servings of a cooked batch don’t use these ingredients again.</p><button class="text-button" data-action="price" data-id="${i.id}">Edit package · ${packageLabel(i.id,i.packQty)} · ${money(i.packCost)}</button></details>${i.leftover?`<button class="text-button stock-find" data-action="use-ingredient" data-id="${i.id}">Find meals using this →</button>`:''}</article>`;
    }).join('')}</div>${!items.length?`<div class="empty-state gro-empty"><span class="gro-empty-art" aria-hidden="true">${stock.items.length?ratLive('cheer','empty-state-rat anim-bob'):ratLive('basket','empty-state-rat anim-bob')}${deco('sparkle','gro-empty-deco e1 anim-twinkle')}</span><h2>${stock.items.length?'Everything shown is used up.':'Food appears here when you plan meals.'}</h2><p>${stock.items.length?'Show used-up ingredients to trace where they went.':'Plan a few meals, then review the whole packages and how they are used through the week.'}</p></div>`:''}</section>`;
}
function stockExport() {
  const stock=inventoryProjection(state);
  return `PLANNED FOOD LEFT AFTER THE WEEK\nIncludes whole packages still to buy. Spices and small seasonings omitted.\n${stock.items.map(i=>`${i.name}: start ${stockQuantity(i.supply,i.unit)}; use ${stockQuantity(i.qty,i.unit)}; left ${stockQuantity(i.leftover,i.unit)}\n${i.events.map(e=>`  ${shortDate(e.date)}${e.prepAhead?' evening prep':''} — ${e.title}: use ${stockQuantity(e.qty,i.unit)}; left ${stockQuantity(e.remaining,i.unit)}`).join('\n')}`).join('\n')}\n`;
}
function pantryResults() {
  const items=pantryChoices(state,ui.pantryQuery,ui.pantryAll);
  return items.map(i=>{
    const gap=pantryGap(i),q=n=>quantity(n,i.unit,i.id,'grocery'),names=ingredientAliases(i.id),query=normalizeIngredientName(ui.pantryQuery),matchedName=query&&!normalizeIngredientName(i.name).includes(query)?names.find(name=>normalizeIngredientName(name).includes(query)):null;
    return `<article class="pantry-item" data-pantry-item="${i.id}"><div class="pantry-item-heading"><button data-action="pantry-amount" data-id="${i.id}">${irat(i.id)}${esc(i.name)} <span aria-hidden="true">↗</span></button>${i.pantry?'<span class="pantry-added">At home ✓</span>':''}</div><p class="pantry-item-balance">${i.qty?`Needed <b>${q(i.qty)}</b> · `:''}At home <b>${q(i.pantry)}</b>${i.bought?` · bought ${q(i.bought)}`:''}</p>${matchedName?`<p class="pantry-aliases">Also called ${esc(matchedName)}</p>`:''}<div class="pantry-item-actions">${i.qty?`<button class="pantry-match" data-action="pantry-match" data-id="${i.id}" ${gap<1e-8?'disabled':''} aria-label="Match needed amount for ${esc(i.name)}">${gap<1e-8?'Need covered ✓':`Match need · ${q(gap)}`}</button>`:''}<button data-action="pantry-package" data-id="${i.id}" aria-label="Add one package of ${esc(i.name)} at home">＋ 1 package <small>${packageLabel(i.id,i.packQty)}</small></button></div>${i.recipes.length?`<details class="pantry-used"><summary>Used in ${count(i.recipes.length,'recipe')}</summary><p class="used-list">${i.recipes.map(usedChip).join('')}</p></details>`:''}</article>`;
  }).join('')||`<p class="pantry-empty">${ratLive('sleep','pantry-empty-rat')}${ui.pantryAll?'No matching ingredients. Try another name.':'No matching ingredients in this week’s plan.'}${!ui.pantryAll?'<button class="text-button" data-action="pantry-scope" data-id="all">Search all ingredients →</button>':''}</p>`;
}
function refreshPantry(id=null,action=null) {
  const list=$('#pantry-results'),top=list.scrollTop;
  list.innerHTML=pantryResults();list.scrollTop=top;
  const groceries=shopping(state);
  $('#pantry-status').textContent=`${money(groceries.remainingCost)} still to buy this week`;
  $('#pantry-undo').disabled=!ui.pantryEdits||!ui.history.length;
  if(id){const card=list.querySelector(`[data-pantry-item="${id}"]`);const button=card?.querySelector(`[data-action="${action}"]:not(:disabled)`)||card?.querySelector('[data-action="pantry-amount"]');button?.focus({preventScroll:true});}
}
function pantryDialog() {
  dialog('Add food you have',`<section id="pantry-dialog"><p class="field-help">Match need copies the exact amount still missing, after pantry and bought food. Add a package when you have more, or tap an ingredient to set its amount.</p><label class="pantry-search-label">Find an ingredient<input id="pantry-search" type="search" placeholder="Try scallions, stock, or minced beef" value="${esc(ui.pantryQuery)}" autocomplete="off"></label><div class="segmented pantry-scope" aria-label="Ingredients to choose from"><button data-action="pantry-scope" data-id="needed" aria-pressed="${!ui.pantryAll}" class="${!ui.pantryAll?'selected':''}">Needed this week</button><button data-action="pantry-scope" data-id="all" aria-pressed="${ui.pantryAll}" class="${ui.pantryAll?'selected':''}">All ingredients</button></div><div id="pantry-results" class="pantry-results" aria-label="Matching ingredients"></div><p class="pantry-week-note">Starting stock for the week of ${shortDate(state.week)}. Food marked bought is already counted.</p><div class="pantry-dialog-footer"><span id="pantry-status" role="status" aria-live="polite"></span><button class="text-button" id="pantry-undo" data-action="pantry-undo">↶ Undo</button><button class="primary" data-action="close">Done</button></div></section>`,true);
  refreshPantry();$('#pantry-search').focus({preventScroll:true});
}
function pantryAmountDialog(id) {
  const item=pantryChoices(state,'',true).find(i=>i.id===id);if(!item)return;
  dialog('Amount at home',`<form id="pantry-amount-form" data-id="${id}"><p class="package-name">${esc(item.name)}</p>${ingredientAliases(id).length?`<p class="field-help">Also called ${ingredientAliases(id).filter((name,index,names)=>names.findIndex(other=>normalizeIngredientName(other).replace(/s$/,'')===normalizeIngredientName(name).replace(/s$/,''))===index).slice(0,3).map(esc).join(', ')}.</p>`:''}<label>Amount at home (${pantryMeasure(item.unit,id).unit})<input name="amount" type="text" inputmode="text" required autocomplete="off" value="${pantryValue(item.pantry,item.unit,id)}"></label><p class="field-help">The total you started this shopping week with, excluding food marked bought. Use fractions such as ½ or 1 1/2; enter 0 to clear.</p><div class="modal-actions"><button type="button" class="text-button" data-action="pantry-back">← Ingredients</button><button class="primary" type="submit">Save amount</button></div></form>`);
}
function pantryCheer(id) {
  const card=$(`#pantry-results [data-pantry-item="${CSS.escape(id)}"]`),badge=card?.querySelector('.pantry-added');if(!card||reduceMotion())return;
  badge?.classList.add('just-checked');fx('spark',badge||card);
}
function changePantry(id,action) {
  try {const next=updatePantry(state,id,action);if(commit(next,action==='match'?'Exact ingredient need covered.':'One package added at home.')){ui.pantryEdits=Math.min(ui.history.length,ui.pantryEdits+1);refreshPantry(id,`pantry-${action}`);pantryCheer(id);}} catch(err){toast(err.message,'error');}
}
// Grocery decorations: aria-hidden, no text, hidden in print. The cart rider rolls once per change.
const AISLE_ICONS={'Produce':'produce','Meat & seafood':'meat','Dairy & eggs':'dairy','Bakery & tortillas':'bread','Frozen':'frozen','Grains & pasta':'grains','Cans, sauces & seasonings':'can'};
const aisleIcon=aisle=>`<span class="aisle-icon" aria-hidden="true">${uiIcon(AISLE_ICONS[aisle]||'basket')}</span>`;
let lastShopP=null;
function rollCart() {
  const track=$('.shop-track');if(!track){lastShopP=null;return;}
  const p=Number(track.dataset.p);if(lastShopP===p)return;lastShopP=p;
  requestAnimationFrame(()=>{void track.offsetWidth;track.style.setProperty('--p',p);});
}
function shopCheer(rect) {
  if(reduceMotion())return;
  requestAnimationFrame(()=>{fx('spark',rect);const needed=shopping(state).items.filter(i=>i.packs>0);if(needed.length&&needed.every(i=>i.checked)){setTimeout(()=>fx('confetti'),160);hop($('.gro-rat'));}});
}
function groceriesView() {
  const g=shopping(state),needed=g.items.filter(i=>i.packs>0),checked=needed.filter(i=>i.checked).length;
  const visible=g.items.filter(i=>!ui.hideBought||i.remainingPacks>0);
  const groups=AISLES.map(aisle=>({aisle,items:visible.filter(i=>aisleFor(i.id)===aisle)})).filter(group=>group.items.length);
  const check=i=>`<input type="checkbox" data-bought="${i.id}" aria-label="Bought ${esc(i.name)}" ${i.checked?'checked':''} ${!i.packs?'disabled':''}>`;
  const mode=ui.stockMode?'stock':ui.shoppingMode?'shop':'review';
  const tools=`<div class="grocery-tools"><button class="text-button pantry-open" data-action="pantry-open">＋ Add food at home</button><button class="text-button" data-action="download-list">↓ Save shopping list</button><button class="text-button" data-action="print">Print list</button></div>`;
  return `<section class="groceries grocery-${mode}"><div class="page-heading grocery-heading"><span class="gro-art" aria-hidden="true">${ratLive('cart','gro-rat anim-bob')}${deco('sparkle','gro-deco g1 anim-twinkle')}${deco('cheese','gro-deco g2')}${deco('heart','gro-deco g3')}${deco('sparkle','gro-deco g4 anim-twinkle')}</span><span class="eyebrow">SHOP ONCE. COOK A FEW TIMES. EAT WELL.</span><h1>${ui.stockMode?'Food left, day by day.':'Your shopping list.'}</h1><p>Ingredients for ${count(g.batches,'batch')} starting ${shortDate(state.week)} – ${shortDate(addDays(state.week,6))}. Each batch is counted once.</p></div>
  <div class="shopping-progress ${needed.length&&checked===needed.length?'all-done':''}" ${ui.stockMode?'hidden':''}><span><strong>${checked} / ${needed.length}</strong> items in your cart</span><span class="shop-track" data-p="${needed.length?checked/needed.length:0}" style="--p:${lastShopP??(needed.length?checked/needed.length:0)}"><progress value="${checked}" max="${needed.length||1}" aria-label="Shopping progress"></progress><span class="shop-lane" aria-hidden="true"><span class="shop-rider">${rat('cart')}</span></span>${deco('sparkle','shop-flag')}</span><span><strong>${money(g.remainingCost)}</strong> still to pick up</span></div>
  <div class="shopping-toolbar"><div class="segmented" aria-label="Grocery view"><button data-action="shopping-mode" data-id="shop" aria-pressed="${ui.shoppingMode}" class="${ui.shoppingMode?'selected':''}">Shopping mode</button><button data-action="shopping-mode" data-id="review" aria-pressed="${!ui.shoppingMode&&!ui.stockMode}" class="${!ui.shoppingMode&&!ui.stockMode?'selected':''}">Review quantities</button><button data-action="shopping-mode" data-id="stock" aria-pressed="${ui.stockMode}" class="${ui.stockMode?'selected':''}">Food left</button></div>${ui.stockMode?`<label><input id="show-used-stock" type="checkbox" ${ui.showUsedStock?'checked':''}> Show used-up ingredients</label>`:`<label><input id="hide-bought" type="checkbox" ${ui.hideBought?'checked':''}> Only still needed</label>`}${ui.shoppingMode?'':tools}</div>
  <p class="notice" id="pantry-help" ${ui.shoppingMode||ui.stockMode?'hidden':''}>${rat('search','notice-rat')}Check your pantry first. Enter amounts like ½ or 1 1/2, or check “Have enough”. Measures are rounded for the kitchen; package counts use full quantities. Check “Bought” at the store. “Have at home” is the amount you started this shopping week with.</p>
  ${ui.stockMode?stockView():ui.shoppingMode?`<div class="aisle-list">${groups.map(({aisle,items})=>`<section class="aisle"><h2>${aisleIcon(aisle)}${aisle}<span class="aisle-count">${items.length}</span></h2>${items.map(i=>`<article class="shopping-item ${i.checked||!i.packs?'completed':''}"><label class="shop-check">${check(i)}<span>${ingName(i.id,i.name,'strong')}<span>${i.packs?`${count(i.remainingPacks,'pack')} left · ${packageLabel(i.id,i.packQty)} each`:'Already in your pantry'}</span><small>Recipe total ${quantity(i.qty,i.unit,i.id,'grocery')}${i.pantry?` · have ${quantity(i.pantry,i.unit,i.id,'grocery')}`:''}${pantryShortfall(i)?` · ${pantryShortfall(i)}`:''}</small></span></label><strong>${money(i.buyCost)}</strong><details><summary>Used in ${count(i.recipes.length,'recipe')}</summary><p class="used-list">${i.recipes.map(usedChip).join('')}</p></details></article>`).join('')}</section>`).join('')}</div>`:
  `<div class="grocery-table-wrap"><table class="grocery-table" role="table"><thead><tr><th>Bought</th><th>Have enough</th><th>Ingredient</th><th>Needed</th><th>Have at home</th><th>Package size</th><th>Est. package price</th><th>Buy</th><th>Est. total</th></tr></thead>${groups.map(({aisle,items})=>`<tbody><tr class="aisle-row"><th colspan="9">${aisleIcon(aisle)}${aisle}</th></tr>${items.map(i=>`<tr class="${!i.packs?'in-pantry':''} ${i.checked?'bought-row':''}"><td class="grocery-check"><label>${check(i)}<span>Bought</span></label></td><td class="grocery-check"><label><input type="checkbox" data-pantry="${i.id}" aria-label="Have enough ${esc(i.name)}" ${!i.packs?'checked':''}><span>Have enough</span></label></td><th scope="row" aria-label="${esc(i.name)}">${ingName(i.id,i.name)}<small class="ingredient-for">${i.recipes.map(usedChip).join('')}</small></th><td data-label="Needed">${quantity(i.qty,i.unit,i.id,'grocery')}${pantryShortfall(i)?`<small class="quantity-shortfall">${pantryShortfall(i)}</small>`:''}</td><td data-label="Have at home"><input class="pantry-quantity" type="text" inputmode="text" autocomplete="off" spellcheck="false" aria-describedby="pantry-help" data-pantry-qty="${i.id}" aria-label="Pantry quantity for ${esc(i.name)}" value="${pantryValue(i.pantry,i.unit,i.id)}"><small>${pantryMeasure(i.unit,i.id).unit}</small></td><td data-label="Package size"><button class="package-edit" data-action="price" data-id="${i.id}" aria-label="Edit package size and price for ${esc(i.name)}">${packageLabel(i.id,i.packQty)} <span aria-hidden="true">↗</span></button></td><td data-label="Est. package price"><label class="price-field"><span>$</span><input type="number" min="0" max="1000" step="0.01" data-price="${i.id}" aria-label="Package price for ${esc(i.name)}" value="${i.packCost.toFixed(2)}"></label></td><td data-label="Buy">${count(i.packs,'pack')}</td><td data-label="Est. total">${money(i.buyCost)}</td></tr>`).join('')}</tbody>`).join('')}</table></div>`}
  ${!ui.stockMode&&!visible.length?`<div class="empty-state gro-empty"><span class="gro-empty-art" aria-hidden="true">${g.items.length?ratLive('cheer','empty-state-rat anim-bob')+deco('sparkle','gro-empty-deco e1 anim-twinkle')+deco('heart','gro-empty-deco e2')+deco('sparkle','gro-empty-deco e3 anim-twinkle'):ratLive('basket','empty-state-rat anim-bob')+deco('sparkle','gro-empty-deco e1 anim-twinkle')}</span><h2>${g.items.length?'Everything is covered.':'Your list starts with a meal.'}</h2><p>${g.items.length?'Your remaining groceries are in the cart or already at home.':'Add recipes to your week and their ingredients will appear here automatically.'}</p><button class="secondary" data-action="${g.items.length?'show-all-shopping':'nav'}" data-id="meals">${g.items.length?'Show all items':'Find a meal'}</button></div>`:''}
  ${ui.shoppingMode?tools:''}<div class="grocery-summary" ${ui.stockMode?'hidden':''}><div><span>Whole-package estimate</span><b>${money(g.basket)}</b><small>Full week · pantry quantities deducted</small></div><div><span>Ingredients in recipes</span><b>${money(g.used)}</b><small>Includes food already in your pantry</small></div></div>
  <p class="fine-print">Pantry and cart quantities are saved for this week. Adding more food reopens items when you need more. Package rounding may leave extras. Prices exclude tax; pantry stock is not carried forward automatically. Remaining amounts don’t predict freshness; follow package storage guidance.</p></section>`;
}
function render() {
  const left=$('.week-scroll')?.scrollLeft||0,top=$('.library-scroll')?.scrollTop||0,focus=document.activeElement?.id,selection=document.activeElement?.selectionStart;
  $('#app').innerHTML=`<header class="app-header"><a class="brand" href="#" data-action="nav" data-id="week"><span class="brand-mark">${ratLive('face')}<span class="visually-hidden">m<span>●</span></span></span><span class="wordmark">mealstack</span><span class="brand-sub">MEAL PLANNER</span></a><nav aria-label="Main navigation">${[['week','My week','calendar'],['meals','Meal library','bowl'],['groceries','Grocery list','basket']].map(([v,l,i])=>`<button data-action="nav" data-id="${v}" class="${ui.view===v?'active':''}" ${ui.view===v?'aria-current="page"':''}>${uiIcon(i)}${l}</button>`).join('')}</nav><div class="header-tools"><span class="saved"><i></i> Saved on this device</span><button class="icon-button theme-toggle" data-action="toggle-theme" aria-label="Dark mode" aria-pressed="${document.documentElement.dataset.theme==='dark'}" title="Switch to ${document.documentElement.dataset.theme==='dark'?'light':'dark'} mode"><svg class="theme-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/></svg><svg class="theme-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/></svg></button><button class="icon-button" data-action="settings" aria-label="Plan settings, import and export">☰</button></div></header>
  <main>${ui.view==='week'?`${homeTop()}<div class="workspace ${ui.showLibrary?'':'hide-library'}">${planner()}${library()}</div>`:ui.view==='meals'?`<div class="page-heading meals-heading"><span class="page-art" aria-hidden="true">${ratLive('cheese','page-rat anim-bob')}${deco('sparkle','page-deco p1 anim-twinkle')}${deco('heart','page-deco p2')}${deco('sparkle','page-deco p3 anim-twinkle')}</span><span class="eyebrow">EXPLORE THE MEAL LIBRARY</span><h1>What sounds good?</h1><p>${mealCounts.main} mains, ${mealCounts.breakfast} breakfasts, and ${mealCounts.snack} snacks with ingredients, cookware and step-by-step instructions.</p></div>${library(true)}`:groceriesView()}</main><footer class="app-footer"><span>Mealstack</span><span>Local to this browser · <button data-action="about">About the estimates</button></span></footer>`;
  if($('.week-scroll'))$('.week-scroll').scrollLeft=left;
  if($('.library-scroll'))$('.library-scroll').scrollTop=top;
  if(focus&&document.getElementById(focus)) {const el=document.getElementById(focus);el.focus({preventScroll:true});if(selection!==null && ['search','text'].includes(el.type))el.setSelectionRange(selection,selection);}
  // Entrance motion plays once per view change, never on ordinary re-renders.
  if(markViewEnter($('main'),ui.view+(ui.view==='week'?':'+ui.plannerView:'')+(ui.view==='groceries'?':'+(ui.stockMode?'stock':ui.shoppingMode?'shop':'review'):'')))wakePhotos();
  syncLoops($('#app'));runFlashes();rollCart();placeDayPanel();
}
// A toast still showing when a dialog opens moves above it (the top layer stacks in opening order).
const raiseToast=()=>{const t=$('#toast');if(t?.classList.contains('visible')&&t.showPopover){try{t.hidePopover();t.showPopover();}catch{}}};
let returnFocus,returnKey;
// A re-render can replace the button that opened a dialog; focus then returns to its stand-in (same action and item).
const refocus=()=>{if(returnFocus?.isConnected){returnFocus.focus();return;}const k=returnKey;if(!k)return;
  const scope=k.day?document.querySelector(`.day-close[data-day-close="${k.day}"]`):document;
  [...(scope?.querySelectorAll(`[data-action="${k.action}"]`)||[])].find(el=>el.dataset.id===k.id&&el.offsetParent)?.focus({preventScroll:true});};
const MODAL_MASCOTS={'Plan your week':'chef','Add food you have':'basket','Your plan':'sit','Clear this week?':'worry','Package size & price':'cheese','Amount at home':'basket','Ingredient date':'search','About Mealstack':'love','One batch. A few good meals.':'wave'};
function dialog(title,body,wide=false,{mascot=MODAL_MASCOTS[title]}={}) {
  returnFocus=document.activeElement;returnKey=returnFocus?.dataset?.action?{action:returnFocus.dataset.action,id:returnFocus.dataset.id,day:returnFocus.closest('.day-close')?.dataset.dayClose}:null;const fresh=!$('#dialog-root dialog');
  $('#dialog-root').innerHTML=`<dialog class="modal ${wide?'wide':''} ${fresh?'dialog-enter':''}" aria-labelledby="dialog-title"><div class="modal-heading">${mascot?rat(mascot,'modal-rat'):''}<h2 id="dialog-title">${esc(title)}</h2><button class="icon-button" data-action="close" aria-label="Close dialog">✕</button></div>${body}</dialog>`;
  const el=$('dialog');el.showModal();syncLoops(el);raiseToast();el.addEventListener('click',e=>{if(e.target===el){const r=el.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});el.addEventListener('close',()=>{if(el.querySelector('#pantry-dialog,#pantry-amount-form'))$('[data-action="pantry-open"]')?.focus({preventScroll:true});else refocus();});
}
function closeDialog() {const pantry=!!$('#pantry-dialog')||!!$('#pantry-amount-form');$('dialog')?.close();$('#dialog-root').innerHTML='';if(pantry)$('[data-action="pantry-open"]')?.focus({preventScroll:true});else refocus();}
// Print the complete recipe/checklist, then restore the reader’s disclosures.
let printOpened=[];
window.addEventListener('beforeprint',()=>{printOpened=[...document.querySelectorAll('dialog[open] details:not([open]), .stock-timeline:not([open])')];printOpened.forEach(el=>el.open=true);});
window.addEventListener('afterprint',()=>{printOpened.forEach(el=>el.open=false);printOpened=[];});
// Slots where this batch is pinned by her own choice (planner reservations are not shown as pins).
const pinnedSlots=batchId=>Object.values(schedule(state).cells).filter(c=>c.manual&&c.chosen===batchId).map(c=>c.id);
function openMeal(id,batchId=null,draft=null) {
  const r=recipeById[id],batch=state.batches.find(b=>b.id===batchId),b=draft||batch||{scale:1,portions:r.servings,startSlot:slot(state.week,r.kind==='main'?'dinner':r.kind==='snack'?'snack-pm-1':'breakfast'),useBy:null};
  const cost=batchCost(r,b.scale,state.prices,state.packageSizes),src=SOURCES[r.source],cleanup=b.estimates?.cleanup??state.estimates[r.id]?.cleanup??cleanupFor(r,cleanupContext(b)).total;
  dialog(batch?'Your batch':'Meet your next meal',`<div class="meal-detail-hero" style="${colors(r)}"><div class="hero-media">${media(r,'hero')}<span class="img-chip hero-chip">${esc(METHOD_NAMES[r.method])} · ${esc(r.cuisine)}</span><h3 class="sticker">${esc(r.title)}</h3>${ratLive('peek','hero-rat')}</div><p>${esc(r.description)}</p></div><div class="detail-metrics"><div><b>${money(cost)}</b><span>ingredients used</span></div><div><b>${money(cost/b.portions)}</b><span>per ${r.kind==='snack'?'snack':'portion'}</span></div><div><b>${estimate(r).active} / ${estimate(r).total}m</b><span>active / total*</span></div><div><button class="cleanup-metric" data-action="jump-cleanup"><b>${cleanup}</b><span>${pluralize(cleanup,'thing')} to wash ↘</span></button></div></div>
  <div class="recipe-actions"><button class="primary" data-action="start-cooking" data-id="${r.id}">Start cooking →</button><button class="secondary" data-action="print">Print recipe</button><button class="text-button" data-action="jump-recipe">↓ Cooking instructions</button></div><form id="meal-form" data-recipe="${r.id}" data-batch="${batch?.id||''}" data-prep-ahead="${!!b.prepAhead}"><h4>Plan this batch</h4><div class="form-row"><label>Batch size<select name="scale" id="batch-scale">${[0.5,1,1.5,2].map(n=>`<option value="${n}" ${b.scale===n?'selected':''}>${n===1?'Standard':formatNumber(n)+'×'} ingredients</option>`).join('')}${![0.5,1,1.5,2].includes(b.scale)?`<option value="${b.scale}" selected>${formatNumber(b.scale)}× ingredients</option>`:''}</select></label><label>${r.kind==='snack'?'Snack portions':'Filling meal portions'}<input name="portions" type="number" min="1" max="30" required value="${b.portions}" id="batch-portions"></label></div><p class="field-help">Makes <strong>${count(r.servings,r.kind==='snack'?'snack':'meal')}</strong> per standard batch. Adjust the portions to suit your appetite. Change the batch size to use more or fewer ingredients.</p>
  <div class="form-row batch-dates"><label><span data-available-label>${b.prepAhead||b.prepDate?'Available date':'Make / available date'}</span><input type="date" name="date" required value="${dayOf(b.startSlot)}" min="2000-01-03" max="2099-12-24"></label><label>First available at<select name="type">${activeTypes(state.snackCount).map(t=>`<option value="${t}" ${typeOf(b.startSlot)===t?'selected':''}>${SLOT_LABELS[t]}</option>`).join('')}</select></label><label>Enjoy by<input name="useBy" type="date" required value="${b.useBy||addDays(dayOf(b.startSlot),r.qualityDays)}" min="${dayOf(b.startSlot)}" max="${addDays(dayOf(b.startSlot),7)}"></label></div>
  <div class="separate-prep"><label class="prep-choice"><input type="checkbox" name="separatePrep" ${b.prepDate?'checked':''} aria-controls="prep-date-field"><span>Keep a separate prep date<small>Prepare earlier, even when another meal is on that day.</small></span></label><div id="prep-date-field" ${b.prepDate?'':'hidden'}><label>Prep date<input name="prepDate" type="date" value="${preparationDate(b)}" data-previous="${preparationDate(b)}" min="${addDays(dayOf(b.startSlot),-7)}" max="${dayOf(b.startSlot)}" ${b.prepDate?'required':'disabled'}></label><p class="field-help">This date and your enjoy-by date stay fixed when other meals move around this batch.</p></div></div>
  <p class="field-help"><span data-relative-prep ${b.prepAhead&&!b.prepDate?'':'hidden'}>${b.prepAhead?`Prepare the evening of ${shortDate(preparationDate(b))} for the available date shown. `:''}</span>The planner aims to use this batch within ${count(r.qualityDays,'day')}. Adjust the date as needed; safe storage still matters. ${batch?'Saving rebuilds this batch from the available date shown.':''}</p>
  <details class="estimate-editor"><summary>Adjust time & cleanup</summary><div class="form-row"><label>Active minutes<input type="number" name="active" min="0" max="1440" required value="${b.estimates?.active??estimate(r).active}"></label><label>Total minutes<input type="number" name="total" min="1" max="1440" required value="${b.estimates?.total??estimate(r).total}"></label><label>Things to wash<input type="number" name="cleanup" min="0" max="50" required value="${cleanup}"></label></div><p class="field-help">Cleanup includes prep, measuring tools and one place setting. Adjust for your kitchen; your estimate is saved for this meal.</p></details><h4>Ingredients · ${formatNumber(b.scale)}× batch</h4><div class="ingredients-table-wrap"><table class="ingredients-table"><thead><tr><th>Ingredient</th><th>Amount</th><th>Est. used</th><th>Est. pack</th></tr></thead><tbody>${r.ingredients.map(i=>`<tr><th scope="row">${ingName(i.id,INGREDIENTS[i.id].name)}</th><td>${quantity(i.qty*b.scale,INGREDIENTS[i.id].unit,i.id)}</td><td>${money(ingredientCost(i,b.scale,state.prices,state.packageSizes))}</td><td><button type="button" data-action="price" data-id="${i.id}" title="Edit package size and price">${money(price(i.id,state.prices))}</button><small> / ${packageLabel(i.id,packageSize(i.id,state.packageSizes))}</small></td></tr>`).join('')}</tbody></table></div>
  <p class="field-help">US measures are rounded to practical kitchen amounts. Water is listed in the steps; salt and pepper to taste.</p>${recipeInstructions(r,b)}
  <details class="recipe-provenance" open><summary>Recipe notes & source</summary><p>${esc(r.note)}</p><p class="field-help">${r.storeBought?'Store-bought and eaten as sold. The price is an estimate; edit it in the ingredient table.':`${r.origin?'Small-batch adaptation of the linked recipe for these quantities.':'Mealstack instructions for these quantities.'} Not kitchen-tested. Times and yields are estimates; use doneness checks. Larger batches need larger cookware or separate batches, not a multiplied cooking time.`}</p>${src?`<a class="source-link" href="${src[1]}" target="_blank" rel="noopener noreferrer">${r.storeBought?'From':r.origin?'Adapted from':'Recipe inspiration:'} ${esc(src[0])} ↗</a><p class="field-help">${esc(r.adaptations||'The inspiration recipe may use different quantities and ingredients.')}</p>`:''}</details>
  <div class="modal-actions">${batch?`<button type="button" class="text-button" data-action="move-serving" data-id="${batch.id}">Place one portion only</button>${pinnedSlots(batch.id).length?`<button type="button" class="text-button" data-action="unpin-batch" data-id="${batch.id}">${pinnedSlots(batch.id).length>1?`Unpin all ${pinnedSlots(batch.id).length}`:'Unpin'}</button>`:''}<button type="button" class="danger text-button" data-action="delete-batch" data-id="${batch.id}">Remove batch</button>`:'<button type="button" class="text-button" data-action="close">Keep browsing</button>'}<button class="primary" type="submit">${batch?'Save batch':'Add batch to my week'} →</button></div></form>`,true);
}
function cleanupContext(b) {
  // A deliberately fixed prep day may be hidden under a different meal. Use
  // the actual first eating day to decide whether all portions need packing.
  const saved=state.batches.find(batch=>batch.id===b.id);
  if(!b.prepDate||!saved||saved.startSlot!==b.startSlot)return b;
  const first=Object.values(schedule(state).cells).find(c=>c.chosen===b.id);
  return {...b,firstMealSlot:first?.id??null};
}
function cleanupCard(r,b={},open=true) {
  const c=cleanupFor(r,cleanupContext(b)),custom=b.estimates?.cleanup??state.estimates[r.id]?.cleanup;
  const paths={cook:'M4 9h16v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3ZM8 6h8M12 3v3M2 12h2m16 0h2',prep:'M5 20 17 8M13 4l7 7M17 8l3-3-4-3-3 2-1 3',measure:'M5 5h11v14H5ZM16 8h3v7h-3M5 9h5M5 13h3',eat:'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8'};
  const groups=[['cook','Cookware',c.cookware],['prep','Prep tools',c.prep],['measure','Measuring',c.measuring],['eat','To eat · one person',c.tableware]];
  return `<details class="cleanup-card" id="cleanup-checklist" ${open?'open':''}><summary><span class="cleanup-heading"><span class="eyebrow">FROM COUNTER TO TABLE</span><strong>What gets dirty</strong></span><span class="cleanup-total"><b>${c.total}</b><span>${pluralize(c.total,'piece')} to wash</span></span>${BUBBLES}<span class="cleanup-chevron" aria-hidden="true">⌄</span></summary><div class="cleanup-body"><div class="cleanup-split"><span><b>${c.kitchen}</b> prep + cook</span><span><b>${c.eating}</b> to eat</span></div>${custom!==undefined&&custom!==c.total?`<p class="cleanup-custom">Your saved estimate: ${custom} to wash. The recipe checklist below counts ${c.total}.</p>`:''}<div class="equipment-grid">${groups.map(([key,label,items])=>`<section class="cleanup-group" data-equipment-group="${key}"><h4><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[key]}"/></svg>${label}<span>${items.reduce((n,i)=>n+i.count,0)}</span></h4><ul>${items.map(i=>`<li><span>${esc(i.label)}${i.note?`<small>${esc(i.note)}</small>`:''}</span>${i.count>1?`<b>${i.count} pieces</b>`:''}</li>`).join('')||'<li class="muted">None needed</li>'}</ul></section>`).join('')}</div><p class="cleanup-basis">One prep set + one place setting. Reuse the same measuring cup and spoons between ingredients; wash between raw food and ready-to-eat food. Optional tools and storage are outside this count.</p>${c.handy.length?`<div class="cleanup-handy"><strong>Have handy</strong><span>${c.handy.map(esc).join(' · ')}</span><small>Equipment and supplies, outside the dish count.</small></div>`:''}${c.containers?`<div class="cleanup-packing"><strong>${c.prepAhead?'Pack':'Save'} ${count(c.containers,'portion')}</strong><p>${count(c.containers,'container')} with ${c.containers===1?'a lid':'lids'}${c.prepAhead?'':', if you eat one portion now'}.${c.separateToppings?' Keep separate toppings or sauces in small containers.':''} Eat from a suitable storage bowl to save a dish.</p></div>`:''}<div class="cleanup-optional"><h4>Optional tools <span>outside the default count</span></h4><ul>${c.optional.map(i=>`<li><strong>${esc(i.label)}</strong><span>${esc(i.note)}</span></li>`).join('')}</ul></div></div></details>`;
}
function recipeInstructions(r,b={scale:1}) {
  const scale=b.scale;
  return `<section class="recipe-instructions" id="cooking-instructions">${cleanupCard(r,b)}
  <h3 class="instructions-heading">${rat('chef','steps-rat')}Let’s make it.</h3><p class="field-help">${formatNumber(scale)}× ingredients · ${scale!==1?'Water amounts below are scaled. Temperatures and times stay the same; check doneness.':'Read through once before starting. Wash produce; thaw frozen raw meat and seafood in the refrigerator.'}</p><ol class="recipe-steps">${cookingSteps(r,scale).map(step=>`<li><div><strong>${esc(step.title)}</strong><p>${esc(step.text)}</p></div></li>`).join('')}</ol>
  <div class="storage-card">${rat('sleep','storage-rat')}<h4>Make tomorrow’s meal easy</h4><p>${esc(r.storage)}</p><p class="field-help">Best texture within ${count(r.qualityDays,'day')}. ${esc(STORAGE_GUIDANCE)}</p><a href="${STORAGE_URL}" target="_blank" rel="noopener noreferrer">USDA storage guidance ↗</a> · <a href="${SAFETY_URL}" target="_blank" rel="noopener noreferrer">Safe cooking temperatures ↗</a></div></section>`;
}
function startCooking(id) {
  const form=$('#meal-form'),r=recipeById[id];
  const draft=form?readMealForm(form):{scale:1,portions:r.servings,startSlot:slot(state.week,'dinner'),useBy:addDays(state.week,r.qualityDays)};
  ui.cookContext={id,batch:form?.dataset.batch||null,draft};
  showCooking();
}
function showCooking() {
  const {id,draft}=ui.cookContext,r=recipeById[id],done=cookingStatus(ui.cookContext).done;
  dialog('Cooking mode',`<div class="cook-header" style="${colors(r)}"><span class="cook-thumb">${media(r)}</span><div><h3>${esc(r.title)}</h3><p>${count(draft.portions,'portion')} · ${formatNumber(draft.scale)}× batch · ${estimate(r).total} min estimated</p></div><span class="cook-art" aria-hidden="true">${STEAM}${ratLive('chef','cook-rat anim-bob')}</span></div><div class="cook-progress"><span id="cook-progress-label">${done.length} of ${count(r.steps.length,'step')} complete</span><span class="cook-track ${done.length===r.steps.length?'all-done':''}" style="--p:${done.length/r.steps.length}"><progress id="cook-progress" value="${done.length}" max="${r.steps.length}" aria-label="Recipe progress"></progress><span class="cook-lane" aria-hidden="true"><span class="cook-rider">${rat('sit')}</span></span></span></div>
  <details class="cook-ingredients"><summary>Ingredients & equipment</summary><div class="cook-ingredient-grid">${r.ingredients.map(i=>`<span class="ing">${irat(i.id)}<span><b>${quantity(i.qty*draft.scale,INGREDIENTS[i.id].unit,i.id)}</b> ${esc(INGREDIENTS[i.id].name)}</span></span>`).join('')}</div><p class="field-help">US measures are rounded to practical kitchen amounts. Water is listed in the steps. Salt and pepper to taste. Scale ingredients, not temperatures or cooking times.</p></details>${cleanupCard(r,draft,false)}
  <ol class="cook-steps">${cookingSteps(r,draft.scale).map((step,i)=>`<li class="${done.includes(i)?'complete':''}"><label><input type="checkbox" data-cook-step="${i}" ${done.includes(i)?'checked':''}><span><small>STEP ${i+1}</small><strong>${esc(step.title)}</strong><span>${esc(step.text)}</span></span></label></li>`).join('')}</ol>
  <div class="storage-card"><h4>${r.storeBought?'Keep it chilled':'Pack the next portion now'}</h4><p>${esc(r.storage)}</p><p class="field-help">${esc(STORAGE_GUIDANCE)}</p><a href="${STORAGE_URL}" target="_blank" rel="noopener noreferrer">USDA storage guidance ↗</a></div><div class="modal-actions"><button class="text-button" data-action="reset-cooking">Reset steps</button><button class="secondary" data-action="back-to-recipe">Back to recipe</button><button class="primary" data-action="next-step">Next unfinished step ↓</button></div>`,true);
  $('dialog').classList.add('cooking-modal');
}
function readPlanOptions(form) {
  const f=new FormData(form);
  return {budget:Number(f.get('budget')),maxCost:Number(f.get('maxCost')),maxActive:Number(f.get('maxActive')),style:f.get('style'),meals:f.getAll('meals'),matchIngredients:f.get('matchIngredients')==='on'};
}
function generatePlan(options) {
  const now=new Date(),week=planningWeek(state.week,now);
  const proposal=suggestPlan(week===state.week?state:{...state,week},{...options,avoid:state.avoid,recentPlans:ui.recentPlans,now});
  // Late in the week the plan targets the coming week; applying it switches the view there.
  proposal.weekNote=week===state.week?'':`${week>monday(localDate(now))?'Planning next week':'Planning this week'} · ${shortDate(week)}–${shortDate(addDays(week,6))}`;
  ui.proposal=proposal;ui.proposalOptions=structuredClone(options);
  if(proposal.added.length){
    ui.recentPlans.push([...new Set(proposal.added.map(b=>b.recipeId))]);ui.recentPlans=ui.recentPlans.slice(-12);
    try{localStorage.setItem(RECENT_PLANS_STORE,JSON.stringify(ui.recentPlans));}catch{}
  }
  return proposal;
}
function planPreview(proposal) {
  const groceries=shopping(proposal.state),result=schedule(proposal.state);
  return `  ${proposal.weekNote?`<p class="notice plan-week-note" data-planning-week="${proposal.state.week}">${proposal.weekNote}</p>`:''}${proposal.replaced.length?`<p class="notice">This preview replaces ${proposal.replaced.length} earlier suggested batches in this week when you choose “Use this mix”. Your current plan stays as it is until then.</p>`:''}
  ${proposal.repeated?'<p class="notice">These settings leave limited variety. Broaden the cost, effort or ingredient limits for more combinations.</p>':''}
  <div class="plan-preview-summary"><div><b>${proposal.added.length}</b><span>new cooking sessions</span></div><div><b>${proposal.added.reduce((n,b)=>n+b.portions,0)}</b><span>portions placed</span></div><div><b>${money(groceries.basket)}</b><span>week’s grocery estimate</span></div><div><b data-preview-items>${groceries.items.filter(i=>i.remainingPacks>0).length}</b><span>items to buy</span></div></div>
  ${proposal.unfilled?`<p class="notice">${proposal.unfilled} meal ${proposal.unfilled===1?'slot is':'slots are'} still open. A higher budget or broader filters may help.</p>`:''}
  <div class="plan-preview">${proposal.added.map(b=>{const r=recipeById[b.recipeId],placements=Object.values(result.cells).filter(c=>c.chosen===b.id);return `<article data-suggested-recipe="${r.id}" style="${colors(r)}"><span class="preview-thumb">${media(r)}</span><div><strong>${esc(r.title)}</strong><p>${b.prepAhead?`Prep ${shortDate(addDays(dayOf(b.startSlot),-1))} evening · ready ${shortDate(dayOf(b.startSlot))}`:`Make ${shortDate(dayOf(b.startSlot))}`} · ${count(b.portions,'portion')} · ${formatNumber(b.scale)}× batch · ${money(batchCost(r,b.scale,state.prices,state.packageSizes)/b.portions)} / portion</p><small>${placements.map(c=>`${shortDate(dayOf(c.id))} ${SLOT_LABELS[typeOf(c.id)].toLowerCase()}`).join(' · ')}</small><p class="preview-cleanup">${r.storeBought?'Nothing to wash':`${cleanupFor(r,cleanupContext(b)).total} to wash · includes one place setting`}</p><p class="preview-packing">${r.storeBought?'Grab & go · keep chilled, eat cold':r.fit.lunch==='home'?'Re-crisp at home':r.fit.lunch==='assemble'?'Pack toppings and bread separately':'Pack the night before · microwave to reheat'}</p></div></article>`;}).join('')||'<div class="empty-search">No new batches fit these settings, or your selected slots are already filled.</div>'}</div>`;
}
function updatePlanSettings() {
  const form=$('#plan-suggestion-form');if(!form)return;
  const options=readPlanOptions(form),valid=form.checkValidity();
  // Retain valid drafts when reopening, but never apply a preview made with other settings.
  if(valid)ui.planOptions=options;
  ui.planDirty=!valid||!options.meals.length||JSON.stringify(options)!==JSON.stringify(ui.proposalOptions);
  const status=$('#plan-status');
  status.textContent=!options.meals.length?'Select at least one meal to plan.':!valid?'Check the highlighted settings before trying another mix.':ui.planDirty?'Settings changed. Try another mix to update this preview.':`Preview ready · ${ui.proposal.added.length} new cooking sessions.`;
  status.classList.toggle('settings-changed',ui.planDirty);
  $('#plan-results').dataset.stale=String(ui.planDirty);
  $('[data-action="different-plan"]').disabled=!options.meals.length;
  const apply=$('[data-action="apply-plan"]');
  apply.disabled=ui.planDirty||!ui.proposal.added.length;
  apply.textContent=ui.proposal.replaced.length?'Use this mix →':`Add ${count(ui.proposal.added.length,'batch')} to my week →`;
}
function rerollPlan() {
  const form=$('#plan-suggestion-form');
  if(!form.reportValidity())return;
  const options=readPlanOptions(form);
  if(!options.meals.length){updatePlanSettings();return;}
  const scroll=$('.plan-scroll'),position=scroll.scrollTop;
  ui.planOptions=options;
  $('#plan-results').innerHTML=planPreview(generatePlan(options));
  updatePlanSettings();
  scroll.scrollTop=position;
  hop($('.planning-modal .modal-rat')); // the chef cheers each fresh mix; the preview markup itself is never touched
}
function planningDialog() {
  const options={...(ui.planOptions||DEFAULT_PLAN_OPTIONS),matchIngredients:ui.matchIngredients};
  const proposal=generatePlan(options);
  dialog('Plan your week',`<div class="plan-scroll">
    <p class="plan-intro">Find a mix you like. Meals you added or edited stay in place.</p>
    <form id="plan-suggestion-form">
      <div class="plan-limits">
        <label>Grocery budget ($)<input name="budget" type="number" min="1" max="10000" step="1" required value="${options.budget}"></label>
        <label>Max $ / portion<input name="maxCost" type="number" min="0.5" max="50" step="0.5" required value="${options.maxCost}"></label>
        <label>Max active minutes<input name="maxActive" type="number" min="5" max="120" step="5" required value="${options.maxActive}"></label>
      </div>
      <div class="plan-choices">
        <div class="plan-style"><label>Cooking style<select name="style" aria-describedby="plan-style-help"><option value="simple" ${options.style==='simple'?'selected':''}>Simple cooking</option><option value="any" ${options.style==='any'?'selected':''}>Any method</option></select></label><p id="plan-style-help" class="field-help">Simple: one pot, dump, tray, air fryer or no-cook.</p></div>
        <fieldset class="plan-meals"><legend>Meals to plan</legend><div>${['breakfast','lunch','dinner'].map(type=>`<label><input type="checkbox" name="meals" value="${type}" ${options.meals.includes(type)?'checked':''}><span>${SLOT_LABELS[type]}</span></label>`).join('')}</div></fieldset>
      </div>
      <div class="ingredient-match-setting"><label class="ingredient-match-option"><input type="checkbox" name="matchIngredients" aria-describedby="ingredient-match-help" ${options.matchIngredients?'checked':''}><span>Match ingredients across meals</span></label><p id="ingredient-match-help">Reuse groceries while keeping different recipes in the mix.</p></div>
      <details class="plan-help"><summary>How the budget and prep work</summary><p>Budget covers estimated whole packages for all batches starting this week, after pantry deductions. Meals you leave unchecked, snacks, Fuel Up, pizzas, bakery meals and drinks need their own allowance.</p><p>Small batches keep leftovers within your texture window. Lunches suit a fridge and microwave; crisp dishes are saved for dinner. New breakfast and lunch batches are prepared the evening before, with their leftover window counted from preparation.</p></details>
      ${state.avoid?`<p class="field-help">Skipping: ${esc(state.avoid)}.</p>`:''}
    </form>
    <section id="plan-results" aria-label="Suggested meals" aria-describedby="plan-status">${planPreview(proposal)}</section>
  </div>
  <div class="plan-footer"><p id="plan-status" role="status" aria-live="polite" aria-atomic="true"></p><div class="modal-actions"><button class="text-button" data-action="close">Keep my current plan</button><button class="secondary" type="submit" form="plan-suggestion-form" data-action="different-plan">Try another mix</button><button class="primary" data-action="apply-plan" aria-describedby="plan-status">Add to my week →</button></div></div>`,true);
  $('dialog').classList.add('planning-modal');
  updatePlanSettings();
}
function removeBatch(next,id) {next.batches=next.batches.filter(b=>b.id!==id);for(const [s,bid] of Object.entries(next.pins))if(bid===id)delete next.pins[s];for(const s of Object.keys(next.skips)){next.skips[s]=next.skips[s].filter(bid=>bid!==id);if(!next.skips[s].length)delete next.skips[s];}}
// One-shot "placed!" pop + sparkle on the freshly rendered portion; queued after the render, never delays it.
function celebratePlaced(target) {flashAfterRender(`.meal-slot[data-slot="${CSS.escape(target)}"] .portion`,'just-placed','spark');runFlashes();}
function applyDrop(payload,target) {
  // Dropping a card back onto its own slot (a tiny drag or tap) changes nothing and adds no undo step.
  if(payload.kind!=='recipe'&&payload.from===target){if(ui.pick){ui.pick=null;render();}return;}
  try {
    if(payload.kind==='recipe') {
      if(!recipeById[payload.id])return;
      const r=recipeById[payload.id],next=addBatchAt(state,r.id,target);
      ui.pick=null;ui.view='week';if(commit(next,`${count(r.servings,(r.kind==='snack'?'snack':'meal')+' portion')} added. Your drop takes priority.`))celebratePlaced(target);
    } else if(payload.kind==='batch') {
      // Food cooked on an earlier day keeps its cook day: dragging one of its cards moves just that meal.
      const b=state.batches.find(x=>x.id===payload.id);
      if(b&&payload.from&&preparationDate(b)<localDate(new Date())){const next=choosePortion(state,payload.id,target,payload.from);ui.pick=null;if(commit(next,'Meal moved. It’s already cooked, so its cook day stays put.'))celebratePlaced(target);return;}
      const next=placeBatch(state,payload.id,target);ui.pick=null;if(commit(next,'Batch start moved. Portions, dates and food left have been rebuilt.'))celebratePlaced(target);
    } else if(payload.kind==='portion') {const next=choosePortion(state,payload.id,target,payload.from);ui.pick=null;if(commit(next,'Portion moved. The rest of the week adjusted around it.'))celebratePlaced(target);}
  } catch(e) {toast(e.message,'error');}
}
// Recipe fetch: any card with a food photo that opens recipe/batch details hands its element to the rat.
const FETCH_CARDS='.recipe-card,.portion,.next-item,.batch-pill,.dc-row,.prep-batch,[data-suggested-recipe]';
const fetchSource=el=>{const card=el.closest(FETCH_CARDS);return card?.querySelector('.card-img')?card:null;};
const fetchFrom=card=>{if(card?.isConnected)fetchCard(card,$('dialog'),{hold:ratLive('hold'),peek:ratLive('peek')});};
function download(name,data,type) {const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function about() {dialog('About Mealstack',`<div class="prose"><p>${esc(DATA_NOTE)}</p><p><strong>Portions:</strong> portion estimates allow for generous meals. Adjust the number of portions to suit your appetite, or change the batch size to scale the ingredients. Snacks are labeled separately.</p><p><strong>Prices:</strong> meal costs cover the quantities used. Your grocery list rounds up to whole packages. Update package sizes and whole-package prices in the grocery list or a meal’s ingredient table. Food left shows the planned ingredient balance after each cooking day. Prices are not connected to a live store feed.</p><p><strong>Enjoy-by dates:</strong> batches start with a 1–2-day window to help keep meals fresh. You can change this in the batch details. Portions are scheduled on or before that date. For safe storage and reheating, see <a href="https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety" target="_blank" rel="noopener noreferrer">USDA leftover guidance ↗</a>.</p><p><strong>Your plan:</strong> changes save in this browser. Export a backup to keep a copy or move your plan to another device. Plans do not sync automatically.</p></div>`);}
function how() {dialog('One batch. A few good meals.',`<div class="prose"><p><strong>1. Find a meal.</strong> Open its details to check ingredients, cost, time and cleanup. Drag its card onto the week, or use its ⠿ button and choose a slot.</p><p><strong>2. Let the portions spread out.</strong> A three-portion batch creates up to three occupied slots, from its available time through its enjoy-by date. Mains go to lunch/dinner, breakfasts to breakfast and snacks to snack slots.</p><p><strong>3. Choose from a stack.</strong> Multiple batches can compete for a slot. Your most recently dropped batch takes priority. Otherwise the earlier enjoy-by date wins; ties favor the batch with more portions per remaining suitable slot. Alternatives don’t use a portion until chosen.</p><p><strong>4. Move anything.</strong> Drag any meal card, or use its ⠿ button then choose a new start. The whole batch moves, its enjoy-by window shifts with it, and automatic portions rebuild around your drop. Covered batch starts move to their next meal, with a fresh cooking window. Other manually chosen slots stay fixed unless you drop onto them. To prepare earlier, open a batch and choose “Keep a separate prep date”. It stays on that day while other meals move around it; dragging that whole batch yourself moves all of its dates together. To place just one cooked portion, open its recipe and choose “Place one portion only”.</p><p><strong>5. Check what’s unplaced.</strong> Extra portions appear under Your batches. They are never silently put beyond their enjoy-by date. Snack slots are optional: two between breakfast and lunch, two between lunch and dinner, and one after dinner.</p></div>`);}
function settings() {dialog('Your plan',`<div class="prose"><p>Your week saves in this browser. Export it to keep a backup or open it on another device.</p><div class="settings-actions"><button class="secondary" data-action="export">↓ Export plan</button><label class="secondary file-button">↑ Import plan<input id="import-file" type="file" accept="application/json,.json"></label></div><button class="text-button" data-action="example">Load example week</button><button class="text-button" data-action="how">How portions & stacks work ↗</button><button class="text-button" data-action="about">About the estimates ↗</button></div>`);}

document.addEventListener('toggle',e=>{if(e.target.matches?.('.more-filters')&&e.target.isConnected)ui.moreFilters=e.target.open;},true);

document.addEventListener('click',e=>{
  if(ui.pick&&e.target.closest('.meal-slot')){applyDrop(ui.pick,e.target.closest('.meal-slot').dataset.slot);return;}
  const el=e.target.closest('[data-action]');
  if(!el){if(ui.pick && e.target.closest('[data-slot]'))applyDrop(ui.pick,e.target.closest('[data-slot]').dataset.slot);return;}
  if(ui.justDragged)return;
  const a=el.dataset.action,id=el.dataset.id;
  if(el.disabled)return;
  if(el.closest('form') && el.type!=='submit')e.preventDefault();
  if(a==='nav'){e.preventDefault();ui.view=id;ui.pick=null;render();window.scrollTo(0,0);}
  if(a==='pantry-open'){ui.pantryEdits=0;ui.pantryQuery='';ui.pantryAll=!shopping(state).items.length;pantryDialog();}
  if(a==='pantry-scope'){ui.pantryAll=id==='all';pantryDialog();}
  if(a==='pantry-match')changePantry(id,'match');
  if(a==='pantry-package')changePantry(id,'package');
  if(a==='pantry-amount')pantryAmountDialog(id);
  if(a==='pantry-back')pantryDialog();
  if(a==='pantry-undo'&&ui.pantryEdits&&ui.history.length){ui.pantryEdits--;state=ui.history.pop();save();render();refreshPantry();toast('Last change undone.');}
  if(a==='details'){const card=fetchSource(el);openMeal(id);fetchFrom(card);}
  if(a==='plan-week'){ui.view='week';ui.pick=null;state.week=id;save();render();$('.week-toolbar')?.scrollIntoView({block:'start'});}
  if(a==='groceries-week'){ui.view='groceries';mutate(s=>s.week=id);window.scrollTo(0,0);}
  if(a==='planner-view'){ui.plannerView=id;ui.pick=null;render();document.querySelector(`.planner-tools [data-id="${id}"]`)?.focus({preventScroll:true});}
  if(a==='jump-day'){const scroller=$('.week-scroll'),day=[...document.querySelectorAll('[data-day]')].find(day=>day.dataset.day===id);if(scroller&&day)scroller.scrollTo({left:scroller.scrollLeft+day.getBoundingClientRect().left-scroller.getBoundingClientRect().left,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  if(a==='cook-batch'){const b=state.batches.find(b=>b.id===id);if(b){ui.cookContext={id:b.recipeId,batch:b.id,draft:structuredClone(b)};showCooking();}}
  if(a==='favorite'){if(!state.favorites.includes(id))flashAfterRender(`[data-recipe="${CSS.escape(id)}"] .favorite-button`,'just-faved','hearts');}
  if(a==='favorite')mutate(s=>s.favorites=s.favorites.includes(id)?s.favorites.filter(x=>x!==id):[...s.favorites,id]);
  if(a==='craving'){ui.q=ui.q===id?'':id;render();}
  if(a==='toggle-theme'){
    const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';
    document.documentElement.dataset.theme=theme;
    el.setAttribute('aria-pressed',String(theme==='dark'));el.title=`Switch to ${theme==='dark'?'light':'dark'} mode`;
    document.querySelector('meta[name="theme-color"]').content=theme==='dark'?'#2B1B4A':'#FFF4D6';
    try{localStorage.setItem('mealstack.theme',theme);}catch{}
  }
  if(a==='jump-cleanup'){const checklist=$('#cleanup-checklist');checklist.open=true;checklist.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});checklist.querySelector('summary').focus({preventScroll:true});}
  if(a==='suggest-plan')planningDialog();
  if(a==='auto-plan')autoPlan();
  if(a==='go-shop'){ui.view='groceries';ui.shoppingMode=true;ui.stockMode=false;ui.pick=null;render();window.scrollTo(0,0);}
  if(a==='apply-plan'&&ui.proposal?.added.length){
    updatePlanSettings();
    if(!ui.planDirty){ui.view='week';if(commit(ui.proposal.state,'Your meals are planned. Open Grocery list to check your pantry.')){closeDialog();$('[data-action="suggest-plan"]')?.focus({preventScroll:true});fx('confetti');hop($('.next-rat'));}}
  }
  if(a==='shopping-mode'){ui.shoppingMode=id==='shop';ui.stockMode=id==='stock';render();document.querySelector(`.shopping-toolbar [data-id="${id}"]`)?.focus({preventScroll:true});}
  if(a==='day-close')setDayOpen(ui.dayOpen===id?null:id,{focus:true});
  if(a==='day-close-x')setDayOpen(null,{focus:true});
  if(a==='day-stock'){ui.view='groceries';ui.stockMode=true;ui.shoppingMode=false;ui.stockDays[state.week]=id;render();window.scrollTo(0,0);}
  if(a==='ingredient-date')ingredientDateDialog(id);
  if(a==='stock-day'){ui.stockDays[state.week]=id==='start'?null:id;render();document.querySelector(`.stock-days [data-id="${id}"]`)?.focus({preventScroll:true});}
  if(a==='show-all-shopping'){ui.hideBought=false;render();}
  if(a==='print'){document.body.classList.toggle('printing-recipe',!!$('dialog'));window.print();}
  if(a==='jump-recipe')$('#cooking-instructions')?.scrollIntoView({behavior:reduceMotion()?'auto':'smooth',block:'start'});
  if(a==='start-cooking'&&$('#meal-form')?.reportValidity())startCooking(id);
  if(a==='back-to-recipe'){const c=ui.cookContext;openMeal(c.id,c.batch,c.draft);}
  if(a==='reset-cooking'){saveCookingProgress([]);showCooking();}
  if(a==='next-step'){const input=$('[data-cook-step]:not(:checked)');if(input){input.closest('li').scrollIntoView({behavior:reduceMotion()?'auto':'smooth',block:'center'});input.focus({preventScroll:true});}else toast('All steps complete. Enjoy your meal and pack the extra portions.','success');}
  if(a==='batch'){const b=state.batches.find(b=>b.id===id);if(b){const card=fetchSource(el);openMeal(b.recipeId,b.id);fetchFrom(card);}}
  if(a==='close')closeDialog();
  if(a==='use-ingredient'||a==='date-find-meals'){if(a==='date-find-meals')closeDialog();Object.assign(ui,{view:'meals',ingredient:id,q:'',kind:'all',protein:'all',method:'all',cheap:false,quick:false,easy:false,onepot:false,dump:false,veg:false,favorites:false});render();window.scrollTo(0,0);$('#meal-search')?.focus({preventScroll:true});}
  if(a==='kind'){ui.kind=id;render();}
  if(a==='filter'){ui[id]=!ui[id];render();}
  if(a==='reset-filters'){Object.assign(ui,{ingredient:null,q:'',kind:'all',protein:'all',method:'all',cheap:false,quick:false,easy:false,onepot:false,dump:false,veg:false,favorites:false});render();}
  if(a==='prev-week'||a==='next-week'){ui.pick=null;mutate(s=>s.week=addDays(s.week,a==='prev-week'?-7:7));}
  if(a==='today'){mutate(s=>s.week=monday(localDate()));}
  if(a==='toggle-library'){ui.showLibrary=!ui.showLibrary;render();}
  if(a==='cancel-pick'){ui.pick=null;render();}
  if(a==='place'||a==='move'||a==='move-serving'){if(a==='move-serving')closeDialog();ui.view='week';ui.plannerView='calendar';ui.pick={kind:a==='place'?'recipe':a==='move-serving'?'portion':'batch',id,from:a==='move-serving'?Object.values(schedule(state).cells).find(c=>c.chosen===id)?.id:el.dataset.from};if(a==='place'&&recipeById[id].kind==='snack')state.showSnacks=true;render();toast('Choose a slot on the week. Escape cancels.');$('.placement-banner')?.scrollIntoView({behavior:reduceMotion()?'auto':'smooth',block:'nearest'});}
  if(a==='slot'){if(ui.pick)applyDrop(ui.pick,el.dataset.slot);else{dialog('Choose a batch for this slot',`<p class="field-help">Available at ${SLOT_LABELS[typeOf(el.dataset.slot)]}, ${shortDate(dayOf(el.dataset.slot))}. Add a recipe to create its full batch.</p><input type="search" id="slot-search" placeholder="Search meals and details" aria-label="Search meals for this slot"><div class="slot-picker">${RECIPES.filter(r=>matchesMeal(r,searchTerms(''))).map(r=>`<button data-action="quick-add" data-id="${r.id}" data-slot="${el.dataset.slot}" style="${colors(r)}"><span>${media(r,'thumb')}${esc(r.title)}</span><small>${r.servings} ${r.kind==='snack'?'snacks':'portions'} · ${money(batchCost(r,1,state.prices,state.packageSizes))} / batch</small></button>`).join('')}</div>`);}} 
  if(a==='quick-add'){closeDialog();applyDrop({kind:'recipe',id},el.dataset.slot);}
  if(a==='choose'){try{commit(choosePortion(state,id,el.dataset.slot),'Your choice is pinned. Other portions adjusted.');}catch(err){toast(err.message,'error');}}
  if(a==='unpin'||a==='unpin-batch'){const slots=a==='unpin'?[el.dataset.slot]:pinnedSlots(id);if(a==='unpin-batch')closeDialog();try{if(commit(unpin(state,...slots)))toast('Unpinned','success',{action:'undo',label:'Undo'});}catch(err){toast(err.message,'error');}}
  if(a==='undo'){if(ui.history.length){state=ui.history.pop();ui.pick=null;save();render();toast('Last change undone.');}}
  if(a==='clear')dialog('Clear this week?',`<div class="prose"><p>This removes batches made ${shortDate(state.week)} – ${shortDate(addDays(state.week,6))}. Batches carried in from an earlier week stay available. You can undo this.</p><div class="modal-actions"><button class="secondary" data-action="close">Keep the plan</button><button class="primary" data-action="confirm-clear">Clear week</button></div></div>`);
  if(a==='confirm-clear'){closeDialog();ui.pick=null;mutate(s=>{for(const b of [...s.batches])if(dayOf(b.startSlot)>=s.week&&dayOf(b.startSlot)<=addDays(s.week,6))removeBatch(s,b.id);},'Week cleared. Choose something new.');}
  if(a==='delete-batch'){closeDialog();mutate(s=>removeBatch(s,id),'Batch removed. Undo brings it back.');}
  if(a==='how')how();if(a==='about')about();if(a==='settings')settings();
  if(a==='example'){closeDialog();if(commit(demoState(dayOf(state.week)),'Example week loaded. Undo restores your previous plan.')){ui.isExample=true;render();}}
  if(a==='export')download(`mealstack-${state.week}.json`,JSON.stringify(state,null,2),'application/json');
  if(a==='download-list'){const g=shopping(state);download(`groceries-${state.week}.txt`,`Mealstack grocery estimates · ${shortDate(state.week)}\n\n${AISLES.map(aisle=>{const items=g.items.filter(i=>aisleFor(i.id)===aisle);return items.length?`${aisle.toUpperCase()}\n${items.map(i=>`${!i.packs?'[at home]':i.checked?'[bought]':'[ ]'} ${i.name}: recipe total ${quantity(i.qty,i.unit,i.id,'grocery')}; have ${quantity(i.pantry,i.unit,i.id,'grocery')}${pantryShortfall(i)?`; ${pantryShortfall(i)}`:''}; buy ${i.packs} × ${packageLabel(i.id,i.packQty)}; ${count(i.remainingPacks,'pack')} still to get — ${money(i.buyCost)}`).join('\n')}\n`:'';}).filter(Boolean).join('\n')}\n${stockExport()}\nWhole packages: ${money(g.basket)}\nStill to buy: ${money(g.remainingCost)}\nIngredients used: ${money(g.used)}\nKitchen measures are rounded; package counts use full quantities. Planning estimates, not live store prices. Before tax.\n`,'text/plain');}
  if(a==='price'){
    const form=$('#meal-form');ui.returnMeal=form?{id:form.dataset.recipe,batch:form.dataset.batch||null,draft:readMealForm(form)}:null;
    const item={...INGREDIENTS[id],packQty:packageSize(id,state.packageSizes)},measure=packageMeasure(item.unit);
    dialog('Package size & price',`<form id="price-form" data-id="${id}"><p class="package-name">${esc(item.name)}</p><p class="field-help">${packageLabel(id,item.packQty)}</p><div class="form-row"><label>${isDrained(id)?'Drained amount in one package':'Amount in one package'} (${measure.unit})<input name="packageQty" type="text" inputmode="text" required value="${packageValue(item.packQty,item.unit)}"></label><label>Price for that whole package ($)<input name="price" type="number" min="0" max="1000" step="0.01" required value="${price(id,state.prices).toFixed(2)}"></label></div><p class="field-help">${isDrained(id)?'Use the drained food amount, not the can’s weight including liquid. ':''}Match the package you actually buy. These estimates apply to recipes, groceries and the food-left view. Food already marked bought keeps its original amount.</p><div class="modal-actions"><button class="primary" type="submit">Save package</button></div></form>`);
  }
});
function updateMealDateLimits(form) {
  const {date,prepDate,useBy,separatePrep}=form.elements;
  if(!date.value)return;
  prepDate.min=addDays(date.value,-7);prepDate.max=date.value;
  useBy.min=date.value;useBy.max=addDays(date.value,7);
  const hint=form.querySelector('[data-relative-prep]');
  hint.hidden=separatePrep.checked||form.dataset.prepAhead!=='true';
  if(!hint.hidden)hint.textContent=`Prepare the evening of ${shortDate(addDays(date.value,-1))} for the available date shown. `;
  const cleanup=form.querySelector('.cleanup-card');
  if(cleanup)cleanup.outerHTML=cleanupCard(recipeById[form.dataset.recipe],readMealForm(form),cleanup.open);
}
function readMealForm(form) {const f=new FormData(form);return {...(form.dataset.batch?{id:form.dataset.batch}:{}),...(f.has('separatePrep')?{prepDate:f.get('prepDate')}:form.dataset.prepAhead==='true'?{prepAhead:true}:{}),scale:Number(f.get('scale')),portions:Number(f.get('portions')),startSlot:slot(f.get('date'),f.get('type')),useBy:f.get('useBy'),estimates:{active:Number(f.get('active')),total:Number(f.get('total')),cleanup:Number(f.get('cleanup'))}};}
document.addEventListener('input',e=>{
  if(e.target.closest('#plan-suggestion-form'))updatePlanSettings();
  if(e.target.id==='pantry-search'){ui.pantryQuery=e.target.value;refreshPantry();}
  if(e.target.id==='meal-search'){ui.q=e.target.value;render();}
  if(e.target.id==='slot-search'){
    const terms=searchTerms(e.target.value);
    for(const b of document.querySelectorAll('.slot-picker button'))b.hidden=!matchesMeal(recipeById[b.dataset.id],terms);
  }
});
document.addEventListener('change',async e=>{
  const el=e.target;
  if(el.closest('#plan-suggestion-form')){
    if(el.name==='matchIngredients'){ui.matchIngredients=el.checked;try{localStorage.setItem(MATCH_INGREDIENTS_STORE,String(el.checked));}catch{}}
    updatePlanSettings();
  }
  if(['method-filter','protein-filter','sort-filter'].includes(el.id)){ui[el.id.split('-')[0]]=el.value;render();}
  if(el.id==='avoid-ingredients')mutate(s=>s.avoid=el.value.trim(),'Ingredient preferences saved.');
  if(el.id==='show-used-stock'){ui.showUsedStock=el.checked;render();}
  if(el.id==='hide-bought'){ui.hideBought=el.checked;render();}
  if(el.dataset.bought){const item=shopping(state).items.find(i=>i.id===el.dataset.bought),got=el.checked,rect=el.getBoundingClientRect(),sel=CSS.escape(item.id);
    if(got){flashAfterRender(`[data-bought="${sel}"]`,'just-checked');flashAfterRender(`:is(.shopping-item,tr):has([data-bought="${sel}"])`,'just-got');}
    if(mutate(s=>{s.purchased[s.week]??={};s.purchased[s.week][item.id]=got?item.bought+item.remainingPacks*item.packQty:0;})&&got)shopCheer(rect);}
  if(el.dataset.pantryQty){const item=shopping(state).items.find(i=>i.id===el.dataset.pantryQty),value=pantryAmount(el.value,item);if(el.value===''||!Number.isFinite(value)||value<0||value>1e7){toast('Enter an amount such as 1, ½ or 1 1/2.','error');render();}else mutate(s=>{s.pantryQty[s.week]??={};s.pantryQty[s.week][el.dataset.pantryQty]=value;s.haveEnough[s.week]=(s.haveEnough[s.week]||[]).filter(id=>id!==el.dataset.pantryQty);});}
  if(el.dataset.cookStep!==undefined){const c=ui.cookContext,step=Number(el.dataset.cookStep),done=new Set(cookingStatus(c).done);if(el.checked)done.add(step);else done.delete(step);saveCookingProgress([...done]);el.closest('li').classList.toggle('complete',el.checked);$('#cook-progress').value=done.size;$('#cook-progress-label').textContent=`${done.size} of ${count(recipeById[c.id].steps.length,'step')} complete`;cookCheer(el,done.size,recipeById[c.id].steps.length);}
  if(el.id==='show-snacks')mutate(s=>s.showSnacks=el.checked);
  if(el.id==='snack-count'){
    const n=Number(el.value),hasSecond=state.batches.some(b=>typeOf(b.startSlot).endsWith('-2'))||Object.keys(state.pins).some(id=>typeOf(id).endsWith('-2'));
    if(n===1&&hasSecond){toast('Move batches and pinned portions out of second snack slots first.');render();}else mutate(s=>s.snackCount=n,'Snack slots updated; automatic portions rebalanced.');
  }
  if(el.dataset.pantry)mutate(s=>{const current=s.haveEnough[s.week]||[];s.haveEnough[s.week]=el.checked?[...new Set([...current,el.dataset.pantry])]:current.filter(id=>id!==el.dataset.pantry);s.pantryQty[s.week]??={};s.pantryQty[s.week][el.dataset.pantry]=el.checked?shopping(state).items.find(i=>i.id===el.dataset.pantry).qty:0;});
  if(el.dataset.price){const value=Number(el.value);if(el.value===''||!Number.isFinite(value)||value<0||value>1000){toast('Enter a package price from $0 to $1,000.','error');render();}else mutate(s=>s.prices[el.dataset.price]=value);}
  if(el.id==='batch-scale'||el.id==='batch-portions'){const f=$('#meal-form'),b=readMealForm(f);if(el.id==='batch-scale')b.portions=yieldFor(recipeById[f.dataset.recipe],b.scale);if(Number.isInteger(b.portions)&&b.portions>=1&&b.portions<=30)openMeal(f.dataset.recipe,f.dataset.batch||null,b);}
  if(el.name==='separatePrep'&&el.closest('#meal-form')){
    const f=el.form,prep=f.elements.prepDate;
    $('#prep-date-field').hidden=!el.checked;prep.disabled=!el.checked;prep.required=el.checked;
    if(el.checked){const available=f.elements.date.value||prep.value||state.week;prep.value=f.dataset.prepAhead==='true'?addDays(available,-1):available;prep.dataset.previous=prep.value;}
    else {f.dataset.prepAhead='false';if(f.elements.date.value)f.elements.useBy.value=addDays(f.elements.date.value,recipeById[f.dataset.recipe].qualityDays);}
    f.querySelector('[data-available-label]').textContent=el.checked?'Available date':'Make / available date';
    updateMealDateLimits(f);
  }
  if(el.name==='date'&&el.closest('#meal-form')&&el.value){
    const f=el.form,r=recipeById[f.dataset.recipe];
    if(!f.elements.separatePrep.checked)f.elements.useBy.value=addDays(el.value,r.qualityDays-(f.dataset.prepAhead==='true'?1:0));
    updateMealDateLimits(f);
  }
  if(el.name==='prepDate'&&el.closest('#meal-form')&&el.value){
    const f=el.form,offset=Math.round((Date.parse(el.value)-Date.parse(el.dataset.previous))/86400000);
    if(Number.isFinite(offset)&&f.elements.useBy.value)f.elements.useBy.value=addDays(f.elements.useBy.value,offset);
    el.dataset.previous=el.value;updateMealDateLimits(f);
  }
  if(el.id==='import-file'&&el.files[0]){try{if(el.files[0].size>1024*1024)throw Error('That file is too large. Choose a Mealstack JSON export under 1 MB.');const next=validateState(JSON.parse(await el.files[0].text()));closeDialog();commit(next,'Plan imported. Undo restores the previous plan.');}catch(err){toast(err.message,'error');el.value='';}}
});
document.addEventListener('submit',e=>{
  if(e.target.id==='plan-suggestion-form'){e.preventDefault();rerollPlan();}
  if(e.target.id==='meal-form'){
    e.preventDefault();const f=e.target,b=readMealForm(f),r=recipeById[f.dataset.recipe];
    const next=structuredClone(state);next.estimates[r.id]=b.estimates;if(f.dataset.batch)removeBatch(next,f.dataset.batch);
    const edited={...makeBatch(r.id,b.startSlot,b.scale,b.portions),...b,id:f.dataset.batch||crypto.randomUUID()};next.batches.push(edited);
    if(r.kind==='snack'||typeOf(b.startSlot).startsWith('snack'))next.showSnacks=true;
    next.week=monday(dayOf(b.startSlot));ui.view='week';
    try {if(commit(placeBatch(next,edited.id,edited.startSlot),`${count(b.portions,'portion')} planned. Check Your batches for anything that didn’t fit.`))closeDialog();} catch(err) {toast(err.message,'error');}
  }
  if(e.target.id==='pantry-amount-form'){
    e.preventDefault();const f=e.target,id=f.dataset.id,item=pantryChoices(state,'',true).find(i=>i.id===id),amount=pantryAmount(new FormData(f).get('amount'),item);
    try {if(commit(updatePantry(state,id,'set',amount),'Amount at home updated.')){ui.pantryEdits=Math.min(ui.history.length,ui.pantryEdits+1);pantryDialog();refreshPantry(id,'pantry-amount');}} catch(err){toast(err.message,'error');}
  }
  if(e.target.id==='ingredient-date-form'){
    e.preventDefault();const f=e.target,id=f.dataset.id,value=new FormData(f).get('useBy');
    if(mutate(s=>{s.ingredientDates[s.week]??={};if(value)s.ingredientDates[s.week][id]=value;else delete s.ingredientDates[s.week][id];},value?'Ingredient date saved.':'Ingredient date cleared.'))closeDialog();
  }
  if(e.target.id==='price-form'){
    e.preventDefault();const f=e.target,id=f.dataset.id,data=new FormData(f),value=Number(data.get('price'));
    const size=packageAmount(data.get('packageQty'),{...INGREDIENTS[id],id,packQty:packageSize(id,state.packageSizes)});
    if(!Number.isFinite(size)||size<1||size>1e7||(['each','slice'].includes(INGREDIENTS[id].unit)&&!Number.isInteger(size))){toast('Enter a positive package size; use whole counts for items and slices.','error');return;}
    if(!Number.isFinite(value)||value<0||value>1000){toast('Enter a package price from $0 to $1,000.','error');return;}
    if(!mutate(s=>{s.prices[id]=value;s.packageSizes[id]=size;},'Package size and price updated.'))return;
    const back=ui.returnMeal;if(back)openMeal(back.id,back.batch,back.draft);else closeDialog();
  }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&ui.pick){ui.pick=null;render();}
  if(e.key==='Escape'&&ui.dayOpen&&!document.querySelector('dialog[open]')){e.preventDefault();setDayOpen(null,{focus:true});}
  // The phone sheet keeps Tab inside it while it covers the page.
  if(e.key==='Tab'&&ui.dayOpen&&isPhone()){const panel=$('.day-close.is-open .day-close-body'),items=panel?[...panel.querySelectorAll('button:not([hidden])')].filter(b=>b.offsetParent):[];
    if(items.length&&(e.shiftKey?document.activeElement===items[0]||document.activeElement===panel:document.activeElement===items.at(-1))){e.preventDefault();(e.shiftKey?items.at(-1):items[0]).focus();}}
  if((e.key==='Enter'||e.key===' ')&&ui.pick&&e.target.matches('.meal-slot')){e.preventDefault();applyDrop(ui.pick,e.target.dataset.slot);}
});
let dragging=null;
function payloadFrom(el) {const r=el.closest('[draggable="true"]');return r?.dataset.recipe?{kind:'recipe',id:r.dataset.recipe}:r?.dataset.batch?{kind:'batch',id:r.dataset.batch,from:r.dataset.from}:null;}
function clearDrop() {document.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));}
document.addEventListener('dragstart',e=>{const p=payloadFrom(e.target);if(!p)return;dragging=p;e.dataTransfer.setData('application/x-mealstack',JSON.stringify(p));e.dataTransfer.effectAllowed=p.kind==='recipe'?'copy':'move';e.target.classList.add('dragging');});
document.addEventListener('dragend',()=>{dragging=null;clearDrop();document.querySelectorAll('.dragging').forEach(el=>el.classList.remove('dragging'));});
document.addEventListener('dragover',e=>{const cell=e.target.closest('[data-slot]');if(!cell||(!dragging&&!e.dataTransfer.types.includes('application/x-mealstack')))return;e.preventDefault();e.dataTransfer.dropEffect=dragging?.kind==='recipe'?'copy':'move';clearDrop();cell.closest('.meal-slot')?.classList.add('drop-target');const board=$('.week-scroll');if(board){const r=board.getBoundingClientRect();if(e.clientX>r.right-45)board.scrollLeft+=14;if(e.clientX<r.left+45)board.scrollLeft-=14;}});
document.addEventListener('drop',e=>{const cell=e.target.closest('[data-slot]');if(!cell)return;e.preventDefault();clearDrop();try{const p=dragging||JSON.parse(e.dataTransfer.getData('application/x-mealstack'));applyDrop(p,cell.dataset.slot);}catch{toast('Drag a meal from this planner.');}dragging=null;});
// Touch handles retain ordinary page scrolling everywhere else. Tap-to-place is also available.
document.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'||!e.target.closest('.drag-handle'))return;
  const p=payloadFrom(e.target);if(!p)return;
  const startX=e.clientX,startY=e.clientY;let ghost=null,moved=false;
  const move=event=>{if(!moved&&Math.hypot(event.clientX-startX,event.clientY-startY)<8)return;moved=true;event.preventDefault();if(!ghost){ghost=document.createElement('div');ghost.className='touch-ghost';ghost.textContent=recipeById[p.kind==='recipe'?p.id:state.batches.find(b=>b.id===p.id)?.recipeId]?.title;document.body.append(ghost);}ghost.style.left=event.clientX+'px';ghost.style.top=(event.clientY-45)+'px';clearDrop();document.elementFromPoint(event.clientX,event.clientY)?.closest('.meal-slot')?.classList.add('drop-target');const board=$('.week-scroll');if(board){const r=board.getBoundingClientRect();if(event.clientY>=r.top&&event.clientY<=r.bottom){if(event.clientX>r.right-35)board.scrollLeft+=18;if(event.clientX<r.left+35)board.scrollLeft-=18;}}if(event.clientY>innerHeight-75)window.scrollBy(0,16);if(event.clientY<75)window.scrollBy(0,-16);};
  const finish=event=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',finish);document.removeEventListener('pointercancel',finish);ghost?.remove();clearDrop();if(moved){ui.justDragged=true;setTimeout(()=>{ui.justDragged=false;},400);if(event.type==='pointerup'){const cell=document.elementFromPoint(event.clientX,event.clientY)?.closest('.meal-slot');if(cell)applyDrop(p,cell.dataset.slot);}}};
  document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',finish);document.addEventListener('pointercancel',finish);
});
const toastEl=$('#toast');if(toastEl&&toastEl.showPopover){toastEl.setAttribute('popover','manual');try{toastEl.showPopover();}catch{toastEl.removeAttribute('popover');}}
document.documentElement.classList.add('first-paint');setTimeout(()=>document.documentElement.classList.remove('first-paint'),1000);
injectMascots();injectIngredientRats();render();watchRats();if(loadError)toast(loadError,'error');
