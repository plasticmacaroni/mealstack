import {meal} from './more-recipes.js';

// Original formulas inspired by familiar comfort dishes and recorded favorites.
// These package prices are editable planning assumptions, not store quotes.
export const CLASSIC_INGREDIENTS={
  kewpie:{name:'Kewpie mayonnaise',unit:'g',packQty:340,packCost:5.5},
  seaweed:{name:'Plain roasted seaweed (no chili)',unit:'g',packQty:20,packCost:2},
  tortillaStrips:{name:'Plain crunchy tortilla strips (no chili)',unit:'g',packQty:100,packCost:1.5},
  balsamicGlaze:{name:'Balsamic glaze',unit:'ml',packQty:250,packCost:3},
  sirloin:{name:'Boneless sirloin steak',unit:'g',packQty:454,packCost:7},
  vinegar:{name:'Rice vinegar (plain)',unit:'ml',packQty:355,packCost:2},
  dill:{name:'Dried dill',unit:'g',packQty:14,packCost:1.5},
};

// Every earlier AI-written entry here was replaced by a real published recipe in real-recipes.js.
export const CLASSIC_RECIPES=[
].map(r=>({...r,classic:true}));
