(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const touchDevice=()=>document.documentElement.classList.add("touch-device");
  if(navigator.maxTouchPoints>0 || window.matchMedia("(any-pointer: coarse)").matches)touchDevice();
  window.addEventListener("pointerdown",e=>{if(e.pointerType==="touch")touchDevice()},{passive:true});
  const worldData=[
    {name:"青葱草甸",image:"meadow",rank:"入门",tag:"#c9e4a3",caption:"草台跳跃 · 弹簧花园",blurb:"从金币指引的第一跳出发，借花园里的红弹簧跃上藏有星币的草台。"},
    {name:"辉光晶洞",image:"cavern",rank:"进阶",tag:"#d8c8ed",caption:"晶石摆渡 · 碎台连跳",blurb:"乘升降台穿过发光的晶湖。脚下的裂纹石板开始颤动时，就是起跳的信号。"},
    {name:"云顶风车",image:"sky",rank:"挑战",tag:"#f5d69c",caption:"空中摆渡 · 云海双路线",blurb:"飞龟守着风车岛的航线。沿低处的云桥稳步前进，或借弹簧跃进上层航道。"},
    {name:"熔岩城堡",image:"castle",rank:"BOSS",tag:"#f4b5a4",caption:"熔炉机关 · 库克决战",blurb:"越过熔炉巡廊，在王座前迎战库克。看准它的冲锋方向，利用撞墙后的破绽。"},
  ];
  const pad=n=>String(n).padStart(2,"0");
  const clock=n=>Math.floor(n/60)+":"+pad(Math.floor(n)%60);
  const slot=(index)=>(Math.floor(index/2)+1)+"-"+(index%2+1);
  const key="mushroom-arcade-progress-v1";
  const store={mode:"classic",sound:true,levels:{}};
  let storageReady=true;
  try{
    const raw=JSON.parse(localStorage.getItem(key)||"{}") || {};
    if(Object.hasOwn(ARCADE_MODES,raw.mode))store.mode=raw.mode;
    if(typeof raw.sound==="boolean")store.sound=raw.sound;
    for(let i=0;i<COURSES.length;i++){
      const rec=raw.levels?.[i];if(!rec || rec.cleared!==true)continue;
      const best={};
      for(const id of Object.keys(ARCADE_MODES))if(Number.isFinite(rec.best?.[id]) && rec.best[id]>0)best[id]=rec.best[id];
      const stars=Array.isArray(rec.stars)?[...new Set(rec.stars.filter(n=>Number.isInteger(n)&&n>=0&&n<3))]:[];
      store.levels[i]={cleared:true,stars,best};
    }
  }catch{storageReady=false}
  function save(){
    try{localStorage.setItem(key,JSON.stringify(store));storageReady=true}
    catch{storageReady=false}
    $("save-status").textContent=storageReady?"冒险进度自动保存在此浏览器":"当前浏览器仅保留本次游玩记录";
  }
  class Sound{
    constructor(){this.enabled=store.sound;this.live=false;this.world=0;this.boss=false;this.context=null;this.pool=new Map();this.theme=null;this.tickId=null;this.step=0;this.voices=new Set()}
    unlock(){
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      try{if(!this.context && AudioCtx)this.context=new AudioCtx();if(this.context?.state==="suspended")this.context.resume().catch(()=>{})}catch{}
    }
    voice(freq,length,volume,shape){
      if(!this.enabled||!this.context||this.context.state!=="running"||!freq)return;
      const c=this.context,o=c.createOscillator(),g=c.createGain(),at=c.currentTime;
      o.type=shape;o.frequency.value=freq;g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(volume,at+.01);
      g.gain.exponentialRampToValueAtTime(.0001,at+length);o.connect(g);g.connect(c.destination);o.start(at);o.stop(at+length+.02);
      this.voices.add(o);o.onended=()=>{this.voices.delete(o);o.disconnect();g.disconnect()};
    }
    effect(name){
      if(!this.enabled)return;
      let pool=this.pool.get(name);if(!pool){pool=[];this.pool.set(name,pool)}
      let a=pool.find(x=>x.paused||x.ended);
      if(!a && pool.length<3){
        const ext=name.endsWith("clear")?"wav":"ogg";a=new Audio("./assets/audio/"+name+"."+ext);
        a.volume=name.endsWith("clear") ? .34 : .32;pool.push(a);
      }
      if(!a)return;
      try{a.currentTime=0;a.play().catch(()=>this.voice(name==="coin"?990:360,.12,.035,"square"))}catch{}
    }
    pulse(){
      const lines=[
        [0,4,7,0,12,7,9,4,5,9,12,9,7,4,2,7],
        [0,7,12,0,3,10,7,0,5,12,15,7,3,10,7,2],
        [0,4,7,11,9,7,4,0,5,9,12,9,7,4,2,7],
        [0,7,3,0,1,8,5,1,0,7,3,0,-2,5,2,-2],
        [0,0,7,3,1,1,8,5,0,3,7,10,-2,2,5,2],
      ];
      const idx=this.boss?4:this.world,notes=lines[idx],n=this.step++%notes.length,root=[261.63,220,293.66,196,196][idx];
      const hz=i=>root*2**(i/12);this.voice(hz(notes[n]),idx===1?.34:.17,idx===1?.035:.021,idx===1?"triangle":"square");
      if(n%4===0)this.voice(hz(notes[n]-24),.26,.065,"triangle");
      if(idx===4 && n%2===0)this.voice(83,.07,.038,"sawtooth");
    }
    stop(){
      this.live=false;if(this.theme)this.theme.pause();clearInterval(this.tickId);this.tickId=null;
      for(const o of this.voices){try{o.stop()}catch{}}
    }
    stopEffects(){for(const pool of this.pool.values())for(const a of pool)a.pause()}
    start(world,boss=false,reset=false){
      this.stop();this.world=world;this.boss=boss;this.live=true;
      if(reset)this.step=0;
      if(!this.enabled)return;
      if(world===0 && !boss){
        if(!this.theme){this.theme=new Audio("./assets/audio/main_theme.ogg");this.theme.loop=true;this.theme.volume=.2}
        if(reset)this.theme.currentTime=0;
        if(this.theme.canPlayType("audio/ogg")){this.theme.play().catch(()=>{});return}
      }
      this.pulse();this.tickId=setInterval(()=>{if(this.live)this.pulse()},boss?160:[205,265,205,195][world]);
    }
    toggle(){
      this.enabled=!this.enabled;store.sound=this.enabled;
      if(!this.enabled)this.stopEffects();
      this.unlock();if(this.live)this.start(this.world,this.boss);
      refreshSound();save();
    }
  }
  const sound=new Sound();
  const details=$("details"),playDialog=$("game"),overlay=$("overlay");
  let game=null,renderer=null,hudKey="",hintEnd=0,frameId=0,lastFrame=0,accumulator=0;
  const held=new Map();
  function refreshSound(){
    document.querySelectorAll("[data-sound]").forEach(b=>{
      b.classList.toggle("is-muted",!store.sound);b.setAttribute("aria-pressed",String(store.sound));
      b.setAttribute("aria-label",store.sound?"关闭声音":"开启声音");
      const label=b.querySelector("span");if(label)label.textContent=store.sound?"声音开启":"声音关闭";
    });
  }
  function nextCourse(){const i=COURSES.findIndex((_,idx)=>!store.levels[idx]);return i===-1?0:i}
  function renderProgress(){
    const records=Object.values(store.levels),times=records.map(r=>r.best[store.mode]).filter(Number.isFinite);
    $("clears").textContent=pad(records.length);$("stars").textContent=pad(records.reduce((n,r)=>n+r.stars.length,0));
    $("best-time").textContent=times.length?clock(Math.min(...times)):"--:--";
    $("start-game").querySelector("span").textContent=records.length===8?"再次冒险":records.length?"继续冒险":"开始冒险";
    document.querySelectorAll("[data-difficulty]").forEach(s=>s.value=store.mode);
    $("save-status").textContent=storageReady?"冒险进度自动保存在此浏览器":"当前浏览器仅保留本次游玩记录";
  }
  const modeOptions=()=>Object.entries(ARCADE_MODES).map(([id,m])=>'<option value="'+id+'"'+(id===store.mode?" selected":"")+'>'+m.name+'</option>').join("");
  const worldGrid=$("world-grid");
  for(const [i,w] of worldData.entries()){
    const b=document.createElement("button");b.type="button";b.className="world-card";b.style.setProperty("--tag",w.tag);
    b.setAttribute("aria-label","选择"+w.name+"的关卡");
    b.innerHTML='<div class="world-image"><img src="./assets/art/'+w.image+'.webp" alt=""><span class="world-code">WORLD '+pad(i+1)+'</span></div><div class="world-info"><div class="card-title"><h3>'+w.name+'</h3><span class="rank">'+w.rank+'</span></div><div class="card-caption">'+w.caption+'<i class="ico arrow"></i></div></div>';
    b.addEventListener("click",()=>showWorld(i));worldGrid.append(b);
  }
  function showDetails(label,html){
    $("detail-label").textContent=label;$("detail-body").innerHTML=html;
    details.setAttribute("aria-labelledby","detail-title");if(!details.open)details.showModal();
    document.body.classList.add("modal-open");details.scrollTop=0;
  }
  function showWorld(i){
    const w=worldData[i],indices=[i*2,i*2+1];
    const buttons=indices.map(n=>{
      const r=store.levels[n],best=r?.best[store.mode];
      const rec=r?"已通关 · 星币 "+r.stars.length+"/3"+(best?" · "+clock(best):""):"星币 0/3";
      return '<button class="level-choice" data-level="'+n+'"><span class="level-id">'+slot(n)+'</span><span><strong>'+COURSES[n].name+'</strong><small>'+rec+'</small></span><i class="ico arrow"></i></button>';
    }).join("");
    showDetails("WORLD "+pad(i+1)," <img class='modal-art' src='./assets/art/"+w.image+".webp' alt=''><div class='detail-inner'><h2 id='detail-title'>"+w.name+"</h2><p>"+w.blurb+"</p>"+buttons+"<div class='modal-mode'><label for='modal-diff'>游玩难度</label><select id='modal-diff' data-difficulty>"+modeOptions()+"</select></div></div>");
    $("modal-diff").addEventListener("change",e=>{setMode(e.target.value);showWorld(i);$("modal-diff").focus()});
    details.querySelectorAll("[data-level]").forEach(b=>b.addEventListener("click",()=>launch(Number(b.dataset.level))));
  }
  function guide(){
    const rows=[
      ["左右移动","<kbd>←</kbd><kbd>→</kbd>　或　<kbd>A</kbd><kbd>D</kbd>"],
      ["跳跃 · 长按跳得更高","<kbd>Space</kbd>　或　<kbd>W</kbd><kbd>↑</kbd>"],
      ["加速奔跑","<kbd>Shift</kbd>　或　<kbd>K</kbd>"],
      ["暂停 / 继续","<kbd>Esc</kbd>　或　<kbd>P</kbd>"],
    ].map(([label,keys])=>'<div class="guide-row"><strong>'+label+'</strong><span>'+keys+'</span></div>').join("");
    showDetails("PLAYER MANUAL",'<div class="detail-inner"><h2 id="detail-title">操作手册</h2><p>到达每关右侧的金旗即可过关。触屏可同时按住方向与跳跃键，横屏能看见更大的画面。</p><div class="guide-rows">'+rows+'</div><div class="guide-tips"><div><i class="ico flag"></i>点亮中途旗后，失足会从旗旁重来。</div><div><i class="ico star"></i>每关藏有三枚星币，通关后计入收藏，可分次收齐。</div><div><i class="ico heart"></i>休闲 / 经典 / 专家分别有 5 / 3 / 2 颗心。撞问号砖找蘑菇即可补血。</div><div><i class="ico crown"></i>跳过库克的火球和冲锋。它撞墙晕眩时，跳起来踩头。</div></div></div>');
  }
  function setMode(mode){if(!Object.hasOwn(ARCADE_MODES,mode))return;store.mode=mode;save();renderProgress()}
  document.querySelector(".difficulty select").addEventListener("change",e=>setMode(e.target.value));
  document.querySelectorAll("[data-open-guide]").forEach(b=>b.addEventListener("click",guide));
  document.querySelectorAll("[data-sound]").forEach(b=>b.addEventListener("click",()=>sound.toggle()));
  document.querySelectorAll("[data-nav],.brand").forEach(a=>a.addEventListener("click",()=>setNav(a.hash==="#worlds"?"worlds":"lobby")));
  function setNav(active){document.querySelectorAll("[data-nav]").forEach(n=>n.classList.toggle("current",n.dataset.nav===active))}
  window.addEventListener("scroll",()=>{if(!playDialog.open&&!details.open)setNav(window.scrollY>100 && $("worlds").getBoundingClientRect().top<window.innerHeight*.65?"worlds":"lobby")},{passive:true});
  $("close-details").addEventListener("click",()=>details.close());details.addEventListener("close",()=>{if(!playDialog.open)document.body.classList.remove("modal-open")});
  details.addEventListener("click",e=>{if(e.target===details){const b=details.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)details.close()}});
  function dismissHint(){$("game-hint").classList.remove("visible");hintEnd=0}
  function hint(text,seconds){$("game-hint").textContent=text;$("game-hint").classList.add("visible");hintEnd=game.time+seconds}
  function drawHUD(){
    const g=game;if(!g)return;
    const count=g.stars.filter(s=>s.got).length,activeBoss=g.boss&&g.boss.phase!=="waiting"&&!g.bossDown;
    const sig=[g.health,g.gold,count,Math.floor(g.time),activeBoss?g.boss.hp:"-"].join("/");
    if(sig===hudKey)return;hudKey=sig;
    $("hearts").innerHTML=Array.from({length:g.mode.hearts},(_,i)=>'<i class="ico heart'+(i<g.health?'':' empty-heart')+'"></i>').join("");
    $("hearts").setAttribute("aria-label","体力 "+g.health+" / "+g.mode.hearts);$("gold-count").textContent=pad(g.gold);
    $("star-count").textContent=count+"/3";$("timer").textContent=clock(g.time);
    $("boss-meter").hidden=!activeBoss;
    if(activeBoss)$("boss-pips").innerHTML=Array.from({length:g.boss.max},(_,i)=>'<i class="'+(i>=g.boss.hp?"spent":"")+'"></i>').join("");
  }
  function release(){
    held.clear();game?.release();
    document.querySelectorAll("[data-control].held").forEach(b=>b.classList.remove("held"));
  }
  function overlayCard(icon,title,body,choices){
    release();dismissHint();overlay.hidden=false;overlay.innerHTML='<div class="overlay-card"><img src="./assets/ui/'+icon+'.png" alt=""><h2>'+title+'</h2><p>'+body+'</p><div class="overlay-actions"></div></div>';
    const root=overlay.querySelector(".overlay-actions");choices.forEach(([label,fn],i)=>{
      const b=document.createElement("button");b.className="stage-button"+(i===0?" accent":"");b.textContent=label;
      b.addEventListener("click",fn);root.append(b);
    });root.firstElementChild?.focus({preventScroll:true});
  }
  function showPause(){
    if(!game||game.state!=="playing")return;
    game.state="paused";sound.stop();$("pause").setAttribute("aria-label","继续游戏");
    overlayCard("mushroom","冒险已暂停",slot(game.index)+" · "+game.course.name+"　|　"+game.mode.name+"难度",[
      ["继续游戏",resume],["重开本关",()=>launch(game.index)],["返回大厅",leave],
    ]);
  }
  function resume(){
    if(game?.state!=="paused")return;game.state="playing";overlay.hidden=true;resetClock();$("pause").setAttribute("aria-label","暂停游戏");
    sound.unlock();sound.start(game.world,Boolean(game.boss&&game.boss.phase!=="waiting"&&!game.bossDown));playDialog.focus({preventScroll:true});
  }
  function togglePause(){if(game?.state==="playing")showPause();else if(game?.state==="paused")resume()}
  function handle(type,payload){
    if(type==="sfx"){sound.effect(payload);return}
    if(type==="hint"){hint(payload.text,payload.seconds);return}
    if(type==="bossStart"){sound.start(game.world,true,true);return}
    if(type==="resumed"){
      overlay.hidden=true;hudKey="";resetClock();sound.start(game.world,false,true);playDialog.focus({preventScroll:true});return;
    }
    if(type==="lost"){
      sound.stop();overlayCard("heart","再试一次",game.checkpoint?"中途旗已经点亮，可以从旗旁继续。":"沿着金币的弧线，长按跳跃可以越过更远的缺口。",[
        [game.checkpoint?"回到中途旗":"从起点重试",()=>game.retry()],["返回大厅",leave],
      ]);return;
    }
    if(type==="won"){
      sound.stop();sound.effect(game.index===7?"world_clear":"stage_clear");
      const rec=store.levels[game.index]||{cleared:true,stars:[],best:{}};
      rec.stars=[...new Set([...rec.stars,...payload.stars])].sort();
      rec.best[game.modeId]=Math.min(rec.best[game.modeId]??Infinity,payload.time);store.levels[game.index]=rec;
      save();renderProgress();
      const final=game.index===COURSES.length-1;
      const body=slot(game.index)+" · "+game.course.name+"<br>星币 "+payload.stars.length+"/3　·　金币 "+payload.coins+"　·　用时 "+clock(payload.time);
      overlayCard(final?"crown":"flag",final?"库克已被击败！":"关卡通关！",body,final?[["返回大厅",leave],["再战库克",()=>launch(game.index)]]:[["进入下一关",()=>launch(game.index+1)],["重玩本关",()=>launch(game.index)],["返回大厅",leave]]);
    }
  }
  function resetClock(){lastFrame=0;accumulator=0}
  function frame(t){
    if(!game)return;
    const delta=lastFrame?Math.min((t-lastFrame)/1000,.08):0;lastFrame=t;
    if(game.state==="playing"){
      accumulator+=delta;while(accumulator>=1/120&&game.state==="playing"){game.step(1/120);accumulator-=1/120}
      if(hintEnd && game.time>hintEnd)dismissHint();
    }
    renderer.draw(game);drawHUD();frameId=requestAnimationFrame(frame);
  }
  function launch(index){
    if(index<0||index>=COURSES.length)return;
    if(details.open)details.close();cancelAnimationFrame(frameId);release();dismissHint();sound.stopEffects();sound.unlock();
    game=new ArcadeGame(COURSES[index],index,store.mode,handle);renderer??=new ArcadeRenderer($("screen"));
    $("world-code").textContent="WORLD "+slot(index)+"  /  "+game.mode.name;$("playing-title").textContent=game.course.name;
    $("pause").setAttribute("aria-label","暂停游戏");overlay.hidden=true;hudKey="";drawHUD();resetClock();
    document.body.classList.add("modal-open");if(!playDialog.open)playDialog.showModal();
    playDialog.focus({preventScroll:true});hint(game.course.tip,3);
    sound.start(game.world,false,true);renderer.draw(game);frameId=requestAnimationFrame(frame);
  }
  function leave(){
    cancelAnimationFrame(frameId);release();sound.stop();sound.stopEffects();game=null;overlay.hidden=true;dismissHint();
    if(document.fullscreenElement && playDialog.contains(document.fullscreenElement))document.exitFullscreen().catch(()=>{});
    if(playDialog.open)playDialog.close();document.body.classList.remove("modal-open");renderProgress();
  }
  $("start-game").addEventListener("click",()=>launch(nextCourse()));$("pause").addEventListener("click",togglePause);
  playDialog.addEventListener("cancel",e=>{e.preventDefault();if(game?.state==="lost"||game?.state==="won")leave();else togglePause()});
  const gameShell=playDialog.querySelector(".game-shell");
  $("fullscreen").addEventListener("click",async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else await gameShell.requestFullscreen()}
    catch{if(game)hint("此浏览器可横屏游玩",2)}
  });
  document.addEventListener("fullscreenchange",()=>{
    const full=document.fullscreenElement===gameShell;$("fullscreen").setAttribute("aria-pressed",String(full));$("fullscreen").setAttribute("aria-label",full?"退出全屏":"进入全屏");
  });
  if(!gameShell.requestFullscreen||!document.fullscreenEnabled)$("fullscreen").hidden=true;
  const keys={ArrowLeft:"left",KeyA:"left",ArrowRight:"right",KeyD:"right",Space:"jump",ArrowUp:"jump",KeyW:"jump",KeyJ:"jump",ShiftLeft:"run",ShiftRight:"run",KeyK:"run"};
  function keyControl(control,id,down){
    if(!game||game.state!=="playing")return;
    if(down)held.set(id,control);else held.delete(id);
    const pressed=[...held.values()].includes(control);game.control(control,pressed);
    document.querySelector('[data-control="'+control+'"]')?.classList.toggle("held",pressed);
  }
  window.addEventListener("keydown",e=>{
    if(!playDialog.open||!game)return;
    if(e.code==="Escape"||e.code==="KeyP"){
      e.preventDefault();if(!e.repeat){if(game.state==="lost"||game.state==="won"){if(e.code==="Escape")leave()}else togglePause()}return;
    }
    if(keys[e.code]&&game.state==="playing"){e.preventDefault();keyControl(keys[e.code],"key:"+e.code,true)}
  });
  window.addEventListener("keyup",e=>{if(playDialog.open && keys[e.code]){e.preventDefault();keyControl(keys[e.code],"key:"+e.code,false)}});
  document.querySelectorAll("[data-control]").forEach(b=>{
    b.addEventListener("pointerdown",e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keyControl(b.dataset.control,"ptr:"+e.pointerId,true)});
    const up=e=>{e.preventDefault();keyControl(b.dataset.control,"ptr:"+e.pointerId,false)};
    b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up);b.addEventListener("lostpointercapture",up);
    b.addEventListener("contextmenu",e=>e.preventDefault());
  });
  document.addEventListener("visibilitychange",()=>{if(document.hidden&&game?.state==="playing")showPause()});
  window.addEventListener("blur",()=>{if(game?.state==="playing")showPause()});
  refreshSound();renderProgress();setNav(location.hash==="#worlds"?"worlds":"lobby");
})();
