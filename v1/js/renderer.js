(() => {
  "use strict";
  const T=16, W=480, H=270;
  const themes=[
    {edge:"#324736",top:"#d2ee76",moss:"#75bc4e",shade:"#3a7643",earth:"#a76340",stone:"#c48450",dark:"#80493b",light:"#df9f62",sky:"#7fcdc9"},
    {edge:"#272543",top:"#c1c1ff",moss:"#8487db",shade:"#52548e",earth:"#56456e",stone:"#715986",dark:"#3a3358",light:"#9683a3",sky:"#403768"},
    {edge:"#504151",top:"#fff0bc",moss:"#efc975",shade:"#b88255",earth:"#ad7258",stone:"#cb8b65",dark:"#825164",light:"#edab7c",sky:"#e8b6aa"},
    {edge:"#322635",top:"#e4a179",moss:"#a8665c",shade:"#684552",earth:"#514052",stone:"#68505b",dark:"#342f41",light:"#8a686d",sky:"#884550"},
  ];
  const sceneNames=["meadow","cavern","sky","castle"];
  const actorNames=["mario-idle","mario-run1","mario-run2","mario-run3","mario-jump","goomba-1","goomba-2","koopa-1","koopa-2","boss-1","boss-2","boss-fire","coin","coin-2","coin-3","coin-4","mushroom","question","brick","shell","star","flame"];
  const pics={};
  function add(key,path){const img=new Image();img.src=path;pics[key]=img}
  for(const k of actorNames)add(k,"./assets/sprites/"+k+".png");
  for(const k of sceneNames)add("bg-"+k,"./assets/art/"+k+".webp");
  const round=Math.round;
  function speck(col,row){const n=Math.sin(col*127.1+row*311.7)*43758.5453;return n-Math.floor(n)}
  function tileStamp(theme,index){
    const c=document.createElement("canvas");c.width=64;c.height=32;
    const g=c.getContext("2d");
    const box=(x,y,w,h,color)=>{g.fillStyle=color;g.fillRect(x,y,w,h)};
    box(0,0,64,32,theme.dark);
    if(index===0 || index===2){
      for(let y=0;y<2;y++)for(let x=-1;x<5;x++){
        const a=x*16+(y%2)*8,b=y*16;
        box(a,b,16,16,theme.earth);box(a+1,b+1,13,1,theme.stone);
        box(a+2,b+3,5,2,theme.stone);box(a+3,b+2,4,1,theme.light);
        box(a+9,b+8,4,3,theme.dark);box(a+8,b+9,2,2,theme.stone);
        box(a+3,b+13,2,1,theme.dark);
      }
    }else{
      for(let y=0;y<3;y++)for(let x=-1;x<5;x++){
        const a=x*18+(y%2)*9,b=y*11;
        box(a+1,b+1,17,10,theme.earth);box(a+2,b+1,15,1,theme.stone);
        box(a+1,b+2,1,6,theme.stone);box(a+4,b+4,4,1,theme.stone);
        box(a+11,b+5,2,1,theme.dark);box(a+13,b+6,2,1,theme.dark);
      }
    }
    return c;
  }
  class ArcadeRenderer{
    constructor(canvas){
      this.canvas=canvas;this.ctx=canvas.getContext("2d",{alpha:false});
      this.ctx.imageSmoothingEnabled=false;this.tiles=themes.map(tileStamp);
      this.reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    box(x,y,w,h,color){const c=this.ctx;c.fillStyle=color;c.fillRect(round(x),round(y),Math.max(1,round(w)),Math.max(1,round(h)))}
    line(points,color){
      const c=this.ctx;c.fillStyle=color;c.beginPath();
      points.forEach(([x,y],i)=>i?c.lineTo(round(x),round(y)):c.moveTo(round(x),round(y)));c.closePath();c.fill();
    }
    sprite(name,x,baseY,width,height,flip=false){
      const img=pics[name];if(!img?.naturalWidth)return;
      const c=this.ctx,dx=round(x),dy=round(baseY-height),w=Math.max(1,round(width)),h=Math.max(1,round(height));
      c.save();c.translate(dx,dy);if(flip)c.scale(-1,1);
      c.drawImage(img,-Math.floor(w/2),0,w,h);c.restore();
    }
    sparkle(x,y,color,size=2){this.box(x-size,y,2*size+1,1,color);this.box(x,y-size,1,2*size+1,color)}
    drawBackground(game){
      const c=this.ctx,world=game.world,img=pics["bg-"+sceneNames[world]];this.box(0,0,W,H,themes[world].sky);
      if(img?.naturalWidth){
        const bw=650,bh=Math.max(H,round(bw*img.naturalHeight/img.naturalWidth));
        const progress=game.camera/Math.max(1,game.course.width-30);
        const horizon=[.15,.47,.55,.47][world];
        c.drawImage(img,-round((bw-W)*progress),-round((bh-H)*horizon),bw,bh);
        this.box(0,0,W,H,["#e4efdc19","#24234635","#ffedce20","#4d293523"][world]);
      }
      if(world===3){
        const y=248,t=game.time,off=round(game.camera*T*.6);
        this.box(0,y,W,H-y,"#e96934");this.box(0,y+4,W,8,"#f78c3a");
        for(let x=-(off%18)-18;x<W;x+=18){const d=round(Math.sin(x*.19+t*3)*2);this.box(x,y+d,10,3,"#ffdf63");this.box(x+10,y+d+2,8,2,"#ffbd46");this.box(x+5,y+d+12,8,2,"#ffab3b")}
      }
      if(this.reduce)return;
      const color=["#fffbbb","#9bfaff","#fffae1","#ffbd65"][world];
      for(let i=0;i<13;i++){
        const x=((i*73.2+Math.sin(game.time*.55+i)*5-game.camera*(world+1))%W+W)%W;
        const y=(i*49.7-game.time*(world===3?9:2)+1000*H)%H;
        this.box(x,y,i%4===0?2:1,i%4===0?2:1,color);
      }
    }
    ground(r,cam,world){
      const t=themes[world],x=round(r.x*T)-cam,y=round(r.y*T),w=round(r.w*T);
      if(x>W||x+w<0)return;
      const c=this.ctx,first=Math.max(0,Math.floor(-x/64)*64);
      c.save();c.beginPath();c.rect(x,y,w,H-y);c.clip();
      for(let a=first;a<w && x+a<W;a+=64)for(let b=0;y+b<H;b+=32)c.drawImage(this.tiles[world],x+a,y+b);
      this.box(x,y,w,2,t.edge);this.box(x,y+1,w,5,t.moss);this.box(x,y+1,w,2,t.top);
      const from=Math.max(0,Math.floor(-x/8)*8);
      for(let a=from;a<w && x+a<W;a+=8){
        const v=speck(r.x+a,world);
        this.box(x+a,y+5,8,2,t.shade);this.box(x+a+1,y+6,3,2+v*3,t.shade);
        this.box(x+a+1,y+5,3,2,t.moss);
        if(v>.6)this.box(x+a+4,y+2,2,1,t.light);
      }
      this.box(x,y,2,H-y,t.edge);this.box(x+w-2,y,2,H-y,t.edge);
      c.restore();
      if(world!==0 && world!==2)return;
      for(let a=4;a<w-3;a+=17){
        if(x+a<0||x+a>W||speck(r.x+a,11)<.52)continue;
        this.box(x+a,y-3,1,3,"#4e8750");this.box(x+a+2,y-2,1,2,"#75974e");
        if(speck(a,5)>.56){this.box(x+a-1,y-5,3,2,"#fff2b0");this.box(x+a,y-4,1,1,"#f2b24c")}
      }
    }
    pipe(r,cam){
      const x=round(r.x*T)-cam,y=round(r.y*T),w=round(r.w*T),h=round(r.h*T);
      if(x>W||x+w<0)return;
      this.box(x+2,y+5,w-4,h-4,"#294637");this.box(x+4,y+5,w-8,h-5,"#328751");
      this.box(x+5,y+5,3,h-5,"#91dc62");this.box(x+8,y+5,3,h-5,"#65bd55");
      this.box(x+w-10,y+5,5,h-5,"#286b47");
      this.box(x,y,w,8,"#284538");this.box(x+1,y+1,w-2,5,"#58aa4c");
      this.box(x+2,y+1,w-4,1,"#b0e36f");this.box(x+4,y+2,4,4,"#95db5d");
      this.box(x+w-7,y+2,5,4,"#36844c");this.box(x+2,y+8,w-4,2,"#265c40");
    }
    block(r,cam){
      const y=r.y*T-(r.bump>0?Math.sin(r.bump/.18*Math.PI)*3:0),x=r.x*T-cam;
      if(x<-17||x>W)return;
      if(!r.used){this.sprite(r.type==="brick"?"brick":"question",x+8,y+16,16,16);return}
      this.box(x,y,16,16,"#543e41");this.box(x+1,y+1,14,13,"#b28866");this.box(x+2,y+2,12,1,"#c69d74");
      for(const dx of [2,12])for(const dy of [3,11])this.box(x+dx,y+dy,2,2,"#795b51");
    }
    platform(p,cam,world,now){
      if(p.gone>0)return;
      const shake=p.crack>0?Math.sin(now*65)*1.5:0;
      const x=round(p.x*T)-cam+round(shake),y=round(p.y*T),w=round(p.w*T);
      if(x>W||x+w<0)return;
      const t=themes[world];
      if(p.kind==="mover"){
        this.box(x,y,w,8,"#343242");this.box(x+1,y+1,w-2,2,"#ffe295");this.box(x+2,y+3,w-4,3,"#ad805e");
        for(let a=4;a<w-3;a+=10){this.box(x+a,y+3,3,3,"#5c555c");this.box(x+a,y+3,1,1,"#ffdb8a")}
        const mx=x+w/2;this.line([[mx-5,y+8],[mx+5,y+8],[mx,y+14]],world===1?"#79dcf0":"#e9bc76");
        this.box(mx-1,y+8,2,3,"#fff4ca");return;
      }
      if(p.kind==="cloud"){
        this.box(x+1,y,w-2,4,"#674c68");this.box(x,y+2,w,4,"#674c68");this.box(x+2,y+1,w-4,3,"#fff3d0");
        for(let a=0;a<w-3;a+=8){const h=4+speck(a,p.x)*3;this.box(x+a+2,y+4,7,h,"#b98ca2");this.box(x+a+2,y+3,6,h-1,"#e5c3c9");this.box(x+a+2,y+3,4,2,"#fff0cf")}
        return;
      }
      const cracked=p.kind==="crumble";
      this.box(x,y,w,6,t.edge);this.box(x+2,y+6,w-4,3,t.dark);
      this.box(x+1,y+1,w-2,2,cracked?"#efbb99":t.top);
      this.box(x+1,y+3,w-2,3,cracked?"#b6817c":t.moss);
      for(let a=3;a<w-4;a+=9){
        this.box(x+a,y+6,6,3+speck(a,p.y)*3,cracked?"#80606b":t.shade);
        if(cracked){this.box(x+a+3,y+1,1,3,t.edge);this.box(x+a+2,y+4,2,2,t.edge)}
      }
    }
    flag(x,y,cam,active,goal,t){
      const px=round(x*T)-cam,py=round(y*T),h=goal?63:35;
      if(px<-25||px>W+6)return;
      this.box(px-3,py-4,8,4,"#3b4644");this.box(px-2,py-4,6,1,"#deb568");
      this.box(px,py-h,3,h-3,"#334b4a");this.box(px,py-h,1,h-3,"#fae3a2");
      this.box(px-1,py-h-2,5,4,"#614f40");this.box(px,py-h-2,3,2,"#ffcd56");
      const top=py-h+3,fold=round(Math.sin(t*4)*2),color=goal?"#ffcc55":active?"#e64d3f":"#82a09c";
      this.line([[px+3,top],[px+19,top+2+fold],[px+14,top+6],[px+18,top+11+fold],[px+3,top+10]],"#3b4241");
      this.line([[px+3,top+1],[px+16,top+3+fold],[px+12,top+6],[px+15,top+9+fold],[px+3,top+9]],color);
      this.sparkle(px+7,top+5,"#fff4c6",2);
    }
    spring(s,cam){const x=round(s.x*T)-cam,y=round(s.y*T),h=s.pulse>0?5:9;if(x<-10||x>W+10)return;
      this.box(x-8,y-3,16,3,"#554550");this.box(x-6,y-4,12,2,"#e67443");
      for(let i=0;i<3;i++)this.box(x-4+(i%2)*2,y-h+2+i*1.4,7,1,"#fcdfad");
      this.box(x-8,y-h-1,16,3,"#854637");this.box(x-7,y-h-1,14,1,"#ffe386");
    }
    drawActors(game,cam){
      const now=game.time;
      for(const e of game.enemies){
        if(e.gone)continue;const x=e.x*T-cam,y=e.y*T;if(x<-30||x>W+30)continue;
        const step=(Math.floor(now*(e.shell?10:5)+e.pace)%2)+1;
        if(e.type==="wing"&&!e.shell){for(const dir of [-1,1]){
          const bx=x+dir*8,by=y-14-(step===1?2:0);this.box(bx-3,by-2,6,5,"#594b5d");this.box(bx-3,by-3,5,4,"#fff4cc");this.box(bx-4,by-4,2,2,"#fff4cc");
        }}
        if(e.shell)this.sprite("shell",x,y,16,13,e.dir>0);
        else if(e.type==="goomba")this.sprite("goomba-"+step,x,y,17,16,e.dir>0);
        else this.sprite("koopa-"+step,x,y,16,23,e.dir>0);
      }
      for(const m of game.items)this.sprite("mushroom",m.x*T-cam,m.y*T,15,15);
      const b=game.boss;
      if(b&&!game.bossDown && !(b.blink>0&&Math.floor(now*12)%2)){
        const bx=b.x*T-cam,by=b.y*T,stun=b.phase==="stunned",braced=b.phase==="brace";
        const run=b.phase==="charge",frame=Math.floor(now*(run?13:5))%2+1;
        const w=stun?42:39,h=stun?25:braced?32:38;
        this.sprite(["inhale","flame"].includes(b.phase)?"boss-fire":"boss-"+frame,bx+(braced?Math.sin(now*67):0),by,w,h,b.dir>0);
        if(stun)for(let i=0;i<3;i++)this.sparkle(bx+Math.cos(now*5+i*2.1)*12,by-h-4+Math.sin(now*5+i*2.1)*3,"#ffdf68",2);
        if(braced||b.phase==="inhale"){
          this.box(bx-2,by-h-12,4,9,"#342e39");this.box(bx-1,by-h-11,2,4,"#ffe784");this.box(bx-1,by-h-5,2,1,"#ffe784");
        }
        if(run)for(let j=0;j<3;j++)this.box(bx-b.dir*(19+j*4),by-4+(j%2),3,2,"#f1bd7d");
      }
      for(const f of game.flames)this.sprite("flame",f.x*T-cam,f.y*T+4+Math.sin(now*15+f.age),24,8,f.dir>0);
      const p=game.player;
      if(game.fallDelay<=0 && !(p.invuln>0&&Math.floor(now*13)%2===1)){
        const moving=Math.abs(p.vx)>.28;
        const name=!p.grounded?"mario-jump":moving?"mario-run"+(1+Math.floor(p.stride*1.8)%3):"mario-idle";
        this.sprite(name,p.x*T-cam,p.y*T,16,24,p.face<0);
      }
    }
    draw(game){
      const c=this.ctx,cam=round(game.camera*T),world=game.world,now=game.time;
      c.save();this.drawBackground(game);
      if(game.shake>0&&!this.reduce)c.translate(round(Math.sin(now*95)*game.shake*7),round(Math.cos(now*82)*game.shake*4));
      for(const m of game.movers){
        const x1=(m.x0+m.w/2)*T-cam,y1=m.y0*T+3,x2=x1+m.dx*T,y2=y1+m.dy*T;
        const n=Math.ceil(Math.hypot(x2-x1,y2-y1)/6);
        for(let i=0;i<=n;i++){const a=i/Math.max(1,n);this.box(x1+(x2-x1)*a,y1+(y2-y1)*a,2,2,"#f9e8afad")}
      }
      for(const r of game.solids){if(r.gone)continue;if(r.kind==="ground")this.ground(r,cam,world);else if(r.kind==="pipe")this.pipe(r,cam);else this.block(r,cam)}
      for(const p of [...game.platforms,...game.movers])this.platform(p,cam,world,now);
      for(const s of game.springs)this.spring(s,cam);
      for(const [x,y,w] of game.course.spikes)for(let i=0;i<w*T;i+=7){
        const a=x*T-cam+i,b=y*T;this.line([[a,b],[a+3,b-8],[a+7,b]],"#443d50");this.line([[a+2,b-1],[a+3,b-6],[a+5,b-1]],"#e4ddce");
      }
      this.flag(...game.course.checkpoint,cam,game.checkpoint,false,now);
      if(!game.boss||game.bossDown)this.flag(...game.course.goal,cam,true,true,now);
      for(const coin of game.coins){
        const x=coin.x*T-cam;if(coin.got||x<-7||x>W+7)continue;
        const f=Math.floor(now*5+coin.x*.15)%4,cy=coin.y*T+Math.sin(now*3+coin.x)*.7;
        this.sprite(f===0?"coin":"coin-"+(f+1),x,cy+6,[8,5,3,5][f],12);
      }
      for(const star of game.stars){
        const x=star.x*T-cam,y=star.y*T+Math.sin(now*3+star.id)*1.5;
        if(star.got||x<-18||x>W+18)continue;
        c.fillStyle="#fff3a32b";c.fillRect(round(x-10),round(y-9),20,18);
        this.sprite("star",x,y+8,16,17);this.sparkle(x+9*Math.cos(now*2),y-9*Math.sin(now*2),"#fff5c2",2);
      }
      this.drawActors(game,cam);
      for(const p of game.particles)this.box(p.x*T-cam,p.y*T,p.size,p.size,p.color);
      c.restore();
    }
  }
  window.ArcadeRenderer=ArcadeRenderer;
})();
