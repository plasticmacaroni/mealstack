// Stored quantities stay in grams / milliliters for pricing and saved-plan compatibility.
// Kitchen volumes depend on the ingredient. Sources: research/us-measurements.md.
export const OZ = 28.349523125;
export const CUP = 236.5882365;
const gramsPerCup = {rice:198,longRice:198,oats:89,flour:120,cornstarch:112,
  cottage:226,creamcheese:227,yogurt:227,sourcream:227,honey:336,peanut:270,
  cheddar:113,mozzarella:113,parmesan:100,feta:114,granola:113,polenta:156,cocoa:84,breadcrumbs:112,pesto:224,barley:213,kewpie:240};
const forms={garlic:'minced',cheddar:'shredded',mozzarella:'shredded',parmesan:'grated',feta:'crumbled'};
const gramsPerTsp = {garlic:28/6,garlicPowder:3.1,onionPowder:2.4,sweetPaprika:2.3,cumin:2.1,
  cinnamon:2.6,coriander:1.8,turmeric:3,dill:1,italianHerbs:1,herbs:1};
const fractions = [[1/8,'⅛'],[1/6,'⅙'],[1/4,'¼'],[1/3,'⅓'],[3/8,'⅜'],[1/2,'½'],[5/8,'⅝'],[2/3,'⅔'],[3/4,'¾'],[5/6,'⅚'],[7/8,'⅞']];
const decimal = n => String(Number(n.toFixed(2)));
export function formatNumber(n) {
  const whole=Math.floor(n+1e-8),part=n-whole;
  if(Math.abs(part)<1e-7)return String(whole);
  const fraction=fractions.find(([v])=>Math.abs(v-part)<1e-7);
  if(fraction)return `${whole||''}${fraction[1]}`;
  // Smaller exact fractions can occur when scaling eggs, slices or batches.
  for(const denominator of [12,16,24]){
    const numerator=Math.round(part*denominator);
    if(numerator>0&&Math.abs(numerator/denominator-part)<1e-7)return `${whole?whole+' ':''}${numerator}/${denominator}`;
  }
  return n>0&&n<.01?'less than 0.01':decimal(n);
}
const closeTo=(a,b,tolerance=.03)=>a>0&&Math.abs(a-b)/b<=tolerance;
const cupLabel=n=>`${formatNumber(n)} ${n<=1?'cup':'cups'}`;
function volume(cups) {
  if(!cups)return '0 cups';
  // Prefer familiar cup measures when close, otherwise use cups plus spoons.
  const whole=Math.floor(cups),simple=[0,1/4,1/3,1/2,2/3,3/4,1].map(n=>whole+n);
  const close=simple.filter(n=>closeTo(n,cups)).sort((a,b)=>Math.abs(a-cups)-Math.abs(b-cups))[0];
  if(close!==undefined)return cupLabel(close);
  // At most two measures: cups plus tablespoons, or tablespoons plus teaspoons.
  if(cups>=.25){
    const base=Math.floor(cups*4)/4,remainder=(cups-base)*16;
    const whole=Math.round(remainder),half=Math.round(remainder*2)/2;
    const tbsp=closeTo(base+whole/16,cups)?whole:closeTo(base+half/16,cups)?half:Math.round(remainder*4)/4;
    return [cupLabel(base),tbsp?`${formatNumber(tbsp)} tbsp`:''].filter(Boolean).join(' + ');
  }
  const halfTbsp=Math.round(cups*16*2)/2;
  if(closeTo(halfTbsp/16,cups))return `${formatNumber(halfTbsp)} tbsp`;
  const raw=cups*48;
  if(raw<1/8)return 'less than ⅛ tsp';
  let teaspoons=Math.round(raw*(raw<1?8:4))/(raw<1?8:4);
  const tbsp=Math.floor(teaspoons/3);teaspoons-=tbsp*3;
  return [tbsp?`${formatNumber(tbsp)} tbsp`:'',teaspoons?`${formatNumber(teaspoons)} tsp`:''].filter(Boolean).join(' + ');
}
function weight(grams,packageSize=false) {
  // Package labels commonly use tenths (an 8.8 oz rice pouch); cooking weights
  // use fractions. Never let a small positive quantity disappear into zero.
  const raw=grams/OZ;
  if(raw>0&&raw<(packageSize?.1:1/8))return `less than ${packageSize?'0.1':'⅛'} oz`;
  const ounces=packageSize?Math.round(raw*10)/10:Math.round(raw*8)/8;
  const pounds=Math.floor(ounces/16),rest=ounces-pounds*16;
  return [pounds?`${pounds} lb`:'',rest||!pounds?`${packageSize?decimal(rest):formatNumber(rest)} oz`:''].filter(Boolean).join(' ');
}
export function quantity(amount,unit,id='',purpose='recipe') {
  if(unit==='g'){
    if(purpose!=='package'){
      if(id==='butter')return volume(amount/226);
      if(gramsPerTsp[id])return `${volume(amount/gramsPerTsp[id]/48)}${forms[id]?` ${forms[id]}`:''}`;
      if(gramsPerCup[id])return `${volume(amount/gramsPerCup[id])}${forms[id]?` ${forms[id]}`:''}`;
    }
    return weight(amount,purpose==='package');
  }
  if(unit==='ml'){
    if(purpose!=='package')return volume(amount/CUP);
    const ounces=amount/(CUP/8);
    return ounces>0&&ounces<.1?'less than 0.1 fl oz':`${decimal(Math.round(ounces*10)/10)} fl oz`;
  }
  return `${formatNumber(amount)}${unit==='each'?'':` ${unit==='slice'&&amount!==1?'slices':unit}`}`;
}

// Pantry entry uses one stable unit per ingredient, regardless of the amount.
export function pantryMeasure(unit,id) {
  if(unit==='g'){
    if(id==='butter')return {unit:'tbsp',factor:14.125};
    if(gramsPerTsp[id])return {unit:forms[id]?`tsp ${forms[id]}`:'tsp',factor:gramsPerTsp[id]};
    if(gramsPerCup[id])return {unit:forms[id]?`cups ${forms[id]}`:'cups',factor:gramsPerCup[id]};
    return {unit:'oz',factor:OZ};
  }
  return unit==='ml'?{unit:'cups',factor:CUP}:{unit:unit==='slice'?'slices':unit,factor:1};
}
export function pantryValue(amount,unit,id) {
  const value=amount/pantryMeasure(unit,id).factor;
  const whole=Math.floor(value),options=[whole,whole+1,...fractions.map(([f])=>whole+f)];
  const close=options.filter(n=>closeTo(n,value)).sort((a,b)=>Math.abs(a-value)-Math.abs(b-value))[0];
  // Keep a parseable value, even for unusually tiny imported pantry amounts.
  return value>0&&value<.01?`1/${Math.round(1/value)}`:formatNumber(close??value);
}
export function parseAmount(input) {
  if(typeof input==='number')return Number.isFinite(input)&&input>=0?input:NaN;
  let text=String(input).trim();
  for(const [value,glyph] of fractions){
    if(text.endsWith(glyph)){
      const whole=text.slice(0,-1).trim();
      return /^(?:\d+)?$/.test(whole)?Number(whole)+value:NaN;
    }
  }
  text=text.replace(/⁄/g,'/');
  if(/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))return Number(text);
  const match=text.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
  return match&&Number(match[3])>0?Number(match[1]||0)+Number(match[2])/Number(match[3]):NaN;
}
export function pantryAmount(value,item) {
  value=parseAmount(value);
  if(!Number.isFinite(value))return NaN;
  // An unchanged rounded field must not alter stock or trigger another package.
  if(value===parseAmount(pantryValue(item.pantry,item.unit,item.id)))return item.pantry;
  const amount=value*pantryMeasure(item.unit,item.id).factor;
  // Allow label rounding only at whole-package boundaries (8.8 oz = 250 g).
  const packs=Math.round(amount/item.packQty),packAmount=packs*item.packQty;
  const tolerance=item.unit==='g'?OZ/20:item.unit==='ml'?CUP/8/20:0;
  return packs&&Math.abs(amount-packAmount)<=packs*tolerance?packAmount:amount;
}

// Rounded totals can look identical while stock is still slightly short.
export function pantryShortfall(item) {
  return item.pantry>0&&item.need>1e-9&&quantity(item.pantry,item.unit,item.id)===quantity(item.qty,item.unit,item.id)
    ?`Still short ${quantity(item.need,item.unit,item.id)}`:'';
}

export function usText(text) {
  return text.replace(/(\d+°F)\s*\/\s*\d+°C/g,'$1')
    .replace(/\b(\d+(?:\.\d+)?)\s*(g|ml)\b/g,(_,n,unit)=>quantity(Number(n),unit));
}
export function useUSRecipeText(recipes) {
  for(const r of recipes){
    for(const key of ['description','note','adaptations','storage'])if(typeof r[key]==='string')r[key]=usText(r[key]);
    r.steps=r.steps.map(s=>({...s,title:usText(s.title),text:usText(s.text)}));
    r.fit.packing=usText(r.fit.packing);r.fit.notes=r.fit.notes.map(usText);
  }
}
