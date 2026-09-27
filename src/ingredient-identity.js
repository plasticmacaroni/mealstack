// Only reviewed equivalents share an identity. Preparation state, cut and size
// stay distinct: cooked/dry rice, raw/cooked chicken and fresh/frozen vegetables.
export const INGREDIENT_ID_ALIASES=Object.freeze({longRice:'rice'});
export const canonicalIngredientId=id=>Object.hasOwn(INGREDIENT_ID_ALIASES,id)?INGREDIENT_ID_ALIASES[id]:id;
export const normalizeIngredientName=value=>String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const INGREDIENT_NAMES={
  beef:['minced beef','ground hamburger meat'],turkey:['minced turkey'],pork:['minced pork'],
  chicken:['raw boneless chicken','boneless chicken breast','boneless chicken thighs'],
  cookedChicken:['precooked chicken','cooked chopped chicken'],shrimp:['prawns'],
  sausage:['cooked smoked sausage'],italianSausage:['sweet Italian ground pork sausage'],
  eggs:['egg'],rice:['dry rice','uncooked long grain white rice','long grain rice'],
  instantRice:['instant white rice','quick cooking white rice'],readyRice:['microwave rice','rice pouch','ready to heat rice'],
  pasta:['dry short pasta','macaroni','penne','rotini','dry pasta shells'],noodles:['dry egg noodles'],
  oats:['old fashioned oats','oatmeal oats'],flour:['all purpose flour'],breadcrumbs:['bread crumbs'],
  bread:['whole wheat sandwich bread'],potato:['potato'],sweetpotato:['sweet potato'],hash:['frozen diced hash browns'],
  broccoli:['fresh broccoli'],frozenBroccoli:['frozen broccoli'],sprouts:['brussels sprouts'],
  peppers:['bell pepper','sweet peppers','capsicum'],onion:['yellow onion','yellow onions'],
  zucchini:['courgette','courgettes'],cabbage:['slaw mix','coleslaw mix','shredded cabbage'],
  corn:['canned corn','sweet corn kernels'],tomatoes:['diced canned tomatoes'],freshTomato:['grape tomatoes'],
  greenOnion:['scallions','scallion','spring onions','spring onion'],
  cheddar:['cheddar cheese','shredded cheddar'],mozzarella:['mozzarella cheese','shredded mozzarella'],
  parmesan:['parmesan cheese','grated parmesan'],goat:['chevre'],creamcheese:['cream cheese'],
  yogurt:['plain greek yoghurt','plain greek yogurt'],sourcream:['sour cream'],heavyCream:['heavy whipping cream'],
  marinara:['marinara sauce'],pesto:['pesto sauce','basil pesto sauce'],broth:['stock','prepared stock'],
  bbq:['barbecue sauce','barbeque sauce'],peanut:['peanut butter'],oil:['neutral cooking oil'],
  lemon:['lemon','lime','lemons','limes'],chickpeas:['garbanzo beans'],
  polenta:['plain cornmeal','polenta cornmeal'],cornstarch:['corn starch'],
  italianHerbs:['Italian seasoning','dried Italian seasoning'],sweetPaprika:['mild paprika','sweet paprika'],
  coriander:['ground coriander seed'],cumin:['cumin powder'],cinnamon:['cinnamon powder'],
  vinegar:['rice vinegar'],seaweed:['roasted nori','nori sheets'],tortillaStrips:['crunchy tortilla strips'],
};
export const ingredientAliases=id=>Object.hasOwn(INGREDIENT_NAMES,canonicalIngredientId(id))?INGREDIENT_NAMES[canonicalIngredientId(id)]:[];

export function canonicalIngredients(items){
  const quantities=new Map();
  for(const item of items){const id=canonicalIngredientId(item.id);quantities.set(id,(quantities.get(id)||0)+item.qty);}
  return [...quantities].map(([id,qty])=>({id,qty}));
}
