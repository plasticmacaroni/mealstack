import {quantity} from './measurements.js';

// Explicit recipe corrections supplement the authored tools and instruction actions.
// A serving dish is separate from a bowl used to prepare a whole batch.
const prepOverrides={
  'berry-yogurt':['Spoon'], 'apple-cottage-bowl':['Spoon'],
  'apple-peanut':['Knife','Cutting board'], 'cheese-pickles':['Knife','Cutting board'],
  'cucumber-hummus':['Knife','Cutting board','Spoon'],
  'chocolate-cottage':['Mixing bowl','Fork'], 'berry-yogurt-cracker-cups':['Mixing bowl','Fork'],
  'avocado-cottage-balsamic-toast':['Knife','Cutting board','Spoon'],
};
const cuttingIngredients=new Set('onion garlic ginger peppers potato sweetpotato carrots zucchini yellowSquash asparagus greenOnion lettuce apple cucumber avocado lemon chicken'.split(' '));
const cans=new Set('tuna corn tomatoes crushedTomatoes tomatoSauce tomatoPaste blackBeans pintoBeans chickpeas mushroomSoup chickenSoup'.split(' '));
const spoonMeals=new Set('berry-yogurt chocolate-cottage apple-cottage-bowl cinnamon-overnight-oats peanut-berry-oats savory-oat-egg-bowls berry-yogurt-cracker-cups'.split(' '));
const handheld=/pita|tacos|wrap|quesadilla|melts|sliders|subs|sandwich|cheeseburger(?!-pasta)|sloppy|toast|pbj-hummus/;
const plated=/dumpling-skillet|steak|pork-chop|parmesan-fish|frittata|egg-muffins|hash|oat-bake|egg-bake|meatloaves|loaded-broccoli-potatoes/;
const item=(label,count=1,note='')=>({label,count,note});
const sum=items=>items.reduce((n,i)=>n+i.count,0);
const unique=items=>[...new Set(items)];

export function reviewEquipment(recipes,ingredients){
  for(const r of recipes){
    const text=r.steps.map(s=>s.text).join(' '),ids=new Set(r.ingredients.map(i=>i.id));
    let prep=[...(prepOverrides[r.id]||r.prepTools)].filter(t=>!['Food thermometer','Oven mitts','Parchment','Toothpick','Kettle','Serving plate'].includes(t));
    const cuts=/\b(?:slice|dice|chop|mince|halve|quarter|cut|core|trim|peel|split|zest)\b/i.test(text)||r.ingredients.some(i=>cuttingIngredients.has(i.id));
    prep=prep.filter(t=>!['Knife','Cutting board'].includes(t)||cuts);
    if(cuts)prep.push('Knife','Cutting board');
    if(/\bwhisk\b/i.test(text))prep.push('Whisk');
    if(/\bbeat\b/i.test(text)&&!prep.some(t=>['Fork','Whisk'].includes(t)))prep.push('Fork');
    if(/\btongs\b/i.test(text))prep.push('Tongs');
    if(/\bspatula\b/i.test(text))prep.push('Spatula');
    if(/\bgrate\b/i.test(text))prep.push('Grater');
    if(/\bfork\b/i.test(text)&&!prep.includes('Fork'))prep.push('Fork');
    if(/\bfluff\b/i.test(text)&&!prep.includes('Fork'))prep.push('Fork');
    if(/\b(?:peel)\b/i.test(text))prep.push('Vegetable peeler');
    if(/\bcolander\b/i.test(text)||/\bdrain (?:the )?(?:pasta|noodles|potatoes)\b/i.test(text))prep.push('Colander');
    if(r.ingredients.some(i=>cans.has(i.id)))prep.push('Can opener');
    // Some old lists name the same tool twice in different words.
    prep=prep.map(t=>t==='Masher'?'Potato masher':t==='Small mixing bowl'?'Small bowl':t==='Serving plate'?'Plate':t);
    const cookware=r.cookware.map(label=>item(label,/\b(?:lid|with cover)\b/i.test(label)?2:1,/\b(?:lid|with cover)\b/i.test(label)?'Vessel + lid':''));
    const tableware=r.storeBought?[]
      :r.kind==='snack'&&!spoonMeals.has(r.id)?[item('Plate')]
      :handheld.test(r.id)?[item('Plate')]
      :spoonMeals.has(r.id)?[item('Bowl'),item('Spoon')]
      :plated.test(r.id)||['tray','air'].includes(r.method)?[item('Plate'),item('Fork'),...(/steak|pork-chop|parmesan-fish/.test(r.id)?[item('Table knife')]:[])]
      :[item('Bowl'),item('Fork')];
    const handy=[];
    if(r.method!=='bowl')handy.push('Oven mitts or heatproof grips');
    if(/\bfoil\b/i.test(text+' '+r.cookware.join(' ')))handy.push('Foil');
    if(/parchment/i.test(text+' '+r.prepTools.join(' ')))handy.push('Parchment');
    if(r.prepTools.includes('Kettle'))handy.push('Kettle for boiling water');
    if(r.prepTools.includes('Toothpick'))handy.push('Toothpick for the doneness check');
    const optional=[{label:'Kitchen scale',note:'If you prefer weighing to cups or package portions.'}];
    if(r.prepTools.includes('Food thermometer'))optional.push({label:'Food thermometer',note:'To check the temperatures in the recipe.'});
    if(!prep.includes('Grater')&&['cheddar','mozzarella','parmesan'].some(id=>ids.has(id)))optional.push({label:'Cheese grater',note:'Only if you buy a block instead of grated or shredded cheese.'});
    if(r.method==='bowl'&&/toast bread.*(?:prefer|desired)/i.test(text))optional.push({label:'Toaster',note:'If you want toasted bread.'});
    if(r.storeBought)optional.length=0;
    r.equipment={cookware,prep:unique(prep).map(label=>item(label,1,label==='Can opener'?'Skip for pull-tab cans.':'')),tableware,handy:unique(handy),optional,
      measures:r.ingredients.map(i=>({...i,unit:ingredients[i.id].unit})),water:[...text.matchAll(/\{water:(\d+)\}/g)].map(m=>Number(m[1])),
      separateToppings:/\bseparat(?:e|ely)\b/i.test(r.storage+' '+r.note)};
    r.prepTools=r.equipment.prep.map(i=>i.label);
    const standard=cleanupFor(r);
    r.dishes=[...standard.cookware,...standard.prep,...standard.measuring,...standard.tableware]
      .flatMap(i=>Array.from({length:i.count},(_,n)=>n?`${i.label} · lid`:i.label));
  }
}

export function cleanupFor(r,{scale=1,portions=r.servings,prepAhead=false,prepDate,startSlot,firstMealSlot}={}){
  if(prepDate)prepAhead=firstMealSlot===null||prepDate<(firstMealSlot||startSlot)?.split('|')[0];
  const e=r.equipment,measures=new Set();
  for(const i of [...e.measures,...e.water.map(qty=>({qty,unit:'ml',id:''}))]){
    const amount=quantity(i.qty*scale,i.unit,i.id);
    if(/\bcups?\b/.test(amount))measures.add(i.unit==='ml'?'Liquid measuring cup':'Dry measuring cup');
    if(/\btbsp\b/.test(amount))measures.add('Tablespoon');
    if(/\btsp\b/.test(amount))measures.add('Teaspoon');
  }
  const measuring=[...measures].map(label=>item(label));
  const kitchen=sum(e.cookware)+sum(e.prep)+sum(measuring),eating=sum(e.tableware);
  return {...e,measuring,kitchen,eating,total:kitchen+eating,containers:Math.max(0,portions-(prepAhead?0:1)),prepAhead};
}
