// The greeting on the front page, in the reader's own time of day.
(function(){
  var g=document.getElementById('greeting');if(!g)return;
  var h=new Date().getHours(),hi=h<5||h>=22?'Good night':h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  g.textContent=hi; // each day below has its own date heading
})();

// Live search: the search box in the header filters the stories on this page as you type.
(function(){
  var form=document.querySelector('form.search'),q=document.getElementById('q'),
      results=document.getElementById('search-results'),page=document.getElementById('page-content'),
      status=document.getElementById('search-status'),pills=[].slice.call(document.querySelectorAll('.cats a')),
      current=pills.filter(function(a){return a.hasAttribute('aria-current')})[0],data=null,timer=null;
  // On narrow screens the menu scrolls sideways; make sure the current section (e.g. History, at the end) is in view.
  if(current)current.scrollIntoView({block:'nearest',inline:'nearest'});
  if(!form||!q||!results||!page)return;
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function fmt(d){return new Date(d).toLocaleDateString('en-GB',{timeZone:'Europe/Zurich',day:'numeric',month:'short'})}
  // Lowercase words without accents, so "zurich" finds "Zürich".
  function norm(s){return String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')}
  function words(s){return norm(s).split(/[^a-z0-9]+/).filter(Boolean)}
  // A term matches a word that starts with it: "ai" matches "ai" and "aim", never "said".
  function has(ws,t){for(var i=0;i<ws.length;i++)if(ws[i].lastIndexOf(t,0)===0)return true;return false}
  function setPill(a){pills.forEach(function(p){p===a?p.setAttribute('aria-current','page'):p.removeAttribute('aria-current')})}
  function setUrl(v){var u=new URL(location.href);v?u.searchParams.set('q',v):u.searchParams.delete('q');history.replaceState(null,'',u.pathname+u.search+u.hash)}
  function load(){return data?Promise.resolve(data):fetch('/search.json').then(function(r){return r.json()}).then(function(j){
    j.forEach(function(a){a._t=words(a.t);a._g=words(a.g.join(' '));a._w=a._t.concat(a._g,words(a.d+' '+a.x+' '+a.c))});return data=j})}
  function card(a){return '<article class="card"><div class="text"><p class="kicker">'+esc(a.c)+' · <time datetime="'+a.p+'">'+fmt(a.p)+'</time></p><h2><a href="'+a.u+'">'+esc(a.t)+'</a></h2><p class="dek">'+esc(a.d)+'</p></div>'+(a.i?'<a class="thumb" href="'+a.u+'" tabindex="-1" aria-hidden="true"><img src="'+a.i+'" alt="" loading="lazy" width="480" height="270"></a>':'')+'</article>'}
  function run(){
    var v=q.value.trim(),terms=words(v);setUrl(v);
    if(!terms.length){results.hidden=true;results.innerHTML='';page.hidden=false;status.textContent='';status.hidden=true;setPill(current);return}
    load().then(function(d){
      if(q.value.trim()!==v)return; // the reader kept typing
      var hits=d.filter(function(a){return terms.every(function(t){return has(a._w,t)})})
        .map(function(a){var s=0;terms.forEach(function(t){if(has(a._t,t))s+=3;if(has(a._g,t))s+=2});return{a:a,s:s}})
        .sort(function(x,y){return y.s-x.s||new Date(y.a.p)-new Date(x.a.p)});
      setPill(pills[0]); // searching covers every category, so "All" is the active filter
      page.hidden=true;results.hidden=false;status.hidden=false;
      status.textContent=hits.length?hits.length+(hits.length===1?' story matches':' stories match')+' “'+v+'”':'No stories match “'+v+'”. Try a shorter word, or pick a section above.';
      results.innerHTML=hits.slice(0,100).map(function(h){return card(h.a)}).join('');
    }).catch(function(){status.hidden=false;status.textContent='Search is unavailable right now.'});
  }
  q.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(run,200)});
  // On phones the search box hides behind a magnifier button in the header.
  var top=form.parentNode,openBtn=document.querySelector('.search-open'),closeBtn=document.querySelector('.search-close');
  function expand(){top.classList.add('searching');if(openBtn)openBtn.setAttribute('aria-expanded','true')}
  function collapse(){clearTimeout(timer);q.value='';run();top.classList.remove('searching');if(openBtn){openBtn.setAttribute('aria-expanded','false');if(getComputedStyle(openBtn).display!=='none')openBtn.focus()}}
  if(openBtn)openBtn.addEventListener('click',function(){expand();q.focus()});
  if(closeBtn)closeBtn.addEventListener('click',collapse);
  q.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();if(top.classList.contains('searching'))collapse();else if(q.value){q.value='';run()}}});
  form.addEventListener('submit',function(e){e.preventDefault();clearTimeout(timer);run()});
  var start=new URLSearchParams(location.search).get('q');if(start){q.value=start;expand();run()}
})();
