(() => {
  "use strict";

  const TILE = 16;
  const VIEW_WIDTH = 480;
  const BOMB_HALF = .43;
  const BOMB_HEIGHT = .93;
  const BLAST_REACH = 1.68;
  const BLAST_HEIGHT = 1.46;
  const BLAST_DURATION = .34;
  const GHOST_HEIGHT = .95;
  const FIRE_COLORS = ["#ffcf74", "#ffeab7", "#f17343"];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function overlaps(x, y, width, height, targetX, targetY, targetWidth, targetHeight) {
    return Math.abs(x - targetX) < (width + targetWidth) / 2 &&
      y > targetY - targetHeight && y - height < targetY;
  }

  function buildArea(course, mode) {
    const bombs = (course.bombTurtles || [])
      .filter(([, , rank = 0]) => rank <= mode.rank)
      .map(([x, y], index) => ({
        x, y, homeX: x, dir: index % 2 ? 1 : -1, vy: 0,
        grounded: true, stand: null, state: "walk", fuse: 0,
        blast: 0, stride: 0, gone: false, trippedByWeapon: false,
      }));
    const flames = (course.ghostFlames || [])
      .filter(([, , , , , rank = 0]) => rank <= mode.rank)
      .map(([x, baseY, height, period, phase = 0]) => ({ x, baseY, height, period, phase }));
    return { bombs, flames };
  }

  function moveBomb(game, bomb, speed, dt) {
    const stand = bomb.stand;
    if (stand?.kind === "mover") {
      bomb.x += stand.stepX;
      bomb.y += stand.stepY;
    }
    const oldX = bomb.x;
    const oldY = bomb.y;
    const desired = clamp(oldX + bomb.dir * speed * dt, BOMB_HALF, game.course.width - BOMB_HALF);
    bomb.x = game.wall(desired, oldX, oldY, BOMB_HEIGHT, BOMB_HALF, stand);
    if (bomb.x !== desired) bomb.dir *= -1;
    bomb.stride += Math.abs(bomb.x - oldX);

    bomb.vy = Math.min(21, bomb.vy + 29 * dt);
    const nextY = oldY + bomb.vy * dt;
    const floor = game.support(bomb.x, .35, oldY, nextY, oldX, bomb.grounded, stand);
    bomb.grounded = Boolean(floor);
    bomb.stand = floor?.object || null;
    bomb.y = floor ? floor.top : nextY;
    if (floor) bomb.vy = 0;
    if (bomb.y > (game.theme === 3 ? 16.35 : 18.9)) bomb.gone = true;
  }

  function walkBomb(game, bomb, player, dt) {
    const dx = player.x - bomb.x;
    const hunting = Math.abs(dx) < 9.4 && Math.abs(player.y - bomb.y) < 2.55 &&
      game.onScreen(bomb.x, bomb.y - .48);
    if (hunting && Math.abs(dx) > .06) bomb.dir = Math.sign(dx);
    else if (bomb.x <= bomb.homeX - 1.6) bomb.dir = 1;
    else if (bomb.x >= bomb.homeX + 1.6) bomb.dir = -1;
    moveBomb(game, bomb, hunting ? 5.35 + .55 * game.mode.rank : 1.06, dt);
  }

  function lightFuse(game, bomb, duration, byWeapon = false) {
    if (bomb.state === "walk") {
      bomb.state = "fuse";
      bomb.fuse = duration;
      game.sfx("bump");
      game.burst(bomb.x, bomb.y - .92, FIRE_COLORS, 5, .52);
    } else {
      bomb.fuse = Math.min(bomb.fuse, duration);
    }
    if (byWeapon && !bomb.trippedByWeapon) {
      bomb.trippedByWeapon = true;
      game.award(300, bomb.x, bomb.y - 1.18);
    }
  }

  function inBlast(bomb, player) {
    const centerY = bomb.y - .38;
    const dx = (clamp(bomb.x, player.x - .35, player.x + .35) - bomb.x) / BLAST_REACH;
    const dy = (clamp(centerY, player.y - player.h, player.y) - centerY) / BLAST_HEIGHT;
    return dx * dx + dy * dy <= 1;
  }

  function explode(game, bomb) {
    bomb.state = "blast";
    bomb.blast = BLAST_DURATION;
    game.sfx("brick_smash");
    game.burst(bomb.x, bomb.y - .44, FIRE_COLORS, 17, 1.18);
    if (inBlast(bomb, game.player)) game.hit();
  }

  function checkWeapons(game, bomb) {
    const shot = game.fireballs.find(f => !f.gone &&
      overlaps(f.x, f.y + .2, .38, .4, bomb.x, bomb.y, BOMB_HALF * 2, BOMB_HEIGHT));
    if (shot) {
      shot.gone = true;
      game.burst(shot.x, shot.y, FIRE_COLORS, 5, .55);
      lightFuse(game, bomb, .28, true);
    }
    const struckByShell = game.enemies.some(shell => !shell.gone && shell.shell === 2 &&
      overlaps(shell.x, shell.y, .8, .74, bomb.x, bomb.y, BOMB_HALF * 2, BOMB_HEIGHT));
    if (struckByShell) lightFuse(game, bomb, .3, true);
    return Boolean(shot);
  }

  function updateBomb(game, bomb, dt, oldPlayerY) {
    if (bomb.gone) return false;
    if (bomb.state === "blast") {
      bomb.blast -= dt;
      if (bomb.blast <= 0) bomb.gone = true;
      return false;
    }
    const p = game.player;
    if (bomb.state === "walk") walkBomb(game, bomb, p, dt);
    else moveBomb(game, bomb, 0, dt);
    if (bomb.gone) return false;

    const touching = overlaps(p.x, p.y, .78, p.h, bomb.x, bomb.y, BOMB_HALF * 2, BOMB_HEIGHT);
    if (touching && game.starTime > 0) {
      game.defeat(bomb, 300, bomb.x, bomb.y);
      return false;
    }
    if (touching && p.vy >= 0 && !p.climbing && oldPlayerY <= bomb.y - BOMB_HEIGHT + .22) {
      game.bounceOn(bomb.y - BOMB_HEIGHT);
      lightFuse(game, bomb, .45);
    }
    const consumedShot = checkWeapons(game, bomb);
    if (bomb.state === "walk" && Math.abs(p.x - bomb.x) < 1.42 && Math.abs(p.y - bomb.y) < 1.24) {
      lightFuse(game, bomb, .83 - .09 * game.mode.rank);
    }
    if (bomb.state === "fuse") {
      bomb.fuse -= dt;
      if (bomb.fuse <= 0) explode(game, bomb);
    }
    return consumedShot;
  }

  function flamePose(flame, clock) {
    const cycle = ((clock + flame.phase) % flame.period + flame.period) % flame.period;
    const flight = flame.period * .72;
    const progress = Math.min(1, cycle / flight);
    // The center starts below the vent. Only the part above its lip can hurt Mario.
    const foot = flame.baseY + 1.01 - flame.height * 4 * progress * (1 - progress);
    const top = foot - GHOST_HEIGHT;
    const bottom = Math.min(foot, flame.baseY - .02);
    return {
      foot, height: Math.max(0, bottom - top), bottom,
      rising: progress < .5, warning: cycle >= flame.period - .38,
    };
  }

  function update(game, dt, oldPlayerY) {
    const { bombs, flames } = game.area.hazards;
    let consumedShot = false;
    for (const bomb of bombs) {
      if (updateBomb(game, bomb, dt, oldPlayerY)) consumedShot = true;
      if (game.state !== "playing") break;
    }
    if (consumedShot) game.fireballs = game.fireballs.filter(f => !f.gone);
    if (game.state !== "playing") return;
    const p = game.player;
    for (const flame of flames) {
      const pose = flamePose(flame, game.area.clock);
      if (pose.height > .2 && overlaps(p.x, p.y, .71, p.h, flame.x, pose.bottom, .64, pose.height)) game.hit();
    }
  }

  function drawBlast(renderer, x, y, remaining) {
    const progress = 1 - remaining / BLAST_DURATION;
    const spread = 10 + progress * 21;
    for (let i = 0; i < 11; i++) {
      const angle = i / 11 * Math.PI * 2;
      const xx = x + Math.cos(angle) * spread;
      const yy = y + Math.sin(angle) * spread * .73;
      renderer.box(xx - 3, yy - 2, 7, 4, i % 2 ? "#d85535" : "#f98a46");
      if (progress < .72) renderer.box(xx - 2, yy - 1, 4, 2, "#ffdf77");
    }
    if (progress < .55) renderer.sparkle(x, y, "#fff0b5", 5);
  }

  function drawBomb(renderer, bomb, cam, clock) {
    const x = bomb.x * TILE - cam;
    const y = bomb.y * TILE;
    if (bomb.gone || x < -42 || x > VIEW_WIDTH + 42) return;
    if (bomb.state === "blast") {
      drawBlast(renderer, x, y - 6, bomb.blast);
      return;
    }
    const lit = bomb.state === "fuse";
    const glow = lit && (renderer.reduce || Math.floor(bomb.fuse * 6) % 2 === 0);
    const feet = !lit && Math.floor(bomb.stride * 3) % 2;
    const dark = "#352736";
    if (lit) {
      const reach = BLAST_REACH * TILE;
      const edge = glow ? "#ffd078" : "#bf6144";
      renderer.box(x - reach, y + 2, 5, 1, edge);
      renderer.box(x + reach - 4, y + 2, 5, 1, edge);
      renderer.box(x - reach, y, 1, 3, edge);
      renderer.box(x + reach, y, 1, 3, edge);
    }
    const c = renderer.ctx;
    c.save();
    c.translate(Math.round(x), Math.round(y));
    c.scale(bomb.dir, 1);
    renderer.box(-8, -7, 17, 6, dark);
    renderer.box(-8, -6, 13, 3, "#986751");
    renderer.box(3, -10, 8, 8, dark);
    renderer.box(4, -9, 6, 5, "#d3a065");
    renderer.box(8, -8, 2, 2, "#47322e");
    renderer.box(-6, -3 - feet, 4, 3, dark);
    renderer.box(3, -3 + feet, 4, 2, dark);
    renderer.box(-7, -14, 11, 10, dark);
    renderer.box(-9, -12, 15, 6, dark);
    renderer.box(-6, -13, 9, 8, glow ? "#ef6c40" : "#4b5262");
    renderer.box(-7, -11, 12, 4, glow ? "#ef6c40" : "#585d6e");
    renderer.box(-5, -12, 4, 2, glow ? "#ffb16c" : "#9ea7af");
    renderer.box(-3, -16, 5, 2, dark);
    renderer.box(-2, -16, 3, 2, "#cc944f");
    if (lit) {
      const spark = renderer.reduce ? 0 : Math.floor(clock * 12) % 2;
      renderer.sparkle(0, -18 - spark, glow ? "#fff0ad" : "#ff8652", 2);
    }
    c.restore();
  }

  function drawFlame(renderer, flame, cam, clock) {
    const x = Math.round(flame.x * TILE - cam);
    if (x < -15 || x > VIEW_WIDTH + 15) return;
    const base = Math.round(flame.baseY * TILE);
    const pose = flamePose(flame, clock);
    if (pose.warning) {
      renderer.box(x - 7, base - 2, 15, 2, "#7269bd");
      renderer.sparkle(x, base - 5, "#a4eff4", 2);
    }
    if (pose.height <= 0) return;
    const y = Math.round(pose.foot * TILE);
    const c = renderer.ctx;
    c.save();
    c.beginPath();
    c.rect(x - 15, base - 200, 31, 200);
    c.clip();
    renderer.box(x - 6, y - 10, 13, 7, "#3b315f");
    renderer.box(x - 4, y - 13, 9, 13, "#3b315f");
    renderer.box(x - 1, y - 15, 3, 5, "#766ab5");
    renderer.box(x - 5, y - 10, 11, 6, "#558fc2");
    renderer.box(x - 3, y - 12, 7, 10, "#82d5e2");
    renderer.box(x - 2, y - 10, 5, 6, "#d7fff0");
    renderer.box(x - 3, y - 8, 2, 3, "#4a446c");
    renderer.box(x + 2, y - 8, 2, 3, "#4a446c");
    renderer.box(x - 1, y - 2, 3, 2, "#756ac0");
    if (!renderer.reduce && pose.rising) renderer.box(x + 1, y + 2, 2, 2, "#a4eff480");
    c.restore();
  }

  function draw(renderer, game, cam) {
    const { bombs, flames } = game.area.hazards;
    for (const flame of flames) drawFlame(renderer, flame, cam, game.area.clock);
    for (const bomb of bombs) drawBomb(renderer, bomb, cam, game.area.clock);
  }

  window.ArcadeHazards = { buildArea, update, draw };
})();
