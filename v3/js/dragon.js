(() => {
  "use strict";

  const TILE = 16;
  const SADDLE = 8;
  const LIFT = SADDLE / TILE;
  const HALF = .36;
  const BODY = .82;
  const EMERGE_TIME = .44;
  const EDIBLE = new Map([
    ["goomba", .91], ["koopa", 1.27], ["wing", 1.27],
    ["spiny", .76], ["hammer", 1.39]
  ]);

  const buildArea = () => [];
  const mountedDragon = game => game.area?.dragons?.find(dragon => dragon.state === "ridden");
  const extraHeight = game => game.player.mounted ? LIFT : 0;
  const riderOffset = game => game.player.mounted ? SADDLE : 0;

  function spawn(game, block) {
    game.area.dragons.push({
      x:block.x + .5, y:block.y, birthY:block.y,
      dir:game.player.face || 1, vy:0, state:"emerging", emerge:EMERGE_TIME,
      settle:0, runFor:0, biteDelay:0, biteDisplay:0,
      grounded:true, surfaceKind:"block"
    });
    game.burst(block.x + .5, block.y - .2, ["#ffe6a3", "#e884eb", "#fff5df"], 8, .55);
    game.hint("金币砖藏着洞穴龙！从上方落到背上即可骑乘", 3.2);
  }

  function mount(game, dragon, floor) {
    const p = game.player;
    dragon.state = "ridden";
    dragon.biteDelay = .15;
    dragon.biteDisplay = 0;
    p.mounted = true;
    p.y = dragon.y;
    p.stand = floor?.object || null;
    p.grounded = Boolean(floor);
    p.vy = floor ? 0 : dragon.vy;
    p.coyote = floor ? .105 : 0;
    p.buffer = 0;
    p.springing = false;
    dragon.x = p.x;
    game.posture();
    game.sfx("powerup");
    game.hint("骑上洞穴龙！按 X 或吞怪键，咬住正前方的敌人", 3.1);
  }

  function dismount(game) {
    const p = game.player;
    const dragon = mountedDragon(game);
    if (dragon) {
      dragon.state = "idle";
      dragon.settle = .28;
      dragon.biteDisplay = 0;
    }
    if (p.mounted) {
      p.mounted = false;
      game.posture();
    }
    return dragon;
  }

  function restore(game, savedMount = true) {
    const dragon = mountedDragon(game);
    if (!savedMount || !dragon) {
      dismount(game);
      return;
    }
    const p = game.player;
    p.mounted = true;
    Object.assign(dragon, {
      x:p.x, y:p.y, dir:p.face, vy:0, biteDelay:.12, biteDisplay:0
    });
    game.posture();
  }

  function scatter(game) {
    if (!game.player.mounted) return false;
    const dragon = dismount(game);
    if (!dragon) return false;
    const p = game.player;
    Object.assign(dragon, {
      x:p.x, y:p.y, dir:Math.sign(p.vx) || p.face, vy:p.vy,
      state:"bolting", runFor:3, settle:.37, grounded:p.grounded
    });
    p.invuln = Math.max(p.invuln, game.mode.grace);
    p.vy = -4.8;
    p.grounded = false;
    p.stand = null;
    p.coyote = 0;
    p.climbing = null;
    game.burst(p.x, p.y - .75, ["#fff6bf", "#f0a95c", "#cb82d8"], 10);
    game.hint("洞穴龙吓跑了！追上后可再次跳到背上", 2.6);
    return true;
  }

  function moveOnTerrain(game, dragon, dt) {
    const oldX = dragon.x;
    const oldY = dragon.y;
    const wasGrounded = dragon.grounded;
    const ride = game.movers.find(platform => Math.abs(dragon.y - platform.y + platform.stepY) < .018 &&
      dragon.x + HALF > platform.x - platform.stepX &&
      dragon.x - HALF < platform.x - platform.stepX + platform.w);
    if (ride) {
      dragon.x += ride.stepX;
      dragon.y += ride.stepY;
    }
    const from = ride || (dragon.surfaceKind === "slope" ? {kind:"slope"} : null);
    if (dragon.state === "bolting") {
      const nextX = dragon.x + dragon.dir * (5.55 + game.mode.rank * .24) * dt;
      const pastEdge = nextX < HALF || nextX > game.course.width - HALF;
      const resolved = game.wall(nextX, dragon.x, dragon.y, BODY, HALF, from);
      dragon.x = Math.max(HALF, Math.min(game.course.width - HALF, resolved));
      if (pastEdge || Math.abs(nextX - resolved) > .001) dragon.dir *= -1;
    }
    dragon.vy = Math.min(20, dragon.vy + dt * 28);
    const nextY = dragon.y + dragon.vy * dt;
    const ground = dragon.vy >= 0
      ? game.support(dragon.x, HALF, ride ? dragon.y : oldY, nextY, oldX, wasGrounded, from)
      : null;
    dragon.y = ground ? ground.top : nextY;
    dragon.grounded = Boolean(ground);
    dragon.surfaceKind = ground?.object.kind || "";
    if (ground) dragon.vy = 0;
    if (dragon.y > 21) dragon.state = "gone";
  }

  function canMount(game, dragon, oldY) {
    const p = game.player;
    const seat = dragon.y - LIFT;
    if (p.climbing || p.vy < 0 || dragon.settle > 0 || Math.abs(p.x - dragon.x) >= .58 ||
      oldY > seat + .14 || p.y < seat - .04 || p.y > dragon.y + .17) return false;
    return !game.solids.some(s => !s.gone &&
      p.x + .38 > s.x + .003 && p.x - .38 < s.x + s.w - .003 &&
      dragon.y > s.y + .003 && dragon.y - (p.h + LIFT) < s.y + s.h - .003);
  }

  function biteBlocked(game, from, to, y) {
    const left = Math.min(from, to);
    const right = Math.max(from, to);
    if (game.solids.some(s => !s.gone && left < s.x + s.w - .005 && right > s.x + .005 &&
      y > s.y + .003 && y < s.y + s.h - .003)) return true;
    return game.slopes.some(s => {
      const a = Math.max(left, s.x);
      const b = Math.min(right, s.x + s.w);
      if (a >= b) return false;
      const surface = x => s.leftY + (s.rightY - s.leftY) * (x - s.x) / s.w;
      return y > Math.min(surface(a), surface(b)) + .025;
    });
  }

  function bite(game, dragon) {
    const p = game.player;
    dragon.biteDelay = .41;
    dragon.biteDisplay = .19;
    const mouth = p.y - .58;
    let target = null;
    let nearest = Infinity;
    for (const enemy of game.enemies) {
      const standingHeight = EDIBLE.get(enemy.type);
      if (!standingHeight || enemy.gone || enemy.shell === 2) continue;
      const h = enemy.shell ? .74 : standingHeight;
      const distance = p.face * (enemy.x - p.x);
      if (distance < .05 || distance > 1.54 || distance >= nearest) continue;
      if (mouth < enemy.y - h - .18 || mouth > enemy.y + .06) continue;
      if (biteBlocked(game, p.x, enemy.x, mouth)) continue;
      target = enemy;
      nearest = distance;
    }
    if (target) {
      game.defeat(target, target.type === "hammer" ? 400 : 200, target.x, target.y);
      game.burst(p.x + p.face * .7, mouth, ["#ffd681", "#fae4ff", "#bb79ca"], 6, .58);
    }
  }

  function update(game, dt, oldY) {
    const p = game.player;
    for (const dragon of game.area.dragons) {
      if (dragon.state === "gone") continue;
      if (dragon.state === "emerging") {
        dragon.emerge = Math.max(0, dragon.emerge - dt);
        if (!dragon.emerge) dragon.state = "idle";
        continue;
      }
      if (dragon.state === "ridden") {
        if (p.climbing) {
          dismount(game);
          continue;
        }
        Object.assign(dragon, {x:p.x, y:p.y, dir:p.face, vy:p.vy, grounded:p.grounded, surfaceKind:p.stand?.kind || ""});
        dragon.biteDelay = Math.max(0, dragon.biteDelay - dt);
        dragon.biteDisplay = Math.max(0, dragon.biteDisplay - dt);
        if (game.input.fire && !dragon.biteDelay) bite(game, dragon);
        continue;
      }
      dragon.settle = Math.max(0, dragon.settle - dt);
      if (dragon.state === "bolting") {
        dragon.runFor -= dt;
        if (dragon.runFor <= 0) dragon.state = "idle";
      }
      moveOnTerrain(game, dragon, dt);
      if (!p.mounted && dragon.state !== "gone" && canMount(game, dragon, oldY)) {
        const floor = dragon.grounded
          ? game.support(p.x, .39, dragon.y - .024, dragon.y + .04, dragon.x, true)
          : null;
        mount(game, dragon, floor);
      }
    }
  }

  function shape(renderer, dragon, moving, time, rider) {
    const rect = renderer.box.bind(renderer);
    const poly = renderer.line.bind(renderer);
    const ink = "#311c43";
    const violet = "#9c66ba";
    const lilac = "#d893ed";
    const gold = "#ffd286";
    const ember = "#e18558";
    const step = moving && Math.floor(time * 12) % 2 ? 2 : 0;
    const wingLift = rider?.grounded === false ? Math.floor(time * 12) % 2 * 3 : 0;
    poly([[-18,-10],[-12,-12],[-7,-7],[-1,-9],[-1,-4],[-9,-3],[-13,-5]],ink);
    poly([[-16,-9],[-12,-10],[-7,-5],[-3,-7],[-3,-5],[-9,-4]],violet);
    rect(-17,-11,3,3,ember);
    rect(-7,-5,5,5-step,ink);
    rect(2,-5,5,3+step,ink);
    rect(-6,-5,3,4-step,ember);
    rect(3,-4,3,2+step,gold);
    poly([[-8,-6],[-9,-11],[-4,-14],[3,-14],[8,-12],[11,-8],[7,-4],[-5,-4]],ink);
    poly([[-7,-6],[-7,-10],[-3,-13],[4,-13],[8,-10],[6,-5],[-4,-5]],violet);
    rect(1,-8,6,3,ember);
    rect(2,-9,5,2,gold);
    poly([[-8,-11],[-11,-18-wingLift],[-6,-16-wingLift],[-2,-17-wingLift],[1,-12],[-2,-8],[-5,-8]],ink);
    poly([[-7,-12],[-9,-16-wingLift],[-5,-14-wingLift],[-3,-15-wingLift],[-1,-12],[-4,-9]],lilac);
    rect(-4,-12,5,2,ember);
    rect(-3,-12,4,1,gold);
    poly([[4,-8],[3,-15],[6,-17],[7,-20],[10,-18],[11,-20],[13,-17],[15,-15],[15,-12],[17,-11],[17,-7],[12,-6],[8,-6]],ink);
    poly([[5,-9],[5,-15],[7,-16],[9,-17],[13,-16],[14,-13],[13,-11],[16,-10],[16,-8],[12,-7],[8,-7]],violet);
    rect(7,-17,2,2,ember);
    rect(10,-18,2,2,gold);
    rect(10,-15,2,3,"#fff6c4");
    rect(11,-14,1,2,ink);
    rect(13,-10,3,2,gold);
    if (dragon.biteDisplay > 0) {
      poly([[13,-11],[20,-13],[19,-9],[15,-8],[20,-8],[19,-5],[12,-6]],ink);
      rect(16,-11,3,1,gold);
      rect(17,-7,2,1,ember);
    }
    if (dragon.state === "bolting" && dragon.runFor > 2.42) {
      rect(0,-26,3,6,ink);
      rect(1,-26,1,4,"#ffec85");
      rect(1,-20,1,1,"#ffec85");
    }
  }

  function draw(renderer, game, camera) {
    for (const dragon of game.area.dragons) {
      if (dragon.state === "gone") continue;
      const rider = dragon.state === "ridden" ? game.player : null;
      const x = (rider?.x ?? dragon.x) * TILE - camera;
      if (x < -24 || x > renderer.canvas.width + 24) continue;
      const y = (rider?.y ?? dragon.y) * TILE;
      const ctx = renderer.ctx;
      ctx.save();
      if (dragon.state === "emerging") {
        const lip = dragon.birthY * TILE;
        ctx.beginPath();
        ctx.rect(x - 24, lip - 30, 48, 30);
        ctx.clip();
      }
      ctx.translate(Math.round(x), Math.round(y + dragon.emerge / EMERGE_TIME * 20));
      ctx.scale((rider?.face ?? dragon.dir) < 0 ? -1 : 1, 1);
      shape(renderer, dragon, dragon.state === "bolting" || Math.abs(rider?.vx || 0) > .28, game.time, rider);
      ctx.restore();
    }
  }

  window.ArcadeDragon = {buildArea, spawn, update, scatter, dismount, restore, draw, extraHeight, riderOffset};
})();
