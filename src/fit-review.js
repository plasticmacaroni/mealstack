// Reviewed against the recorded food profile, 2026-09-26; ids updated for the real-recipe catalog.
// These are planning interpretations, not medical rules or claims of taste testing.
const homeTexture=new Set([
  'dumpling-skillet','tuna-melts','pizza-potatoes','jp-pizza-sliders','jp-steak-quesadillas',
  'jp-crispy-chicken-bowls','sm-meatball-subs','potato-egg-hash','french-toast',
  'savory-cottage','apple-cottage-toast','avocado-cottage-balsamic-toast',
  'smoky-sausage-sweetpotato-hash',
]);
const assemble=new Set([
  'greek-pitas','tuna-cucumber-pitas','sweetpotato-beef','shrimp-tomato-bake','jp-beef-tacos',
  'breakfast-pitas','ham-egg-breakfast-wraps','skillet-cheeseburgers','veggie-sloppy-joes',
  'tuna-seaweed-rice','chicken-crunch-rice','corn-chicken-bake','beef-corn-tortilla-skillet',
  'mild-enchilada-rice','loaded-broccoli-potatoes',
  'chicken-bacon-ranch-rice','jp-bacon-alfredo','jp-french-onion-pork',
  'cheeseburger-pasta','egg-muffins','broccoli-cheddar-egg-bake',
]);
const softTexture=new Set(['cinnamon-overnight-oats','savory-oat-egg-bowls','peanut-berry-oats','apple-oat-bake','berry-yogurt-oat-bake','cocoa-oat-bites']);
export const SHOPPING_NOTE='Choose plain, non-hot sauces, sausage, meatballs, dumplings and seasonings: “mild” can still contain chili or pepper. Check labels for chili, cayenne, hot paprika, peas, coconut and ordinary mayo. Use sweet paprika and plain herbs; omit black pepper for zero heat.';
export function reviewFit(recipes) {
  for(const r of recipes){
    const ids=new Set(r.ingredients.map(i=>i.id));
    const home=homeTexture.has(r.id)||['air','tray'].includes(r.method);
    const assembly=assemble.has(r.id)||r.method==='bowl';
    const lunch=home?'home':assembly?'assemble':'reheat';
    const packing=r.storeBought
      ? 'Keep refrigerated. Grab one from the fridge and pack it chilled; eat it cold, no microwave needed.'
      : home
      ? 'Best at home: serve fresh or re-crisp using the recipe’s cooking equipment. Keep toppings separate and assemble only when ready to eat.'
      : assembly
        ? 'Pack the night before with bread, dry toppings and sauces separate. At lunch, reheat only the cooked filling if needed, then assemble; cold components stay chilled.'
        : 'Pack a portion the night before. Microwave with a vented cover, stirring halfway, to 165°F / 74°C throughout. Keep the batch within its 1–2-day texture window.';
    const notes=[];
    if(ids.has('chicken')||ids.has('cookedChicken')||ids.has('popcornChicken'))notes.push('Chicken is a small addition: cut into little bites and distribute through the starch and vegetables.');
    if(['blackBeans','pintoBeans','chickpeas'].some(id=>ids.has(id)))notes.push('Beans stay a small supporting addition, never the center of the meal.');
    if(ids.has('kewpie'))notes.push('Kewpie is included only in the accepted tuna, rice and seaweed combination.');
    if(softTexture.has(r.id))notes.push('Soft or chewy texture: try one portion first. This has not been confirmed as a liked texture.');
    if(r.active>20||r.cookware.length>1)notes.push(`${r.active} estimated active minutes; ${r.cookware.length} cooking vessels. Allow for the extra preparation and cleanup.`);
    if(['sirloin','cubeSteak','shavedSteak'].some(id=>ids.has(id)))notes.push('Cook steak through to her preference; this may cost more than the default per-portion limit.');
    r.fit={lunch,packing,notes};
    // Replace broad storage boilerplate where crispness or assembly is essential.
    if(home)r.storage='Refrigerate cooked components promptly in shallow containers. Keep bread, sauce and toppings separate. Reheat cooked leftovers to 165°F / 74°C, using an oven, air fryer or skillet for crisp parts. '+packing;
    else if(r.storeBought)r.storage=packing;
    else if(assembly)r.storage+=' '+packing;
    // A zero-heat profile should not quietly add black pepper at the final step.
    r.steps=r.steps.map(step=>({...step,text:step.text.replace(/salt and pepper/g,'salt if needed')}));
  }
}
