import {canonicalIngredientId,canonicalIngredients} from './ingredient-identity.js';
import {reviewEquipment} from './equipment.js';
import {useUSRecipeText} from './measurements.js';
import {COLLECTION_INGREDIENTS,COLLECTION_SOURCES,COLLECTION_RECIPES} from './collection-recipes.js';
import {enrichRecipes} from './cookbook.js';
import {MORE_RECIPES} from './more-recipes.js';
import {CLASSIC_INGREDIENTS,CLASSIC_RECIPES} from './classic-recipes.js';
import {REAL_INGREDIENTS,REAL_SOURCES,REAL_RECIPES,SOURCED_IMAGES} from './real-recipes.js';
import {reviewFit} from './fit-review.js';

export const RESEARCH_DATE = '2026-09-23';
// Planning assumptions, not live retailer prices. Quantities use the unit shown.
const p = (name, unit, packQty, packCost) => ({ name, unit, packQty, packCost });
export const INGREDIENTS = {
  beef:p('Ground beef','g',454,5.25), turkey:p('Ground turkey','g',454,4.25), pork:p('Ground pork','g',454,4), chicken:p('Boneless chicken, cut small','g',454,3.6),
  sausage:p('Mild fully cooked sausage','g',397,3.75), shrimp:p('Peeled shrimp','g',454,7.5), fish:p('White fish fillets','g',454,5.5), salmon:p('Salmon','g',454,9), tuna:p('Canned tuna, drained','g',113,1.15),
  eggs:p('Eggs','each',12,3.25), rice:p('Dry rice','g',907,2.5), pasta:p('Dry pasta','g',454,1.25), noodles:p('Egg noodles','g',340,1.8), gnocchi:p('Shelf-stable gnocchi','g',454,3), ravioli:p('Frozen cheese ravioli','g',680,4.75),
  couscous:p('Dry couscous','g',283,2.5), barley:p('Pearl barley','g',454,1.8), oats:p('Rolled oats','g',510,2.25), flour:p('Flour','g',907,1.8), cornbread:p('Cornbread mix','g',240,0.85), breadcrumbs:p('Breadcrumbs','g',227,1.75),
  bread:p('Whole-wheat bread','slice',20,2.8), tortillas:p('Tortillas','each',10,2.5), pita:p('Whole-wheat pita','each',6,3.5), potato:p('Potatoes','g',1360,3.5), sweetpotato:p('Sweet potatoes','g',907,2.5), hash:p('Frozen diced potatoes','g',794,3),
  broccoli:p('Broccoli florets','g',454,2), sprouts:p('Brussels sprouts','g',454,3), spinach:p('Spinach','g',227,2.5), kale:p('Kale','g',227,2), mushrooms:p('Mushrooms','g',227,2), peppers:p('Bell peppers','each',3,2.5), onion:p('Onion','each',1,0.65),
  zucchini:p('Zucchini','g',454,1.5), cabbage:p('Bagged slaw / shredded cabbage','g',397,1.9), carrots:p('Carrots','g',454,1), corn:p('Corn, drained','g',250,0.9), tomatoes:p('Canned diced tomatoes','g',411,1), freshTomato:p('Cherry tomatoes','g',283,2.5), cucumber:p('Cucumber','each',1,0.75), avocado:p('Avocado','each',1,0.8),
  cheddar:p('Cheddar','g',227,2.25), mozzarella:p('Mozzarella','g',227,2.25), parmesan:p('Parmesan','g',170,3), feta:p('Feta','g',113,2.5), goat:p('Goat cheese','g',113,3), cottage:p('Cottage cheese','g',680,3.75), creamcheese:p('Cream cheese','g',227,1.8), yogurt:p('Plain Greek yogurt','g',907,4.5), sourcream:p('Sour cream','g',227,1.5), milk:p('Milk','ml',1893,2.25), butter:p('Butter','g',454,4),
  marinara:p('Mild marinara','g',680,1.8), pesto:p('Basil pesto','g',184,2.8), broth:p('Prepared broth','ml',946,1.5), soy:p('Soy sauce','ml',296,1.75), bbq:p('Mild BBQ sauce','g',510,1.6), peanut:p('Peanut butter','g',454,1.9), honey:p('Honey','g',340,3), jelly:p('Jelly','g',510,1.9), hummus:p('Hummus','g',283,2.5),
  oil:p('Cooking oil','ml',473,3.5), garlic:p('Garlic','g',60,0.55), lemon:p('Lemon / lime','each',1,0.5), ginger:p('Ginger','g',100,1), herbs:p('Mild dried herbs / spices','g',30,1.5), mustard:p('Mustard','g',227,1.25), pickles:p('Pickles','g',473,2.5),
  apple:p('Apple','each',1,0.65), berries:p('Berries','g',340,3), nuts:p('Nuts','g',170,3), granola:p('Granola','g',340,2.75), cocoa:p('Cocoa powder','g',227,2.5), popcorn:p('Popcorn kernels','g',454,1.8), crackers:p('Whole-wheat crackers','g',227,2), raisins:p('Raisins','g',340,2.5),
  dumplings:p('Pork potstickers','g',454,4.5), cubeSteak:p('Cube steak','g',454,5.5), mushroomSoup:p('Condensed mushroom soup','g',298,1.4), chickpeas:p('Chickpeas, drained','g',250,0.85),
  ...COLLECTION_INGREDIENTS,
  ...CLASSIC_INGREDIENTS,
  ...REAL_INGREDIENTS,
};
export const SOURCES = {
  gnocchi:['Sheet-pan gnocchi technique','https://www.budgetbytes.com/gnocchi-with-sausage-and-fall-vegetables/'],
  ravioli:['No-boil ravioli bake','https://www.theseasonedmom.com/ravioli-casserole/'],
  stroganoff:['One-pot beef stroganoff','https://www.budgetbytes.com/beef-stroganoff/'],
  mushroom:['One-pot mushroom pasta','https://www.budgetbytes.com/one-pot-creamy-mushroom-pasta/'],
  burger:['One-pot cheeseburger pasta','https://www.budgetbytes.com/skillet-cheeseburger-pasta/'],
  eggroll:['Egg roll bowl technique','https://www.budgetbytes.com/egg-roll-in-a-bowl/'],
  fajita:['No. 2 Pencil · Sheet Pan Shrimp Fajitas','https://www.number-2-pencil.com/one-sheet-pan-shrimp-fajitas/'],
  shrimpRice:['Lemon garlic shrimp and rice','https://www.budgetbytes.com/one-pot-lemon-garlic-shrimp-and-rice/'],
  pepper:['Stuffed pepper skillet','https://www.budgetbytes.com/stuffed-pepper-skillet/'],
  pesto:['Dump-and-bake pesto pasta','https://www.theseasonedmom.com/chicken-pesto-pasta/'],
  fish:['Jar of Lemons · Crispy Air Fryer Fish Tacos','https://www.jaroflemons.com/crispy-air-fryer-fish-tacos/'],
  eggs:['Egg muffin technique','https://www.budgetbytes.com/egg-muffins/'],
  cottage:['Cottage cheese bowl ideas','https://www.budgetbytes.com/cottage-cheese-breakfast-bowls-6-ways/'],
  cottageMushroom:['Mushroom Council · Mushroom, Arugula and Cottage Cheese Toast','https://www.mushroomcouncil.com/recipes/mushroom-arugula-and-cottage-cheese-toast/'],
  cottageChocolate:['PBfit · Peanut Butter Cup Cottage Cheese Bowl','https://www.pbfit.com/recipes/pbfit-chocolate-cottage-cheese-bowl'],
  pestoRavioli:['Nutrition for ME · Pesto Ravioli with Spinach & Tomatoes','https://www.nutritionforme.org/recipes/pesto-ravioli-with-spinach-tomatoes/'],
  hash:['Sweet potato hash technique','https://cozypeachkitchen.com/sweet-potato-breakfast-hash/'],
  slow:['Slow-cooker cube steak','https://www.soulfullymade.com/crock-pot-country-steak-gravy/'],
  broccoli:['Air-fryer broccoli technique','https://www.budgetbytes.com/air-fryer-broccoli/'],
  ...COLLECTION_SOURCES,
  ...REAL_SOURCES,
};
const pans = {
  skillet:['Skillet','Spatula','Knife','Cutting board'],
  pot:['Pot','Spoon','Knife','Cutting board'],
  tray:['Baking sheet','Tongs','Knife','Cutting board'],
  bake:['Baking dish','Spoon'],
  air:['Air-fryer basket','Tongs','Knife','Cutting board'],
  bowl:['Mixing bowl','Spoon'],
  slow:['Slow-cooker insert','Spoon','Knife','Cutting board'],
};
const r = (id,title,emoji,kind,method,protein,cuisine,active,total,nominal,ingredients,days,description,source=null,note='') => ({
  id,title,emoji,kind,method,protein,cuisine,active,total,nominal,
  servings:Math.max(1,Math.floor(nominal*0.75)),
  ingredients:ingredients.map(([id,qty])=>({id,qty})),
  dishes:[...(pans[method] || pans.bowl)], qualityDays:days,description,source,
  note:note || 'Store sauces and crunchy toppings separately, then combine when serving.',
  hue:0,
});
export const RECIPES = [
  r('crispy-gnocchi','Crispy gnocchi & Brussels sprouts','🥔','main','tray','Sausage','Italian',12,45,4,[['gnocchi',454],['sprouts',350],['sausage',200],['onion',1],['parmesan',25],['oil',20],['herbs',3]],1,'Golden potato pillows, roasted sprouts and smoky sausage pieces.','gnocchi','Crisp edges and soft centers. Best served fresh; reheat in the oven or air fryer to crisp up the edges.'),
  r('spinach-ravioli','Spinach ravioli lasagna','🍝','main','bake','Vegetarian','Italian',5,50,4,[['ravioli',454],['marinara',400],['spinach',120],['mozzarella',80],['parmesan',15]],2,'Lasagna comfort with filled pasta, greens and browned cheese. No noodle boiling.','ravioli'),
  r('beef-stroganoff','Beef & mushroom stroganoff','🍄','main','pot','Beef','American',12,30,4,[['beef',227],['mushrooms',227],['noodles',250],['broth',600],['sourcream',100],['garlic',10],['butter',15],['herbs',2]],2,'Creamy egg noodles; mushrooms stretch a modest amount of beef.','stroganoff'),
  r('shrimp-fajitas','Garlic-lime shrimp fajitas','🍤','main','tray','Seafood','Mexican',10,25,3,[['shrimp',300],['peppers',2],['onion',1],['tortillas',4],['lemon',1],['oil',15],['herbs',3]],1,'Charred peppers, garlicky shrimp and warm tortillas.','fajita','Use garlic, cumin and sweet paprika; the chili powder, smoked paprika and black pepper from the linked recipe are left out. Assemble tortillas fresh.'),
  r('eggroll','Mushroom egg-roll skillet','🥬','main','skillet','Turkey','Chinese',8,25,4,[['turkey',340],['cabbage',397],['mushrooms',150],['rice',150],['soy',30],['ginger',10],['garlic',10],['oil',15]],2,'Savory ground meat, ginger and vegetables with a little crunch. Rice included.','eggroll','Cook the rice in a separate pot while the skillet cooks.'),
  r('pepper-rice','Unstuffed pepper skillet','🫑','main','skillet','Beef','American',10,40,4,[['beef',300],['peppers',2],['onion',1],['rice',200],['tomatoes',411],['broth',400],['cheddar',60],['herbs',3]],2,'All the savory stuffed-pepper filling with none of the stuffing.','pepper'),
  r('cheeseburger-pasta','Cheeseburger macaroni','🧀','main','pot','Beef','American',10,30,4,[['beef',300],['pasta',250],['onion',1],['broth',500],['milk',200],['cheddar',100],['mustard',15],['pickles',40]],2,'Beefy, cheesy one-pot pasta with a little mustard and pickle crunch.','burger','Add the pickles just before serving to keep them crisp.'),
  r('mushroom-pasta','Creamy garlic mushroom pasta','🍄','main','pot','Vegetarian','Italian',10,30,3,[['pasta',250],['mushrooms',300],['spinach',100],['broth',500],['creamcheese',75],['parmesan',30],['garlic',12],['oil',15]],2,'A rich mushroom sauce and spinach without a separate sauce pan.','mushroom'),
  r('lemon-shrimp-rice','Lemon-garlic shrimp rice','🍋','main','pot','Seafood','Mediterranean',8,30,4,[['shrimp',340],['rice',200],['broth',450],['spinach',100],['lemon',1],['garlic',10],['butter',25]],1,'Buttery lemon rice, small shrimp and wilted spinach in one pot.','shrimpRice'),
  r('pesto-chicken-bake','Pesto chicken & zucchini bake','🌿','main','bake','Chicken','Italian',10,50,4,[['chicken',250],['pasta',250],['zucchini',300],['pesto',80],['broth',500],['mozzarella',80]],2,'Small chicken pieces and pasta with basil pesto and zucchini.','pesto','This adaptation uses chicken cut small. Check the source for precooked versus raw chicken before cooking; timing differs.'),
  r('fish-tacos','Crunchy white-fish tacos','🌮','main','air','Seafood','Mexican',12,25,3,[['fish',300],['breadcrumbs',40],['tortillas',4],['cabbage',150],['yogurt',80],['lemon',1],['oil',15],['herbs',2]],1,'Crisp fish, cool cabbage and a mild lime-yogurt sauce.','fish','Breadcrumbs replace the cornmeal crust; the ancho chili, black pepper and hot sauce are left out. Yogurt lime slaw on green cabbage. Assemble fresh.'),
  r('slow-cube','Slow-cooker steak & mushroom gravy','🥩','main','slow','Beef','American',8,370,3,[['cubeSteak',350],['mushrooms',200],['mushroomSoup',298],['onion',1],['potato',450],['milk',80],['butter',15]],2,'Tender cube steak in mushroom gravy with a substantial potato side.','slow','Elapsed time includes a long slow cook. Potatoes are separate and add a pot and masher to cleanup.'),
  r('pesto-ravioli','Pesto ravioli with blistered tomatoes','🌿','main','skillet','Vegetarian','Italian',5,20,3,[['ravioli',454],['pesto',65],['freshTomato',250],['spinach',100],['parmesan',20],['oil',10]],2,'Filled pasta, basil sauce, greens and sweet blistered tomatoes.','pestoRavioli','Follow the ravioli package instructions, then toss with pesto, tomatoes and spinach.'),
  // Breakfasts: nominal yields refer to meals, not the number of muffins or slices.
  r('egg-muffins','Spinach-cheddar egg muffins','🥚','breakfast','bake','Eggs','American',10,30,4,[['eggs',6],['spinach',100],['cheddar',70],['milk',80],['bread',3],['oil',5]],2,'Spinach-and-cheddar egg bites with whole-wheat toast.','eggs','Soft egg bites with crisp toast. Keep the bread separate and toast it just before serving.'),
  r('savory-cottage','Mushroom cottage-cheese toast','🍄','breakfast','skillet','Vegetarian','American',8,15,3,[['cottage',300],['mushrooms',200],['bread',4],['garlic',5],['oil',10]],1,'Garlicky mushrooms and cottage cheese on wheat toast.','cottageMushroom','The red pepper flakes are left out and the arugula is optional. Keep the toast and toppings separate until serving.'),
  r('sweet-hash','Sweet potato & turkey breakfast hash','🍠','breakfast','skillet','Turkey','American',12,30,4,[['sweetpotato',500],['turkey',250],['peppers',1],['eggs',3],['onion',0.5],['oil',15],['herbs',2]],2,'Sweet potato cubes, savory turkey and eggs.','hash','Brown the turkey before adding the vegetables. Cook the eggs in the same skillet.'),
  r('chocolate-cottage','Chocolate-peanut cottage bowls','🥜','breakfast','bowl','Vegetarian','American',5,5,3,[['cottage',400],['peanut',60],['cocoa',12],['honey',25],['granola',60]],2,'Chocolate and peanut butter with cottage cheese and a crunchy topping.','cottageChocolate','Regular peanut butter, cocoa and honey replace the powdered peanut butter mix. Stir them into the cottage cheese; add granola just before eating.'),
  // Snack portions are explicitly snack-sized; never silently treated as a main meal.
  ...COLLECTION_RECIPES,
  ...MORE_RECIPES,
  ...CLASSIC_RECIPES,
  ...REAL_RECIPES,
];
for(const recipe of RECIPES)if(!recipe.image&&SOURCED_IMAGES.includes(recipe.id))recipe.image=`assets/recipes/${recipe.id}.webp`;
INGREDIENTS.polenta=p('Plain cornmeal / polenta','g',454,1.75);
const extraDishes={eggroll:['Rice pot'], 'slow-cube':['Potato pot','Masher'], 'egg-muffins':['Mixing bowl','Whisk'],};
Object.assign(extraDishes,{
  'fish-tacos':['Crumb bowl','Sauce bowl'],
  'pesto-chicken-bake':['Skillet','Spatula','Knife','Cutting board'],
});
RECIPES.forEach((recipe,index)=>{
  recipe.hue=Math.round((index*137.508+12)%360);
  recipe.dishes.push(...(extraDishes[recipe.id]||[]));
});
const patchRecipe=(id,patch)=>Object.assign(RECIPES.find(r=>r.id===id),patch);
patchRecipe('pesto-chicken-bake',{active:20,total:65,note:'Cook the chicken pieces before baking the pasta. The time estimate includes this step and cleanup includes the skillet. The linked recipe uses cooked chicken; this version also includes zucchini.'});
patchRecipe('slow-cube',{active:18,total:390,note:'Includes roughly six hours of slow cooking plus potato preparation. Potatoes are separate and add a pot and masher to cleanup.'});
patchRecipe('egg-muffins',{dishes:['Muffin pan','Mixing bowl','Whisk']});
export const METHOD_NAMES={skillet:'Skillet',pot:'Pot',tray:'Sheet pan',bake:'Oven bake',air:'Air fryer',bowl:'No-cook assembly',slow:'Slow cooker'};
export const DATA_NOTE='Prices, quantities, portions, cooking times and cleanup counts are estimates. Cleanup includes cookware, lids, prep and measuring tools, plus one place setting. Optional tools and containers for saved portions are shown separately. Meal ideas have not been kitchen-tested; linked recipes may use different quantities and ingredients.';

// Specify the seasoning that the cooking instructions call for, including sweet recipes.
Object.assign(INGREDIENTS, {
  cinnamon:p('Ground cinnamon','g',60,1.5),
  coriander:p('Ground coriander','g',40,1.5),
  turmeric:p('Ground turmeric','g',40,1.5),
});
INGREDIENTS.rice.name='Dry long-grain white rice';
const seasoning = {
  'shrimp-fajitas':['garlicPowder','cumin'],
  'fish-tacos':['cumin','garlicPowder'],
  'sweet-hash':['cumin','garlicPowder'],
};
for(const recipe of RECIPES) recipe.ingredients=canonicalIngredients(recipe.ingredients.flatMap(i=>i.id==='herbs'?(seasoning[recipe.id]||['italianHerbs']).map(id=>({id,qty:i.qty/(seasoning[recipe.id]?.length||1)})):[{...i,id:canonicalIngredientId(i.id)}]));
patchRecipe('lemon-shrimp-rice',{total:35});
patchRecipe('jp-sausage-shells',{method:'pot',active:10,total:30});
patchRecipe('jp-chicken-veggie-rice',{active:10,total:25});
// September profile review: retain IDs so existing plans and favorites still work.
const crispyChicken=RECIPES.find(r=>r.id==='jp-crispy-chicken-bowls');
crispyChicken.ingredients.find(i=>i.id==='popcornChicken').qty=225;
crispyChicken.adaptations='Uses 225 g small popcorn-chicken bites as a topping among potatoes and corn. A regular potato pot replaces the source’s Instant Pot; this is a higher-effort dinner with separate crisp toppings.';
const alfredo=RECIPES.find(r=>r.id==='jp-bacon-alfredo');
for(const [id,qty] of Object.entries({pasta:300,bacon:60,heavyCream:120,parmesan:45}))alfredo.ingredients.find(i=>i.id===id).qty=qty;
alfredo.ingredients.push({id:'milk',qty:300},{id:'cornstarch',qty:12},{id:'spinach',qty:200});
alfredo.description='Creamy Parmesan pasta with spinach, small chicken bits and a little crisp bacon.';
alfredo.adaptations='Uses 225 g finely chopped cooked chicken. Cream reduced to 120 ml with milk and cornstarch for the sauce; spinach added, bacon and Parmesan reduced. Still a comfort option with two cooking vessels.';
enrichRecipes(RECIPES);
reviewFit(RECIPES);

reviewEquipment(RECIPES,INGREDIENTS);
useUSRecipeText(RECIPES);
