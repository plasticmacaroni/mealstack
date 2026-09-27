// Count labels: count(1,'meal') -> "1 meal", count(2,'batch') -> "2 batches", count(2,'knife') -> "2 knives".
// Pass the plural explicitly for phrases: count(n,'portion won’t','portions won’t').
const IRREGULAR={knife:'knives',leaf:'leaves',loaf:'loaves',child:'children',person:'people',mouse:'mice',tomato:'tomatoes',potato:'potatoes',dish:'dishes',box:'boxes',batch:'batches',lunch:'lunches',sandwich:'sandwiches'};
const auto=w=>{const lower=w.toLowerCase();if(Object.hasOwn(IRREGULAR,lower)){const p=IRREGULAR[lower];return w[0]===w[0].toUpperCase()?p[0].toUpperCase()+p.slice(1):p;}if(/(s|x|z|ch|sh)$/i.test(w))return w+'es';if(/[^aeiou]y$/i.test(w))return w.slice(0,-1)+'ies';return w+'s';};
export const pluralize=(n,word,plural=auto(word))=>Number(n)===1?word:plural;
export const count=(n,word,plural)=>`${n} ${pluralize(n,word,plural)}`;
