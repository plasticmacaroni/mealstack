import {ingredientAliases} from './ingredient-identity.js';
import {RECIPES, INGREDIENTS, SOURCES, METHOD_NAMES} from './data.js';
import {batchCost} from './engine.js';
import {LOW_CLEANUP_LIMIT} from './workflow.js';

export const normalize = value => String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const aliases = {
  creamy:['cream','creamy','alfredo','stroganoff'], cheesy:['cheese','cheesy','cheddar','mozzarella','parmesan','feta'],
  crispy:['crisp','crunch','golden','breaded'], crunchy:['crisp','crunch'], cozy:['comfort','creamy','cheesy','gravy','casserole'],
  comforting:['comfort','creamy','cheesy','gravy','casserole'], garlicky:['garlic'], noodles:['noodle','pasta','spaghetti','orzo'],
  pasta:['pasta','noodle','spaghetti','orzo','ravioli','tortellini','lasagna','macaroni','ziti','bow ties','shells'],
  beef:['beef','steak','burger'], chicken:['chicken'], fish:['fish','salmon'], seafood:['fish','salmon','shrimp','tuna'],
  vegetarian:['vegetarian'], mushrooms:['mushroom'], vegetables:['vegetable','broccoli','spinach','zucchini','pepper','cabbage'],
  potatoes:['potato'], peppers:['pepper'], tomatoes:['tomato'], eggs:['egg'], tacos:['taco'], beans:['bean','chickpea'],
  cheese:['cheese','cheddar','mozzarella','parmesan','feta','alfredo'], dairy:['milk','cream','cheese','yogurt','butter','cheddar','mozzarella','parmesan','feta'],
};
const expand = term => aliases[term] || [term];
const hasTerm = (haystack,term) => expand(term).some(t=>haystack.includes(t));
const searchable = new Map(RECIPES.map(r=>[r.id,normalize([
  r.title,r.description,r.note,r.adaptations,r.kind,r.cuisine,r.protein,METHOD_NAMES[r.method],
  r.origin?.publisher,r.origin?.title,...(SOURCES[r.source]||[]),...r.ingredients.flatMap(i=>[INGREDIENTS[i.id].name,...ingredientAliases(i.id)]),
  ...r.dishes,...r.steps.map(s=>s.text),r.classic?'comfort classics familiar favorites':'',r.onePot?'one pot one pan':'',r.dump?(r.method==='slow'?'dump dinner slow cooker':'dump dinner dump and bake'):'',
].filter(Boolean).join(' '))]));
// Exclusions inspect ingredients, never phrases such as "no mushrooms" in source notes.
const ingredientText = new Map(RECIPES.map(r=>[r.id,normalize(r.ingredients.flatMap(i=>[INGREDIENTS[i.id].name,...ingredientAliases(i.id)]).join(' '))]));

export function parseQuery(query) {
  const parsed = {terms:[],exclude:[],maxCost:Infinity,maxTotal:Infinity,maxActive:Infinity,maxCleanup:Infinity,onePot:false,dump:false,vegetables:false};
  let text=String(query).toLowerCase().replace(/[’']/g,'');
  text=text.replace(/(?:under|below|less than|up to|<=|≤)\s*\$\s*(\d+(?:\.\d+)?)(?:\s*(?:per|a|\/)\s*(?:meal|portion|serving))?/g,(_,n)=>{parsed.maxCost=Number(n);return ' ';});
  text=text.replace(/(?:under|below|less than|up to|<=|≤)?\s*(\d+)\s*(?:minutes?|mins?|m)\b(?:\s*(active|total))?/g,(_,n,active)=>{parsed[active==='active'?'maxActive':'maxTotal']=Number(n);return ' ';});
  text=text.replace(/\b(?:one[ -]?(?:pot|pan)|single[ -]pot)\b/g,()=>{parsed.onePot=true;return ' ';});
  text=text.replace(/\bdump(?:[ -](?:and[ -])?bake| dinners?| meals?)?\b/g,()=>{parsed.dump=true;return ' ';});
  text=text.replace(/\b(?:veg(?:gie|etable)?[ -]forward|more vegetables|healthy)\b/g,()=>{parsed.vegetables=true;return ' ';});
  text=text.replace(/\b(?:cheap|budget|affordable)\b/g,()=>{parsed.maxCost=Math.min(3,parsed.maxCost);return ' ';});
  text=text.replace(/\b(?:quick|fast)\b/g,()=>{parsed.maxTotal=Math.min(30,parsed.maxTotal);return ' ';});
  text=text.replace(/\b(?:easy|low effort)\b/g,()=>{parsed.maxActive=Math.min(15,parsed.maxActive);return ' ';});
  text=text.replace(/\b(?:(?:low|minimal|less)[ -]cleanup|few[ -]dishes|less[ -]washing)\b/g,()=>{parsed.maxCleanup=LOW_CLEANUP_LIMIT;return ' ';});
  text=text.replace(/(?:\b(?:without|no|exclude)\s+|(?:^|\s)-)([a-z]+(?:\s+(?:cheese|peppers|beans))?)/g,(_,term)=>{parsed.exclude.push(normalize(term));return ' ';});
  const stop=new Set(['i','im','am','hungry','craving','want','would','like','feel','feeling','something','some','for','a','an','the','with','and','that','is','please','meal','meals','dinner','dinners','in','than']);
  parsed.terms=normalize(text).split(' ').filter(t=>t&&!stop.has(t));
  return parsed;
}

export function matchesQuery(r, query, options={}) {
  const p=typeof query==='string'?parseQuery(query):query;
  const e=options.estimates?.[r.id]||r;
  const avoided=[...p.exclude,...String(options.avoid||'').split(',').map(normalize).filter(Boolean)];
  return batchCost(r,1,options.prices,options.packageSizes)/r.servings<=p.maxCost && e.total<=p.maxTotal && e.active<=p.maxActive && (e.cleanup??r.dishes.length)<=(p.maxCleanup??Infinity)
    && (!p.onePot||r.onePot) && (!p.dump||r.dump) && (!p.vegetables||r.vegetableGrams>=100)
    && p.terms.every(term=>hasTerm(searchable.get(r.id),term))
    && !avoided.some(term=>hasTerm(ingredientText.get(r.id),term));
}

export function searchRecipes(query, options={}) {
  const parsed=parseQuery(query);
  return RECIPES.filter(r=>matchesQuery(r,parsed,options));
}

export const CRAVINGS=[['Comfort classics','comfort classics'],['Creamy & cozy','creamy'],['Something crispy','crispy'],['Cheesy pasta','cheesy pasta'],['Garlicky','garlic'],['One-pot dinner','one pot'],['Dump dinners','dump'],['Cheap & quick','cheap quick']];
// Featured order: a deterministic daily shuffle seeded by the local date (same all day, new tomorrow).
// Each recipe gets a hash key from date+id, so a filtered subset keeps the same relative order. Favorites first.
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}h^=h>>>15;h=Math.imul(h,2246822507);h^=h>>>13;return h>>>0;};
export function featuredOrder(list,date,isFavorite=()=>false) {
  const key=new Map(list.map(r=>[r.id,hash(`${date}|${r.id}`)]));
  return [...list].sort((a,b)=>Number(isFavorite(b))-Number(isFavorite(a))||key.get(a.id)-key.get(b.id)||(a.id<b.id?-1:1));
}
