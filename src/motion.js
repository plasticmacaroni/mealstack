// Re-render-safe motion helpers. Nothing here touches saved plan data, focus or layout.
//   reduceMotion()          -> true when the person asked for less motion
//   markViewEnter(main,key) -> adds .view-enter to the fresh <main> only when the view key changed
//   flashAfterRender(sel,cls,burst) -> queue a one-shot class (and optional burst) for the NEXT render
//   runFlashes()            -> called by render(); applies queued one-shots in the next frame
//   fx(kind,target)         -> 'confetti' (full screen) | 'spark' | 'hearts' (around an element or rect)
//   syncLoops(root)         -> stamp the page clock so idle loops stay in phase across innerHTML re-renders
//   hop(el)                 -> replay the cheer-hop on a mascot that already exists
export const reduceMotion=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastViewKey=null;
export function markViewEnter(main,key) {if(key===lastViewKey||!main)return false;lastViewKey=key;main.classList.add('view-enter');return true;}
let queued=[];
export function flashAfterRender(selector,cls='just-placed',burst='') {queued.push({selector,cls,burst});}
export function runFlashes() {
  if(!queued.length)return;const list=queued;queued=[];
  requestAnimationFrame(()=>{for(const {selector,cls,burst} of list){const el=document.querySelector(selector);if(!el)continue;el.classList.add(cls);el.addEventListener('animationend',()=>el.classList.remove(cls),{once:true});if(burst)fx(burst,el);}});
}
const COLORS=['var(--green)','var(--cheese)','var(--mint)','var(--heart)','var(--sky)'];
export function fx(kind='confetti',target=null) {
  if(reduceMotion())return;
  const host=document.querySelector('dialog[open]')||document.body; // top-layer dialogs cover body layers
  const layer=document.createElement('div');layer.className='fx-layer';layer.setAttribute('aria-hidden','true');
  let html='';
  if(kind==='confetti'){
    for(let i=0;i<26;i++){const x=(Math.random()*100).toFixed(1),dx=((Math.random()-.5)*30).toFixed(1),r=(Math.random()*540)|0,d=(Math.random()*180)|0,dur=1000+((Math.random()*450)|0);
      html+=`<i class="fx-bit fx-${i%4}" style="left:${x}vw;--dx:${dx}vw;--r:${r}deg;--c:${COLORS[i%COLORS.length]};animation-delay:${d}ms;animation-duration:${dur}ms"></i>`;}
  } else {
    const rect=target?.getBoundingClientRect?target.getBoundingClientRect():target;if(!rect)return;
    const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,n=kind==='hearts'?5:8,dist=kind==='hearts'?26:Math.max(22,Math.min(46,rect.width/2+10));
    for(let i=0;i<n;i++){const a=i/n*Math.PI*2-Math.PI/2+(kind==='hearts'?(Math.random()-.5)*.6:0);
      html+=`<i class="${kind==='hearts'?'fx-heart':'fx-spark'}" style="left:${cx}px;top:${cy}px;--dx:${(Math.cos(a)*dist).toFixed(1)}px;--dy:${(Math.sin(a)*dist-(kind==='hearts'?10:0)).toFixed(1)}px;--c:${COLORS[i%COLORS.length]};animation-delay:${i*12}ms"></i>`;}
  }
  layer.innerHTML=html;host.append(layer);setTimeout(()=>layer.remove(),kind==='confetti'?2000:900);
}
// Idle loops live on nodes that render() recreates. Each render stamps the page clock on the fresh root as a
// negative delay (CSS: animation-delay:var(--clock)), so a re-render continues sway/blink mid-phase. One style write,
// no getAnimations() walk.
export function syncLoops(root) {if(root?.style)root.style.setProperty('--clock',`-${Math.round(performance.now())}ms`);}
export function hop(el) {if(!el||reduceMotion())return;el.classList.remove('anim-hop');void el.getBoundingClientRect();el.classList.add('anim-hop');el.addEventListener('animationend',()=>el.classList.remove('anim-hop'),{once:true});}
if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>document.documentElement.classList.toggle('is-hidden',document.hidden));
// Recipe fetch: a rat dashes in from a random side to the clicked card, grabs it, and the card flips round to become the
// dialog's hero photo. The rat then stays for as long as a dialog is open, holding it up: beside a bottom corner of a
// centered dialog, or peeking over the top edge of a phone bottom sheet. When the dialog closes it lets go and scampers off.
// Purely decorative: the dialog is open and interactive underneath from the first frame; the overlay is aria-hidden,
// pointer-events:none, animated with transform/opacity only and never overlaps dialog content (paws touch the border).
// Any pointer, wheel, scroll or key fast-forwards the run-in to the holding pose. Repeat opens run quicker but always run.
// Reduced motion: no running or flipping, just a still rat holding the dialog.
// fetchCard(cardEl, dialogEl, {hold, peek, exit}) -> hold/peek are the rat SVGs for the side and top-edge poses;
//   exit = {hold, peek, cheer, star, joy} SVGs for the goodbye (see celebrate below).
let lastFetch=-1e9,lastFrom='',stopFetch=null;
const HOLD={pawX:.885,feet:.944,ratio:66/64},PEEK={paw:.86,ratio:46/62};
const safeInset=v=>{const probe=document.createElement('i');probe.style.cssText=`position:fixed;top:0;height:var(${v},0px);visibility:hidden`;document.body.append(probe);const h=probe.offsetHeight;probe.remove();return h;};
const safeTop=()=>safeInset('--sat');
const pick=list=>list[Math.floor(Math.random()*list.length)];
// Where the rat holds the dialog: the side with room beside a bottom corner, else peeking over the top edge, else nowhere.
function holdSpot(d,prefer) {
  const vw=innerWidth,vh=innerHeight,w=Math.round(Math.max(84,Math.min(120,vw*.075))),h=w*HOLD.ratio;
  const room={left:d.left,right:vw-d.right},sides=['left','right'].filter(k=>room[k]>=w*.9&&d.bottom-d.top>h*1.4);
  if(sides.length){
    const side=sides.includes(prefer)?prefer:pick(sides),floor=Math.min(d.bottom,vh-6)-4;
    return {mode:'side',side,w,h,left:side==='left'?d.left-w*HOLD.pawX+1.5:d.right-w*(1-HOLD.pawX)-1.5,top:floor-h*HOLD.feet};
  }
  const pw=Math.min(76,(d.top+3-safeTop())/PEEK.paw/PEEK.ratio); // never up under the status bar of a home-screen app
  if(pw<40)return null;
  const ph=pw*PEEK.ratio,side=prefer==='right'||(prefer!=='left'&&Math.random()<.5)?'right':'left';
  // Left or right third of the edge, clear of the sheet's centre grabber and the heading's close button.
  const left=side==='left'?d.left+Math.min(28,d.width*.08):d.right-pw-Math.min(84,d.width*.22);
  return {mode:'top',side,w:pw,h:ph,left,top:d.top+3-ph*PEEK.paw,edge:d.top+3};
}
// Something that must stay readable (a toast) can ask the holding rat to get out of its way while it shows.
let duckFor=null;
const overlaps=(a,b)=>a.left<b.right+6&&b.left<a.right+6&&a.top<b.bottom+6&&b.top<a.bottom+6;
export function duck(el) {duckFor=el;syncDuck();}
function syncDuck() {
  const h=document.querySelector('.fetch-layer .fetch-hold');if(!h)return;
  const on=!!duckFor?.isConnected&&duckFor.classList.contains('visible')&&overlaps(duckFor.getBoundingClientRect(),h.getBoundingClientRect());
  h.classList.toggle('is-ducked',on);
}
const holding=on=>document.documentElement.classList.toggle('fetch-holding',on);
export function fetchCard(card,dialog,{hold='',peek='',exit=null}={}) {
  stopFetch?.(true);stopExit?.();
  if(!card||!dialog||matchMedia('print').matches)return;
  const still=reduceMotion(),dRect=dialog.getBoundingClientRect(),spot=holdSpot(dRect);
  const layer=document.createElement('div');layer.className='fetch-layer';layer.setAttribute('aria-hidden','true');
  if(layer.showPopover)layer.setAttribute('popover','manual');
  const holder=document.createElement('div');holder.className='fetch-hold';
  const put=sp=>{Object.assign(holder.style,{left:`${sp.left}px`,top:`${sp.top}px`,width:`${sp.w}px`,height:`${sp.h}px`});holder.style.setProperty('--edge',sp.edge!=null?`${sp.edge-sp.top}px`:'');};
  const place=sp=>{holder.className=`fetch-hold is-${sp.mode} is-${sp.side}`;put(sp);holding(true);queueMicrotask(syncDuck);
    holder.innerHTML=sp.mode==='side'?`<div class="fetch-body">${hold}</div>`:`<div class="fetch-runner">${hold}</div><div class="fetch-clip"><div class="fetch-body">${peek}</div></div>`;};
  let current=spot,settled=false,anims=[],dlg=dialog;
  if(spot)place(spot);
  layer.append(holder);
  // --- the run-in (skipped under reduced motion or when the card is offscreen) ---
  const hero=dialog.querySelector('.hero-media'),img=card.querySelector('.card-img');
  const photo=card.querySelector('.recipe-media,.portion-media')||img||card;
  const c=card.getBoundingClientRect(),s=photo.getBoundingClientRect(),t=hero?.getBoundingClientRect();
  const canRun=!still&&hero&&s.width&&t?.width&&s.bottom>0&&s.top<innerHeight;
  if(canRun){
    const now=performance.now(),quick=now-lastFetch<4000;lastFetch=now;
    const run=quick?150:260,grab=run+50,flip=grab+(quick?120:190),T=flip+(quick?150:230),at=ms=>Math.min(1,Math.max(0,ms/T));
    const k=s.width/t.width,P=`perspective(${Math.round(2400/(1+k))}px)`;
    const carry=document.createElement('div');carry.className='fetch-carry';
    carry.style.cssText=`--ik:${(1/k).toFixed(3)};left:${t.left}px;top:${t.top}px;width:${t.width}px;height:${t.height}px`;
    carry.innerHTML=`<div class="fetch-face fetch-a" style="height:${s.height/k}px"></div><div class="fetch-face fetch-b"></div>`;
    const a=carry.querySelector('.fetch-a'),b=carry.querySelector('.fetch-b');
    if(img)a.append(img.cloneNode(img.tagName!=='IMG'));
    const title=photo.querySelector?.('.recipe-title,.portion-name');if(title){const tag=document.createElement('b');tag.textContent=title.textContent;a.append(tag);}
    const heroCopy=hero.cloneNode(true);heroCopy.querySelectorAll('.rat').forEach(r=>r.remove());b.append(heroCopy);
    layer.prepend(carry);
    const dx=s.left-t.left,dy=s.top-t.top,from=`translate(${dx}px,${dy}px) scale(${k})`,lift=`translate(${dx}px,${dy-10}px) scale(${k*1.05}) rotate(-3deg)`;
    const ease='cubic-bezier(.35,.6,.3,1)',o=(el,frames)=>el.animate(frames,{duration:T,fill:'both'});
    anims=[
      o(carry,[{transform:from,offset:0},{transform:from,offset:at(run)},{transform:lift,offset:at(grab),easing:ease},{transform:'none',opacity:1,offset:at(T-40)},{transform:'none',opacity:0}]),
      o(a,[{transform:`${P} rotateY(0deg)`,offset:0},{transform:`${P} rotateY(0deg)`,offset:at(grab),easing:'ease-in'},{transform:`${P} rotateY(90deg)`,opacity:1,offset:at(flip)},{opacity:0,offset:at(flip+1)},{opacity:0}]),
      o(b,[{opacity:0,transform:`${P} rotateY(-90deg)`,offset:0},{opacity:0,transform:`${P} rotateY(-90deg)`,offset:at(flip)},{opacity:1,transform:`${P} rotateY(-90deg)`,offset:at(flip+1),easing:'ease-out'},{opacity:1,transform:`${P} rotateY(0deg)`}]),
      o(dialog,[{opacity:0},{opacity:0,offset:at(flip)},{opacity:1}]),
    ];
    // The rat: from offscreen (a different side from last time) to the card, grabs it, then on to its holding spot.
    const target=spot||{left:c.left+c.width/2-40,top:c.top,w:80,h:80*HOLD.ratio,mode:'none'};
    if(!spot){holder.className='fetch-hold is-side is-left is-away';Object.assign(holder.style,{left:`${target.left}px`,top:`${target.top}px`,width:'80px',height:`${target.h}px`});holder.innerHTML=`<div class="fetch-body">${hold}</div>`;}
    const sides=spot?.mode==='top'?['left','right','top']:spot?.side==='right'?['right','top','bottom']:['left','top','bottom'];
    const fromSide=pick(sides.filter(x=>x!==lastFrom).length?sides.filter(x=>x!==lastFrom):sides);lastFrom=fromSide;
    const gx=s.left+s.width/2-target.w/2,gy=Math.min(s.bottom,innerHeight)-target.h*.9; // grab point: standing at the photo
    const start={left:[-target.w-20,gy],right:[innerWidth+20,gy],top:[gx,-target.h-20],bottom:[gx,innerHeight+20]}[fromSide];
    const tr=([x,y],extra='')=>`translate(${Math.round(x-target.left)}px,${Math.round(y-target.top)}px)${extra}`;
    const lean=fromSide==='left'?' rotate(8deg)':fromSide==='right'?' rotate(-8deg)':'';
    const body=holder.querySelector('.fetch-body'),runner=holder.querySelector('.fetch-runner');
    anims.push(o(holder,[{transform:tr(start,lean),offset:0,easing:'cubic-bezier(.2,.7,.4,1)'},{transform:tr([gx,gy]),offset:at(run)},{transform:tr([gx,gy-8],' rotate(-4deg)'),offset:at(grab)},{transform:'none',offset:at(T-30),easing:ease},{transform:'none'}]));
    if(runner){ // top edge: the carrying rat ducks behind the sheet's edge and pops up to peek over it
      anims.push(o(runner,[{opacity:1},{opacity:1,offset:at(T-130)},{opacity:0,offset:at(T-110)},{opacity:0}]));
      anims.push(o(body,[{transform:'translateY(100%)'},{transform:'translateY(100%)',offset:at(T-120),easing:'cubic-bezier(.3,1.4,.5,1)'},{transform:'none'}]));
    }
    if(!spot)anims.push(o(body,[{opacity:1},{opacity:1,offset:at(T-60)},{opacity:0}]));
  } else lastFetch=performance.now();
  (dialog.showPopover?document.body:dialog).append(layer);layer.showPopover?.();
  const listeners=[['pointerdown',{capture:true}],['wheel',{capture:true,passive:true}],['scroll',{capture:true,passive:true}],['keydown',{capture:true}],['touchstart',{capture:true,passive:true}]];
  const unlisten=()=>{for(const [ev,opts] of listeners)removeEventListener(ev,settle,opts);};
  // Settle: run-in done (or fast-forwarded). The rat stays in its holding pose with a gentle idle.
  function settle() {
    if(settled)return;settled=true;unlisten();
    for(const an of anims)an.cancel();anims=[];layer.querySelector('.fetch-carry')?.remove();
    if(!current){leave();return;}
    holder.classList.add('is-holding');syncDuck();
  }
  // Keep holding whichever dialog is open in the same root (a recipe re-rendered, cooking mode, a package editor);
  // follow resizes; leave when none is open.
  const root=dialog.parentNode;
  const reanchor=()=>{
    const open=root?.querySelector('dialog[open]');
    if(!open){leave();return;}
    if(open!==dlg){dlg.removeEventListener('close',onClose);dlg=open;dlg.addEventListener('close',onClose);ro?.disconnect();ro?.observe(dlg);if(layer.showPopover){try{layer.hidePopover();layer.showPopover();}catch{}}}
    const sp=holdSpot(dlg.getBoundingClientRect(),current?.side);
    if(!sp){holder.style.visibility='hidden';holding(false);return;}
    holder.style.visibility='';holding(true);
    if(!current||sp.mode!==current.mode||sp.side!==current.side){place(sp);if(settled)holder.classList.add('is-holding');}
    else put(sp);
    current=sp;
  };
  const onClose=()=>setTimeout(reanchor,0);
  const mo=root?new MutationObserver(()=>{if(settled||!dlg.isConnected)reanchor();}):null;mo?.observe(root,{childList:true});
  const ro=typeof ResizeObserver==='function'?new ResizeObserver(()=>{if(settled)reanchor();}):null;ro?.observe(dialog);
  dialog.addEventListener('close',onClose);addEventListener('resize',reanchor,{passive:true});
  let gone=false;
  function leave(instant=false) {
    if(gone)return;gone=true;settled=true;unlisten();holding(false);
    for(const an of anims)an.cancel();anims=[];
    mo?.disconnect();ro?.disconnect();dlg.removeEventListener('close',onClose);removeEventListener('resize',reanchor);
    if(stopFetch===stop)stopFetch=null;
    const done=()=>layer.remove();
    if(instant||reduceMotion()||!current||holder.style.visibility==='hidden'||!exit||!layer.isConnected){done();return;}
    layer.querySelector('.fetch-carry')?.remove();
    celebrate(layer,holder,current,exit);
  }
  const stop=(instant)=>leave(instant);
  stopFetch=stop;
  if(!anims.length){settle();return;}
  // Listen a beat later so the focus/scroll caused by opening the dialog itself doesn't fast-forward it.
  setTimeout(()=>{if(!settled)for(const [ev,opts] of listeners)addEventListener(ev,settle,opts);},90);
  anims[0].finished.then(settle,()=>{});
}
// Goodbye, played over the page after the dialog has already closed (nothing waits for it): a four-point star twinkles
// at the paw that let go, the rat grins ^ ^ with joy squiggles round its head, throws both arms up, and runs off
// left or right. ~0.8s in all; within 3s of the last goodbye it only cheers and runs (~0.5s). Any pointer, key, wheel
// or scroll, or the next fetch, ends it at once. The pieces are drawn in the rat's own coordinates (the RAT_POSES frame:
// hold is 64 wide from x=0, y=-2; peek 62 wide from x=1, y=0), so the goodbye starts exactly where the rat was.
let stopExit=null,lastExit=-1e9;
function celebrate(layer,holder,sp,art) {
  const quick=performance.now()-lastExit<3000,top=sp.mode==='top',u=top?sp.w/62:sp.w/64,ox=top?-u:0,oy=top?0:2*u;
  const wrap=document.createElement('div');wrap.className=`fetch-exit${!top&&sp.side==='right'?' is-flipped':''}`;
  const bounds={l:Infinity,t:Infinity,r:-Infinity,b:-Infinity};
  // piece(svg, cx, cy, scale): cx/cy = where the art's own origin sits in rat coordinates (0,0 for poses).
  const piece=(html,cx=0,cy=0,k=1)=>{
    const t=document.createElement('template');t.innerHTML=html.trim();const el=t.content.firstElementChild;
    const [vx,vy,vw,vh]=el.getAttribute('viewBox').split(/[\s,]+/).map(Number),x=ox+(cx+vx*k)*u,y=oy+(cy+vy*k)*u,w=vw*k*u,h=vh*k*u;
    Object.assign(el.style,{left:`${x}px`,top:`${y}px`,width:`${w}px`,height:`${h}px`,transformOrigin:`${ox+cx*u-x}px ${oy+cy*u-y}px`});
    Object.assign(bounds,{l:Math.min(bounds.l,x),t:Math.min(bounds.t,y),r:Math.max(bounds.r,x+w),b:Math.max(bounds.b,y+h)});
    wrap.append(el);return el;};
  const pivot=(el,x=32,y=60.5)=>{el.style.transformOrigin=`${ox+x*u-parseFloat(el.style.left)}px ${oy+y*u-parseFloat(el.style.top)}px`;return el;};
  const grin=quick?null:pivot(piece(top?art.peek:art.hold));
  const cheer=pivot(piece(art.cheer));
  const joy=quick?null:pivot(piece(art.joy),32,26.5); // wiggles round the head
  const star=quick?null:piece(art.star,...(top?[46,37]:[61,17]),.95);
  holder.className='fetch-hold is-exit';holder.innerHTML='';holder.append(wrap);
  // Keep the whole goodbye on screen and clear of the notch / home indicator.
  const w=parseFloat(holder.style.width),flip=wrap.classList.contains('is-flipped'),L=parseFloat(holder.style.left),T=parseFloat(holder.style.top);
  const bl=L+(flip?w-bounds.r:bounds.l),br=L+(flip?w-bounds.l:bounds.r),bt=T+bounds.t-8*u,bb=T+bounds.b;
  const minY=safeTop()+6,maxY=innerHeight-safeInset('--sab')-6;
  const dx=bl<8?8-bl:br>innerWidth-8?innerWidth-8-br:0,dy=bt<minY?minY-bt:bb>maxY?Math.max(minY-bt,maxY-bb):0;
  holder.style.left=`${L+dx}px`;holder.style.top=`${T+dy}px`;
  const swap=quick?0:230,runAt=quick?120:400,runFor=quick?320:380,end=runAt+runFor;
  const o=(el,frames,opts)=>el.animate(frames,{fill:'both',...opts});
  const anims=[];
  if(grin){
    anims.push(o(grin,[{transform:'scale(1)',opacity:1},{transform:'translateY(-2px) scale(1.07,.95)',offset:.3},{transform:'scale(1)',opacity:1,offset:.97},{transform:'scale(1)',opacity:0}],{duration:swap,easing:'ease-out'}));
    anims.push(o(star,[{opacity:0,transform:'scale(.2) rotate(-35deg)',easing:'cubic-bezier(.2,.8,.4,1.2)'},{opacity:1,transform:'scale(1.3) rotate(0deg)',offset:.3,easing:'ease-out'},{opacity:1,transform:'scale(1) rotate(15deg)',offset:.6,easing:'ease-in'},{opacity:0,transform:'scale(.3) rotate(40deg)'}],{duration:300}));
    anims.push(o(joy,[{opacity:0,transform:'scale(.7)'},{opacity:1,transform:'scale(1.1) rotate(-4deg)',offset:.2},{transform:'scale(1) rotate(5deg)',offset:.45},{transform:'scale(1.05) rotate(-4deg)',offset:.7},{opacity:1,transform:'scale(1) rotate(0deg)',offset:.88},{opacity:0,transform:'scale(1.12)'}],{duration:runAt+40-100,delay:100}));
  }
  // Arms up with a little hop, then off it goes with a couple of bounces, leaning into the run.
  anims.push(o(cheer,[{opacity:0,transform:'scale(1.08,.88)'},{opacity:1,transform:'scale(1.08,.88)',offset:.01},{transform:'translateY(-14%) scale(.95,1.06)',offset:.45,easing:'ease-in'},{opacity:1,transform:'none'}],{duration:quick?120:170,delay:swap,easing:'ease-out'}));
  const dir=Math.random()<.5?-1:1,L2=L+dx,away=dir<0?-(L2+Math.max(bounds.r,w-bounds.l)+30):innerWidth-L2+Math.max(-bounds.l,bounds.r-w)+30;
  const run=o(holder,[{transform:'none'},{transform:`translate(${away*.22}px,-7px) rotate(${dir*7}deg)`,offset:.3},{transform:`translate(${away*.55}px,0) rotate(${dir*9}deg)`,offset:.6},{transform:`translate(${away}px,-5px) rotate(${dir*11}deg)`}],{duration:runFor,delay:runAt,easing:'cubic-bezier(.45,.05,.85,.7)'});
  anims.push(run);
  const inputs=[['pointerdown',{capture:true}],['keydown',{capture:true}],['wheel',{capture:true,passive:true}],['scroll',{capture:true,passive:true}],['touchstart',{capture:true,passive:true}]];
  let over=false,armed=0;
  const finish=()=>{if(over)return;over=true;clearTimeout(armed);for(const [ev,opts] of inputs)removeEventListener(ev,finish,opts);for(const an of anims)an.cancel();layer.remove();lastExit=performance.now();if(stopExit===finish)stopExit=null;};
  stopExit=finish;
  // Listen a beat later so the focus/scroll that closing the dialog causes doesn't end it before it starts.
  armed=setTimeout(()=>{if(!over)for(const [ev,opts] of inputs)addEventListener(ev,finish,opts);},80);
  run.finished.then(finish,()=>{});
  return end;
}
