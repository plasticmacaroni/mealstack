import {RECIPES} from './data.js';
import {addDays,localDate,monday,slot,dayOf,typeOf,rank,makeBatch,schedule,shopping,purchaseFor,batchCost,price,removeBatches} from './engine.js';
import {matchesQuery} from './discovery.js';

export const menuSignature = batches => [...new Set(batches.map(b=>b.recipeId))].sort().join('|');
const randomSeed=()=>globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
// Unused shelf-stable ingredients are easier to carry forward than fresh food.
// The matching score estimates unused package value, not actual spoilage.
const shelfStable=new Set('rice instantRice pasta noodles orzo lasagna couscous barley oats flour cornbread polenta breadcrumbs oil sesameOil soy vinegar honey peanut jelly mustard pickles balsamicGlaze herbs italianHerbs garlicPowder onionPowder sweetPaprika cumin cinnamon coriander turmeric dill cornstarch cocoa nuts raisins popcorn seaweed tortillaStrips crackers granola'.split(' '));
const wasteWeight=id=>shelfStable.has(id)?.1:1;
function shoppingFootprint(state) {
  const groceries=shopping(state);
  const waste=groceries.items.reduce((sum,i)=>{
    // Measure the change from stock already on hand, so using that stock helps
    // and untouched pantry ingredients do not distort comparisons between menus.
    const unmeasured=state.pantryQty?.[state.week]?.[i.id]===undefined&&(state.haveEnough[state.week]||[]).includes(i.id);
    return sum+(unmeasured?0:(i.remainingPacks*i.packQty-i.qty)/i.packQty*i.packCost*wasteWeight(i.id));
  },0);
  return {waste,itemsToBuy:groceries.items.filter(i=>i.remainingPacks>0).length};
}
function randomFor(seed) {
  let value=seed>>>0;
  return ()=>{value+=0x6D2B79F5;let t=Math.imul(value^(value>>>15),1|value);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
}

// A fresh weighted draw, bounded by real package costs. Recent menus and repeated
// proteins/cuisines get less weight; several attempts prevent an unlucky draw wasting slots.
// Breakfast and lunch are prepared the night before, so today's are already out of
// reach; today's dinner stays plannable until mid-afternoon. Past days never are.
export function firstPlannableSlot(now) {
  const today=localDate(now);
  return now.getHours()<16?slot(today,'dinner'):slot(addDays(today,1),'breakfast');
}

// "Just do it for me": once fewer than four days still have a plannable dinner
// (Thursday after 4pm through Sunday), plan the coming week instead. Past weeks
// move forward to the current one first.
export const MIN_PLANNABLE_DAYS=4;
export function planningWeek(week,now=new Date()) {
  const earliest=rank(firstPlannableSlot(now)),current=monday(localDate(now));
  const start=week<current?current:week;
  const days=Array.from({length:7},(_,i)=>addDays(start,i)).filter(d=>rank(slot(d,'dinner'))>=earliest).length;
  return days>=MIN_PLANNABLE_DAYS?start:addDays(start,7);
}

export function suggestPlan(state, {budget=100,maxCost=3,maxActive=20,style='simple',avoid=state.avoid||'',seed=randomSeed(),recentPlans=[],scope='mains',meals,matchIngredients=false,now=null}={}) {
  const earliest=now?rank(firstPlannableSlot(now)):-Infinity;
  const selected=['breakfast','lunch','dinner'].filter(type=>(meals??(scope==='dinners'?['dinner']:['lunch','dinner'])).includes(type));
  if(!selected.length)return {state:structuredClone(state),added:[],replaced:[],unfilled:0,repeated:false};
  const matching=matchIngredients===true;
  const end=addDays(state.week,6);
  // Preserve batches serving unchecked meals, including shared lunch/dinner batches,
  // and suggested batches she has moved a meal of: those are her choices now.
  const existing=schedule(state),outsideSelection=new Set(Object.values(existing.cells)
    .filter(c=>c.chosen&&(c.manual||!selected.includes(typeOf(c.id)))).map(c=>c.chosen));
  const replaced=state.batches.filter(b=>b.autoPlanned&&selected.includes(typeOf(b.startSlot))&&!outsideSelection.has(b.id)
    &&dayOf(b.startSlot)>=state.week&&dayOf(b.startSlot)<=end&&rank(b.startSlot)>=earliest);
  const base=removeBatches(state,replaced.map(b=>b.id));
  // Slots already holding a meal are off limits: new batches only take empty slots.
  const before=schedule(base),taken=new Set(Object.values(before.cells).filter(c=>c.chosen).map(c=>c.id));
  const targets=Array.from({length:7},(_,i)=>addDays(state.week,i)).flatMap(day=>selected.map(type=>slot(day,type))).filter(id=>rank(id)>=earliest);
  const choices=RECIPES.filter(r=>(r.kind==='breakfast'?selected.includes('breakfast'):r.kind==='main'&&selected.some(t=>t!=='breakfast'))&&(state.estimates[r.id]?.active??r.active)<=maxActive
    && batchCost(r,1,state.prices,state.packageSizes)/r.servings<=maxCost
    && (style==='any'||r.onePot||r.dump||['tray','air','bowl'].includes(r.method))&&matchesQuery(r,'',{avoid}));
  const history=recentPlans.filter(Array.isArray).slice(-12);
  if(replaced.length)history.push(replaced.map(b=>b.recipeId));
  const recentSignatures=new Set(history.map(ids=>[...new Set(ids)].sort().join('|')));
  const recentPenalty=new Map();
  history.slice().reverse().forEach((ids,age)=>{for(const id of new Set(ids))recentPenalty.set(id,(recentPenalty.get(id)||0)+4/(age+1));});
  const protectedBatches=base.batches.filter(b=>dayOf(b.startSlot)>=base.week&&dayOf(b.startSlot)<=end);
  const recipeMap=new Map(RECIPES.map(r=>[r.id,r]));
  const attempts=[];
  const suitable=(r,id)=>(typeOf(id)==='breakfast'?r.kind==='breakfast':r.kind==='main')&&(typeOf(id)!=='lunch'||r.fit.lunch!=='home');
  // Keep the usual varied proposals as fallbacks, then grow a shared-ingredient
  // plan around every matching recipe. No random shortlist can hide a better base.
  for(let attempt=0;attempt<8+(matching?choices.length:0);attempt++) {
    const reuse=matching&&attempt>=8,anchor=reuse?choices[attempt-8]:null;
    const anchorSlot=anchor?targets.find(id=>!taken.has(id)&&suitable(anchor,id)):null;
    const random=randomFor((seed+Math.imul(attempt,0x9E3779B9))>>>0),next=structuredClone(base),added=[];
    const recipeCounts=new Map(),proteinCounts=new Map(),cuisineCounts=new Map();
    const count=r=>{for(const [map,key] of [[recipeCounts,r.id],[proteinCounts,r.protein],[cuisineCounts,r.cuisine]])map.set(key,(map.get(key)||0)+1);};
    protectedBatches.forEach(b=>count(recipeMap.get(b.recipeId)));
    const priorities=new Map(choices.map(r=>[r.id,random()*6]));
    for(const target of targets) {
      if(taken.has(target)||next.placements[target]||next.batches.length>=200)continue;
      const current=shopping(next),byIngredient=new Map(current.items.map(i=>[i.id,i]));
      const candidates=[];
      for(const r of choices) {
        // Lunch assumes a confirmed fridge + microwave; crisp dishes need home equipment.
        if(!suitable(r,target)||(target===anchorSlot&&r.id!==anchor.id))continue;
        const prepAhead=['breakfast','lunch'].includes(typeOf(target));
        const useBy=addDays(dayOf(target),r.qualityDays-(prepAhead?1:0));
        const open=targets.filter(id=>rank(id)>=rank(target)&&dayOf(id)<=useBy&&!taken.has(id)&&!next.placements[id]&&suitable(r,id)
          &&(!anchorSlot||target===anchorSlot||id!==anchorSlot));
        const portions=Math.min(r.servings,open.length),scale=portions/r.servings;
        if(!portions||scale<.25)continue;
        let basket=current.basket,newItems=0,wasteChange=0;
        for(const ingredient of r.ingredients) {
          const old=byIngredient.get(ingredient.id);
          const qty=(old?.qty||0)+ingredient.qty*scale;
          const purchase=purchaseFor(next,ingredient.id,qty);
          basket+=purchase.buyCost-(old?.buyCost||0);
          if(reuse){
            const remaining=purchase.remainingPacks;
            if(remaining>0&&!(old?.remainingPacks>0))newItems++;
            const unmeasured=next.pantryQty?.[next.week]?.[ingredient.id]===undefined&&(next.haveEnough[next.week]||[]).includes(ingredient.id);
            if(!unmeasured)wasteChange+=((remaining-(old?.remainingPacks||0))*purchase.packQty-ingredient.qty*scale)
              /purchase.packQty*price(ingredient.id,next.prices)*wasteWeight(ingredient.id);
          }
        }
        if(basket>budget+.00001)continue;
        const effort=(state.estimates[r.id]?.active??r.active)/portions/15;
        const repetition=(recipeCounts.get(r.id)||0)*30+(proteinCounts.get(r.protein)||0)*1.3+(cuisineCounts.get(r.cuisine)||0)*.8;
        const score=reuse
          ? repetition+(recentPenalty.get(r.id)||0)*.5+priorities.get(r.id)*.25+effort
            +newItems/portions*.8+wasteChange/portions*2+(basket-current.basket)/portions*.1
          : (basket-current.basket)/portions*.4+effort+repetition+(recentPenalty.get(r.id)||0)+priorities.get(r.id)+1/portions;
        candidates.push({r,scale,portions,open:open.slice(0,portions),score,useBy,prepAhead,newItems});
      }
      candidates.sort((a,b)=>a.score-b.score);
      const best=candidates[0];if(!best)continue;
      const b={...makeBatch(best.r.id,target,best.scale,best.portions),useBy:best.useBy,autoPlanned:true,mealTypes:selected.filter(t=>best.r.kind==='breakfast'?t==='breakfast':t!=='breakfast'),...(best.prepAhead?{prepAhead:true}:{})};
      next.batches.push(b);added.push(b);for(const id of best.open)next.placements[id]=b.id;next.auto[b.id]=[...best.open];count(best.r);
    }
    const unfilled=targets.filter(id=>!taken.has(id)&&!next.placements[id]).length;
    const repeated=recentSignatures.has(menuSignature(added));
    const distinct=new Set(added.map(b=>b.recipeId)).size;
    const diversity=new Set(added.map(b=>recipeMap.get(b.recipeId).protein)).size+new Set(added.map(b=>recipeMap.get(b.recipeId).cuisine)).size;
    const recency=added.reduce((n,b)=>n+(recentPenalty.get(b.recipeId)||0),0);
    const varietyTarget=Math.min(3,added.length+protectedBatches.length);
    const varietyGap=Math.max(0,varietyTarget-proteinCounts.size)+Math.max(0,varietyTarget-cuisineCounts.size);
    // A menu with fewer than three proteins or cuisines ranks behind any varied one.
    attempts.push({state:next,added,replaced,unfilled,repeated,quality:(added.length-distinct)*30+varietyGap*20+recency-diversity,
      ...(matching?{...shoppingFootprint(next),duplicateRecipes:added.length-distinct,varietyGap}:{})});
  }
  // Matching preserves coverage and variety, then avoids recently shown menus
  // before minimizing unused food. A reroll should not repeat the cheapest mix.
  attempts.sort((a,b)=>a.unfilled-b.unfilled
    ||(matching?a.duplicateRecipes-b.duplicateRecipes||a.varietyGap-b.varietyGap:0)
    ||Number(a.repeated)-Number(b.repeated)
    ||(matching?a.waste-b.waste||a.itemsToBuy-b.itemsToBuy:0)||a.quality-b.quality);
  const best=attempts[0];
  if(!best.added.length)return {state:structuredClone(state),added:[],replaced:[],unfilled:targets.filter(id=>!schedule(state).cells[id]?.chosen).length,repeated:false};
  return best;
}

export const AISLES=['Produce','Meat & seafood','Dairy & eggs','Bakery & tortillas','Frozen','Grains & pasta','Cans, sauces & seasonings'];
const groups={
  'Produce':'potato sweetpotato broccoli sprouts spinach kale mushrooms peppers onion zucchini cabbage carrots freshTomato cucumber avocado garlic lemon ginger apple berries yellowSquash asparagus greenOnion lettuce',
  'Meat & seafood':'beef turkey pork chicken cookedChicken sausage shrimp fish salmon cubeSteak sirloin italianSausage italianLinks ham bacon shavedSteak porkChops pepperoni',
  'Dairy & eggs':'eggs cheddar mozzarella parmesan feta goat cottage creamcheese yogurt sourcream milk butter heavyCream onionDip hummus',
  'Bakery & tortillas':'bread tortillas pita wheatSliders wheatBuns wheatSubs smallTortillas largeTortillas',
  'Frozen':'ravioli dumplings hash frozenBroccoli frozenCarrots tortellini pierogi popcornChicken meatballs',
  'Grains & pasta':'rice longRice readyRice instantRice pasta noodles gnocchi couscous barley oats flour cornbread polenta breadcrumbs granola crackers popcorn',
};
export const aisleFor=id=>Object.entries(groups).find(([,ids])=>ids.split(' ').includes(id))?.[0]||AISLES.at(-1);
