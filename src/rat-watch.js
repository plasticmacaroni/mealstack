// Rats watch the pointer and twitch their noses. Decorative only; no effect on layout, focus or saved data.
//  - One IntersectionObserver tracks which .rat elements are on screen (re-armed after DOM changes).
//  - On-screen live rats get .rat-on, which enables the tiny CSS nose/whisker twitch (paused offscreen / hidden tab).
//  - One passive pointermove listener (fine pointer + hover only), rAF-throttled, sets the transform of .r-look
//    (the pupils) on visible live rats only. Sprite (<use>) rats stay still: reaching into their shadow trees means
//    inheriting a custom property through the whole rat, which measured ~7x more style recalc while moving.
// Off entirely under prefers-reduced-motion.
import {reduceMotion} from './motion.js';

const MAX=1.6; // SVG units the pupils may travel
export function watchRats() {
  if(typeof window==='undefined'||typeof IntersectionObserver!=='function'||reduceMotion())return;
  const visible=new Set();let pointer=null,frame=0;
  let centers=new WeakMap(); // cached rat centres, dropped on scroll/resize/re-render
  const forget=()=>{centers=new WeakMap();};addEventListener('scroll',forget,{passive:true,capture:true});addEventListener('resize',forget,{passive:true});
  const io=new IntersectionObserver(entries=>{for(const e of entries){e.target.classList.toggle('rat-on',e.isIntersecting);if(e.isIntersecting)visible.add(e.target);else visible.delete(e.target);}if(pointer)queue();});
  let rearm=0;
  const observeAll=()=>{rearm=0;forget();io.disconnect();visible.clear();for(const el of document.querySelectorAll('svg.rat-live'))io.observe(el);};
  new MutationObserver(()=>{if(!rearm)rearm=requestAnimationFrame(observeAll);}).observe(document.body,{childList:true,subtree:true});
  observeAll();

  const fine=matchMedia('(hover: hover) and (pointer: fine)');
  const queue=()=>{if(!frame)frame=requestAnimationFrame(update);};
  function update() {
    frame=0;if(!pointer)return;
    for(const el of visible){
      if(!el.isConnected){visible.delete(el);continue;}
      let c=centers.get(el);if(!c){const r=el.getBoundingClientRect();c={x:r.left+r.width/2,y:r.top+r.height*.4};centers.set(el,c);}
      const dx=pointer.x-c.x,dy=pointer.y-c.y,d=Math.hypot(dx,dy)||1,k=Math.min(1,d/160)*MAX;
      const look=el.__look||(el.__look=el.querySelector('.r-look'));if(!look)continue;
      const q=n=>(Math.round(n*4)/4).toFixed(2),v=`translate(${q(dx/d*k)}px,${q(dy/d*k*.8)}px)`; // quarter-unit steps: few writes
      if(el.__v!==v){el.__v=v;look.style.transform=v;}
    }
  }
  const onMove=e=>{if(e.pointerType&&e.pointerType!=='mouse'&&e.pointerType!=='pen')return;pointer={x:e.clientX,y:e.clientY};queue();};
  const sync=()=>{if(fine.matches)addEventListener('pointermove',onMove,{passive:true});else{removeEventListener('pointermove',onMove);pointer=null;}};
  fine.addEventListener?.('change',sync);sync();
}
