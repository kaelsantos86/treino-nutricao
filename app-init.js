function bindDynamic(){}

document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>setRoute(b.dataset.route)));
document.getElementById('quickAdd').addEventListener('click',openQuickAdd);
document.getElementById('profileBtn').addEventListener('click',openProfile);
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
render();
