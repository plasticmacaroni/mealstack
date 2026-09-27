// Small-batch recipe builder. Each formula travels with its own cooking method and tools.
// options.source {publisher,title,url} links the published recipe it adapts; options.image is its photo.
export const meal=(id,title,method,protein,cuisine,active,total,ingredients,description,vessels,steps,options={})=>({
  id,title,method,protein,cuisine,active,total,description,
  kind:options.kind||'main',emoji:options.emoji||({pot:'🍲',skillet:'🍳',bake:'🥘',tray:'🥔',slow:'🍲',air:'🍽️',bowl:'🥣'}[method]),
  nominal:options.nominal||4,servings:Math.max(1,Math.floor((options.nominal||4)*.75)),qualityDays:options.days||2,
  ingredients:ingredients.map(([id,qty])=>({id,qty})),dishes:options.tools||[['air','tray'].includes(method)?'Tongs':method==='skillet'?'Spatula':'Spoon','Knife','Cutting board'],
  source:options.source?id:null,note:options.note||'Small-batch adaptation. Portion leftovers promptly and keep any crisp toppings separate.',hue:0,
  ...(options.source?{origin:options.source,adaptations:options.adaptations||''}:{}),...(options.image?{image:options.image}:{}),...(options.classic?{classic:true}:{}),
  cooking:{vessels,steps:steps.map(([title,text])=>({title,text})),dump:!!options.dump,extraTools:options.extraTools||[]},
});

// Every earlier AI-written entry here was replaced by a real published recipe in real-recipes.js.
export const MORE_RECIPES=[
];
