(() => {
  "use strict";
  const MODES = {
    relaxed: {name:"休闲", hearts:5, speed:0.73, grace:2.4, crumble:1.15, boss:3},
    classic: {name:"经典", hearts:3, speed:1, grace:1.7, crumble:0.78, boss:3},
    expert: {name:"专家", hearts:2, speed:1.32, grace:1.2, crumble:0.55, boss:4},
  };
  const HALF = 0.39;
  const HEIGHT = 1.25;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const toward = (v,to,delta) => v < to ? Math.min(to,v+delta) : Math.max(to,v-delta);
  const overlapsX = (x,half,r) => x+half>r.x+0.001 && x-half<r.x+r.w-0.001;
  const pairHit = (x,y,w,h,ox,oy,ow,oh) => Math.abs(x-ox)<(w+ow)/2 && y>oy-oh && y-h<oy;
  const freshInput = () => ({left:false,right:false,jump:false,run:false});
  const solid = (x,y,w,h,kind) => ({x,y,w,h,kind});

  class ArcadeGame {
    constructor(course,index,mode,emit=()=>{}) {
      this.course=course; this.index=index; this.world=Math.floor(index/2);
      this.mode=MODES[mode] || MODES.classic; this.modeId=mode;
      this.emit=emit; this.state="playing"; this.input=freshInput();
      this.solids=[
        ...course.ground.map(([a,b])=>solid(a,13,b-a,6,"ground")),
        ...course.pipes.map(([x,y,w])=>solid(x,y,w,13-y,"pipe")),
        ...course.blocks.map(([x,y,kind])=>({...solid(x,y,1,1,"block"),type:kind,used:false,bump:0})),
      ];
      this.platforms=course.ledges.map(([x,y,w,kind])=>({...solid(x,y,w,0.5,kind),crack:0,gone:0}));
      this.movers=course.movers.map(([x,y,w,dx,dy,period])=>({...solid(x,y,w,0.5,"mover"),x0:x,y0:y,dx,dy,period,stepX:0,stepY:0}));
      this.springs=course.springs.map(([x,y])=>({x,y,pulse:0}));
      this.coins=course.coins.map(([x,y])=>({x,y,got:false}));
      this.stars=course.stars.map(([x,y],id)=>({x,y,id,got:false}));
      this.checkpoint=false; this.gold=0; this.time=0; this.camera=0;
      this.particles=[]; this.items=[]; this.flames=[]; this.seenSigns=new Set();
      this.health=this.mode.hearts; this.shake=0; this.bossDown=false; this.fallDelay=0;
      this.player={}; this.resetActors();
    }
    resetActors() {
      const start=this.checkpoint ? this.course.checkpoint : [2,13];
      Object.assign(this.player,{x:start[0],y:start[1],vx:0,vy:0,face:1,grounded:true,stand:null,coyote:0.1,buffer:0,invuln:this.checkpoint?1.6:0.6,stride:0});
      this.enemies=this.course.enemies.map(([x,y,type,radius],i)=>({x,y,startX:x,baseY:y,type,radius,dir:i%2?1:-1,gone:false,shell:0,vy:0,safe:0,pace:i*0.41}));
      this.platforms.forEach(p=>{p.crack=0;p.gone=0});
      this.flames=[]; this.items=[]; this.fallDelay=0; this.shake=0;
      if(this.course.boss && !this.bossDown){
        const {left,right}=this.course.boss;
        this.boss={left,right,x:right-2.2,y:13,dir:-1,hp:this.mode.boss,max:this.mode.boss,phase:"waiting",clock:0,shots:0,blink:0};
      }
      this.camera=clamp(start[0]-8.5,0,this.course.width-30);
      this.release();
    }
    release(){this.input=freshInput();this.player.buffer=0}
    control(key,held){
      if(this.state!=="playing" || !(key in this.input) || this.input[key]===held)return;
      this.input[key]=held;
      if(key==="jump" && held)this.player.buffer=0.14;
      if(key==="jump" && !held && this.player.vy < -6.2 && !this.player.springing)this.player.vy=-6.2;
    }
    hint(text,seconds=2.5){this.emit("hint",{text,seconds})}
    sfx(name){this.emit("sfx",name)}
    burst(x,y,colors,count=10,power=1) {
      for(let i=0;i<count;i++)this.particles.push({x,y,vx:(Math.random()-.5)*7*power,vy:(-1-Math.random()*5)*power,life:.24+Math.random()*.35,color:colors[i%colors.length],size:i%3===0?3:2});
    }
    animate(dt){
      this.shake=Math.max(0,this.shake-dt);
      this.particles=this.particles.filter(p=>p.life>0);
      for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=15*dt;p.life-=dt}
      for(const s of this.solids)if(s.bump>0)s.bump=Math.max(0,s.bump-dt);
      for(const spring of this.springs)spring.pulse=Math.max(0,spring.pulse-dt);
      for(const platform of this.platforms){
        if(platform.crack>0){platform.crack-=dt;if(platform.crack<=0){platform.gone=2.6;this.burst(platform.x+platform.w/2,platform.y,["#ab958a","#776777"],8)}}
        else if(platform.gone>0)platform.gone=Math.max(0,platform.gone-dt);
      }
      for(const m of this.movers){
        const factor=(1-Math.cos(this.time*Math.PI*2/m.period))/2;
        const nx=m.x0+m.dx*factor,ny=m.y0+m.dy*factor;
        m.stepX=nx-m.x;m.stepY=ny-m.y;m.x=nx;m.y=ny;
      }
    }
    bump(block){
      if(block.kind!=="block")return;
      block.bump=0.18;
      if(block.used){this.sfx("bump");return}
      if(block.type==="brick"){
        block.gone=true;this.burst(block.x+.5,block.y+.4,["#a24c2d","#e19855","#6b3f36"],13);this.sfx("bump");return;
      }
      block.used=true;
      if(block.type==="coin"){this.gold++;this.sfx("coin");this.burst(block.x+.5,block.y-.4,["#ffe198","#f5af39"],9)}
      else{
        this.sfx("powerup_appears");
        this.items.push({x:block.x+.5,y:block.y-.02,vx:this.player.face*2,vy:-5});
      }
    }
    movePlayer(dt){
      const p=this.player;
      const ride=p.stand?.kind==="mover" ? p.stand : null;
      if(ride){p.x+=ride.stepX;p.y+=ride.stepY}
      p.invuln=Math.max(0,p.invuln-dt);
      p.buffer=Math.max(0,p.buffer-dt);
      p.coyote=p.grounded ? .105 : Math.max(0,p.coyote-dt);
      const intent=Number(this.input.right)-Number(this.input.left);
      p.vx=toward(p.vx,intent*(this.input.run?9.3:6.9),(intent?47:65)*dt);
      if(intent)p.face=intent;
      if(p.buffer>0 && p.coyote>0){p.vy=-14.6;p.buffer=0;p.coyote=0;p.grounded=false;p.stand=null;p.springing=false;this.sfx("small_jump")}
      p.stride+=Math.abs(p.vx)*dt;
      const oldX=p.x;
      p.x+=p.vx*dt;
      for(const r of this.solids){
        if(r.gone || p.y<=r.y+.001 || p.y-HEIGHT>=r.y+r.h-.001 || !overlapsX(p.x,HALF,r))continue;
        if(p.vx>0 && oldX+HALF<=r.x+.03){p.x=r.x-HALF;p.vx=0}
        else if(p.vx<0 && oldX-HALF>=r.x+r.w-.03){p.x=r.x+r.w+HALF;p.vx=0}
      }
      const left=this.boss && !this.bossDown && this.boss.phase!=="waiting" ? this.boss.left+.4 : HALF;
      p.x=clamp(p.x,left,this.course.width-HALF);
      const oldY=p.y;p.vy=Math.min(23,p.vy+32*dt);
      const nextY=oldY+p.vy*dt;p.grounded=false;p.stand=null;
      if(p.vy>=0){
        let landed=null;
        for(const r of [...this.solids,...this.platforms,...this.movers]){
          if(r.gone || !overlapsX(p.x,HALF,r))continue;
          const oldTop=r.kind==="mover" && r!==ride?r.y-r.stepY:r.y;
          if(oldY<=oldTop+.035 && nextY>=r.y-.001 && (!landed || r.y<landed.y))landed=r;
        }
        if(landed){
          p.y=landed.y;p.vy=0;p.grounded=true;p.springing=false;p.stand=landed;
          if(landed.kind==="crumble" && landed.crack<=0)landed.crack=this.mode.crumble;
        }else p.y=nextY;
      }else{
        let ceiling=null;
        for(const r of this.solids){
          const bottom=r.y+r.h;
          if(r.gone || !overlapsX(p.x,HALF,r))continue;
          if(oldY-HEIGHT>=bottom-.025 && nextY-HEIGHT<=bottom && (!ceiling || bottom>ceiling.y+ceiling.h))ceiling=r;
        }
        if(ceiling){p.y=ceiling.y+ceiling.h+HEIGHT;p.vy=0;this.bump(ceiling)}
        else p.y=nextY;
      }
      for(const s of this.springs){
        if(Math.abs(p.x-s.x)<.53 && p.vy>=0 && oldY<=s.y+.04 && p.y>=s.y-.27){
          p.y=s.y-.25;p.vy=-19.65;p.grounded=false;p.stand=null;p.coyote=0;p.springing=true;s.pulse=.3;this.sfx("small_jump");
          this.burst(s.x,s.y-.35,["#ffd65b","#fff7bf"],5);break;
        }
      }
      return oldY;
    }
    pickups(dt){
      const p=this.player;
      const touching=o=>Math.abs(p.x-o.x)<.78 && o.y>=p.y-HEIGHT-.35 && o.y<=p.y+.3;
      for(const c of this.coins)if(!c.got && touching(c)){c.got=true;this.gold++;this.sfx("coin");this.burst(c.x,c.y,["#ffe490","#efb237"],5,.65)}
      for(const s of this.stars)if(!s.got && touching(s)){
        s.got=true;this.sfx("powerup");this.burst(s.x,s.y,["#fff7c4","#ffd146","#faf6df"],19);
        this.hint("星币到手！  "+this.stars.filter(star=>star.got).length+" / 3",1.5);
      }
      for(const m of this.items){
        const prev=m.y,oldX=m.x;m.vy+=24*dt;m.x+=m.vx*dt;m.y+=m.vy*dt;
        for(const r of [...this.solids,...this.platforms,...this.movers]){
          if(r.gone||!overlapsX(m.x,.35,r))continue;
          if(m.vy>=0 && prev<=r.y+.02 && m.y>=r.y){m.y=r.y;m.vy=0}
          else if((r.kind==="pipe" || r.kind==="block") && m.y>r.y+.03 && m.y-.8<r.y+r.h && !overlapsX(oldX,.35,r)){m.x=oldX;m.vx*=-1}
        }
        if(pairHit(p.x,p.y,.78,HEIGHT,m.x,m.y,.8,.8)){
          m.got=true;
          if(this.health<this.mode.hearts){this.health++;this.hint("蘑菇补给 · 恢复一颗心",1.8)}
          else{p.invuln=Math.max(p.invuln,4);this.hint("满心奖励 · 短暂无敌",1.8)}
          this.sfx("powerup");
        }
      }
      this.items=this.items.filter(m=>!m.got && m.y<18);
    }
    hit(pit=false){
      const p=this.player;
      if(this.fallDelay>0 || this.state!=="playing" || (!pit && p.invuln>0))return;
      this.health--;this.shake=.18;this.sfx("bump");
      if(this.health<=0){this.state="lost";this.release();this.emit("lost");return}
      if(pit){this.fallDelay=.34;this.hint(this.checkpoint?"回到中途旗":"回到起点",1.5);return}
      p.invuln=this.mode.grace;p.vy=-6;p.grounded=false;p.stand=null;p.coyote=0;
      this.burst(p.x,p.y-.7,["#f67555","#fff3bb"],9);
    }
    updateEnemies(dt,oldY){
      const p=this.player;
      for(const e of this.enemies){
        if(e.gone)continue;
        e.safe=Math.max(0,e.safe-dt);
        if(e.shell===2){
          const oldX=e.x,oldFoot=e.y;e.x+=e.dir*10.5*dt;e.vy=Math.min(22,e.vy+32*dt);e.y+=e.vy*dt;
          for(const r of this.solids){
            if(r.gone || !overlapsX(e.x,.42,r))continue;
            if(e.vy>=0 && oldFoot<=r.y+.025 && e.y>=r.y){e.y=r.y;e.vy=0}
            else if(e.y>r.y+.025 && e.y-.75<r.y+r.h && !overlapsX(oldX,.42,r)){e.x=oldX;e.dir*=-1;this.sfx("bump")}
          }
          if(e.y>18 || e.x<0 || e.x>this.course.width)e.gone=true;
          for(const victim of this.enemies)if(victim!==e && !victim.gone && pairHit(e.x,e.y,.8,.72,victim.x,victim.y,.8,1)){
            victim.gone=true;this.burst(victim.x,victim.y-.45,["#d38951","#ffc55e"],8);this.sfx("stomp");
          }
        }else if(!e.shell){
          const speed=(e.type==="goomba"?1.28:1.55)*this.mode.speed;e.x+=e.dir*speed*dt;
          if(e.x<=e.startX-e.radius){e.x=e.startX-e.radius;e.dir=1}
          if(e.x>=e.startX+e.radius){e.x=e.startX+e.radius;e.dir=-1}
          if(e.type==="wing")e.y=e.baseY-.12-Math.abs(Math.sin(this.time*2.05+e.pace))*1.85;
        }
        const h=e.shell ? .74 : e.type==="goomba" ? .91 : 1.27;
        if(e.gone || e.safe>0 || !pairHit(p.x,p.y,.78,HEIGHT,e.x,e.y,.84,h))continue;
        if(p.vy>=0 && oldY<=e.y-h+.37){
          p.y=e.y-h;p.vy=this.input.jump?-10.2:-7.7;p.grounded=false;p.stand=null;p.coyote=0;
          this.sfx("stomp");this.burst(e.x,e.y-h,["#fff1b2","#dfb06c"],6,.6);e.safe=.23;
          if(e.type==="wing"){e.type="koopa";e.y=e.baseY}
          else if(e.type==="goomba")e.gone=true;
          else if(e.shell===1){e.shell=2;e.dir=p.x<=e.x?1:-1;this.sfx("kick")}
          else e.shell=1;
        }else if(e.shell===1){
          e.shell=2;e.dir=p.x<=e.x?1:-1;e.safe=.35;this.sfx("kick");
        }else this.hit();
      }
    }
    bossPhase(phase,seconds,message){
      this.boss.phase=phase;this.boss.clock=seconds;
      if(message)this.hint(message,Math.min(seconds+0.5,3.6));
    }
    updateBoss(dt,oldY){
      const b=this.boss,p=this.player;
      if(!b||this.bossDown)return;
      if(b.phase==="waiting"){
        if(p.x>=b.left+.6){this.bossPhase("inhale",1.5,"库霸正在吸气，准备越过火球！");this.emit("bossStart")}
        return;
      }
      b.clock-=dt;b.blink=Math.max(0,b.blink-dt);
      if(b.phase==="inhale"){
        b.dir=p.x>=b.x?1:-1;
        if(b.clock<=0){b.shots=b.hp<=1?2:1;this.bossPhase("flame",0)}
      }else if(b.phase==="flame" && b.clock<=0){
        if(b.shots>0){
          b.dir=p.x>=b.x?1:-1;this.flames.push({x:b.x+b.dir*1.1,y:12.3,dir:b.dir,age:0});
          this.sfx("fireball");b.shots--;b.clock=1.14/Math.sqrt(this.mode.speed);
        }else{
          b.dir=p.x>=b.x?1:-1;
          this.bossPhase("brace",1.18/Math.sqrt(this.mode.speed),"库霸准备冲锋！跳过它，等它撞墙。");
        }
      }else if(b.phase==="brace" && b.clock<=0)this.bossPhase("charge",8);
      else if(b.phase==="charge"){
        b.x+=b.dir*(10.3+(b.max-b.hp)*.65)*Math.sqrt(this.mode.speed)*dt;
        if(b.x<b.left+1.1 || b.x>b.right-1.1){
          b.x=clamp(b.x,b.left+1.1,b.right-1.1);this.shake=.3;this.sfx("bump");
          this.burst(b.x,12.2,["#ffc66a","#fff2c4","#d47148"],18);
          this.bossPhase("stunned",this.modeId==="expert"?3.05:4.0,"库霸晕了！现在跳起来踩头！");
        }
      }else if(b.phase==="stunned" && b.clock<=0)this.bossPhase("inhale",1.05,"库霸再次吸气，准备跳跃！");
      else if(b.phase==="recover" && b.clock<=0)this.bossPhase("inhale",1.25,"库霸再次吸气，准备跳跃！");
      const bh=b.phase==="stunned"?1.28:1.95;
      if(b.blink<=0 && pairHit(p.x,p.y,.78,HEIGHT,b.x,b.y,1.78,bh)){
        if(b.phase==="stunned" && p.vy>=0 && oldY<=b.y-bh+.36){
          b.hp--;b.blink=1.2;p.invuln=Math.max(.9,p.invuln);p.y=b.y-bh;p.vy=-12.3;p.grounded=false;p.stand=null;p.coyote=0;
          this.sfx("stomp");this.shake=.26;this.burst(b.x,b.y-1,["#fff7c4","#ffc34f","#f38950"],20);
          if(b.hp===0){this.bossDown=true;this.flames=[];this.sfx("powerup");this.hint("库霸落败！去右侧金旗领取胜利。",4)}
          else this.bossPhase("recover",1.5,"命中！库霸还剩 "+b.hp+" 格体力");
        }else this.hit();
      }
      for(const f of this.flames){
        f.age+=dt;f.x+=f.dir*(6.1+this.mode.speed)*dt;
        if(pairHit(p.x,p.y,.72,HEIGHT-.1,f.x,f.y+.23,.65,.42)){this.hit();f.gone=true}
      }
      this.flames=this.flames.filter(f=>!f.gone && f.age<6 && f.x>=b.left-.5 && f.x<=b.right+.5);
    }
    retry(){
      this.health=this.mode.hearts;this.state="playing";this.resetActors();this.emit("resumed");
      this.hint(this.checkpoint?"从中途旗再次出发":"准备好，再试一次！",2);
    }
    step(dt){
      if(this.state!=="playing")return;
      this.time+=dt;this.animate(dt);
      if(this.fallDelay>0){this.fallDelay-=dt;if(this.fallDelay<=0)this.resetActors();return}
      const oldY=this.movePlayer(dt),p=this.player,c=this.course;
      if(p.y>(this.world===3?15.45:17.7)){this.hit(true);return}
      this.pickups(dt);this.updateEnemies(dt,oldY);
      for(const [x,y,w] of c.spikes)if(p.x+HALF>x+.12 && p.x-HALF<x+w-.12 && p.y>y-.44 && p.y-HEIGHT<y)this.hit();
      if(this.state!=="playing")return;
      if(!this.checkpoint && p.x>=c.checkpoint[0]-.35){
        this.checkpoint=true;this.sfx("powerup");this.hint("中途旗已点亮 · 失足会回到这里",2.6);
      }
      this.updateBoss(dt,oldY);
      if(this.state!=="playing")return;
      for(let i=0;i<c.signs.length;i++){
        if(!this.seenSigns.has(i) && Math.abs(p.x-c.signs[i][0])<1.2){
          this.seenSigns.add(i);this.hint(c.signs[i][1],2.6);
        }
      }
      const desired=this.boss && this.boss.phase!=="waiting" && !this.bossDown ? (this.boss.left+this.boss.right)/2-15 : p.x-9.2;
      this.camera+=(clamp(desired,0,c.width-30)-this.camera)*Math.min(1,dt*7);
      if(p.x>=c.goal[0]-.38 && (!this.boss || this.bossDown)){
        this.state="won";this.release();this.emit("won",{stars:this.stars.filter(s=>s.got).map(s=>s.id),time:this.time,coins:this.gold});
      }
    }
  }
  window.ArcadeGame=ArcadeGame;
  window.ARCADE_MODES=MODES;
})();
