// The yarn string: one candy-coloured string per batch, card to card through the gutters.
// Two aria-hidden SVG layers inside the week grid: one behind the cards (strings at rest) and
// one above them (the focused string and every knot's loops). The knot itself is a small
// button (whole-batch handle: tap = batch menu, drag = move the whole batch). Everything here
// is decoration drawn from the calendar's own cards; the words live on the cards and chips.
// Drawn after every render, on resize and when fonts load: one batched read of card rects, then writes.
import {rank,dayOf} from './engine.js';

const NS='http://www.w3.org/2000/svg';
const q=(t,n)=>{const a=t*t,b=(1-t)*(1-t),c=2*t*(1-t);return [b*n[0]+c*n[2]+a*n[4],b*n[1]+c*n[3]+a*n[5]];};
const inside=(p,r)=>p[0]>r.l&&p[0]<r.r&&p[1]>r.t&&p[1]<r.b;
const f=n=>n.toFixed(1);
// A segment between two cards: a quadratic with a little gravity sag.
function seg(a,b){const d=Math.hypot(b.cx-a.cx,b.cy-a.cy),s=Math.min(46,d*.14);return [a.cx,a.cy,(a.cx+b.cx)/2,(a.cy+b.cy)/2+s,b.cx,b.cy];}
// Where the curve leaves card a and enters card b.
function clip(n,ra,rb){let t0=0,t1=1;for(let i=0;i<=120;i++){const t=i/120;if(inside(q(t,n),ra))t0=t;else break;}for(let i=120;i>=0;i--){const t=i/120;if(inside(q(t,n),rb))t1=t;else break;}return [t0,t1];}
function pathD(n,t0=0,t1=1,wave=0){
  const pts=[],N=40;
  for(let i=0;i<=N;i++){const t=t0+(t1-t0)*i/N;let [x,y]=q(t,n);
    if(wave){const [x2,y2]=q(Math.min(1,t+1e-3),n),dx=x2-x,dy=y2-y,l=Math.hypot(dx,dy)||1,w=Math.sin(i/N*Math.PI*wave)*4*Math.sin(i/N*Math.PI);x+=-dy/l*w;y+=dx/l*w;}
    pts.push(f(x)+','+f(y));}
  return 'M'+pts.join('L');
}
const stroke=(d,color,w,{dash='',cls=''}={})=>`<g class="${cls}"><path class="str-case" d="${d}" stroke-width="${w+3.5}"${dash?` stroke-dasharray="${dash}"`:''}/><path class="str-yarn" d="${d}" stroke="${color}" stroke-width="${w}"${dash?` stroke-dasharray="${dash}"`:` pathLength="1"`}/></g>`;
const bead=(x,y,color,r=5)=>`<circle class="str-bead" cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${color}"/>`;
function frayed(x,y,ang,color){return `<g transform="translate(${f(x)},${f(y)}) rotate(${f(ang)})">${[-28,0,26].map(a=>{const d=`M0 0l${f(7*Math.cos(a*Math.PI/180))} ${f(7*Math.sin(a*Math.PI/180))}`;return `<path class="str-case" d="${d}" stroke-width="4.5"/><path class="str-yarn" d="${d}" stroke="${color}" stroke-width="2"/>`;}).join('')}</g>`;}
// The knot's loops (the bead in the middle is the button's own SVG).
export const KNOT_SVG=`<svg class="knot-art" viewBox="-17 -12 34 24" aria-hidden="true" focusable="false"><path class="knot-case" d="M0 0c-9-11-19-3-11 4M0 0c9-11 19-3 11 4"/><path class="knot-loop" d="M0 0c-9-11-19-3-11 4M0 0c9-11 19-3 11 4"/><circle class="knot-bead" r="6.5"/></svg>`;

export const LOCK_BADGE='<svg class="knot-lock" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="lock-shackle" d="M8 11V8.2a4 4 0 0 1 8 0V11"/><rect class="lock-body" x="5" y="10.5" width="14" height="10" rx="2.6"/></svg>';

// One batched read: every visible card of every batch, relative to the grid, in calendar order.
function measure(grid) {
  const g=grid.getBoundingClientRect(),out={};
  for(const el of grid.querySelectorAll('.portion[data-batch][data-from]')){
    const r=el.getBoundingClientRect();if(!r.width)continue;
    const rr={l:r.left-g.left,t:r.top-g.top,r:r.right-g.left,b:r.bottom-g.top};rr.cx=(rr.l+rr.r)/2;rr.cy=(rr.t+rr.b)/2;rr.w=r.width;rr.h=r.height;
    (out[el.dataset.batch]??=[]).push({slot:el.dataset.from,el,r:rr});
  }
  for(const k in out)out[k].sort((a,b)=>rank(a.slot)-rank(b.slot));
  return {cards:out,w:grid.scrollWidth,h:grid.scrollHeight};
}

// batches: [{id, color, title, first:slot|null (the batch's first meal, any week), anchor:slot|null (the card
//            the knot sits on: the first meal, or the first one shown when that is a hidden snack),
//            locked, meals:{slot:{state,day}}, before:n, after:n, cookLabel, enjoyLabel, startLabel}]
export function drawStrings(grid,batches,{focus=null,animate=new Set()}={}) {
  if(!grid||!grid.isConnected)return;
  const m=measure(grid);
  grid.querySelectorAll(':scope>.str-layer,:scope>.str-chip').forEach(x=>x.remove());
  grid.classList.toggle('str-focusing',!!focus);
  let under='',over='',chips='';const knots=[];
  const chip=(x,y,html,cls='',color='')=>{chips+=`<div class="str-chip ${cls}" aria-hidden="true" style="left:${f(x)}px;top:${f(y)}px${color?`;--c:${color}`:''}">${html}</div>`;};
  for(const b of batches) {
    const list=m.cards[b.id]||[],on=focus===b.id,dim=!!focus&&!on,color=b.color;
    // (Cards already carry their colour from the template; writing it again would restyle every card.)
    for(const c of list){if(c.el.style.getPropertyValue('--c')!==color)c.el.style.setProperty('--c',color);c.el.classList.toggle('str-on',on);}
    if(!list.length)continue;
    let s='';const w=on?5:4,draw=animate.has(b.id)?' str-draw':'';
    // Clip segments to the card edges only for the focused string (it lies above the photos).
    for(let i=0;i<list.length-1;i++){
      const a=list[i],z=list[i+1],n=seg(a.r,z.r),[t0,t1]=clip(n,a.r,z.r),st=b.meals[z.slot]?.state;
      if(st==='unsafe'){
        // Snapped: the string thins, turns red and frays just before the late meal.
        const acc=[[t0,0]];let len=0,prev=q(t0,n);for(let k=1;k<=60;k++){const t=t0+(t1-t0)*k/60,p=q(t,n);len+=Math.hypot(p[0]-prev[0],p[1]-prev[1]);prev=p;acc.push([t,len]);}
        const at=px=>acc.find(([,l])=>l>=px)?.[0]??t1,tm=at(Math.max(len*.45,len-40)),tn=at(Math.max(len*.6,len-22)),tr=at(len*.3);
        s+=stroke(pathD(n,t0,tr),color,w,{cls:draw})+stroke(pathD(n,tr,tm),'var(--str-warn)',2.5,{dash:'5 4'})+stroke(pathD(n,tn,t1),'var(--str-warn)',2.5,{dash:'5 4'});
        const p1=q(tm,n),p0=q(Math.max(0,tm-.01),n),p2=q(tn,n),p3=q(Math.min(1,tn+.01),n);
        s+=frayed(p1[0],p1[1],Math.atan2(p1[1]-p0[1],p1[0]-p0[0])*180/Math.PI,'var(--str-warn)')+frayed(p2[0],p2[1],Math.atan2(p2[1]-p3[1],p2[0]-p3[0])*180/Math.PI,'var(--str-warn)');
        if(on){const pm=q((tm+tn)/2,n);chip(pm[0],pm[1]-20,`Snapped · day ${b.meals[z.slot].day}`,'is-warn');}
      } else {
        const wave=st==='mushy'?Math.max(4,Math.round(Math.hypot(z.r.cx-a.r.cx,z.r.cy-a.r.cy)/34)):0;
        s+=stroke(pathD(n,t0,t1,wave),color,st==='mushy'?w-1.5:w,{cls:`${st==='mushy'?'is-mushy':''}${draw}`});
      }
      const pa=q(t0,n),pb=q(t1,n);s+=bead(pa[0],pa[1],color)+bead(pb[0],pb[1],st==='unsafe'?'var(--str-warn)':color);
    }
    // Continues into another week: a short tail to the grid edge and a chip.
    const first=list[0],last=list.at(-1);
    if(b.before){
      const n=[-6,first.r.cy-26,first.r.l/2,first.r.cy-6,first.r.cx,first.r.cy],[,t1]=clip(n,{l:-99,r:-98,t:0,b:0},first.r);
      s+=stroke(pathD(n,0,t1),color,w-1,{dash:'2 7'});const p=q(t1,n);s+=bead(p[0],p[1],color);
      chip(Math.max(40,first.r.l+30),first.r.t-10,`← ${b.before} from last week`,'is-c is-edge',color);
    }
    if(b.after){
      const n=[last.r.cx,last.r.cy,(last.r.r+m.w)/2,last.r.cy+50,m.w+4,last.r.b+2],[t0]=clip(n,last.r,{l:-9,r:-8,t:0,b:0});
      s+=stroke(pathD(n,t0,1),color,w,{cls:draw});const p=q(t0,n);s+=bead(p[0],p[1],color);
      chip(Math.min(m.w-60,last.r.cx),last.r.b+12,`${b.after} more next week →`,'is-c is-edge',color);
    }
    const g=`<g class="str-batch${dim?' is-dim':''}${on?' is-on':''}" data-batch="${b.id}">${s}</g>`;
    if(on)over+=g;else under+=g;
    // The knot: on the batch's first meal (the cook meal), at the card's left edge. A small padlock
    // on it when the batch is locked in (Plan my week keeps it).
    const at=b.anchor??b.first,knotCard=at&&list.find(c=>c.slot===at);
    if(knotCard){
      const r=knotCard.r,y=r.t+Math.min(72,r.h*.4);
      knots.push({id:b.id,anchor:knotCard.slot,cls:`knot${dim?' is-dim':''}${on?' is-on':''}${draw?' str-pop':''}${b.locked?' is-locked':''}`,left:`${f(r.l+1)}px`,top:`${f(y)}px`,color,
        label:`Whole batch: ${b.title}. ${b.cookLabel}.${b.startLabel?` ${b.startLabel}.`:''}${b.locked?' Locked in.':''} Tap for options, or drag to move every meal`});
    }
    if(on){
      chip((knotCard||first).r.l+40,first.r.t-12,`<i></i>${b.cookLabel}`,'is-c',color);
      const fresh=[...list].reverse().find(c=>(b.meals[c.slot]?.state||'fresh')==='fresh')||first;
      chip(fresh.r.cx,fresh.r.b+13,b.enjoyLabel,'',color);
    }
  }
  const layer=(cls,body)=>`<svg class="str-layer ${cls}" aria-hidden="true" focusable="false" width="${m.w}" height="${m.h}" viewBox="0 0 ${m.w} ${m.h}">${body}</svg>`;
  grid.insertAdjacentHTML('beforeend',layer('str-under',under)+layer('str-over',over)+chips);
  // Knots are kept (updated in place, never replaced) so a tap or click that is already on one still lands.
  const old=new Map([...grid.querySelectorAll(':scope>.knot')].map(k=>[k.dataset.id,k]));
  for(const k of knots){
    let el=old.get(k.id);old.delete(k.id);
    if(!el){el=document.createElement('button');el.type='button';el.id=`knot-${k.id}`;el.dataset.action='knot';el.dataset.id=k.id;el.setAttribute('aria-haspopup','dialog');el.title='Whole batch · tap for options, drag to move it all';el.innerHTML=KNOT_SVG+LOCK_BADGE;}
    el.className=k.cls;el.dataset.anchor=k.anchor;el.style.left=k.left;el.style.top=k.top;el.style.setProperty('--c',k.color);el.setAttribute('aria-label',k.label.replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));
    if(!el.isConnected)grid.append(el);
  }
  for(const el of old.values())el.remove();
}
// Re-read on resize and when fonts settle; the caller passes the current model and focus.
let observer=null,observed=null;
export function watchGrid(grid,redraw) {
  if(observed===grid)return;
  observer?.disconnect();observed=grid;
  if(!grid||typeof ResizeObserver==='undefined')return;
  let first=true,last=0;
  observer=new ResizeObserver(()=>{if(first){first=false;return;}cancelAnimationFrame(last);last=requestAnimationFrame(redraw);});
  observer.observe(grid);
}
