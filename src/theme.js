// Run before the stylesheet so a saved theme never flashes the other palette.
(() => {
  let theme='dark';
  try {const saved=localStorage.getItem('mealstack.theme');if(['light','dark'].includes(saved))theme=saved;} catch {}
  document.documentElement.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]').content=theme==='dark'?'#2B1B4A':'#FFF4D6';
})();
