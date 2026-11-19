(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const touchDevice=()=>document.documentElement.classList.add("touch-device");
  if(navigator.maxTouchPoints>0 || window.matchMedia("(any-pointer: coarse)").matches)touchDevice();
  window.addEventListener("pointerdown",e=>{if(e.pointerType==="touch")touchDevice()},{passive:true});
  const worldData=[
    {name:"青葱草甸",image:"meadow",rank:"入门",tag:"#c9e4a3",caption:"花管密道 · 树冠高路",blurb:"先在花园找到蘑菇和火焰花。带箭头的管口通往密室，藤蔓伸向树冠上的积分星。"},
    {name:"辉光晶洞",image:"cavern",rank:"进阶",tag:"#d8c8ed",caption:"竖井升降 · 水晶密室",blurb:"乘升降台穿过发光的晶湖。脚下的裂纹石板开始颤动时，就是起跳的信号。"},
    {name:"云顶风车",image:"sky",rank:"挑战",tag:"#f5d69c",caption:"空岛长藤 · 云海双路线",blurb:"飞龟守着风车岛的航线。沿低处的云桥稳步前进，或借弹簧跃进上层航道。"},
    {name:"熔岩城堡",image:"castle",rank:"BOSS",tag:"#f4b5a4",caption:"回旋火杆 · 库霸决战",blurb:"越过熔炉巡廊，在王座前迎战库霸。看准它的冲锋方向，利用撞墙后的破绽。"},
  ];
  const pad=n=>String(n).padStart(2,"0");
  const clock=n=>Math.floor(n/60)+":"+pad(Math.floor(n)%60);
  const slot=(index)=>(Math.floor(index/2)+1)+"-"+(index%2+1);
  const key="mushroom-arcade-progress-v2",oldKey="mushroom-arcade-progress-v1";
  const starCount=c=>c.stars.length+(c.secret?.stars.length||0);
  const formatted=n=>String(Math.floor(n||0)).padStart(6,"0");
  const store={mode:"classic",sound:true,levels:{},high:{}};
  let storageReady=true,legacyClears=0;
  function modeNumbers(values){
    const out={};
    for(const id of Object.keys(ARCADE_MODES))if(Number.isFinite(values?.[id])&&values[id]>=0)out[id]=values[id];
    return out;
  }
  try{
    const legacy=JSON.parse(localStorage.getItem(oldKey)||"{}")||{};
    const raw=JSON.parse(localStorage.getItem(key)||"{}")||{};
    const pref=raw.mode?raw:legacy;
    if(Object.hasOwn(ARCADE_MODES,pref.mode))store.mode=pref.mode;
    if(typeof pref.sound==="boolean")store.sound=pref.sound;
    legacyClears=Object.values(legacy.levels||{}).filter(r=>r?.cleared).length;
    store.high=modeNumbers(raw.high);
    for(let i=0;i<COURSES.length;i++){
      const rec=raw.levels?.[i];if(rec?.cleared!==true)continue;
      const stars=Array.isArray(rec.stars)?[...new Set(rec.stars.filter(n=>Number.isInteger(n)&&n>=0&&n<starCount(COURSES[i])))]:[];
      store.levels[i]={cleared:true,stars,best:modeNumbers(rec.best),high:modeNumbers(rec.high),secret:rec.secret===true};
    }
  }catch{storageReady=false}
  function save(){
    try{localStorage.setItem(key,JSON.stringify(store));storageReady=true}catch{storageReady=false}
    $("save-status").textContent=storageReady?"冒险进度自动保存在此浏览器":"当前浏览器仅保留本次游玩记录";
  }
  class Sound{
    constructor(){this.enabled=store.sound;this.music=new Map();this.effects=new Map();this.current=null;this.file="";this.rate=1}
    effect(name){
      if(!this.enabled)return;
      let pool=this.effects.get(name);if(!pool){pool=[];this.effects.set(name,pool)}
      let a=pool.find(x=>x.paused||x.ended);
      if(!a&&pool.length<3){a=new Audio("./assets/audio/"+name+".wav");a.volume=name.includes("clear") ? .38 : .32;pool.push(a)}
      if(!a)return;
      try{a.currentTime=0;a.play().catch(()=>{})}catch{}
    }
    sync(g,reset=false){
      if(!g||!["playing","tally"].includes(g.state)||!this.enabled){this.stop();return}
      const tally=g.state==="tally"?g.tally:null;
      if(tally&&(!tally.paid||tally.paid===tally.seconds)){this.stop();return}
      let file;
      if(tally)file="count-down.wav";
      else if(g.starTime>0)file="starman.m4a";
      else if(g.areaName==="secret"||g.theme===1)file="underground-loop.wav";
      else if(g.theme===3)file="castle-loop.wav";
      else file=g.lowTime?"hurry.m4a":"overworld.m4a";
      const rate=!tally&&g.lowTime&&file.endsWith(".wav")?1.23:1;
      if(reset){for(const a of this.music.values()){a.pause();a.currentTime=0}}
      if(this.current&&this.file!==file)this.current.pause();
      let a=this.music.get(file);
      if(!a){a=new Audio("./assets/audio/"+file);a.loop=!tally;a.volume=tally ? .2 : .29;this.music.set(file,a)}
      if(tally)a.currentTime=Math.max(0,tally.age-.72);
      if(file==="starman.m4a"&&this.file!==file)a.currentTime=0;
      this.file=file;this.current=a;this.rate=rate;a.playbackRate=rate;
      if(a.paused)a.play().catch(()=>{});
    }
    stop(){if(this.current)this.current.pause()}
    stopEffects(){for(const pool of this.effects.values())for(const a of pool)a.pause()}
    toggle(){
      this.enabled=!this.enabled;store.sound=this.enabled;
      if(!this.enabled)this.stopEffects();this.sync(game);refreshSound();save();
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
    const records=Object.values(store.levels);
    $("clears").textContent=pad(records.length);$("stars").textContent=pad(records.reduce((n,r)=>n+r.stars.length,0));
    $("star-total").textContent="/ "+COURSES.reduce((n,c)=>n+starCount(c),0);
    $("best-score").textContent=formatted(store.high[store.mode]);
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
      const limit=starCount(COURSES[n]);
      const rec=r?"积分星 "+r.stars.length+"/"+limit+(r.high[store.mode]?" · "+r.high[store.mode]+" 分":"")+(best?" · "+clock(best):"")+(r.secret?" · 密室已发现":""):"积分星 0/"+limit+" · 隐藏管道 1";
      return '<button class="level-choice" data-level="'+n+'"><span class="level-id">'+slot(n)+'</span><span><strong>'+COURSES[n].name+'</strong><small>'+rec+'</small></span><i class="ico arrow"></i></button>';
    }).join("");
    showDetails("WORLD "+pad(i+1)," <img class='modal-art' src='./assets/art/"+w.image+".webp' alt=''><div class='detail-inner'><h2 id='detail-title'>"+w.name+"</h2><p>"+w.blurb+"</p>"+buttons+"<div class='modal-mode'><label for='modal-diff'>游玩难度</label><select id='modal-diff' data-difficulty>"+modeOptions()+"</select></div></div>");
    $("modal-diff").addEventListener("change",e=>{setMode(e.target.value);showWorld(i);$("modal-diff").focus()});
    details.querySelectorAll("[data-level]").forEach(b=>b.addEventListener("click",()=>launch(Number(b.dataset.level))));
  }
  function guide(){
    const rows=[
      ["左右移动","<kbd>← →</kbd> / <kbd>A D</kbd>"],["跳跃 · 长按跳高","<kbd>Space</kbd> / <kbd>J</kbd>"],
      ["蹲行 / 管口正中按住入管","<kbd>↓</kbd> / <kbd>S</kbd>"],["攀藤 / 上下移动","<kbd>↑ ↓</kbd> / <kbd>W S</kbd>"],
      ["发射火球（取得火焰花后）","<kbd>X</kbd> / <kbd>F</kbd>"],["加速 / 暂停","<kbd>Shift</kbd> / <kbd>Esc</kbd>"],
    ].map(([label,keys])=>'<div class="guide-row"><strong>'+label+'</strong><span>'+keys+'</span></div>').join("");
    const old=legacyClears?'<p class="legacy-note">上一版已通关 '+legacyClears+' / 8。原记录已保留，新版单独计分。</p>':'';
    showDetails("PLAYER MANUAL",'<div class="detail-inner"><h2 id="detail-title">操作手册</h2><p>管口上的箭头指向隐藏房间。爬藤时按跳跃键离藤，空中可改变方向。手机的方向键与动作键可同时按。</p><div class="guide-rows">'+rows+'</div><div class="guide-tips"><div><img src="./assets/sprites/fire-flower.png" alt="">蘑菇变大，可顶碎砖。吃花后能发射弹跳火球，同时最多两发。</div><div><img src="./assets/sprites/score-star.png" alt="">蓝色积分星每枚 1000 分，通关会登记收集位置。</div><div><img src="./assets/sprites/invincible-star.png" alt="">彩虹金星藏在少数问号砖里。十秒内可撞倒敌人和食人花。</div><div><i class="ico flag"></i>连续踩敌、龟壳连击会加分。高位触旗最高 5000 分，每秒余时另加 50 分。</div><div><i class="ico crown"></i>库霸撞墙冒星时，用踩头或火球反击。</div></div>'+old+'</div>');
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
    const count=g.starIds.length,activeBoss=g.areaName==="main"&&g.boss&&g.boss.phase!=="waiting"&&!g.bossDown;
    const remain=Math.ceil(g.remaining),power=Math.ceil(g.starTime);
    const sig=[g.health,g.gold,count,remain,g.totalScore,g.player.form,power,g.areaName,g.state,activeBoss?g.boss.hp:"-"].join("/");
    if(sig===hudKey)return;hudKey=sig;
    $("hearts").innerHTML=Array.from({length:g.mode.hearts},(_,i)=>'<i class="ico heart'+(i<g.health?'':' empty-heart')+'"></i>').join("");
    $("hearts").setAttribute("aria-label","体力 "+g.health+" / "+g.mode.hearts);
    $("gold-count").textContent=pad(g.gold);$("star-count").textContent=count+"/"+g.starTotal;
    $("timer").textContent=String(remain).padStart(3,"0");$("timer").classList.toggle("urgent",g.lowTime);
    $("live-score").textContent=formatted(g.totalScore);
    $("form-status").textContent=power?"无敌 "+power+"s":({small:"小马里奥",super:"超级",fire:"火焰"})[g.player.form];
    $("form-status").classList.toggle("powered",g.player.form==="fire"||power>0);
    $("playing-title").textContent=g.areaName==="secret"?g.course.name:g.level.name;
    const tally=$("settle-banner");tally.hidden=g.state!=="tally";
    if(!tally.hidden)tally.textContent="触旗 +"+g.tally.flag+"　|　余时 "+remain+" × 50";
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
    if(!game||!["playing","tally"].includes(game.state))return;
    game.beforePause=game.state;game.state="paused";sound.stop();$("pause").setAttribute("aria-label","继续游戏");
    overlayCard("mushroom","冒险已暂停",slot(game.index)+" · "+game.course.name+"　|　"+game.mode.name+"难度",[
      ["继续游戏",resume],["重开本关",()=>launch(game.index,{score:game.carryScore,form:game.initialForm})],["返回大厅",leave],
    ]);
  }
  function resume(){
    if(game?.state!=="paused")return;game.state=game.beforePause||"playing";overlay.hidden=true;resetClock();$("pause").setAttribute("aria-label","暂停游戏");
    sound.sync(game);playDialog.focus({preventScroll:true});
  }
  function togglePause(){if(game&&["playing","tally"].includes(game.state))showPause();else if(game?.state==="paused")resume()}
  function handle(type,payload){
    if(type==="sfx"){sound.effect(payload);return}
    if(type==="hint"){hint(payload.text,payload.seconds);return}
    if(type==="music"){sound.sync(game);return}
    if(type==="tally"){sound.stop();dismissHint();return}
    if(type==="resumed"){
      overlay.hidden=true;hudKey="";resetClock();sound.sync(game,true);playDialog.focus({preventScroll:true});return;
    }
    if(type==="lost"){
      sound.stop();sound.effect("death");overlayCard("heart",payload==="time"?"时间到了":"再试一次",game.checkpoint?"回到中途旗，恢复触旗时的分数、道具和时间。":"从起点重新挑战，计时与本关分数重置。",[
        [game.checkpoint?"回到中途旗":"从起点重试",()=>game.retry()],["返回大厅",leave],
      ]);return;
    }
    if(type==="won"){
      sound.stop();sound.effect(game.index===7?"world_clear":"stage_clear");
      const rec=store.levels[game.index]||{cleared:true,stars:[],best:{},high:{},secret:false};
      rec.high[game.modeId]=Math.max(rec.high[game.modeId]||0,payload.score);
      rec.secret=rec.secret||payload.secret;store.high[game.modeId]=Math.max(store.high[game.modeId]||0,payload.total);
      rec.stars=[...new Set([...rec.stars,...payload.stars])].sort((a,b)=>a-b);
      rec.best[game.modeId]=Math.min(rec.best[game.modeId]??Infinity,payload.time);store.levels[game.index]=rec;
      save();renderProgress();
      const final=game.index===COURSES.length-1;
      const body=slot(game.index)+" · "+game.level.name+"　|　积分星 "+payload.stars.length+"/"+game.starTotal+
        '<br>冒险 '+payload.action+'　＋　触旗 '+payload.flag+'　＋　余时 '+payload.seconds+' × 50'+
        '<br><strong class="result-score">本关 '+formatted(payload.score)+' 分</strong>　行程累计 '+formatted(payload.total)+' 分';
      overlayCard(final?"crown":"flag",final?"库霸已被击败！":"关卡通关！",body,final?[["返回大厅",leave],["重玩本关",()=>launch(game.index)]]:[["进入下一关",()=>launch(game.index+1,{score:payload.total,form:game.player.form})],["重玩本关",()=>launch(game.index)],["返回大厅",leave]]);
    }
  }
  function resetClock(){lastFrame=0;accumulator=0}
  function frame(t){
    if(!game)return;
    const delta=lastFrame?Math.min((t-lastFrame)/1000,.08):0;lastFrame=t;
    if(game.state==="playing"||game.state==="tally"){
      accumulator+=delta;while(accumulator>=1/120&&(game.state==="playing"||game.state==="tally")){game.step(1/120);accumulator-=1/120}
      if(hintEnd && game.time>hintEnd)dismissHint();
    }
    renderer.draw(game);drawHUD();frameId=requestAnimationFrame(frame);
  }
  function launch(index,carry={}){
    if(index<0||index>=COURSES.length)return;
    if(details.open)details.close();cancelAnimationFrame(frameId);release();dismissHint();sound.stopEffects();
    game=new ArcadeGame(COURSES[index],index,store.mode,handle,carry);renderer??=new ArcadeRenderer($("screen"));
    $("world-code").textContent="WORLD "+slot(index)+"  /  "+game.mode.name;$("playing-title").textContent=game.course.name;
    $("pause").setAttribute("aria-label","暂停游戏");overlay.hidden=true;hudKey="";drawHUD();resetClock();
    document.body.classList.add("modal-open");if(!playDialog.open)playDialog.showModal();
    playDialog.focus({preventScroll:true});hint(game.course.tip,3);
    sound.sync(game,true);renderer.draw(game);frameId=requestAnimationFrame(frame);
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
  const keys={ArrowLeft:"left",KeyA:"left",ArrowRight:"right",KeyD:"right",Space:"jump",ArrowUp:"up",KeyW:"up",ArrowDown:"down",KeyS:"down",KeyX:"fire",KeyF:"fire",KeyJ:"jump",ShiftLeft:"run",ShiftRight:"run",KeyK:"run"};
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
  document.addEventListener("visibilitychange",()=>{if(document.hidden)showPause()});
  window.addEventListener("blur",()=>{showPause()});
  refreshSound();renderProgress();setNav(location.hash==="#worlds"?"worlds":"lobby");
})();
