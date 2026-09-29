import {addDays,dayOf,preparationDate} from './engine.js';


export const LOW_CLEANUP_LIMIT=8;

// A batch is prepared once, even when its portions appear on several days.
// Include Sunday preparation for Monday, plus Sunday work for next week's Monday.
export function preparationDays(state) {
  const end=addDays(state.week,6),groups=new Map();
  for(const batch of state.batches){
    const available=dayOf(batch.startSlot),date=preparationDate(batch);
    if(!((date>=state.week&&date<=end)||(date<state.week&&available>=state.week&&available<=end)))continue;
    if(!groups.has(date))groups.set(date,[]);
    groups.get(date).push(batch);
  }
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,batches])=>({date,batches:batches.sort((a,b)=>a.startSlot.localeCompare(b.startSlot)||a.id.localeCompare(b.id))}));
}

// Cook-day markers: each day of the shown week with the batches cooked that day. when:
// 'day' = cooked for a meal that day, 'night-before' = cooked that evening for a packed meal
// (or a dinner she cooks ahead), 'prep' = on a prep day. A batch counts once, on the day it is cooked,
// including a Sunday cook for next week's Monday.
export function cookDays(state) {
  return Array.from({length:7},(_,i)=>addDays(state.week,i)).map(date=>({date,batches:state.batches.filter(b=>preparationDate(b)===date)
    .sort((a,b)=>a.startSlot.localeCompare(b.startSlot)||a.id.localeCompare(b.id))
    .map(b=>({id:b.id,when:b.prepDate?'prep':b.prepAhead?'night-before':'day'}))}));
}

export const cookingKey=({id,batch,draft})=>`${batch?`batch:${batch}`:'recipe'}:${id}:${draft.scale}`;

export function readCookingProgress(raw) {
  try {
    const value=JSON.parse(raw);
    if(!value||typeof value!=='object'||Array.isArray(value))return {};
    return Object.fromEntries(Object.entries(value).filter(([key,steps])=>key.length<=250&&Array.isArray(steps))
      .slice(-100).map(([key,steps])=>[key,[...new Set(steps.filter(step=>Number.isInteger(step)&&step>=0&&step<100))]]));
  } catch {return {};}
}
