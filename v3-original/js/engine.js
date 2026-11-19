(() => {
  "use strict";
  const MODES = {
    relaxed:{name:"休闲",rank:0,hearts:5,speed:.83,grace:1.9,crumble:1.1,boss:3,clock:1.48},
    classic:{name:"经典",rank:1,hearts:3,speed:1.19,grace:1.35,crumble:.72,boss:5,clock:1},
    expert:{name:"专家",rank:2,hearts:2,speed:1.52,grace:1.05,crumble:.48,boss:6,clock:.55}
  };
  function timeBudget(course,modeId){
    const mode=MODES[modeId]||MODES.classic;
    if(mode.rank===2 && Number.isFinite(course.expertTime))return course.expertTime;
    return Math.round((course.timeLimit||155)*mode.clock);
  }
  const ENEMY_HEIGHT={goomba:.91,spiny:.76,hammer:1.39,lakitu:1.48,koopa:1.27,wing:1.27};
  const enemyHeight=e=>e.shell ? .74 : ENEMY_HEIGHT[e.type]||1.27;
  const HALF=.39, STANDING={small:1.02,super:1.76,fire:1.76};
  const CHAIN_POINTS=[100,200,400,800,1000,2000,4000,8000];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const toward=(v,to,delta)=>v<to?Math.min(to,v+delta):Math.max(to,v-delta);
  const overlapsX=(x,half,r)=>x+half>r.x+.001 && x-half<r.x+r.w-.001;
  const pairHit=(x,y,w,h,ox,oy,ow,oh)=>Math.abs(x-ox)<(w+ow)/2 && y>oy-oh && y-h<oy;
  const freshInput=()=>({left:false,right:false,jump:false,run:false,up:false,down:false,fire:false});
  const solid=(x,y,w,h,kind)=>({x,y,w,h,kind});
  const slopeY=(s,x)=>s.leftY+(s.rightY-s.leftY)*clamp((x-s.x)/s.w,0,1);
  function buildArea(c,mode,offset){
    const solids=[
      ...c.ground.map(([a,b,y=13])=>solid(a,y,b-a,Math.max(5,20-y),"ground")),
      ...c.pipes.map(([x,y,w,tag,bottom=13])=>({...solid(x,y,w,bottom-y,"pipe"),tag})),
      ...(c.cannons||[]).map(([x,y,w,bottom,dir,minRank=0])=>({...solid(x,y,w,bottom-y,"cannon"),enabled:mode.rank>=minRank,dir,aim:dir||-1,cooldown:1.05,warning:0,flash:0})),
      ...(c.gates||[]).map(([id,x,y,w,bottom])=>({...solid(x,y,w,bottom-y,"gate"),id,gone:false})),
      ...(c.ceilings||[]).map(([x,y,w,h])=>solid(x,y,w,h,"ceiling")),
      ...c.blocks.map(([x,y,type])=>({...solid(x,y,1,1,"block"),type,used:false,bump:0})),
    ];
    const platforms=c.ledges.map(([x,y,w,kind])=>({...solid(x,y,w,.5,kind),crack:0,gone:0}));
    const movers=c.movers.map(([x,y,w,dx,dy,period])=>({...solid(x,y,w,.5,"mover"),x0:x,y0:y,dx,dy,period,stepX:0,stepY:0}));
    const slopes=(c.slopes||[]).map(([x,end,leftY,rightY])=>({x,w:end-x,leftY,rightY,kind:"slope"}));
    const enemies=c.enemies.filter(e=>(e[4]||0)<=mode.rank).map(([x,y,type,radius],i)=>({x,y,startX:x,baseY:y,type,radius,dir:i%2?1:-1,gone:false,shell:0,chain:0,vy:0,safe:0,pace:i*.41}));
    for(const e of enemies)if(e.type==="hammer"){e.grounded=true;e.jumpWait=.75+e.pace%1.05;e.cooldown=1.05+e.pace%.56;e.aim=-1;e.warning=0}
    for(const [left,right,height,tier=0] of c.lakitus||[])if(tier<=mode.rank){
      enemies.push({type:"lakitu",left,right,baseY:height,x:left+3,y:height,dir:1,gone:false,safe:0,cooldown:1.35,warning:0,home:left,age:0});
    }
    const switches=(c.switches||[]).map(([id,x,y])=>({id,x,y,on:false}));
    const plants=solids.filter(s=>s.tag==="plant").map((s,i)=>({x:s.x+s.w/2,y:s.y,ext:0,phase:"rest",wait:.65+i%3*.52,gone:false}));
    return {solids,platforms,movers,slopes,enemies,plants,switches,
      springs:c.springs.map(([x,y])=>({x,y,pulse:0})),
      coins:c.coins.map(([x,y])=>({x,y,got:false})),
      stars:c.stars.map(([x,y],i)=>({x,y,id:i+offset,got:false})),
      seenSigns:new Set(),items:[],clock:0};
  }
  class ArcadeGame{
    constructor(course,index,mode,emit=()=>{},carry={}){
      this.level=course;this.index=index;this.world=Math.floor(index/2);this.mode=MODES[mode]||MODES.classic;
      this.modeId=mode;this.emit=emit;this.carryScore=carry.score||0;this.initialForm=STANDING[carry.form]?carry.form:"small";
      this.checkpoints=course.checkpoints||[course.checkpoint];this.limit=timeBudget(course,mode);
      this.warningAt=Math.min(35,Math.max(10,Math.round(this.limit*.23)));
      this.initRun();
    }
    initRun(){
      this.areas={main:buildArea(this.level,this.mode,0)};
      if(this.level.secret)this.areas.secret=buildArea(this.level.secret,this.mode,this.level.stars.length);
      this.state="playing";this.input=freshInput();this.player={form:this.initialForm};
      this.flagIndex=-1;this.savedFlag=null;this.score=0;this.gold=0;this.time=0;this.remaining=this.limit;
      this.health=this.mode.hearts;this.starTime=0;this.combo=0;this.secretFound=false;this.bossDown=false;this.lowTime=false;
      this.restoreAtFlag();
    }
    get checkpoint(){return this.flagIndex>=0}
    get totalScore(){return this.carryScore+this.score}
    get starTotal(){return this.level.stars.length+(this.level.secret?.stars.length||0)}
    get starIds(){return Object.values(this.areas).flatMap(a=>a.stars.filter(s=>s.got).map(s=>s.id))}
    enterArea(name){
      this.areaName=name;this.area=this.areas[name];this.course=name==="main"?this.level:this.level.secret;
      this.theme=name==="main"?this.world:(this.course.theme??1);
      for(const key of ["solids","platforms","movers","slopes","springs","enemies","plants","coins","stars","items","seenSigns","switches"])this[key]=this.area[key];
      this.surfaces=[...this.solids,...this.platforms,...this.movers];
      this.particles=[];this.labels=[];this.flames=[];this.fireballs=[];this.foeShots=[];
    }
    place(x,y,keepInput=false){
      const p=this.player;
      Object.assign(p,{x,y,vx:0,vy:0,face:1,h:STANDING[p.form],duck:false,climbing:null,climbLock:0,grounded:true,stand:null,coyote:.1,buffer:0,invuln:.8,stride:0,springing:false,throwTime:0,fireDelay:0});
      this.camera=clamp(x-8.5,0,Math.max(0,this.course.width-30));this.cameraY=Math.min(0,y-8.8);
      this.combo=0;this.pipeHold=0;if(!keepInput)this.release();
    }
    restoreAtFlag(){
      this.enterArea("main");this.pipeTrip=null;this.tally=null;this.fallDelay=0;this.shake=0;this.starTime=0;
      this.place(...(this.checkpoint?this.checkpoints[this.flagIndex]:(this.level.spawn||[2,13])));
      this.boss=null;
      if(this.level.boss&&!this.bossDown){
        const {left,right}=this.level.boss;
        this.boss={left,right,x:right-2.2,y:13,dir:-1,hp:this.mode.boss,max:this.mode.boss,phase:"waiting",clock:0,shots:0,blink:0,cycle:0,leaps:0,volley:0,fromX:0,targetX:0,airShot:false};
      }
    }
    recordFlag(){
      this.savedFlag={areas:structuredClone(this.areas),score:this.score,gold:this.gold,remaining:this.remaining,time:this.time,form:this.player.form,secret:this.secretFound};
    }
    release(){this.input=freshInput();this.player.buffer=0}
    control(key,held){
      if(this.state!=="playing" || !(key in this.input) || this.input[key]===held)return;
      this.input[key]=held;
      if((key==="jump" || (key==="up"&&!this.nearVine()))&&held){
        this.player.buffer=.14;
        if(this.player.climbing){this.player.climbing=null;this.player.coyote=.12;this.player.climbLock=.28}
      }
      if((key==="jump"||key==="up")&&!held&&!this.input.jump&&!this.input.up&&this.player.vy< -6.2&&!this.player.springing)this.player.vy=-6.2;
    }
    nearVine(){const p=this.player;return (this.course.vines||[]).find(([x,top,bottom])=>Math.abs(x-p.x)<.68&&p.y>=top-.1&&p.y-p.h<=bottom+.12)}
    hint(text,seconds=2.5){this.emit("hint",{text,seconds})}
    sfx(name){this.emit("sfx",name)}
    award(points,x,y,label){
      this.score+=points;
      if(x!==undefined)this.labels.push({x,y,text:label||String(points),life:.76});
    }
    setForm(form){this.player.form=form;this.posture()}
    posture(){
      const p=this.player,tall=STANDING[p.form];
      const low=this.solids.some(r=>!r.gone&&(r.kind==="ceiling"||r.kind==="block")&&overlapsX(p.x,HALF,r)&&r.y<p.y-.1&&r.y+r.h>p.y-tall+.002&&r.y+r.h<=p.y-.56);
      p.duck=!p.climbing&&((this.input.down&&(p.grounded||p.duck))||low);
      p.h=p.duck?(p.form==="small" ? .65 : .78):tall;
    }
    burst(x,y,colors,count=10,power=1) {
      for(let i=0;i<count;i++)this.particles.push({x,y,vx:(Math.random()-.5)*7*power,vy:(-1-Math.random()*5)*power,life:.24+Math.random()*.35,color:colors[i%colors.length],size:i%3===0?3:2});
    }
    animate(dt){
      this.shake=Math.max(0,this.shake-dt);this.area.clock+=dt;
      this.labels=this.labels.filter(l=>l.life>0);
      for(const l of this.labels){l.life-=dt;l.y-=dt*1.15}
      this.particles=this.particles.filter(p=>p.life>0);
      for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=15*dt;p.life-=dt}
      for(const s of this.solids)if(s.bump>0)s.bump=Math.max(0,s.bump-dt);
      for(const spring of this.springs)spring.pulse=Math.max(0,spring.pulse-dt);
      for(const platform of this.platforms){
        if(platform.crack>0){platform.crack-=dt;if(platform.crack<=0){platform.gone=2.6;this.burst(platform.x+platform.w/2,platform.y,["#ab958a","#776777"],8)}}
        else if(platform.gone>0)platform.gone=Math.max(0,platform.gone-dt);
      }
      for(const m of this.movers){
        const factor=(1-Math.cos(this.area.clock*Math.PI*2/m.period))/2;
        const nx=m.x0+m.dx*factor,ny=m.y0+m.dy*factor;
        m.stepX=nx-m.x;m.stepY=ny-m.y;m.x=nx;m.y=ny;
      }
    }
    bump(block){
      if(block.kind!=="block")return;
      block.bump=.18;
      if(block.used){this.sfx("bump");return}
      if(block.type==="brick"){
        if(this.player.form==="small"){this.sfx("bump");return}
        block.gone=true;this.award(50,block.x+.5,block.y);
        this.burst(block.x+.5,block.y+.4,["#a24c2d","#e19855","#6b3f36"],13);this.sfx("brick_smash");return;
      }
      block.used=true;
      if(block.type==="coin"){
        this.gold++;this.award(100,block.x+.5,block.y-.4);this.sfx("coin");this.burst(block.x+.5,block.y-.4,["#ffe198","#f5af39"],9);return;
      }
      const type=block.type==="heart"?"mushroom":block.type;
      this.sfx("powerup_appears");
      this.items.push({type,x:block.x+.5,y:block.y,emerge:.36,vx:type==="flower"?0:this.player.face*(type==="invincible"?3.6:2),vy:0});
    }
    support(x,half,oldY,nextY,oldX=x,walking=false,ride=null){
      let top=Infinity,object=null;
      for(const r of this.surfaces){
        if(r.gone||!overlapsX(x,half,r))continue;
        const previous=r.kind==="mover"&&r!==ride?r.y-r.stepY:r.y;
        const seam=walking&&r.kind==="ground"&&ride?.kind==="slope" ? .28 : .035;
        if(oldY<=previous+seam&&nextY>=r.y-.002&&r.y<top){top=r.y;object=r}
      }
      for(const r of this.slopes){
        if(x<r.x-.01||x>r.x+r.w+.01)continue;
        const y=slopeY(r,x),old=slopeY(r,oldX);
        if(oldY<=old+(walking ? .3 : .04)&&nextY>=y-(walking ? .26 : .002)&&y<top){top=y;object=r}
      }
      return object?{top,object}:null;
    }
    wall(x,previous,y,h,half,ride){
      for(const r of this.solids){
        if(r.gone||y<=r.y+.003||y-h>=r.y+r.h-.002||!overlapsX(x,half,r))continue;
        if(ride?.kind==="slope"&&r.kind==="ground"&&Math.abs(y-r.y)<.36)continue;
        if(x>previous&&previous+half<=r.x+.025)return r.x-half;
        if(x<previous&&previous-half>=r.x+r.w-.025)return r.x+r.w+half;
      }
      // The steep outside face of a raised ramp is solid below its endpoint.
      for(const r of this.slopes){
        if(x>previous && previous+half<=r.x && x+half>r.x && y>r.leftY+.35)return r.x-half;
        if(x<previous && previous-half>=r.x+r.w && x-half<r.x+r.w && y>r.rightY+.35)return r.x+r.w+half;
      }
      return x;
    }
    updateClimb(dt){
      const p=this.player;
      p.climbLock=Math.max(0,p.climbLock-dt);
      if(!p.climbing && !p.climbLock && this.input.up)p.climbing=this.nearVine();
      if(!p.climbing)return false;
      const [x,top,bottom]=p.climbing,axis=Number(this.input.down)-Number(this.input.up);
      const dx=Number(this.input.right)-Number(this.input.left);
      if(dx && !axis){p.climbing=null;p.climbLock=.25;p.coyote=.1;p.vx=dx*3;return false}
      const oldY=p.y;
      p.duck=false;p.h=STANDING[p.form];p.x=toward(p.x,x,dt*8);p.vx=0;p.vy=0;p.grounded=false;p.stand=null;p.coyote=0;p.buffer=0;
      p.y=clamp(p.y+axis*dt*5.1,top-.1,bottom+.1);p.stride+=Math.abs(p.y-oldY);
      if((p.y<=top+.005&&axis<0)||(p.y>=bottom&&axis>0)){
        p.climbing=null;p.climbLock=.3;p.coyote=.12;
        if(axis<0){p.y=top-.13;p.vy=-4.5}
      }
      return true;
    }
    movePlayer(dt){
      const p=this.player,oldY=p.y;
      p.invuln=Math.max(0,p.invuln-dt);p.fireDelay=Math.max(0,p.fireDelay-dt);p.throwTime=Math.max(0,p.throwTime-dt);
      if(this.updateClimb(dt))return oldY;
      const lastStand=p.stand,ride=lastStand?.kind==="mover"?lastStand:null;
      if(ride){p.x+=ride.stepX;p.y+=ride.stepY}
      this.posture();p.buffer=Math.max(0,p.buffer-dt);
      p.coyote=p.grounded ? .105 : Math.max(0,p.coyote-dt);
      const intent=Number(this.input.right)-Number(this.input.left);
      const velocity=p.duck?2.55:(this.input.run?9.3:6.9);
      const wind=!p.grounded&&(this.course.winds||[]).find(([x,y,w,h])=>p.x>=x&&p.x<=x+w&&p.y-p.h*.5>=y&&p.y-p.h*.5<=y+h);
      p.vx=toward(p.vx,intent*velocity+(wind?wind[5]:0),(p.duck?24:intent?47:65)*dt);
      if(intent)p.face=intent;
      if(p.buffer>0&&p.coyote>0){
        p.vy=-14.6;p.buffer=0;p.coyote=0;p.grounded=false;p.stand=null;p.springing=false;this.sfx(p.form==="small"?"small_jump":"big_jump");
      }
      p.stride+=Math.abs(p.vx)*dt;
      const oldX=p.x,desiredX=p.x+p.vx*dt;
      p.x=this.wall(desiredX,p.x,p.y,p.h,HALF,lastStand);
      if(p.x!==desiredX)p.vx=0;
      const arena=this.areaName==="main"&&this.boss&&!this.bossDown&&this.boss.phase!=="waiting";
      p.x=clamp(p.x,arena?this.boss.left+.4:HALF,arena?this.boss.right-.4:this.course.width-HALF);
      const fromY=p.y,wasGround=p.grounded;
      p.vy=wind?Math.max(-11,p.vy+(32-wind[4])*dt):Math.min(23,p.vy+32*dt);
      const nextY=fromY+p.vy*dt;p.grounded=false;p.stand=null;
      if(p.vy>=0){
        const ground=this.support(p.x,HALF,fromY,nextY,oldX,wasGround,lastStand);
        if(ground){
          p.y=ground.top;p.vy=0;p.grounded=true;p.springing=false;p.stand=ground.object;this.combo=0;
          if(p.stand.kind==="crumble"&&p.stand.crack<=0)p.stand.crack=this.mode.crumble;
        }else p.y=nextY;
      }else{
        let ceiling=null;
        for(const r of this.solids){
          if(r.gone||!overlapsX(p.x,HALF,r))continue;
          const bottom=r.y+r.h;
          if(fromY-p.h>=bottom-.025&&nextY-p.h<=bottom&&(!ceiling||bottom>ceiling.y+ceiling.h))ceiling=r;
        }
        if(ceiling){p.y=ceiling.y+ceiling.h+p.h;p.vy=0;this.bump(ceiling)}
        else p.y=nextY;
      }
      for(const s of this.springs){
        if(Math.abs(p.x-s.x)<.53&&p.vy>=0&&fromY<=s.y+.04&&p.y>=s.y-.27){
          p.y=s.y-.25;p.vy=-19.65;p.grounded=false;p.stand=null;p.coyote=0;p.springing=true;s.pulse=.3;this.sfx("big_jump");
          this.burst(s.x,s.y-.35,["#ffd65b","#fff7bf"],5);break;
        }
      }
      return fromY;
    }
    pickups(dt){
      const p=this.player;
      const touches=o=>Math.abs(p.x-o.x)<.78&&o.y>=p.y-p.h-.35&&o.y<=p.y+.3;
      for(const c of this.coins)if(!c.got&&touches(c)){
        c.got=true;this.gold++;this.award(100);this.sfx("coin");this.burst(c.x,c.y,["#ffe490","#efb237"],4,.6);
      }
      for(const s of this.stars)if(!s.got&&touches(s)){
        s.got=true;this.award(1000,s.x,s.y-.4);this.sfx("coin");this.burst(s.x,s.y,["#9df6ff","#55c4ed","#fff"],13);
      }
      for(const m of this.items){
        if(m.got)continue;
        if(m.emerge>0){m.emerge=Math.max(0,m.emerge-dt);continue}
        const oldX=m.x,oldY=m.y,dx=m.x+m.vx*dt;
        m.x=this.wall(dx,m.x,m.y,.8,.35);if(m.x!==dx)m.vx*=-1;
        m.vy=Math.min(22,m.vy+24*dt);m.y+=m.vy*dt;
        const floor=m.vy>=0?this.support(m.x,.35,oldY,m.y,oldX,true):null;
        if(floor){m.y=floor.top;m.vy=m.type==="invincible"?-7.15:0}
        if(m.y>20){m.got=true;continue}
        if(!pairHit(p.x,p.y,.78,p.h,m.x,m.y,.85,.87))continue;
        m.got=true;this.award(1000,m.x,m.y-.9);this.sfx("powerup");
        if(m.type==="invincible"){
          this.starTime=10;this.hint("无敌星！十秒内撞倒敌人",2.1);this.emit("music");
        }else if(m.type==="flower"){
          this.setForm("fire");this.hint("火焰马里奥 · 按 X 或火球键发射",2.2);
        }else if(p.form==="small"){
          this.setForm("super");this.hint("超级马里奥 · 能顶碎砖块，按 ↓ 蹲行",2.1);
        }else if(this.health<this.mode.hearts){this.health++;this.hint("蘑菇补给 · +1 体力",1.7)}
      }
    }
    hit(pit=false){
      const p=this.player;
      if(this.state!=="playing"||this.fallDelay>0||(!pit&&(p.invuln>0||this.starTime>0)))return;
      this.shake=.15;this.sfx("bump");
      if(!pit&&p.form!=="small"){this.setForm(p.form==="fire"?"super":"small")}
      else this.health--;
      if(this.health<=0){this.lose("health");return}
      if(pit){this.setForm("small");this.fallDelay=.32;this.hint(this.checkpoint?"回到中途旗":"回到起点",1.6);return}
      p.invuln=this.mode.grace;p.vy=-6;p.grounded=false;p.stand=null;p.climbing=null;p.coyote=0;
      this.burst(p.x,p.y-.7,["#f67555","#fff3bb"],8);
    }
    lose(reason){this.state="lost";this.release();this.emit("lost",reason)}
    defeat(target,points,x,y){
      if(target.gone)return;
      target.gone=true;this.award(points,x,y-.65);this.burst(x,y-.6,["#ffdd74","#fff5dc","#eb8a56"],9);this.sfx("kick");
    }
    updatePlants(dt){
      const p=this.player;
      for(const f of this.plants){
        if(f.gone)continue;
        const near=Math.abs(p.x-f.x)<1.75&&p.y>=f.y-2.4&&p.y<=f.y+1.5;
        if(f.phase==="rest"){if(!near)f.wait-=dt;if(f.wait<=0&&!near)f.phase="rise"}
        else if(f.phase==="rise"){f.ext=Math.min(1.55,f.ext+dt*1.7*this.mode.speed);if(f.ext>=1.55){f.phase="open";f.wait=.85}}
        else if(f.phase==="open"){f.wait-=dt;if(f.wait<=0)f.phase="sink"}
        else{f.ext=Math.max(0,f.ext-dt*1.85);if(!f.ext){f.phase="rest";f.wait=1.15/this.mode.speed}}
        if(f.ext>.22&&pairHit(p.x,p.y,.75,p.h,f.x,f.y,.77,f.ext)){
          if(this.starTime>0)this.defeat(f,300,f.x,f.y-f.ext+.5);else this.hit();
        }
      }
    }
    shoot(){
      const p=this.player;
      if(p.form!=="fire"||p.fireDelay>0||this.fireballs.length>=2||p.climbing)return;
      p.fireDelay=.26;p.throwTime=.17;
      this.fireballs.push({x:p.x+p.face*.55,y:p.y-p.h*.57,dir:p.face,vy:-.7,age:0});
      this.sfx("fireball");
    }
    updateShots(dt){
      if(this.input.fire)this.shoot();
      for(const f of this.fireballs){
        f.age+=dt;const oldX=f.x,oldY=f.y,dx=f.x+f.dir*13.9*dt;
        f.x=this.wall(dx,oldX,f.y+.2,.35,.2);f.gone=f.x!==dx;
        f.vy+=24*dt;f.y+=f.vy*dt;
        const floor=f.vy>=0?this.support(f.x,.18,oldY+.2,f.y+.2,oldX):null;
        if(floor){f.y=floor.top-.2;f.vy=-6.9}
        if(this.solids.some(r=>!r.gone&&overlapsX(f.x,.18,r)&&f.y+.19>r.y+.003&&f.y-.19<r.y+r.h-.003))f.gone=true;
        for(const e of this.enemies){
          if(f.gone||e.gone||!pairHit(f.x,f.y+.2,.4,.4,e.x,e.y,.86,enemyHeight(e)))continue;
          this.defeat(e,e.type==="lakitu"?800:e.type==="hammer"?400:200,e.x,e.y);f.gone=true;
        }
        for(const e of this.plants){
          if(f.gone||e.gone||e.ext<.28||!pairHit(f.x,f.y+.2,.4,.4,e.x,e.y,.83,e.ext))continue;
          this.defeat(e,300,e.x,e.y-e.ext+.55);f.gone=true;
        }
        for(const shot of this.foeShots)if(!f.gone&&!shot.gone&&pairHit(f.x,f.y+.2,.4,.4,shot.x,shot.y+.23,.6,.5)){
          if(shot.type==="egg"){this.defeat(shot,100,shot.x,shot.y);f.gone=true}
          else if(shot.type==="bullet")f.gone=true;
        }
        const b=this.boss;
        if(!f.gone&&this.areaName==="main"&&b&&!this.bossDown&&b.phase!=="waiting"&&pairHit(f.x,f.y+.2,.45,.4,b.x,b.y,1.9,this.bossOpen()?1.4:2.1)){
          f.gone=true;if(this.bossOpen()&&b.blink<=0)this.strikeBoss(false);
        }
        if(f.gone)this.burst(f.x,f.y,["#ffed98","#fa8544"],6,.6);
      }
      this.fireballs=this.fireballs.filter(f=>!f.gone&&f.age<2.95&&f.y<19&&f.x>=0&&f.x<=this.course.width);
    }
    bounceOn(y){
      const p=this.player;
      p.y=y;p.vy=this.input.jump||this.input.up?-11:-8.4;p.grounded=false;p.stand=null;p.coyote=0;
      this.sfx("stomp");this.burst(p.x,y,["#fff1b2","#dfb06c"],6,.6);
    }
    onScreen(x,y){return x>=this.camera-.25&&x<=this.camera+30.25&&y>=this.cameraY-.5&&y<=this.cameraY+17.1}
    updateHammer(e,dt){
      const p=this.player,rank=this.mode.rank,near=Math.abs(e.x-p.x)<15&&Math.abs(e.y-p.y)<9&&this.onScreen(e.x,e.y-.7);
      if(!near&&e.grounded){e.warning=0;e.cooldown=Math.max(.65,e.cooldown);return}
      const oldX=e.x,oldY=e.y;
      const desired=clamp(e.x+e.dir*(e.grounded ? .85 : 1.45)*this.mode.speed*dt,e.startX-e.radius,e.startX+e.radius);
      e.x=this.wall(desired,e.x,e.y,1.36,.38);
      if(e.x<=e.startX-e.radius+.01||e.x>=e.startX+e.radius-.01||e.x!==desired)e.dir*=-1;
      e.jumpWait-=dt;
      if(near&&e.grounded&&e.jumpWait<=0){
        e.vy=-10.6-rank*.43;e.grounded=false;e.jumpWait=2.35-.31*rank+e.pace%.37;
      }
      e.vy=Math.min(19,e.vy+25*dt);e.y+=e.vy*dt;e.grounded=false;
      if(e.vy<0){
        for(const r of this.solids){
          const bottom=r.y+r.h;
          if(!r.gone&&overlapsX(e.x,.38,r)&&oldY-1.36>=bottom-.01&&e.y-1.36<bottom){e.y=bottom+1.36;e.vy=0;break}
        }
      }else{
        const floor=this.support(e.x,.36,oldY,e.y,oldX,true);
        if(floor){e.y=floor.top;e.vy=0;e.grounded=true}
      }
      if(e.y>19){e.gone=true;return}
      if(!near){e.warning=0;return}
      if(e.warning>0){
        e.warning=Math.max(0,e.warning-dt);
        if(!e.warning){
          this.foeShots.push({type:"hammer",x:e.x+e.aim*.52,y:e.y-1.19,vx:e.aim*(4.4+Math.min(3.6,Math.abs(p.x-e.x)*.29)),vy:-9.2,age:0,dir:e.aim});
          e.cooldown=2.2-.40*rank+e.pace%.25;
        }
      }else if((e.cooldown-=dt)<=0){
        e.aim=p.x<e.x?-1:1;e.warning=.56-rank*.065;
      }
    }
    updateLakitu(e,dt){
      const p=this.player,rank=this.mode.rank;
      if(p.x<e.left-2||p.x>e.right+2){e.warning=0;e.cooldown=Math.max(.9,e.cooldown);return}
      e.age+=dt;
      const target=clamp(p.x+(p.vx<-.5?-3.8:3.8),e.left+1,e.right-1);
      e.x=toward(e.x,target,(5.8+rank*.65)*dt);e.dir=p.x<e.x?-1:1;
      const height=Math.min(e.baseY,p.y-3.65);
      e.y=toward(e.y,height+Math.sin(e.age*2)*.32,3.6*dt);
      if(Math.abs(e.x-p.x)>14||!this.onScreen(e.x,e.y-1)){e.warning=0;e.cooldown=Math.max(.7,e.cooldown);return}
      if(e.warning>0){
        e.warning=Math.max(0,e.warning-dt);
        if(!e.warning){
          this.foeShots.push({type:"egg",x:e.x,y:e.y-.42,vx:clamp((p.x-e.x)*.55+p.vx*.12,-3,3),vy:-3.8,age:0,home:e.home});
          e.cooldown=3.85-.69*rank;
        }
      }else if((e.cooldown-=dt)<=0){
        const alive=this.enemies.filter(a=>a.type==="spiny"&&a.home===e.home&&!a.gone).length+this.foeShots.filter(f=>f.type==="egg"&&f.home===e.home&&!f.gone).length;
        if(alive<2+rank)e.warning=.82-.1*rank;else e.cooldown=.8;
      }
    }
    updateSpiny(e,dt){
      const oldX=e.x,oldY=e.y,speed=(e.home===undefined?1.22:1.48)*this.mode.speed;
      let desired=e.x+e.dir*speed*dt;
      if(e.home===undefined){
        desired=clamp(desired,e.startX-e.radius,e.startX+e.radius);
        if(desired<=e.startX-e.radius+.001)e.dir=1;
        if(desired>=e.startX+e.radius-.001)e.dir=-1;
      }
      e.x=this.wall(desired,oldX,e.y,.76,.36);
      if(e.x!==desired)e.dir=desired>oldX?-1:1;
      e.vy=Math.min(22,e.vy+28*dt);e.y+=e.vy*dt;
      const floor=this.support(e.x,.36,oldY,e.y,oldX,true);
      if(floor){e.y=floor.top;e.vy=0}
      if(e.y>19||e.x<-.5||e.x>this.course.width+.5)e.gone=true;
    }
    updateCannons(dt){
      const p=this.player,rank=this.mode.rank;
      for(const c of this.solids){
        if(c.kind!=="cannon"||!c.enabled)continue;
        const middle=c.x+c.w/2,dx=p.x-middle,candidate=c.dir||Math.sign(dx)||1;
        const armed=this.onScreen(middle,c.y+.6)&&Math.abs(dx)<15.8&&Math.abs(dx)>2.55&&Math.abs(p.y-c.y)<7.7&&candidate*dx>0;
        c.flash=Math.max(0,c.flash-dt);
        if(c.warning>0){
          if(!armed||c.aim*dx<=0){c.warning=0;c.cooldown=.72;continue}
          c.warning=Math.max(0,c.warning-dt);
          if(!c.warning){
            const x=middle+c.aim*(c.w/2+.5);
            this.foeShots.push({type:"bullet",x,y:c.y+.64,dir:c.aim,vx:c.aim*(5.7+rank*1.05),vy:0,age:0});
            c.flash=.16;c.cooldown=3.35-.54*rank;this.sfx("bump");
          }
        }else if(armed&&(c.cooldown-=dt)<=0){c.aim=candidate;c.warning=.83-.1*rank}
      }
    }
    updateFoeShots(dt,oldPlayerY){
      const p=this.player;
      for(const f of this.foeShots){
        if(f.gone)continue;
        const oldX=f.x,oldY=f.y;f.age+=dt;
        f.x+=f.vx*dt;
        if(f.type==="bullet"){
          if(this.wall(f.x,oldX,f.y+.29,.58,.36)!==f.x){f.gone=true;continue}
          if(pairHit(p.x,p.y,.75,p.h,f.x,f.y+.32,1.04,.63)){
            if(this.starTime>0)this.defeat(f,200,f.x,f.y);
            else if(p.vy>=0&&oldPlayerY<=f.y-.31+.26){this.bounceOn(f.y-.31);this.defeat(f,CHAIN_POINTS[Math.min(7,this.combo++)],f.x,f.y)}
            else this.hit();
          }
        }else{
          f.vy+=(f.type==="egg"?19.5:21)*dt;f.y+=f.vy*dt;
          const floor=f.vy>=0?this.support(f.x,.24,oldY+.26,f.y+.26,oldX):null;
          if(floor){
            if(f.type==="egg"){
              const id=this.enemies.findIndex(e=>e.gone&&e.type==="spiny"&&e.home!==undefined);
              const hatch={type:"spiny",x:f.x,y:floor.top,dir:p.x<f.x?-1:1,home:f.home,vy:0,safe:.12,gone:false,shell:0,pace:0};
              if(id<0)this.enemies.push(hatch);else this.enemies[id]=hatch;
              this.burst(f.x,floor.top-.3,["#e06144","#ffe7b3"],5,.55);
            }
            f.gone=true;continue;
          }
          if(pairHit(p.x,p.y,.7,p.h,f.x,f.y+.25,.51,.52)){
            if(this.starTime>0)this.defeat(f,100,f.x,f.y);else this.hit();
          }
        }
        if(f.age>6||f.y>19||f.x<0||f.x>this.course.width)f.gone=true;
      }
      this.foeShots=this.foeShots.filter(f=>!f.gone);
    }
    updateSwitches(){
      const p=this.player;
      for(const lever of this.switches){
        if(lever.on||!pairHit(p.x,p.y,.82,p.h,lever.x,lever.y,1.05,1.16))continue;
        lever.on=true;
        for(const gate of this.solids)if(gate.kind==="gate"&&gate.id===lever.id)gate.gone=true;
        this.sfx("powerup_appears");this.burst(lever.x,lever.y-.6,["#ffe397","#b2f5ef"],9);
        this.hint(lever.id===1?"琥珀闸已开启":"水蓝闸已开启",1.8);
      }
    }
    updateEnemies(dt,oldY){
      const p=this.player;
      for(const e of this.enemies){
        if(e.gone)continue;
        e.safe=Math.max(0,e.safe-dt);
        if(e.shell===2){
          const oldX=e.x,oldFoot=e.y,dx=e.x+e.dir*11.5*dt;e.x=this.wall(dx,e.x,e.y,.75,.42);
          if(e.x!==dx)e.dir*=-1;
          e.vy=Math.min(22,e.vy+32*dt);e.y+=e.vy*dt;
          const floor=e.vy>=0?this.support(e.x,.4,oldFoot,e.y,oldX,true):null;
          if(floor){e.y=floor.top;e.vy=0}
          if(e.y>19||e.x<0||e.x>this.course.width){e.gone=true;continue}
          for(const v of this.enemies)if(v!==e&&!v.gone&&pairHit(e.x,e.y,.8,.72,v.x,v.y,.8,1)){
            this.defeat(v,CHAIN_POINTS[Math.min(7,e.chain++)],v.x,v.y);
          }
          for(const f of this.plants)if(!f.gone&&f.ext>.2&&pairHit(e.x,e.y,.8,.72,f.x,f.y,.8,f.ext)){
            this.defeat(f,CHAIN_POINTS[Math.min(7,e.chain++)],f.x,f.y-f.ext+.5);
          }
        }else if(e.type==="hammer")this.updateHammer(e,dt);
        else if(e.type==="lakitu")this.updateLakitu(e,dt);
        else if(e.type==="spiny")this.updateSpiny(e,dt);
        else if(!e.shell){
          e.x+=e.dir*(e.type==="goomba"?1.4:1.68)*this.mode.speed*dt;
          if(e.x<=e.startX-e.radius){e.x=e.startX-e.radius;e.dir=1}
          if(e.x>=e.startX+e.radius){e.x=e.startX+e.radius;e.dir=-1}
          if(e.type==="wing")e.y=e.baseY-.12-Math.abs(Math.sin(this.area.clock*2.05+e.pace))*1.85;
        }
        const h=enemyHeight(e);
        if(e.gone||e.safe>0||!pairHit(p.x,p.y,.78,p.h,e.x,e.y,.84,h))continue;
        if(this.starTime>0){this.defeat(e,200,e.x,e.y);continue}
        if(e.type==="spiny"){this.hit();continue}
        if(p.vy>=0&&!p.climbing&&oldY<=e.y-h+.35){
          this.bounceOn(e.y-h);e.safe=.23;
          if(e.type==="hammer"||e.type==="lakitu"){
            const points=Math.max(e.type==="lakitu"?800:400,CHAIN_POINTS[Math.min(7,this.combo++)]);
            this.defeat(e,points,e.x,e.y);continue;
          }
          if(!e.shell)this.award(CHAIN_POINTS[Math.min(7,this.combo++)],e.x,e.y-h-.3);
          if(e.type==="wing"){e.type="koopa";e.y=e.baseY}
          else if(e.type==="goomba")e.gone=true;
          else if(e.shell===1){e.shell=2;e.dir=p.x<=e.x?1:-1;e.chain=0;this.sfx("kick")}
          else e.shell=1;
        }else if(e.shell===1){e.shell=2;e.chain=0;e.dir=p.x<=e.x?1:-1;e.safe=.35;this.sfx("kick")}
        else this.hit();
      }
    }
    updateFirebars(){
      const p=this.player;
      if(p.invuln>0||this.starTime>0)return;
      for(const [x,y,length,period,phase=0] of this.course.firebars||[]){
        if(Math.abs(x-p.x)>length+1)continue;
        const angle=this.area.clock*Math.PI*2/period+phase;
        for(let d=.4;d<=length+.02;d+=.47){
          const fx=x+Math.cos(angle)*d,fy=y+Math.sin(angle)*d;
          if(pairHit(p.x,p.y,.66,p.h-.06,fx,fy+.2,.4,.4)){this.hit();return}
        }
      }
    }
    bossPhase(phase,seconds,message){
      this.boss.phase=phase;this.boss.clock=seconds;
      if(message)this.hint(message,Math.min(seconds+0.5,3.6));
    }
    bossOpen(){return this.boss.phase==="stunned"||this.boss.phase==="landing"}
    startVolley(){
      const b=this.boss,rank=this.mode.rank;b.cycle++;b.volley=0;
      b.shots=1+(rank>0?1:0)+(b.hp<=Math.ceil(b.max/2)&&rank===2?1:0);
      this.bossPhase("inhale",1.02-.18*rank);
    }
    spit(air=false){
      const b=this.boss,rank=this.mode.rank,p=this.player;
      b.dir=p.x>=b.x?1:-1;
      const high=(b.volley+b.cycle)%2===0;
      const y=air?b.y-1.35:13-(high?1.48:.54);
      this.flames.push({x:b.x+b.dir*1.2,y,dir:b.dir,age:0,vy:air?1.45:0,speed:6.4+rank*.9,air});
      b.volley++;this.sfx("fireball");
    }
    aimLeap(){
      const b=this.boss,p=this.player,rank=this.mode.rank;
      b.fromX=b.x;const reach=6.8+rank*1.65;
      b.targetX=clamp(b.x+clamp(p.x+p.vx*.22-b.x,-reach,reach),b.left+1.1,b.right-1.1);
      b.dir=b.targetX<b.x?-1:1;b.airShot=false;
      b.flight=1.22-rank*.065;b.height=3.55+rank*.33;
      this.bossPhase("leapWarn",.85-rank*.13,b.leaps===0?"注意地上的落点圈，库霸要跳了！":undefined);
    }
    strikeBoss(stomp){
      const b=this.boss,p=this.player;b.hp--;b.blink=.75;
      if(stomp){p.invuln=Math.max(.8,p.invuln);p.y=b.y-1.28;p.vy=-12.3;p.grounded=false;p.stand=null;p.coyote=0}
      this.award(b.hp===0?5000:500,b.x,b.y-2);this.sfx("stomp");this.shake=.22;
      this.burst(b.x,b.y-1,["#fff7c4","#ffc34f","#f38950"],20);
      if(b.hp===0){this.bossDown=true;this.flames=[];this.sfx("powerup");this.hint("库霸落败！右侧的王旗已经升起。",3);this.emit("music")}
      else this.bossPhase("recover",1.0-.12*this.mode.rank,b.hp===Math.ceil(b.max/2)?"库霸进入急攻，留意空中的火焰！":undefined);
    }
    updateBoss(dt,oldY){
      const b=this.boss,p=this.player,rank=this.mode.rank;
      if(this.areaName!=="main"||!b||this.bossDown)return;
      if(b.phase==="waiting"){
        if(p.x>=b.left+.6){this.startVolley();this.hint("高焰能蹲，低焰要跳。库霸落地或撞墙时可以反击。",3.4);this.emit("music")}
        return;
      }
      b.clock-=dt;b.blink=Math.max(0,b.blink-dt);
      const angry=b.hp<=Math.ceil(b.max/2);
      switch(b.phase){
        case "inhale":
          b.dir=p.x>=b.x?1:-1;
          if(b.clock<=0)this.bossPhase("flame",0);
          break;
        case "flame":
          if(b.clock>0)break;
          if(b.shots>0){this.spit();b.shots--;b.clock=(.86-rank*.095)*(angry ? .92 : 1)}
          else if(b.cycle%3===0){
            b.dir=p.x>=b.x?1:-1;this.bossPhase("brace",1.0-rank*.13);
          }else this.aimLeap();
          break;
        case "leapWarn":
          if(b.clock<=0){b.leaps++;this.bossPhase("leap",b.flight);this.sfx("big_jump")}
          break;
        case "leap": {
          const t=clamp(1-b.clock/b.flight,0,1);
          b.x=b.fromX+(b.targetX-b.fromX)*t;b.y=13-4*b.height*t*(1-t);
          if(!b.airShot&&t>=.46&&(rank===2||angry&&rank===1)){b.airShot=true;this.spit(true)}
          if(t>=1){b.x=b.targetX;b.y=13;this.shake=.18;this.burst(b.x,12.9,["#fcd288","#bc7051"],12);this.sfx("bump");this.bossPhase("landing",1.56-rank*.25)}
          break;
        }
        case "landing":
          if(b.clock<=0){if((rank===2||angry&&rank===1)&&b.leaps%3===1)this.aimLeap();else this.startVolley()}
          break;
        case "brace":
          if(b.clock<=0)this.bossPhase("charge",6);
          break;
        case "charge":
          b.x+=b.dir*(10.7+rank*.83+(angry ? .8 : 0))*dt;
          if(b.x<=b.left+1.1||b.x>=b.right-1.1){
            b.x=clamp(b.x,b.left+1.1,b.right-1.1);this.shake=.26;this.sfx("bump");
            this.burst(b.x,12.2,["#ffc66a","#fff2c4","#d47148"],16);
            this.bossPhase("stunned",2.95-rank*.47);
          }
          break;
        case "stunned": case "recover": if(b.clock<=0)this.startVolley();break;
      }
      const weak=this.bossOpen(),height=weak?1.28:1.92;
      if(b.blink<=0&&pairHit(p.x,p.y,.77,p.h,b.x,b.y,1.76,height)){
        if(weak&&p.vy>=0&&oldY<=b.y-height+.35)this.strikeBoss(true);else this.hit();
      }
      for(const f of this.flames){
        f.age+=dt;f.x+=f.dir*f.speed*dt;f.y+=f.vy*dt;
        if(pairHit(p.x,p.y,.70,p.h-.08,f.x,f.y+.19,.70,.38)){this.hit();f.gone=true}
      }
      this.flames=this.flames.filter(f=>!f.gone&&f.age<6&&f.y<13.1&&f.x>=b.left-.5&&f.x<=b.right+.5);
    }
    updatePipes(dt){
      const p=this.player,r=p.stand;
      if(!p.grounded||!r||!["in","back"].includes(r.tag)||Math.abs(p.x-r.x-r.w/2)>.65||!this.input.down){this.pipeHold=0;return}
      this.pipeHold+=dt;
      if(this.pipeHold<.18)return;
      p.x=r.x+r.w/2;p.vx=0;this.pipeTrip={age:0,swapped:false,to:r.tag==="in"?"secret":"main",lip:r.y};
      this.sfx("pipe");p.buffer=0;
    }
    travel(dt){
      const trip=this.pipeTrip;trip.age+=dt;
      if(trip.age>=.42&&!trip.swapped){
        const target=trip.to;this.enterArea(target);trip.swapped=true;
        if(target==="secret"){
          this.secretFound=true;this.place(...this.course.spawn,true);trip.lip=null;
          this.hint(this.course.name+" · 找到回程管后按 ↓ 返回",3);
        }else{
          const out=this.solids.find(r=>r.tag==="out");this.place(out.x+out.w/2,out.y,true);trip.lip=out.y;
          this.hint("返回主路",1.4);
        }
        this.emit("music");
      }
      if(trip.age>=.87){this.pipeTrip=null;this.pipeHold=0}
    }
    updateCamera(dt){
      const p=this.player,b=this.boss;
      const arena=this.areaName==="main"&&b&&b.phase!=="waiting"&&!this.bossDown;
      const x=arena?(b.left+b.right)/2-15:p.x-9.2;
      this.camera+=(clamp(x,0,Math.max(0,this.course.width-30))-this.camera)*Math.min(1,dt*7);
      const target=Math.min(0,p.y-8.8);
      this.cameraY+=(target-this.cameraY)*Math.min(1,dt*(p.vy>7?7:5));
    }
    touchFlag(){
      const [x,y]=this.level.goal,p=this.player;
      const high=y-p.y+p.h*.7;
      const flag=high>=4.4?5000:high>=3.5?2000:high>=2.6?800:high>=1.65?400:100;
      const seconds=Math.ceil(Math.max(0,this.remaining));
      this.award(flag,x,y-Math.max(1.1,high));this.release();p.climbing=null;p.duck=false;p.invuln=0;p.h=STANDING[p.form];
      this.tally={age:0,seconds,paid:0,flag,fromY:Math.max(y-5.35,p.y),preFlag:this.score-flag};
      p.x=x;p.face=1;p.vx=0;p.vy=0;this.state="tally";this.sfx("flagpole");this.emit("tally");
    }
    advanceTally(dt){
      const t=this.tally,[x,y]=this.level.goal;t.age+=dt;this.animate(dt);
      const slide=clamp(t.age/.68,0,1);this.player.y=t.fromY+(y-t.fromY)*slide;
      if(t.age>.68){this.player.x=Math.min(x+1.5,this.course.width-.5,x+(t.age-.68)*2.1);this.player.grounded=true;this.player.stride+=dt*2.1}
      const due=Math.floor(t.seconds*clamp((t.age-.72)/1.55,0,1));
      if(due>t.paid){
        const first=t.paid===0;
        this.score+=(due-t.paid)*50;t.paid=due;
        if(first||due===t.seconds)this.emit("music");
      }
      this.remaining=t.seconds-t.paid;
      if(t.age>=2.56){
        this.state="won";
        this.emit("won",{stars:this.starIds,time:this.time,coins:this.gold,score:this.score,total:this.totalScore,flag:t.flag,seconds:t.seconds,action:t.preFlag,secret:this.secretFound});
      }
    }
    retry(){
      const s=this.savedFlag;
      if(s){
        this.areas=structuredClone(s.areas);this.score=s.score;this.gold=s.gold;this.remaining=s.remaining;this.time=s.time;
        this.player.form=s.form;this.secretFound=s.secret;this.health=this.mode.hearts;this.state="playing";this.bossDown=false;
        this.lowTime=this.remaining<=this.warningAt;this.restoreAtFlag();
      }else this.initRun();
      this.emit("resumed");this.hint(this.checkpoint?"从中途旗再次出发":"准备好，再试一次！",2);
    }
    step(dt){
      if(this.state==="tally"){this.advanceTally(dt);return}
      if(this.state!=="playing")return;
      this.time+=dt;this.remaining=Math.max(0,this.remaining-dt);
      if(this.remaining<=0){this.lose("time");return}
      if(!this.lowTime&&this.remaining<=this.warningAt){this.lowTime=true;this.sfx("out_of_time");this.emit("music")}
      if(this.starTime>0){this.starTime=Math.max(0,this.starTime-dt);if(!this.starTime)this.emit("music")}
      this.animate(dt);
      if(this.pipeTrip){this.travel(dt);return}
      if(this.fallDelay>0){this.fallDelay-=dt;if(this.fallDelay<=0){this.restoreAtFlag();this.emit("music")}return}
      const oldY=this.movePlayer(dt),p=this.player,c=this.course;
      if(p.y>(this.theme===3?16.3:18.3)){this.hit(true);return}
      this.pickups(dt);this.updateSwitches();this.updatePlants(dt);this.updateShots(dt);this.updateEnemies(dt,oldY);
      this.updateCannons(dt);this.updateFoeShots(dt,oldY);
      for(const [x,y,w] of c.spikes)if(p.x+HALF>x+.12&&p.x-HALF<x+w-.12&&p.y>y-.44&&p.y-p.h<y)this.hit();
      this.updateFirebars();if(this.state!=="playing")return;
      this.updatePipes(dt);if(this.pipeTrip)return;
      if(this.areaName==="main"){
        for(let i=this.checkpoints.length-1;i>this.flagIndex;i--){
          const [x,y]=this.checkpoints[i];
          if(Math.abs(p.x-x)>.98||p.y<y-4.4||p.y>y+.28)continue;
          this.flagIndex=i;this.recordFlag();this.sfx("powerup");this.hint("已点亮中途旗 "+(i+1)+" / "+this.checkpoints.length,2);break;
        }
        this.updateBoss(dt,oldY);
      }
      if(this.state!=="playing")return;
      for(let i=0;i<c.signs.length;i++){
        if(!this.seenSigns.has(i)&&Math.abs(p.x-c.signs[i][0])<1.2){
          this.seenSigns.add(i);this.hint(c.signs[i][1],2.7);
        }
      }
      this.updateCamera(dt);
      if(this.areaName==="main"&&p.x>=c.goal[0]-.38&&(!this.boss||this.bossDown)&&p.y>=c.goal[1]-6.4&&p.y<=c.goal[1]+.3)this.touchFlag();
    }
  }
  window.ArcadeGame=ArcadeGame;
  window.ARCADE_MODES=MODES;
  window.arcadeTimeBudget=timeBudget;
})();
