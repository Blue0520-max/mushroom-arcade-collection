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
  const actorNames=["mario-idle","mario-run1","mario-run2","mario-run3","mario-jump","goomba-1","goomba-2","koopa-1","koopa-2","boss-1","boss-2","boss-fire","coin","coin-2","coin-3","coin-4","mushroom","question","brick","shell","flame","small-idle","small-run1","small-run2","small-run3","small-jump","small-duck","super-duck","fire-idle","fire-run1","fire-run2","fire-run3","fire-jump","fire-duck","fire-throw","fire-flower","fireball-1","fireball-2","plant-open","plant-closed","score-star","invincible-star","small-climb1","small-climb2","super-climb1","super-climb2","fire-climb1","fire-climb2","hammer-bro-1","hammer-bro-2","hammer-bro-throw","spiny-1","spiny-2","spiny-egg-1","spiny-egg-2","lakitu-1","lakitu-throw","hammer","bullet-bill","bullet-tower","bullet-tower-base","boss-jump"];
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
      const c=this.ctx,world=game.theme,img=pics["bg-"+sceneNames[world]];this.box(0,0,W,H,themes[world].sky);
      if(img?.naturalWidth){
        const bw=650,bh=Math.max(H,round(bw*img.naturalHeight/img.naturalWidth));
        const progress=game.camera/Math.max(1,game.course.width-30);
        const horizon=Math.max(0,[.15,.47,.55,.47][world]+game.cameraY*.022);
        c.drawImage(img,-round((bw-W)*progress),-round((bh-H)*horizon),bw,bh);
        this.box(0,0,W,H,["#e4efdc19","#24234635","#ffedce20","#4d293523"][world]);
      }
      if(world===3){
        const y=248-round(game.cameraY*T),t=game.time,off=round(game.camera*T*.6);
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
    ramp(r,cam,world){
      const left=round(r.x*T)-cam,right=round((r.x+r.w)*T)-cam;
      if(right<0||left>W)return;
      const t=themes[world],c=this.ctx,ya=round(r.leftY*T),yb=round(r.rightY*T),bottom=20*T;
      c.save();c.beginPath();c.moveTo(left,ya);c.lineTo(right,yb);c.lineTo(right,bottom);c.lineTo(left,bottom);c.closePath();c.clip();
      for(let a=left+Math.max(0,Math.floor(-left/64))*64;a<right&&a<W;a+=64)
        for(let b=Math.min(ya,yb);b<bottom;b+=32)c.drawImage(this.tiles[world],a,b);
      for(let x=Math.max(0,left);x<=Math.min(W,right);x+=2){
        const y=ya+(yb-ya)*(x-left)/(right-left);
        this.box(x,y,2,1,t.edge);this.box(x,y+1,2,2,t.top);this.box(x,y+3,2,3,t.moss);this.box(x,y+6,2,2,t.shade);
      }
      c.restore();
    }
    ceiling(r,cam,world){
      const x=round(r.x*T)-cam,y=round(r.y*T),w=round(r.w*T),h=round(r.h*T),t=themes[world],c=this.ctx;
      if(x>W||x+w<0)return;
      c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
      for(let a=0;a<w;a+=64)for(let b=0;b<h;b+=32)c.drawImage(this.tiles[world],x+a,y+b);
      this.box(x,y,w,2,t.top);this.box(x,y+h-2,w,2,t.edge);c.restore();
    }
    vine(v,cam){
      const [cx,top,bottom]=v,x=round(cx*T)-cam;if(x<-12||x>W+12)return;
      const y1=round(top*T),y2=round(bottom*T);
      this.box(x-1,y1,3,y2-y1,"#315b3e");this.box(x,y1,1,y2-y1,"#c0d464");
      for(let y=y1+3,i=0;y<y2-2;y+=6,i++){
        const side=i%2?1:-1;this.box(x+(side>0?1:-5),y,5,2,"#385b3b");this.box(x+(side>0?3:-7),y-2,5,3,"#65a45a");this.box(x+(side>0?5:-6),y-2,2,1,"#c3de7c");
      }
    }
    firebar(bar,time,cam){
      const [cx,cy,length,period,phase=0]=bar,x=round(cx*T)-cam,y=round(cy*T);
      if(x+length*T<0||x-length*T>W)return;
      const a=time*Math.PI*2/period+phase;
      this.box(x-4,y-4,8,8,"#4f3546");this.box(x-2,y-2,4,4,"#d6ac82");
      for(let d=.4;d<=length+.02;d+=.47){
        const xx=x+Math.cos(a)*d*T,yy=y+Math.sin(a)*d*T;
        this.box(xx-3,yy-2,6,4,"#b14035");this.box(xx-2,yy-3,4,6,"#ed702d");this.box(xx-1,yy-1,3,3,"#ffdc65");
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
      if(r.tag==="in"||r.tag==="back"||r.tag==="out"){
        const mid=x+w/2,signY=y+10,down=r.tag!=="out";
        this.box(mid-5,signY,11,10,"#24463c");this.box(mid-4,signY+1,9,8,"#f2d485");
        if(down){this.box(mid,signY+2,1,4,"#3c674b");this.line([[mid-3,signY+5],[mid+4,signY+5],[mid,signY+8]],"#3c674b")}
        else this.line([[mid-3,signY+6],[mid+4,signY+6],[mid,signY+2]],"#3c674b");
      }
    }
    block(r,cam){
      const y=r.y*T-(r.bump>0?Math.sin(r.bump/.18*Math.PI)*3:0),x=r.x*T-cam;
      if(x<-17||x>W)return;
      if(!r.used&&r.type==="dragon"){
        this.box(x,y,16,16,"#503346");
        this.box(x+1,y+1,14,14,"#dc9a43");this.box(x+2,y+2,12,1,"#ffe4a0");
        this.line([[x+7,y+4],[x+9,y+4],[x+11,y+8],[x+11,y+11],[x+9,y+13],[x+6,y+13],[x+4,y+11],[x+4,y+8]],"#faedcc");
        this.box(x+6,y+7,2,2,"#ab6394");this.box(x+8,y+10,2,2,"#ab6394");
        return;
      }
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
      if(p.kind==="mover"&&world===1&&Math.abs(p.dx)>8){
        this.line([[x-2,y+1],[x+w+2,y+1],[x+w-3,y+8],[x+w-10,y+14],[x+8,y+14],[x+2,y+9]],"#3b3949");
        this.line([[x+1,y+4],[x+w-1,y+4],[x+w-8,y+10],[x+7,y+10]],"#9b6859");
        this.box(x,y,w,3,"#edbd79");this.box(x+6,y+7,w-13,2,"#cb946c");
        for(let a=10;a<w-6;a+=13){this.box(x+a,y+5,2,2,"#f0c998");this.box(x+a,y+11,4,1,"#755454")}
        this.box(x+3,y-11,2,12,"#685261");this.box(x+3,y-12,7,2,"#d1a273");this.box(x+7,y-10,3,4,"#ffdf7b");
        this.box(x+2,y+15,9,1,"#a0e2e3");this.box(x+w-14,y+15,5,1,"#6cc9d8");return;
      }
      if(p.kind==="mover"){
        this.box(x,y,w,8,"#343242");this.box(x+1,y+1,w-2,2,"#ffe295");this.box(x+2,y+3,w-4,3,"#ad805e");
        for(let a=4;a<w-3;a+=10){this.box(x+a,y+3,3,3,"#5c555c");this.box(x+a,y+3,1,1,"#ffdb8a")}
        const mx=x+w/2;this.line([[mx-5,y+8],[mx+5,y+8],[mx,y+14]],world===1?"#79dcf0":"#e9bc76");
        this.box(mx-1,y+8,2,3,"#fff4ca");return;
      }
      if(["deck","dock","iron","canopy"].includes(p.kind)){
        const green=p.kind==="canopy",iron=p.kind==="iron";
        this.box(x,y,w,7,green?"#3d6745":iron?"#494657":"#6b4646");
        this.box(x+1,y+1,w-2,2,green?"#b9da79":iron?"#c5aa91":"#e1af75");
        for(let a=4;a<w-3;a+=12){this.box(x+a,y+3,green?7:2,3,green?"#76ac5c":iron?"#c68e62":"#a3735b");if(p.kind==="dock")this.box(x+a,y+7,3,5,"#73575b")}
        return;
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
    flag(x,y,cam,active,goal,t,tally=null){
      const px=round(x*T)-cam,py=round(y*T),h=goal?82:35;
      if(px<-25||px>W+6)return;
      this.box(px-3,py-4,8,4,"#3b4644");this.box(px-2,py-4,6,1,"#deb568");
      this.box(px,py-h,3,h-3,"#334b4a");this.box(px,py-h,1,h-3,"#fae3a2");
      this.box(px-1,py-h-2,5,4,"#614f40");this.box(px,py-h-2,3,2,"#ffcd56");
      const top=py-h+3+(tally?Math.min(1,tally.age/.72)*(h-16):0),fold=round(Math.sin(t*4)*2),color=goal?"#ffcc55":active?"#e64d3f":"#82a09c";
      this.line([[px+3,top],[px+19,top+2+fold],[px+14,top+6],[px+18,top+11+fold],[px+3,top+10]],"#3b4241");
      this.line([[px+3,top+1],[px+16,top+3+fold],[px+12,top+6],[px+15,top+9+fold],[px+3,top+9]],color);
      this.sparkle(px+7,top+5,"#fff4c6",2);
    }
    spring(s,cam){const x=round(s.x*T)-cam,y=round(s.y*T),h=s.pulse>0?5:9;if(x<-10||x>W+10)return;
      this.box(x-8,y-3,16,3,"#554550");this.box(x-6,y-4,12,2,"#e67443");
      for(let i=0;i<3;i++)this.box(x-4+(i%2)*2,y-h+2+i*1.4,7,1,"#fcdfad");
      this.box(x-8,y-h-1,16,3,"#854637");this.box(x-7,y-h-1,14,1,"#ffe386");
    }
    mechanics(game,cam){
      const t=game.area.clock;
      for(const [left,top,w,h,,drift] of game.course.winds||[]){
        const x=left*T-cam,y=top*T,width=w*T,height=h*T;
        if(x+width<0||x>W)continue;
        this.box(x,y,width,height,"#a7f5ed26");
        for(let lane=4;lane<width;lane+=15){
          const speed=this.reduce?0:t*31,offset=(lane*11+speed)%29;
          for(let j=height-offset;j>3;j-=29){
            const dx=x+lane+Math.sin(j*.07+t)*2+drift;
            this.box(dx,y+j,1,5,"#ecfff4a6");this.box(dx-2,y+j+2,1,2,"#e0fff0c0");this.box(dx+2,y+j+2,1,2,"#e0fff0c0");
          }
        }
      }
      for(const sw of game.switches){
        const x=round(sw.x*T)-cam,y=round(sw.y*T);
        if(x<-12||x>W+12)continue;
        const color=sw.on?"#a7f779":sw.id===1?"#ffc253":"#75dced";
        this.box(x-9,y-4,18,4,"#332f42");this.box(x-7,y-5,14,2,"#b4a899");
        const tipX=x+(sw.on?5:-5),tipY=y-(sw.on?6:14);
        this.line([[x-2,y-4],[x+1,y-4],[tipX+1,tipY],[tipX-1,tipY]],"#453546");
        this.box(tipX-3,tipY-2,6,5,"#392f3c");this.box(tipX-2,tipY-1,4,3,color);
        this.box(x-5,y-3,sw.id===1?3:2,2,color);if(sw.id===2)this.box(x-1,y-3,2,2,color);
      }
    }
    gate(r,cam){
      const x=round(r.x*T)-cam,w=round(r.w*T),y=round(r.y*T),bottom=round((r.y+r.h)*T);
      if(x+w<0||x>W)return;
      const color=r.id===1?"#eeb257":"#65c9da";
      if(r.gone){this.box(x,bottom-2,w,2,"#7bbe91");return}
      this.box(x,y,w,bottom-y,"#363747");this.box(x+1,y,3,bottom-y,color);this.box(x+w-3,y,2,bottom-y,"#afb1b2");
      for(let row=y+3;row<bottom-3;row+=12){
        this.box(x+4,row,w-8,8,"#646578");this.box(x+4,row,w-8,2,"#8d949c");
        this.box(x+w/2-3,row+3,2,3,color);if(r.id===2)this.box(x+w/2+1,row+3,2,3,color);
      }
    }
    cannon(r,cam){
      const x=round(r.x*T)-cam,w=round(r.w*T),y=round(r.y*T),h=round(r.h*T),cx=x+w/2;
      if(x+w+5<0||x-5>W)return;
      const head=Math.min(h,Math.max(20,Math.min(36,w*1.36)));
      for(let j=head;j<h;j+=14)this.sprite("bullet-tower-base",cx,y+Math.min(h,j+14),w,Math.min(14,h-j));
      this.sprite("bullet-tower",cx,y+head,w,head,r.aim<0);
      if(r.warning>0||r.flash>0){
        const muzzle=cx+r.aim*(w*.43),cy=y+10;
        this.sparkle(muzzle,cy,r.flash?"#fff4bf":"#ffb24d",r.flash?5:3);
        if(r.warning>.08)this.box(cx-2,y-5,4,3,"#ffe6a3");
      }
    }
    scenery(course,cam,t){
      for(const [left,right,top] of course.lakes||[]){
        const x=left*T-cam,w=(right-left)*T,y=top*T;if(x>W||x+w<0)continue;
        this.box(x,y,w,80,"#195979");this.box(x,y+2,w,3,"#61d2d7");this.box(x,y+8,w,4,"#287594");
        for(let a=0;a<w;a+=18){if(x+a< -18||x+a>W)continue;this.box(x+a,y+Math.round(Math.sin(t*3+a*.2)),8,2,"#9ee7dc");this.box(x+a+7,y+13,7,1,"#63c1ca")}
      }
      for(const [left,top,width] of course.vessels||[]){
        const x=left*T-cam,y=top*T,w=width*T;if(x>W+12||x+w< -12)continue;
        const depth=Math.min(39,17+w*.055),mast=x+w*.46;
        this.line([[x,y+2],[x+w,y+2],[x+w-9,y+15],[x+w-24,y+depth],[x+24,y+depth],[x+9,y+15]],"#533944");
        this.line([[x+3,y+5],[x+w-4,y+5],[x+w-16,y+21],[x+15,y+21]],"#aa6954");
        this.box(x+10,y+12,w-20,2,"#db9a67");this.box(x+24,y+depth-4,w-48,2,"#815a50");
        for(let a=17;a<w-13;a+=25){
          this.box(x+a,y+16,8,8,"#e0aa69");this.box(x+a+1,y+17,6,5,"#355160");this.box(x+a+2,y+17,2,2,"#86aaaf");
          this.box(x+a+10,y+6,9,1,"#ba8667");if(a<w-28)this.box(x+a+9,y+26,13,1,"#855d50");
        }
        this.box(mast-2,y-48,4,49,"#705252");this.box(mast-1,y-46,1,44,"#eec48a");
        this.line([[mast+1,y-44],[mast+26,y-34],[mast+34,y-18],[mast+3,y-20]],"#896463");
        this.line([[mast+3,y-41],[mast+24,y-33],[mast+30,y-21],[mast+3,y-23]],"#f0caa0");
        this.line([[mast+3,y-35],[mast+22,y-30],[mast+25,y-27],[mast+3,y-30]],"#bb6965");
        this.line([[mast+1,y-48],[mast+13,y-46],[mast+9,y-42],[mast+1,y-43]],"#a94952");
        for(const prop of [x+12,x+w-13]){
          const cy=y+depth-1,span=4+Math.abs(Math.sin(t*8+prop*.02))*6;
          this.box(prop-5,cy-3,10,7,"#725257");this.box(prop-2,cy-span,4,span*2,"#b49a7c");this.box(prop-1,cy-1,3,3,"#f1c77e");
        }
      }
      for(const [kind,tile,base] of course.landmarks||[]){
        const x=round(tile*T)-cam,y=round(base*T);if(x< -60||x>W+60)continue;
        if(kind==="orchard"){
          this.box(x-4,y-35,8,35,"#8c694c");this.box(x-2,y-32,3,30,"#b88a53");
          this.line([[x-26,y-34],[x-19,y-49],[x-7,y-49],[x-3,y-56],[x+13,y-52],[x+22,y-43],[x+19,y-29],[x-11,y-24]],"#52855a");
          this.box(x-14,y-46,10,4,"#83b368");for(const dx of [-12,6,14]){this.box(x+dx,y-37+dx%5,4,4,"#ed7950");this.box(x+dx,y-38+dx%5,2,1,"#f7ce79")}
        }else if(kind==="trellis"){
          for(const dx of [-22,21]){this.box(x+dx,y-30,4,30,"#9f7650");this.box(x+dx,y-29,1,28,"#d3a469")}
          for(let a=-23;a<=19;a+=7){this.box(x+a,y-34,8,4,"#987457");this.box(x+a+2,y-36,6,3,"#64a260");this.box(x+a+4,y-33,2,4,"#df9a79")}
        }else if(kind==="crane"||kind==="winch"){
          this.box(x-4,y-42,6,42,"#63586e");this.box(x-3,y-39,2,35,"#a29396");
          this.line([[x-6,y-40],[x+24,y-49],[x+26,y-45],[x-2,y-32]],"#9b8984");
          this.box(x+23,y-46,2,24,"#cab99b");this.box(x+19,y-24,6,3,"#8d817f");this.box(x+21,y-46,5,4,"#e6bf80");
          if(kind==="winch")for(let i=0;i<4;i++)this.box(x-9+i*5,y-16-i%2*2,4,5,"#aa9bc0");
        }else if(kind==="mail"||kind==="standard"){
          const castle=kind==="standard";
          this.box(x-2,y-35,4,35,castle?"#917273":"#a48162");this.box(x-3,y-37,6,3,"#e9c87e");
          if(castle){this.box(x+1,y-32,15,18,"#9e5054");this.line([[x+1,y-15],[x+16,y-15],[x+8,y-8]],"#9e5054");this.box(x+6,y-29,4,9,"#f1c77a")}
          else for(let i=0;i<4;i++)this.box(x+2+i*4,y-33+i%2,4,7-i,i%2?"#f7dda5":"#cc7561");
        }else if(kind==="furnace"){
          this.box(x-16,y-28,32,28,"#6f5157");this.box(x-12,y-33,24,7,"#8b6364");this.box(x-8,y-20,16,17,"#453944");
          this.box(x-6,y-13,12,9,"#d8764c");this.box(x-3,y-15,5,11,"#ffbe63");
          for(const a of [-10,0,10])this.box(x+a,y-22,2,19,"#705255");
        }
      }
    }
    drawActors(game,cam){
      const now=game.time;
      for(const e of game.enemies){
        if(e.gone)continue;const x=e.x*T-cam,y=e.y*T;if(x<-30||x>W+30)continue;
        const step=(Math.floor(now*(e.shell?10:5)+e.pace)%2)+1;
        if(e.type==="wing"&&!e.shell){for(const dir of [-1,1]){
          const bx=x+dir*8,by=y-14-(step===1?2:0);this.box(bx-3,by-2,6,5,"#594b5d");this.box(bx-3,by-3,5,4,"#fff4cc");this.box(bx-4,by-4,2,2,"#fff4cc");
        }}
        if(e.type==="hammer")this.sprite(e.warning?"hammer-bro-throw":"hammer-bro-"+step,x,y,22,25,(e.warning?e.aim:e.dir)<0);
        else if(e.type==="spiny")this.sprite("spiny-"+step,x,y,17,14,e.dir<0);
        else if(e.type==="lakitu")this.sprite(e.warning?"lakitu-throw":"lakitu-1",x,y,25,27,e.dir<0);
        else if(e.shell)this.sprite("shell",x,y,16,13,e.dir>0);
        else if(e.type==="goomba")this.sprite("goomba-"+step,x,y,17,16,e.dir>0);
        else this.sprite("koopa-"+step,x,y,16,23,e.dir>0);
      }
      for(const m of game.items)if(!m.got){
        const name=m.type==="flower"?"fire-flower":m.type==="invincible"?"invincible-star":"mushroom";
        const scale=Math.max(.16,1-m.emerge/.36),w=m.type==="invincible"?21:16,h=16*scale;
        this.sprite(name,m.x*T-cam,m.y*T,w,h);
      }
      for(const shot of game.foeShots){
        const x=shot.x*T-cam,y=shot.y*T;if(x< -16||x>W+16||shot.gone)continue;
        if(shot.type==="bullet"){
          this.box(x-shot.dir*10,y-1,4,2,"#fae1a2");this.sprite("bullet-bill",x,y+6,20,14,shot.dir<0);
        }else if(shot.type==="egg")this.sprite("spiny-egg-"+(1+Math.floor(shot.age*9)%2),x,y+6,13,13);
        else{const c=this.ctx;c.save();c.translate(round(x),round(y));c.rotate(shot.dir*Math.floor(shot.age*12)*Math.PI/4);this.sprite("hammer",0,6,13,13);c.restore()}
      }
      for(const f of game.fireballs)this.sprite("fireball-"+(Math.floor(now*13)%2+1),f.x*T-cam,f.y*T+4,9,9,f.dir<0);
      const b=game.boss;
      if(game.areaName==="main"&&b&&!game.bossDown && !(b.blink>0&&Math.floor(now*12)%2)){
        const bx=b.x*T-cam,by=b.y*T,stun=game.bossOpen(),braced=b.phase==="brace"||b.phase==="leapWarn";
        const run=b.phase==="charge",frame=Math.floor(now*(run?13:5))%2+1;
        const w=stun?42:39,h=stun?25:braced?32:38;
        if(b.phase==="leapWarn"||b.phase==="leap"){
          const mark=b.targetX*T-cam,ground=13*T;
          const glow=this.reduce||Math.floor(now*4)%2?"#fff3ad":"#f8bf63";
          this.line([[mark-20,ground-2],[mark-14,ground-5],[mark+14,ground-5],[mark+20,ground-2],[mark+13,ground],[mark-13,ground]],"#432e3c");
          this.box(mark-14,ground-4,8,2,glow);this.box(mark+6,ground-4,8,2,glow);
          this.line([[mark-6,ground-13],[mark+6,ground-13],[mark,ground-5]],"#432e3c");
          this.line([[mark-3,ground-12],[mark+4,ground-12],[mark,ground-8]],glow);
        }
        this.sprite(b.phase==="leap"?"boss-jump":["inhale","flame"].includes(b.phase)?"boss-fire":"boss-"+frame,bx+(braced?Math.sin(now*67):0),by,w,h,b.dir>0);
        if(stun)for(let i=0;i<3;i++)this.sparkle(bx+Math.cos(now*5+i*2.1)*12,by-h-4+Math.sin(now*5+i*2.1)*3,"#ffdf68",2);
        if(braced||b.phase==="inhale"){
          this.box(bx-2,by-h-12,4,9,"#342e39");this.box(bx-1,by-h-11,2,4,"#ffe784");this.box(bx-1,by-h-5,2,1,"#ffe784");
        }
        if(run)for(let j=0;j<3;j++)this.box(bx-b.dir*(19+j*4),by-4+(j%2),3,2,"#f1bd7d");
      }
      for(const f of game.flames)this.sprite("flame",f.x*T-cam,f.y*T+4+Math.sin(now*15+f.age),24,8,f.dir>0);
      window.ArcadeHazards.draw(this,game,cam);
      window.ArcadeDragon.draw(this,game,cam);
      const p=game.player;
      if(game.fallDelay>0||(p.invuln>0&&p.invuln<.7&&Math.floor(now*9)%2&&!game.pipeTrip))return;
      const sliding=game.state==="tally"&&game.tally.age<.68;
      const clinging=Boolean(p.climbing)||sliding;
      const moving=Math.abs(p.vx)>.28||(game.state==="tally"&&game.tally.age>=.68&&game.tally.age<1.4);
      const gripFrame=1+Math.floor(sliding?game.tally.age*8:p.stride*1.8)%2;
      const name=clinging?p.form+"-climb"+gripFrame:p.duck?(p.form==="super"?"super-duck":p.form+"-duck"):
        p.form==="fire"&&p.throwTime>0?"fire-throw":
        (p.form==="super"?"mario":p.form)+"-"+(!p.grounded&&!p.climbing?"jump":moving?"run"+(1+Math.floor(p.stride*1.8)%3):"idle");
      const w=name==="fire-throw"?27:p.form==="small"?15:17;
      const h=p.duck?(p.form==="small"?11:16):p.form==="small"?16:28;
      const px=p.x*T-cam,base=p.y*T-window.ArcadeDragon.riderOffset(game),trip=game.pipeTrip,c=this.ctx;
      let shift=0;c.save();
      if(trip&&trip.lip!==null){
        c.beginPath();c.rect(-50,-1500,W+100,1500+trip.lip*T);c.clip();
        shift=h*(trip.swapped?Math.max(0,1-(trip.age-.42)/.42):Math.min(1,trip.age/.40));
      }
      if(game.starTime>0){
        c.filter="hue-rotate("+Math.floor(now*5)*49+"deg) saturate(1.55) brightness(1.17)";
        this.sparkle(px+Math.sin(now*6)*11,base-h*.55+Math.cos(now*5)*8,"#fff2a0",2);
      }
      this.sprite(name,px-(clinging?5*p.face:0),base+shift,w,h,p.face<0);c.restore();
    }
    draw(game){
      const c=this.ctx,cam=round(game.camera*T),world=game.theme,now=game.time;
      c.save();this.drawBackground(game);c.translate(0,-round(game.cameraY*T));
      if(game.shake>0&&!this.reduce)c.translate(round(Math.sin(now*95)*game.shake*7),round(Math.cos(now*82)*game.shake*4));
      this.scenery(game.course,cam,now);this.mechanics(game,cam);
      for(const m of game.movers){
        const x1=(m.x0+m.w/2)*T-cam,y1=m.y0*T+3,x2=x1+m.dx*T,y2=y1+m.dy*T;
        const n=Math.ceil(Math.hypot(x2-x1,y2-y1)/6);
        for(let i=0;i<=n;i++){const a=i/Math.max(1,n);this.box(x1+(x2-x1)*a,y1+(y2-y1)*a,2,2,"#f9e8afad")}
      }
      for(const v of game.course.vines||[])this.vine(v,cam);
      for(const r of game.slopes)this.ramp(r,cam,world);
      for(const f of game.plants){
        if(f.gone||f.ext<=0)continue;
        const x=f.x*T-cam,lip=f.y*T;c.save();c.beginPath();c.rect(x-12,lip-32,24,32);c.clip();
        this.sprite(f.phase==="open"&&Math.floor(now*4)%2?"plant-open":"plant-closed",x,lip+25-f.ext*T,18,25);c.restore();
      }
      for(const r of game.solids){if(r.kind==="gate"){this.gate(r,cam);continue}if(r.gone)continue;if(r.kind==="ground")this.ground(r,cam,world);else if(r.kind==="pipe")this.pipe(r,cam);else if(r.kind==="cannon")this.cannon(r,cam);else if(r.kind==="ceiling")this.ceiling(r,cam,world);else this.block(r,cam)}
      for(const bar of game.course.firebars||[])this.firebar(bar,game.area.clock,cam);
      for(const p of [...game.platforms,...game.movers])this.platform(p,cam,world,now);
      for(const s of game.springs)this.spring(s,cam);
      for(const [x,y,w] of game.course.spikes)for(let i=0;i<w*T;i+=7){
        const a=x*T-cam+i,b=y*T;this.line([[a,b],[a+3,b-8],[a+7,b]],"#443d50");this.line([[a+2,b-1],[a+3,b-6],[a+5,b-1]],"#e4ddce");
      }
      if(game.areaName==="main"){
        game.checkpoints.forEach(([x,y],i)=>this.flag(x,y,cam,game.flagIndex>=i,false,now));
        if(!game.boss||game.bossDown)this.flag(...game.course.goal,cam,true,true,now,game.tally);
      }
      for(const coin of game.coins){
        const x=coin.x*T-cam;if(coin.got||x<-7||x>W+7)continue;
        const f=Math.floor(now*5+coin.x*.15)%4,cy=coin.y*T+Math.sin(now*3+coin.x)*.7;
        this.sprite(f===0?"coin":"coin-"+(f+1),x,cy+6,[8,5,3,5][f],12);
      }
      for(const star of game.stars){
        const x=star.x*T-cam,y=star.y*T+Math.sin(now*3+star.id)*1.5;
        if(star.got||x<-18||x>W+18)continue;
        c.fillStyle="#9aefff2b";c.fillRect(round(x-10),round(y-9),20,18);
        this.sprite("score-star",x,y+8,15,15);this.sparkle(x+9*Math.cos(now*2),y-9*Math.sin(now*2), "#b3efff",2);
      }
      this.drawActors(game,cam);
      for(const p of game.particles)this.box(p.x*T-cam,p.y*T,p.size,p.size,p.color);
      c.font="bold 9px monospace";c.textAlign="center";
      for(const l of game.labels){
        const x=round(l.x*T-cam),y=round(l.y*T);
        c.fillStyle="#342c40";c.fillText(l.text,x+1,y+1);c.fillStyle="#fff0a3";c.fillText(l.text,x,y);
      }
      c.restore();
      if(game.pipeTrip){
        const alpha=Math.max(0,1-Math.abs(game.pipeTrip.age-.42)/.18);
        if(alpha>0){c.fillStyle="rgba(24,34,44,"+alpha+")";c.fillRect(0,0,W,H)}
      }
    }
  }
  window.ArcadeRenderer=ArcadeRenderer;
})();
