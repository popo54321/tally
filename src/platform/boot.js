(function(){
  var web = (location.protocol==='https:' && location.hostname!=='traininglog.local') || location.hostname==='localhost' || location.hostname==='127.0.0.1';
  if(!web || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('sw.js').catch(function(e){ console.error('sw register failed', e); });
  });
})();
