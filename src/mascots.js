// Friendly rat mascots and small decorations, drawn once as inline SVG.
// Every piece is decorative: aria-hidden, no <title>, no pointer events, hidden in print.
//   rat(pose,cls)      -> tiny <svg><use href="#rat-pose"></svg> from the shared sprite (cheap, static parts)
//   ratLive(pose,cls)  -> the same rat drawn inline so its tail, eyes, arm and z's can animate
//   deco(name,cls)     -> sparkle / heart / steam / cheese / paw from the sprite
//   icon(name,cls)     -> 24px line icons (calendar, spoon, basket) from the sprite
//   injectMascots()    -> puts the sprite in <body> once; safe to call repeatedly
// Addressable parts for motion: .r-look (pupils, moved by rat-watch.js on live rats), .r-eyes (blink), .r-nose, .r-whisk (twitch).
const EARS=`<g class="r-ears"><circle class="r-fur r-o" cx="16.5" cy="14" r="11"/><circle class="r-ear r-o" cx="17.3" cy="15" r="6.6"/><circle class="r-fur r-o" cx="47.5" cy="14" r="11"/><circle class="r-ear r-o" cx="46.7" cy="15" r="6.6"/></g>`;
const tailPath=d=>`<g class="r-tail"><path style="stroke:var(--rat-line);stroke-width:6.4" d="${d}"/><path d="${d}"/></g>`;
const TAIL=tailPath('M45 52C52.5 56.5 59 53 59 46.5C59 42 55 40 52.5 42.5');
const BODY=`<ellipse class="r-fur r-o" cx="32" cy="44.5" rx="17" ry="14"/><ellipse class="r-belly r-o" cx="32" cy="47.5" rx="10" ry="8.2"/>`;
const FEET=`<ellipse class="r-pink r-o" cx="24.5" cy="57.6" rx="5" ry="2.7"/><ellipse class="r-pink r-o" cx="39.5" cy="57.6" rx="5" ry="2.7"/>`;
const HEAD=`<ellipse class="r-fur r-o" cx="32" cy="26.5" rx="15.2" ry="13"/>`;
const CHEEKS=`<ellipse class="r-cheek" cx="21.4" cy="31" rx="3.3" ry="2"/><ellipse class="r-cheek" cx="42.6" cy="31" rx="3.3" ry="2"/>`;
const EYES=`<g class="r-look"><g class="r-eyes"><circle class="r-eye" cx="26" cy="25.6" r="2.2"/><circle class="r-eye" cx="38" cy="25.6" r="2.2"/><circle class="r-shine" cx="26.9" cy="24.7" r=".8"/><circle class="r-shine" cx="38.9" cy="24.7" r=".8"/></g></g>`;
const HAPPY=`<path class="r-stroke" d="M23.3 26.6q2.7-3.2 5.4 0M35.3 26.6q2.7-3.2 5.4 0"/>`;
const NOSE=`<ellipse class="r-nose r-o" style="stroke-width:1.8" cx="32" cy="30.5" rx="2.8" ry="2.2"/>`;
const SMILE=`<path class="r-stroke" d="M29.2 33.4q1.4 1.6 2.8 0q1.4 1.6 2.8 0"/>`;
const WHISK=`<path class="r-whisk" d="M19.5 31.5l-6.5-1.4M19.5 33.6l-6 1.5M44.5 31.5l6.5-1.4M44.5 33.6l6 1.5"/>`;
const face=(e=EYES,m=SMILE)=>CHEEKS+e+NOSE+m+WHISK;
const paw=(x,y,rx=3.3,ry=2.7)=>`<ellipse class="r-paw" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`;
const PAWS=paw(25.5,45)+paw(38.5,45);
const HAT=`<g class="r-hat" transform="rotate(-6 32 10)"><rect class="r-hatc r-o" x="22.5" y="8.5" width="19" height="7" rx="2.6"/><circle class="r-hatc r-o" cx="25.5" cy="5" r="6"/><circle class="r-hatc r-o" cx="38.5" cy="5" r="6"/><circle class="r-hatc r-o" cx="32" cy="1.6" r="7"/><rect class="r-hatc" x="24" y="4" width="16" height="10.3"/><path class="r-hatl" d="M27.5 10.5v3M32 10.5v3M36.5 10.5v3"/></g>`;
const spark=(x,y,s=1)=>`<path class="r-spark" transform="translate(${x} ${y}) scale(${s})" d="M0-6Q.8-.8 6 0Q.8.8 0 6Q-.8.8-6 0Q-.8-.8 0-6Z"/>`;
const heart=(x,y,s=1)=>`<path class="r-heart" transform="translate(${x} ${y}) scale(${s})" d="M0 5C-6 1-6-4-3-4.8C-1.4-5.2-.3-4.2 0-3C.3-4.2 1.4-5.2 3-4.8C6-4 6 1 0 5Z"/>`;
const arm=(a,b,c,d)=>`<path class="r-armo" d="M${a} ${b}L${c} ${d}"/><path class="r-arm" d="M${a} ${b}L${c} ${d}"/>`;
const STAND=TAIL+EARS+BODY+FEET+HEAD;

// [viewBox, artwork]. All colours come from CSS tokens, so every rat follows the theme.
export const RAT_POSES={
  face:  ['1 0 62 44',EARS+HEAD+face()],
  sit:   ['0 0 64 64',STAND+face()+PAWS],
  chef:  ['0 -9 64 73',STAND+HAT+face()+paw(25.5,45)+`<path class="r-spoon" d="M41 46L50 31"/><ellipse class="r-spoonb r-o" cx="51.6" cy="27.4" rx="3.3" ry="4.3" transform="rotate(30 51.6 27.4)"/>`+paw(41.5,44.5)],
  cheer: ['0 -5 64 69',TAIL+EARS+arm(22,42,12,27)+arm(42,42,52,27)+`<circle class="r-paw" cx="11.5" cy="25.5" r="3.3"/><circle class="r-paw" cx="52.5" cy="25.5" r="3.3"/>`+BODY+FEET+HEAD+face(HAPPY,`<path class="r-mouth" d="M29.3 33.2q2.7 4.2 5.4 0z"/>`)+spark(7,9,.9)+spark(57,7,.7)+heart(32,-1,.7)],
  sleep: ['0 8 64 56',`<g class="r-breathe"><ellipse class="r-fur r-o" cx="39" cy="45.5" rx="20.5" ry="13.5"/></g><ellipse class="r-pink r-o" cx="49" cy="58.4" rx="4.6" ry="2.5"/>${tailPath('M58 44C61.5 50.5 58 54 50 54C43 54 37 53.6 30 53.6L15 55.2C10 55.4 6.2 54.4 5.4 50.6')}<g transform="translate(1.2 0) rotate(-8 22 44)"><circle class="r-fur r-o" cx="12.5" cy="33" r="9.6"/><circle class="r-ear r-o" cx="13.2" cy="33.8" r="5.6"/><circle class="r-fur r-o" cx="31.5" cy="33" r="9.6"/><circle class="r-ear r-o" cx="30.8" cy="33.8" r="5.6"/><ellipse class="r-fur r-o" cx="22" cy="45" rx="14.5" ry="12"/><path class="r-stroke" d="M13.8 44q2.6 2.6 5.2 0M25 44q2.6 2.6 5.2 0"/><ellipse class="r-cheek" cx="12.4" cy="49" rx="3" ry="1.8"/><ellipse class="r-cheek" cx="31.6" cy="49" rx="3" ry="1.8"/><ellipse class="r-nose r-o" style="stroke-width:1.6" cx="22" cy="48.6" rx="2.4" ry="1.9"/><path class="r-stroke" style="stroke-width:1.6" d="M20.2 51.6q1.8 1.4 3.6 0"/></g>${paw(17,57,3.4,2.5)}${paw(26.5,56.6,3.4,2.5)}<g class="r-z"><path class="r-zz" d="M44 26h5l-5 6h5"/><path class="r-zz" d="M52.5 15h4l-4 5h4"/></g>`],
  peek:  ['1 0 62 46',EARS+HEAD+face()+paw(23,39.5,4.2,3.2)+paw(41,39.5,4.2,3.2)],
  cart:  ['-4 2 76 62',`<g transform="translate(17 2) scale(.84)">${STAND+face()}</g><path class="r-handle" d="M41.5 43L32 36.5"/>${paw(41.5,43)}<path class="r-cheese r-o" d="M9 34.5l13-6.5 2.4 8z"/><path class="r-leaf" d="M24 34q1-8 7-8q-1 7-7 8z"/><path class="r-cart r-o" d="M1.5 35h31l-3.6 16H5.6z"/><path class="r-cartl" d="M8.5 40.5h20M8 45.5h19"/><circle class="r-wheel" cx="9.5" cy="56" r="3.2"/><circle class="r-wheel" cx="25" cy="56" r="3.2"/>`],
  search:['0 0 64 64',STAND+face()+paw(25.5,45)+`<path class="r-handle" d="M42 45L47.5 38"/><g class="r-lensg"><circle class="r-lens r-o" cx="50" cy="31" r="7.5"/><circle class="r-shine" cx="47.5" cy="28.5" r="1.6"/></g>`+paw(42,45)],
  basket:['0 0 64 64',STAND+face()+`<path class="r-leaf" d="M25.5 47q-4.5-7 2-10.5q3.2 6.5-2 10.5z"/><circle class="r-tomato r-o" cx="37.5" cy="43.6" r="3.8"/><path class="r-leaf" d="M37.5 40q1.6-2.6 3.6-1.8q-.8 2.6-3.6 1.8z"/><path class="r-basket r-o" d="M17 46.5h30l-2.6 11H19.6z"/><path class="r-cartl" d="M21 50.5h22M22 54h20"/>`+paw(18.5,48)+paw(45.5,48)],
  wave:  ['0 -2 64 66',TAIL+EARS+`<g class="r-wavearm">${arm(43,42,52,28)}<circle class="r-paw" cx="52.5" cy="26.5" r="3.3"/></g>`+BODY+FEET+HEAD+face()+paw(25.5,45)],
  cheese:['0 0 64 64',STAND+face(HAPPY)+`<path class="r-cheese r-o" d="M18 50l28-10 1 11z"/><circle class="r-hole" cx="30" cy="48" r="1.6"/><circle class="r-hole" cx="39" cy="46" r="1.2"/><circle class="r-hole" cx="42" cy="49.5" r="1"/>`+paw(20,49)+paw(45,44)],
  worry: ['0 0 64 64',TAIL+`<g transform="rotate(-14 19 15)"><circle class="r-fur r-o" cx="16.5" cy="16" r="11"/><circle class="r-ear r-o" cx="17.3" cy="17" r="6.6"/></g><g transform="rotate(14 45 15)"><circle class="r-fur r-o" cx="47.5" cy="16" r="11"/><circle class="r-ear r-o" cx="46.7" cy="17" r="6.6"/></g>`+BODY+FEET+HEAD+CHEEKS+EYES+NOSE+`<path class="r-stroke" d="M29.6 34.6q2.4-2 4.8 0"/>`+WHISK+PAWS+`<path class="r-drop" d="M48 13q3 4 0 6q-3-2 0-6z"/>`],
  // Recipe-fetch rat: stands on its left, both paws reaching up to its right to hold the dialog's edge (mirror for the other side).
  hold:  ['0 -2 64 66',tailPath('M19 52C11.5 56.5 5 53 5 46.5C5 42 9 40 11.5 42.5')+`<g class="r-bodyg">`+EARS+BODY+FEET+HEAD+face(HAPPY)+`</g>`+arm(39,39,55.5,22.5)+arm(42,45,56.5,34)+`<circle class="r-paw" cx="56" cy="22" r="3.5"/><circle class="r-paw" cx="57" cy="34" r="3.5"/>`],
  love:  ['0 -4 64 68',STAND+face(HAPPY)+`<path class="r-heart r-o" d="M32 53C22 47 21 39 26.5 37.8C29 37.3 31 38.8 32 40.6C33 38.8 35 37.3 37.5 37.8C43 39 42 47 32 53Z"/>`+paw(24.5,44)+paw(39.5,44)+heart(12,6,.7)+heart(53,2,.55)],
};
export const DECOS={
  sparkle:['-7 -7 14 14',`<path class="r-spark" d="M0-6.5Q.9-.9 6.5 0Q.9.9 0 6.5Q-.9.9-6.5 0Q-.9-.9 0-6.5Z"/>`],
  heart:  ['-7 -7 14 14',`<path class="r-heart" d="M0 5.5C-6.5 1-6.5-4.4-3.2-5.2C-1.5-5.6-.3-4.5 0-3.2C.3-4.5 1.5-5.6 3.2-5.2C6.5-4.4 6.5 1 0 5.5Z"/>`],
  steam:  ['0 0 24 24',`<path class="d-steam" d="M6 21q-3-4 0-8t0-8"/><path class="d-steam" d="M12 21q-3-4 0-8t0-8"/><path class="d-steam" d="M18 21q-3-4 0-8t0-8"/>`],
  cheese: ['1 4 22 16',`<path class="r-cheese r-o" d="M2.5 17.5 20 8.5l1.5 10z"/><circle class="r-hole" cx="11" cy="15" r="1.4"/><circle class="r-hole" cx="17" cy="14.5" r="1"/>`],
  paw:    ['0 0 24 24',`<ellipse class="d-paw" cx="12" cy="15.5" rx="5" ry="4.2"/><circle class="d-paw" cx="6" cy="9.5" r="2.2"/><circle class="d-paw" cx="10" cy="6.5" r="2.2"/><circle class="d-paw" cx="14" cy="6.5" r="2.2"/><circle class="d-paw" cx="18" cy="9.5" r="2.2"/>`],
};
export const ICONS={
  calendar:`<rect x="3.5" y="5" width="17" height="15.5" rx="4"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.4" class="i-fill"/>`,
  bowl:    `<path d="M3.5 12h17a8.5 8 0 0 1-17 0z"/><path d="M8 20.5h8M9 8q-1.4-1.6 0-3.2M12.5 8q-1.4-1.6 0-3.2M16 8q-1.4-1.6 0-3.2"/>`,
  basket:  `<path d="M3.5 10h17l-2 9.5a2 2 0 0 1-2 1.5h-9a2 2 0 0 1-2-1.5z"/><path d="M8 10l3-6M16 10l-3-6M9 14.5v3M12 14.5v3M15 14.5v3"/>`,
  drag:    `<circle cx="9" cy="6" r="1.6" class="i-fill"/><circle cx="15" cy="6" r="1.6" class="i-fill"/><circle cx="9" cy="12" r="1.6" class="i-fill"/><circle cx="15" cy="12" r="1.6" class="i-fill"/><circle cx="9" cy="18" r="1.6" class="i-fill"/><circle cx="15" cy="18" r="1.6" class="i-fill"/>`,
  unpin:   `<path d="M7 7l10 10M17 7 7 17"/>`,
  pin:     `<path d="M9 3.5h6l-1 5 3.5 3.5h-11L10 8.5z"/><path d="M12 12v8.5"/>`,
  produce: `<path d="M14.5 9.5 5 19l-.5-.5L14 9"/><path d="M6 18.5 15.5 9a3 3 0 0 0-4.2-4.2L4 16z"/><path d="M15 8.5 19.5 4M15.5 9l4 .5M15 8.5 14.5 4.5"/>`,
  meat:    `<path d="M14.5 4a5.5 5.5 0 0 1 3.9 9.4c-1.9 1.9-4.4 1.7-5.9 1.1L9 18a2 2 0 1 1-2.6-.4A2 2 0 1 1 6 15l3.5-3.5c-.6-1.5-.8-4 1.1-5.9A5.5 5.5 0 0 1 14.5 4z"/>`,
  dairy:   `<path d="M8 3.5h8M8.5 3.5V7L6 10.5v10h12v-10L15.5 7V3.5"/><path d="M6 13.5h12"/>`,
  bread:   `<path d="M5 11a3.5 3.5 0 0 1 2-6.5h10a3.5 3.5 0 0 1 2 6.5v8.5H5z"/><path d="M9.5 9v3M14.5 9v3"/>`,
  frozen:  `<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/>`,
  grains:  `<path d="M12 21V9"/><path d="M12 9c-3-1-3.5-4-3-6 2.5.5 3.5 3 3 6zM12 9c3-1 3.5-4 3-6-2.5.5-3.5 3-3 6zM12 14c-3-1-4.5-3-4-5.5 2.5.3 4 2.5 4 5.5zM12 14c3-1 4.5-3 4-5.5-2.5.3-4 2.5-4 5.5z"/>`,
  can:     `<ellipse cx="12" cy="5.5" rx="6" ry="2"/><path d="M6 5.5v13c0 1.1 2.7 2 6 2s6-.9 6-2v-13M6 10h12M6 15h12"/>`,
};
const symbol=(id,[vb,art])=>`<symbol id="${id}" viewBox="${vb}">${art}</symbol>`;
export const MASCOT_SPRITE=`<svg id="mascot-sprite" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>${Object.entries(RAT_POSES).map(([k,v])=>symbol(`rat-${k}`,v)).join('')}${Object.entries(DECOS).map(([k,v])=>symbol(`deco-${k}`,v)).join('')}${Object.entries(ICONS).map(([k,v])=>symbol(`icon-${k}`,['0 0 24 24',v])).join('')}</defs></svg>`;
export function injectMascots() {if(!document.getElementById('mascot-sprite'))document.body.insertAdjacentHTML('afterbegin',MASCOT_SPRITE);}
const box=vb=>{const [x,y,w,h]=vb.split(' ');return `x="${x}" y="${y}" width="${w}" height="${h}"`;};
const use=(id,vb,cls)=>`<svg class="${cls}" viewBox="${vb}" aria-hidden="true" focusable="false"><use href="#${id}" ${box(vb)}/></svg>`;
export const rat=(pose,cls='')=>use(`rat-${pose}`,RAT_POSES[pose][0],`rat rat--${pose} ${cls}`.trim());
export const ratLive=(pose,cls='')=>{const [vb,art]=RAT_POSES[pose];return `<svg class="${`rat rat-live rat--${pose} ${cls}`.trim()}" viewBox="${vb}" aria-hidden="true" focusable="false">${art}</svg>`;};
export const deco=(name,cls='')=>use(`deco-${name}`,DECOS[name][0],`deco deco--${name} ${cls}`.trim());
export const icon=(name,cls='')=>use(`icon-${name}`,'0 0 24 24',`ui-icon ${cls}`.trim());
