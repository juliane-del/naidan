(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const startScreen = document.getElementById("startScreen");
  const resultScreen = document.getElementById("resultScreen");
  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");
  const jumpButton = document.getElementById("jumpButton");
  const chargeFill = document.getElementById("chargeFill");
  const distanceValue = document.getElementById("distanceValue");
  const bestValue = document.getElementById("bestValue");
  const finalDistance = document.getElementById("finalDistance");
  const finalBest = document.getElementById("finalBest");
  const resultTitle = document.getElementById("resultTitle");
  const resultStamp = document.getElementById("resultStamp");
  const resultMessage = document.getElementById("resultMessage");
  const statusText = document.getElementById("statusText");
  const runState = document.getElementById("runState");
  const liveHint = document.getElementById("liveHint");
  const soundToggle = document.getElementById("soundToggle");
  const soundLabel = document.getElementById("soundLabel");
  const stageFlash = document.getElementById("stageFlash");
  const jumpActionText = document.getElementById("jumpActionText");
  const jumpActionHint = document.getElementById("jumpActionHint");
  const mouseButton = document.getElementById("mouseButton");
  const frogButton = document.getElementById("frogButton");
  const formHelp = document.getElementById("formHelp");
  const eggMusic = document.getElementById("eggMusic");
  const mouseMusic = document.getElementById("mouseMusic");
  const frogMusic = document.getElementById("frogMusic");
  const embeddedAssets = window.__MILK_EGG_ASSETS__ || {};
  if (eggMusic && embeddedAssets.eggAudio && !eggMusic.getAttribute("src")) {
    eggMusic.src = embeddedAssets.eggAudio;
  }
  if (mouseMusic && embeddedAssets.mouseAudio && !mouseMusic.getAttribute("src")) {
    mouseMusic.src = embeddedAssets.mouseAudio;
  }
  if (frogMusic && embeddedAssets.frogAudio && !frogMusic.getAttribute("src")) {
    frogMusic.src = embeddedAssets.frogAudio;
  }

  const sprites = {
    egg: {
      image: new Image(),
      ready: false,
      path: embeddedAssets.egg || "assets/milk-egg-sprite.png",
    },
    mouse: {
      image: new Image(),
      ready: false,
      path: embeddedAssets.mouse || "assets/milk-mouse-sprite.png",
    },
    frog: {
      image: new Image(),
      ready: false,
      path: embeddedAssets.frog || "assets/milk-frog-sprite.png",
    },
  };
  for (const sprite of Object.values(sprites)) {
    sprite.image.addEventListener("load", () => {
      sprite.ready = true;
    });
    sprite.image.src = sprite.path;
  }

  const WORLD = {
    width: 960,
    height: 540,
    groundY: 430,
    heroX: 154,
    heroWidth: 48,
    heroHeight: 64,
    dangerLineY: 201,
    collisionDangerY: 203,
  };

  const PHYSICS = {
    gravityHeld: 500,
    gravityReleased: 1900,
    jumpVelocity: -560,
    maxHold: 0.28,
    coyoteTime: 0.1,
    jumpBuffer: 0.13,
  };

  const FORM_MOTION = {
    egg: { ...PHYSICS },
    mouse: {
      jumpVelocity: -590,
      gravityHeld: 580,
      gravityReleased: 1780,
      maxHold: 0.26,
      coyoteTime: 0.1,
      jumpBuffer: 0.13,
    },
    frog: {
      jumpVelocity: -520,
      gravityHeld: 390,
      gravityReleased: 1480,
      maxHold: 0.26,
      coyoteTime: 0.1,
      jumpBuffer: 0.13,
    },
  };

  const COLORS = {
    ink: "#17333a",
    deepInk: "#0a252c",
    cream: "#fff8df",
    yellow: "#ffd84e",
    yellowDark: "#e7a81e",
    coral: "#ff6c52",
    mint: "#8bd9b3",
  };

  const state = {
    mode: "ready",
    previousTime: performance.now(),
    elapsed: 0,
    cameraX: 0,
    speed: 250,
    distance: 0,
    best: readBest(),
    shake: 0,
    deathReason: "",
    deathTimer: 0,
    shattered: false,
    flashTimer: 0,
    nextMilestone: 100,
    lastUiDistance: -1,
    soundEnabled: true,
    musicMode: "egg",
    hintKey: "",
  };

  const player = {
    x: WORLD.heroX,
    y: WORLD.groundY - WORLD.heroHeight,
    vy: 0,
    width: WORLD.heroWidth,
    height: WORLD.heroHeight,
    grounded: true,
    coyote: PHYSICS.coyoteTime,
    jumpBuffer: 0,
    jumpHeld: false,
    jumpTime: 0,
    rotation: 0,
    squash: 1,
    blinkTimer: 2.4,
    idleTime: 0,
    form: "egg",
    formTimer: 0,
    transformTimer: 0,
  };

  const world = {
    segments: [],
    spikes: [],
    lastEnd: 0,
    nextId: 0,
  };

  const particles = [];
  const floaters = [];
  let soundEngine = null;
  let lastFrameTime = performance.now();

  function readBest() {
    try {
      const saved = Number(window.localStorage.getItem("bouncyEggBest"));
      return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
    } catch (error) {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      window.localStorage.setItem("bouncyEggBest", String(value));
    } catch (error) {
      // 本地文件或隐私模式可能禁止存储；游戏依然可以正常运行。
    }
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  }

  function roundedRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function resetWorld() {
    world.segments = [{ start: 0, end: 1020, id: 0, decorationSeed: 7 }];
    world.spikes = [{ x: 690, width: 54, height: 33 }];
    world.lastEnd = 1020;
    world.nextId = 1;
    state.cameraX = 0;
    state.elapsed = 0;
    state.speed = 250;
    state.distance = 0;
    state.shake = 0;
    state.deathReason = "";
    state.deathTimer = 0;
    state.shattered = false;
    state.flashTimer = 0;
    state.nextMilestone = 100;
    state.lastUiDistance = -1;
    state.hintKey = "";

    Object.assign(player, {
      y: WORLD.groundY - WORLD.heroHeight,
      vy: 0,
      grounded: true,
      coyote: PHYSICS.coyoteTime,
      jumpBuffer: 0,
      jumpHeld: false,
      jumpTime: 0,
      rotation: 0,
      squash: 1,
      blinkTimer: 2.4,
      idleTime: 0,
      form: "egg",
      formTimer: 0,
      transformTimer: 0,
    });

    particles.length = 0;
    floaters.length = 0;
    ensureWorld();
    updateJumpUi(0, false);
    setHazardPrompt("reset", "egg");
    updateFormButtons();
    renderDistance(0);
  }

  function ensureWorld() {
    while (world.lastEnd < state.cameraX + WORLD.width + 900) {
      const difficulty = clamp(state.cameraX / 19000, 0, 1);
      const gap = random(112, 138 + difficulty * 20);
      const platformWidth = random(340, 500);
      const start = world.lastEnd + gap;
      const end = start + platformWidth;
      const id = world.nextId++;
      const decorationSeed = id * 73 + Math.floor(start);

      world.segments.push({ start, end, id, decorationSeed });

      if (Math.random() < 0.53 + difficulty * 0.25 && platformWidth > 330) {
        const spikeX = random(start + 132, end - 82);
        world.spikes.push({
          x: spikeX,
          width: random(46, 59),
          height: random(31, 37),
        });
      }

      world.lastEnd = end;
    }

    world.segments = world.segments.filter((segment) => segment.end > state.cameraX - 500);
    world.spikes = world.spikes.filter((spike) => spike.x > state.cameraX - 180);
  }

  function startGame() {
    resetWorld();
    state.mode = "running";
    startScreen.classList.remove("is-visible");
    resultScreen.classList.remove("is-visible");
    resultScreen.setAttribute("aria-hidden", "true");
    runState.classList.add("is-running");
    runState.classList.remove("is-danger");
    statusText.textContent = "奶蛋奔跑中";
    liveHint.textContent = "尖刺前变奶鼠，空隙前变奶蛙。先变身，再跳跃。";
    ensureAudio();
    setMusicMode("egg", true);
    updateFormButtons();
    playSound("start");
  }

  function activeMusic() {
    if (state.musicMode === "frog") {
      return frogMusic;
    }
    if (state.musicMode === "mouse") {
      return mouseMusic;
    }
    return eggMusic;
  }

  function playAudio(audio) {
    if (!audio || !state.soundEnabled) {
      return;
    }
    try {
      audio.muted = false;
      const playback = audio.play();
      playback?.catch(() => {
        // 浏览器若因自动播放策略拒绝播放，用户第一次操作时会再次尝试。
      });
    } catch (error) {
      // 音频加载失败不应阻断游戏运行。
    }
  }

  function setMusicMode(mode, restart = false) {
    if (!eggMusic || !mouseMusic || !frogMusic) {
      return;
    }

    state.musicMode = mode;
    if (mode === "frog") {
      eggMusic.volume = 0;
      mouseMusic.volume = 0;
      try {
        eggMusic.pause();
        mouseMusic.pause();
      } catch (error) {
        // 忽略音频元素尚未初始化时的暂停错误。
      }
      try {
        if (frogMusic.readyState === 0) {
          frogMusic.load();
        }
      } catch (error) {
        // 某些浏览器在元数据加载前不允许显式 load。
      }
      frogMusic.volume = 0.68;
      frogMusic.muted = !state.soundEnabled;
      if (restart || frogMusic.ended) {
        try {
          frogMusic.pause();
          frogMusic.currentTime = 0;
        } catch (error) {
          // 音频元数据尚未就绪时忽略复位错误。
        }
      }
      playAudio(frogMusic);
      return;
    }

    try {
      frogMusic.pause();
    } catch (error) {
      // 忽略音频元素尚未初始化时的暂停错误。
    }
    frogMusic.volume = 0;
    const active = mode === "mouse" ? mouseMusic : eggMusic;
    const inactive = mode === "mouse" ? eggMusic : mouseMusic;
    inactive.volume = 0;
    try {
      inactive.pause();
      frogMusic.pause();
    } catch (error) {
      // 切换形态时允许暂停失败。
    }
    active.volume = 0.4;
    active.muted = !state.soundEnabled;
    if (restart) {
      try {
        active.currentTime = 0;
      } catch (error) {
        // 音频元数据尚未就绪时忽略复位错误。
      }
    }
    playAudio(active);
  }

  function requestJump() {
    if (state.mode === "ready") {
      startGame();
      return;
    }

    if (state.mode === "gameover") {
      startGame();
      return;
    }

    if (state.mode !== "running") {
      return;
    }

    player.jumpHeld = true;
    player.jumpBuffer = PHYSICS.jumpBuffer;
    jumpButton.classList.add("is-pressed");
    if (activeMusic()?.paused && state.soundEnabled) {
      playAudio(activeMusic());
    }
  }

  function releaseJump() {
    player.jumpHeld = false;
    jumpButton.classList.remove("is-pressed");
  }

  function upcomingHazard(worldX, range = 190) {
    const platform = platformAt(worldX);
    const frontX = worldX + player.width / 2;
    const gapDistance = platform ? platform.end - frontX : Number.POSITIVE_INFINITY;
    let blockDistance = Number.POSITIVE_INFINITY;

    for (const spike of world.spikes) {
      const distance = spike.x - spike.width / 2 - frontX;
      if (distance >= -4 && distance < blockDistance) {
        blockDistance = distance;
      }
    }

    if (blockDistance <= range && blockDistance <= gapDistance) {
      return { form: "mouse", type: "spike" };
    }
    if (gapDistance <= range) {
      return { form: "frog", type: "gap" };
    }
    return { form: "egg", type: "none" };
  }

  function setPlayerForm(form, animate = false) {
    // 用户主动选择形态时取消上一次落地后的自动恢复计时。
    player.formTimer = 0;
    if (player.form === form) {
      updateFormButtons();
      return;
    }

    player.form = form;
    player.transformTimer = animate ? 0.24 : 0;
    if (animate) {
      const formNames = { mouse: "奶鼠变身！", frog: "奶蛙变身！" };
      addFloater(formNames[form] || "", WORLD.heroX + 16, player.y - 22, COLORS.cream);
    }
    if (form === "frog") {
      setMusicMode("frog", true);
    } else if (form === "mouse") {
      setMusicMode("mouse");
    } else {
      setMusicMode("egg");
    }
    state.hintKey = "";
    updateFormButtons();
  }

  function updateFormButtons() {
    if (!mouseButton || !frogButton) {
      return;
    }
    const canTransform = state.mode === "running" && player.grounded;
    mouseButton.disabled = !canTransform;
    frogButton.disabled = !canTransform;
    mouseButton.setAttribute("aria-pressed", String(player.form === "mouse"));
    frogButton.setAttribute("aria-pressed", String(player.form === "frog"));
    jumpButton.classList.toggle("is-form-mouse", player.form === "mouse");
    jumpButton.classList.toggle("is-form-frog", player.form === "frog");

    if (formHelp) {
      formHelp.textContent =
        player.form === "mouse"
          ? "奶鼠 BGM 已切换，点击跳跃越过尖刺。"
          : player.form === "frog"
            ? "捧腹大笑 BGM 已切换，点击跳跃越过空隙。"
            : "先点变身，再点跳跃。落地后恢复奶蛋。";
    }
  }

  function chooseForm(form) {
    if (state.mode !== "running" || !player.grounded) {
      return;
    }
    ensureAudio();
    setPlayerForm(form, true);
    statusText.textContent = form === "mouse" ? "奶鼠待命" : "奶蛙待命";
    state.hintKey = "";
  }

  function setHazardPrompt(key, targetForm, message) {
    if (state.hintKey === key) {
      return;
    }
    state.hintKey = key;

    mouseButton.classList.toggle("is-needed", targetForm === "mouse" && player.form !== "mouse");
    frogButton.classList.toggle("is-needed", targetForm === "frog" && player.form !== "frog");

    if (!player.grounded && player.form === "mouse") {
      jumpActionText.textContent = "奶鼠跳跃";
      jumpActionHint.textContent = "越过尖刺！";
    } else if (!player.grounded && player.form === "frog") {
      jumpActionText.textContent = "奶蛙跳跃";
      jumpActionHint.textContent = "飞跃空隙！";
    } else if (targetForm === "mouse" && player.form === "mouse") {
      jumpActionText.textContent = "奶鼠跳跃";
      jumpActionHint.textContent = "已变身 · 点击跳跃";
    } else if (targetForm === "frog" && player.form === "frog") {
      jumpActionText.textContent = "奶蛙跳跃";
      jumpActionHint.textContent = "已变身 · 点击跳跃";
    } else if (player.form === "mouse") {
      jumpActionText.textContent = "奶鼠跳跃";
      jumpActionHint.textContent = "点击跳跃 / 长按蓄力";
    } else if (player.form === "frog") {
      jumpActionText.textContent = "奶蛙跳跃";
      jumpActionHint.textContent = "点击跳跃 / 长按蓄力";
    } else {
      jumpActionText.textContent = "跳跃";
      jumpActionHint.textContent = "先变身，再跳跃";
    }

    if (message && state.mode === "running") {
      liveHint.textContent = message;
    }
  }

  function updateHazardPrompt(worldX) {
    const hazard = upcomingHazard(worldX);
    if (!player.grounded && player.form === "mouse") {
      setHazardPrompt("air-mouse", "", "奶鼠加速！准备越过尖刺。");
    } else if (!player.grounded && player.form === "frog") {
      setHazardPrompt("air-frog", "", "奶蛙起飞！越过前方空隙。");
    } else if (hazard.form === "mouse") {
      setHazardPrompt("target-mouse", "mouse", "尖刺！先点变身奶鼠，再跳过它。");
    } else if (hazard.form === "frog") {
      setHazardPrompt("target-frog", "frog", "空隙！先点变身奶蛙，再跳过去。");
    } else {
      setHazardPrompt("idle", "egg", "尖刺前变奶鼠，空隙前变奶蛙。");
    }
  }

  function launchJump(worldX) {
    const motion = FORM_MOTION[player.form] || PHYSICS;

    player.grounded = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    player.jumpTime = 0;
    player.vy = motion.jumpVelocity;
    player.squash = 0.82;
    statusText.textContent =
      player.form === "mouse" ? "奶鼠起跳！" : player.form === "frog" ? "奶蛙飞跃！" : "奶蛋奔跑中";
    const jumpSound = player.form === "mouse" ? "mouseJump" : player.form === "frog" ? "frogJump" : "jump";
    if (soundEngine && typeof soundEngine[jumpSound] === "function") {
      soundEngine[jumpSound]();
    }
    updateFormButtons();
  }

  function platformAt(worldX, inset = 9) {
    return world.segments.find(
      (segment) => worldX + player.width / 2 - inset > segment.start && worldX - player.width / 2 + inset < segment.end,
    );
  }

  function updateGame(dt) {
    state.elapsed += dt;
    state.speed = 250 + Math.min(82, state.elapsed * 2.35);
    state.cameraX += state.speed * dt;
    state.distance = Math.floor(state.cameraX / 30);
    ensureWorld();

    player.transformTimer = Math.max(0, player.transformTimer - dt);
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
    player.blinkTimer -= dt;
    if (player.blinkTimer < -0.12) {
      player.blinkTimer = random(2.2, 4.3);
    }

    const worldX = state.cameraX + player.x;
    const isOverPlatform = Boolean(platformAt(worldX));

    if (player.grounded && !isOverPlatform) {
      player.grounded = false;
      player.coyote = PHYSICS.coyoteTime;
    }

    if (player.grounded) {
      player.coyote = PHYSICS.coyoteTime;
      player.y = WORLD.groundY - player.height;
      player.vy = 0;
    } else {
      player.coyote = Math.max(0, player.coyote - dt);
    }

    if ((player.grounded || player.coyote > 0) && player.jumpBuffer > 0) {
      launchJump(worldX);
    }

    if (!player.grounded) {
      const motion = FORM_MOTION[player.form] || PHYSICS;
      const holding = player.jumpHeld && player.jumpTime < motion.maxHold && player.vy < 0;
      player.vy += (holding ? motion.gravityHeld : motion.gravityReleased) * dt;
      player.jumpTime += dt;

      const previousBottom = player.y + player.height;
      player.y += player.vy * dt;
      const bottom = player.y + player.height;

      if (
        player.vy > 0 &&
        previousBottom <= WORLD.groundY + 5 &&
        bottom >= WORLD.groundY &&
        platformAt(worldX)
      ) {
        player.y = WORLD.groundY - player.height;
        player.vy = 0;
        player.grounded = true;
        player.coyote = PHYSICS.coyoteTime;
        player.jumpTime = 0;
        player.squash = 0.2;
        player.formTimer = 0.24;
        soundEngine?.land();
      }
    }

    player.squash = Math.min(1, player.squash + dt * 4.2);
    if (player.grounded && player.formTimer > 0) {
      player.formTimer -= dt;
      if (player.formTimer <= 0) {
        setPlayerForm("egg");
        if (state.mode === "running") {
          statusText.textContent = "奶蛋奔跑中";
        }
      }
    }

    if (!isOverPlatform && !player.grounded && player.form !== "frog") {
      loseGame("gap");
      return;
    }

    if (player.y < WORLD.collisionDangerY) {
      loseGame("sky");
      return;
    }

    if (hitsSpike(worldX)) {
      loseGame("spike");
      return;
    }

    if (player.y > WORLD.height + 70) {
      loseGame("gap");
      return;
    }

    if (state.distance >= state.nextMilestone) {
      addFloater(`${state.nextMilestone} m · 还活着！`, WORLD.heroX + 25, player.y - 26, COLORS.cream);
      state.nextMilestone += 100;
    }

    updateHazardPrompt(worldX);
    updateFormButtons();
    updateJumpUi(player.jumpTime, player.jumpHeld && !player.grounded);
    renderDistance(state.distance);
  }

  function hitsSpike(worldX) {
    const left = worldX - player.width / 2 + 8;
    const right = worldX + player.width / 2 - 8;
    const top = player.y + 7;
    const bottom = player.y + player.height;

    return world.spikes.some((spike) => {
      const spikeLeft = spike.x - spike.width / 2 + 4;
      const spikeRight = spike.x + spike.width / 2 - 4;
      const horizontallyOverlapping = right > spikeLeft && left < spikeRight;
      const spikeTop = WORLD.groundY - spike.height + 7;
      if (horizontallyOverlapping && player.form !== "mouse") {
        return true;
      }
      return horizontallyOverlapping && bottom > spikeTop && top < WORLD.groundY;
    });
  }

  function updateDying(dt) {
    state.deathTimer += dt;

    if (state.deathReason === "gap") {
      player.vy += 1250 * dt;
      player.y += player.vy * dt;
      player.rotation += dt * 5.2;
    } else if (state.deathReason === "sky") {
      player.vy += 800 * dt;
      player.y += player.vy * dt;
    }

    if (!state.shattered && state.deathReason !== "gap" && state.deathTimer > 0.11) {
      state.shattered = true;
      createEggBurst();
      soundEngine?.shatter();
    }

    if (state.deathTimer > (state.deathReason === "gap" ? 0.78 : 1.02)) {
      showResult();
    }
  }

  function loseGame(reason) {
    if (state.mode !== "running") {
      return;
    }

    state.mode = "dying";
    state.deathReason = reason;
    state.deathTimer = 0;
    state.shattered = false;
    player.jumpHeld = false;
    player.jumpBuffer = 0;
    player.jumpTime = 0;
    updateJumpUi(0, false);
    mouseButton.classList.remove("is-needed");
    frogButton.classList.remove("is-needed");
    updateFormButtons();
    runState.classList.remove("is-running");
    runState.classList.add("is-danger");
    statusText.textContent = "奶蛋告急";

    if (reason === "gap") {
      player.grounded = false;
      player.vy = Math.max(player.vy, 70);
      liveHint.textContent =
        player.form === "frog" ? "奶蛙已经尽力了，下一次更早变身。" : "空隙前记得点击变身奶蛙。";
    } else if (reason === "spike") {
      state.shake = 13;
      liveHint.textContent = "被尖刺扎到了，下次记得先变成奶鼠。";
      flashStage();
    } else {
      state.shake = 10;
      liveHint.textContent = "飞得太高，脑袋撞醒了。";
      flashStage();
    }
  }

  function flashStage() {
    stageFlash.classList.remove("is-hit");
    void stageFlash.offsetWidth;
    stageFlash.classList.add("is-hit");
  }

  function showResult() {
    if (state.mode === "gameover") {
      return;
    }

    state.mode = "gameover";
    const finalScore = state.distance;
    if (finalScore > state.best) {
      state.best = finalScore;
      saveBest(state.best);
      resultStamp.textContent = "NEW BEST · 新纪录";
    } else {
      resultStamp.textContent = "RUN ENDED";
    }

    const outcomes = {
      spike: {
        title: "被尖刺扎到了",
        message: "尖刺前要先点“变身奶鼠”，再点跳跃。顺序不能反。",
      },
      sky: {
        title: "飞得太高啦",
        message: "奶蛋抱着雪球冲进了高空警戒线。够远就够了。",
      },
      gap: {
        title: "奶蛙没跳过去",
        message: "空隙前要先点“变身奶蛙”，再点跳跃。下次记得按顺序来。",
      },
    };
    const outcome = outcomes[state.deathReason] || outcomes.gap;
    resultTitle.textContent = outcome.title;
    resultMessage.textContent = outcome.message;
    finalDistance.textContent = String(finalScore);
    finalBest.textContent = String(state.best);
    bestValue.textContent = String(state.best);
    renderDistance(finalScore);
    setMusicMode("egg");
    resultScreen.classList.add("is-visible");
    resultScreen.setAttribute("aria-hidden", "false");
    statusText.textContent = "本次旅程结束";
    restartButton.focus({ preventScroll: true });
  }

  function renderDistance(value) {
    if (value === state.lastUiDistance) {
      return;
    }
    state.lastUiDistance = value;
    distanceValue.textContent = String(value);
  }

  function updateJumpUi(time, active) {
    const fraction = clamp(time / PHYSICS.maxHold, 0, 1);
    chargeFill.style.width = `${Math.round(fraction * 100)}%`;
    jumpButton.classList.toggle("is-charging", active);
    jumpButton.classList.toggle("is-warning", active && fraction > 0.73);
  }

  function updateParticles(dt) {
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.life -= dt;
      if (particle.life <= 0) {
        particles.splice(index, 1);
        continue;
      }

      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.rotation += particle.spin * dt;
      particle.vx *= Math.pow(0.16, dt);
    }

    for (let index = floaters.length - 1; index >= 0; index -= 1) {
      const floater = floaters[index];
      floater.life -= dt;
      floater.y -= 24 * dt;
      if (floater.life <= 0) {
        floaters.splice(index, 1);
      }
    }
  }

  function createEggBurst() {
    const originX = WORLD.heroX;
    const originY = clamp(player.y + player.height / 2, 145, WORLD.groundY - 20);

    for (let index = 0; index < 27; index += 1) {
      const angle = random(-Math.PI, 0.2);
      const speed = random(90, 330);
      particles.push({
        type: index % 4 === 0 ? "yolk" : "shell",
        x: originX + random(-17, 17),
        y: originY + random(-18, 18),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - random(20, 120),
        gravity: 680,
        rotation: random(0, Math.PI * 2),
        spin: random(-8, 8),
        size: random(5, 14),
        color: index % 4 === 0 ? "#ffb629" : index % 2 === 0 ? "#ffe36e" : "#fff2b0",
        life: random(0.7, 1.35),
        maxLife: 1.35,
      });
    }

    addFloater(state.deathReason === "spike" ? "咔！" : "啪！", originX + 26, originY - 35, COLORS.cream);
  }

  function addFloater(text, x, y, color) {
    floaters.push({ text, x, y, color, life: 1.1, maxLife: 1.1 });
  }

  function draw() {
    const now = performance.now();
    const idlePulse = Math.sin(now / 530);
    state.shake *= 0.84;

    ctx.clearRect(0, 0, WORLD.width, WORLD.height);
    ctx.save();
    if (state.shake > 0.5) {
      ctx.translate(random(-state.shake, state.shake), random(-state.shake, state.shake));
    }

    drawSky();
    drawFarLandscape();
    drawDangerZone(now);
    drawAbyss();
    drawPlatforms();
    drawSpikes();
    drawParticles();

    if (state.mode === "ready") {
      drawReadyEgg(idlePulse);
    } else if (state.mode === "running") {
      drawRunningEgg(idlePulse);
    } else if (state.mode === "dying" || state.mode === "gameover") {
      if (state.deathReason === "gap" || !state.shattered) {
        drawDyingEgg();
      }
    }

    if (state.mode === "running" && player.form !== "egg") {
      drawFormBadge();
    }
    drawFloaters();
    drawTopAtmosphere(now);
    ctx.restore();
  }

  function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, WORLD.groundY);
    sky.addColorStop(0, "#8fd4ce");
    sky.addColorStop(0.47, "#ccebda");
    sky.addColorStop(0.75, "#f7df9e");
    sky.addColorStop(1, "#f4ba67");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WORLD.width, WORLD.groundY);

    const halo = ctx.createRadialGradient(790, 286, 8, 790, 286, 150);
    halo.addColorStop(0, "rgba(255, 240, 155, 0.86)");
    halo.addColorStop(0.46, "rgba(255, 224, 114, 0.28)");
    halo.addColorStop(1, "rgba(255, 224, 114, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(620, 130, 340, 320);

    ctx.beginPath();
    ctx.arc(790, 282, 57, 0, Math.PI * 2);
    ctx.fillStyle = "#ffe483";
    ctx.fill();

    drawCloud(748 - (state.cameraX * 0.035) % 1150, 242, 0.82, "rgba(255, 251, 221, 0.6)");
    drawCloud(390 - (state.cameraX * 0.05) % 1250, 290, 1.05, "rgba(255, 251, 221, 0.4)");
    drawCloud(1060 - (state.cameraX * 0.04) % 1370, 320, 0.68, "rgba(255, 251, 221, 0.44)");
  }

  function drawCloud(x, y, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 44, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(-29, -4, 25, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(23, -8, 28, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFarLandscape() {
    const parallaxFar = -((state.cameraX * 0.1) % 960);
    ctx.fillStyle = "#68b6a6";
    drawMountainLayer(parallaxFar, 398, 170, 250, "#75bea7");
    drawMountainLayer(parallaxFar - 650, 408, 205, 300, "#62ad9b");

    const parallaxNear = -((state.cameraX * 0.24) % 720);
    ctx.fillStyle = "#3d927f";
    for (let index = -2; index < 4; index += 1) {
      const x = parallaxNear + index * 290;
      ctx.beginPath();
      ctx.moveTo(x - 130, WORLD.groundY);
      ctx.quadraticCurveTo(x - 95, 338, x, 329);
      ctx.quadraticCurveTo(x + 76, 321, x + 150, WORLD.groundY);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = "rgba(255, 241, 177, 0.48)";
    for (let index = 0; index < 15; index += 1) {
      const x = (index * 137 - state.cameraX * 0.07) % 1120;
      const y = 268 + ((index * 47) % 80);
      ctx.beginPath();
      ctx.arc(x < -20 ? x + 1120 : x, y, index % 3 === 0 ? 2 : 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMountainLayer(offset, baseY, height, width, color) {
    for (let index = -2; index < 5; index += 1) {
      const x = offset + index * width;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.quadraticCurveTo(x + width * 0.28, baseY - height * 0.91, x + width * 0.55, baseY - height);
      ctx.quadraticCurveTo(x + width * 0.76, baseY - height * 0.48, x + width, baseY);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  function drawDangerZone(now) {
    const storm = ctx.createLinearGradient(0, 0, 0, 176);
    storm.addColorStop(0, "rgba(11, 47, 55, 0.95)");
    storm.addColorStop(0.72, "rgba(23, 65, 70, 0.8)");
    storm.addColorStop(1, "rgba(36, 83, 83, 0)");
    ctx.fillStyle = storm;
    ctx.fillRect(0, 0, WORLD.width, 176);

    const scroll = (state.cameraX * 0.11) % 220;
    ctx.fillStyle = "#123d43";
    for (let index = -2; index < 8; index += 1) {
      const x = index * 220 - scroll;
      ctx.beginPath();
      ctx.ellipse(x, 118, 98, 38, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 66, 110, 72, 45, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 132, 124, 95, 34, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#0b3037";
    for (let index = -1; index < 11; index += 1) {
      const x = index * 118 - ((state.cameraX * 0.16) % 118);
      const spikeHeight = 18 + (index % 3) * 9;
      ctx.beginPath();
      ctx.moveTo(x - 24, 135);
      ctx.lineTo(x + 8, 135 + spikeHeight);
      ctx.lineTo(x + 36, 135);
      ctx.closePath();
      ctx.fill();
    }

    const warningGlow = 0.58 + Math.sin(now / 290) * 0.16;
    ctx.save();
    ctx.globalAlpha = warningGlow;
    ctx.strokeStyle = "#ff725b";
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 12]);
    ctx.beginPath();
    ctx.moveTo(0, WORLD.dangerLineY);
    ctx.lineTo(WORLD.width, WORLD.dangerLineY);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#ff8265";
    ctx.fillRect(22, WORLD.dangerLineY - 14, 104, 21);
    ctx.fillStyle = "#43201a";
    ctx.font = '700 10px "Avenir Next", "PingFang SC", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("高空警戒线", 74, WORLD.dangerLineY - 3);
  }

  function drawAbyss() {
    const abyss = ctx.createLinearGradient(0, WORLD.groundY, 0, WORLD.height);
    abyss.addColorStop(0, "#153e46");
    abyss.addColorStop(0.28, "#0c2931");
    abyss.addColorStop(1, "#05181e");
    ctx.fillStyle = abyss;
    ctx.fillRect(0, WORLD.groundY, WORLD.width, WORLD.height - WORLD.groundY);

    ctx.strokeStyle = "rgba(148, 210, 195, 0.1)";
    ctx.lineWidth = 1;
    for (let index = 0; index < 4; index += 1) {
      const offset = (state.cameraX * (0.08 + index * 0.02)) % 190;
      ctx.beginPath();
      for (let x = -190; x < WORLD.width + 190; x += 38) {
        const y = 467 + index * 18 + Math.sin((x + offset) / 39) * 4;
        if (x === -190) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255, 226, 120, 0.2)";
    for (let index = 0; index < 14; index += 1) {
      const x = (index * 107 - state.cameraX * 0.3) % 1060;
      const y = 465 + ((index * 31) % 55);
      ctx.beginPath();
      ctx.arc(x < -20 ? x + 1060 : x, y, 1 + (index % 2), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlatforms() {
    for (const segment of world.segments) {
      const x = segment.start - state.cameraX;
      const width = segment.end - segment.start;
      if (x + width < -40 || x > WORLD.width + 40) {
        continue;
      }

      const groundGradient = ctx.createLinearGradient(0, WORLD.groundY, 0, WORLD.height);
      groundGradient.addColorStop(0, "#d99243");
      groundGradient.addColorStop(0.35, "#b86836");
      groundGradient.addColorStop(1, "#743b29");

      ctx.fillStyle = groundGradient;
      roundedRect(x, WORLD.groundY + 10, width, WORLD.height - WORLD.groundY + 10, 16);
      ctx.fill();

      ctx.fillStyle = "#3d8f6f";
      roundedRect(x - 2, WORLD.groundY - 2, width + 4, 25, 14);
      ctx.fill();
      ctx.fillStyle = "#72c878";
      roundedRect(x, WORLD.groundY - 4, width, 16, 13);
      ctx.fill();

      ctx.strokeStyle = "rgba(33, 83, 64, 0.55)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 9, WORLD.groundY + 15);
      ctx.lineTo(x + width - 9, WORLD.groundY + 15);
      ctx.stroke();

      drawPlatformDetails(segment, x, width);
    }
  }

  function drawPlatformDetails(segment, x, width) {
    const seed = segment.decorationSeed;
    const grassCount = Math.floor(width / 70);
    ctx.lineCap = "round";

    for (let index = 0; index < grassCount; index += 1) {
      const localX = 36 + ((seed * (index + 3) * 37) % Math.max(40, width - 70));
      const bladeHeight = 4 + ((seed + index * 13) % 7);
      ctx.strokeStyle = index % 2 === 0 ? "#357d5f" : "#276d53";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + localX, WORLD.groundY + 1);
      ctx.quadraticCurveTo(x + localX - 4, WORLD.groundY - bladeHeight, x + localX - 6, WORLD.groundY - bladeHeight - 3);
      ctx.moveTo(x + localX + 2, WORLD.groundY + 1);
      ctx.quadraticCurveTo(x + localX + 7, WORLD.groundY - bladeHeight + 1, x + localX + 8, WORLD.groundY - bladeHeight - 2);
      ctx.stroke();
    }

    const pebbleCount = Math.floor(width / 105);
    for (let index = 0; index < pebbleCount; index += 1) {
      const localX = 55 + ((seed * (index + 7) * 53) % Math.max(55, width - 95));
      const localY = 47 + ((seed + index * 19) % 61);
      ctx.fillStyle = index % 3 === 0 ? "rgba(255, 218, 145, 0.18)" : "rgba(80, 38, 30, 0.24)";
      ctx.beginPath();
      ctx.ellipse(x + localX, WORLD.groundY + localY, 9 + (index % 4), 4 + (index % 3), -0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (width > 360) {
      const flowerX = x + 95 + (seed % 110);
      const flowerY = WORLD.groundY - 12;
      ctx.strokeStyle = "#2e7359";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(flowerX, WORLD.groundY);
      ctx.lineTo(flowerX, flowerY);
      ctx.stroke();
      ctx.fillStyle = "#ffe6a0";
      for (let petal = 0; petal < 4; petal += 1) {
        const angle = (petal / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(flowerX + Math.cos(angle) * 4, flowerY + Math.sin(angle) * 4, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#f5a72f";
      ctx.beginPath();
      ctx.arc(flowerX, flowerY, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSpikes() {
    for (const spike of world.spikes) {
      const centerX = spike.x - state.cameraX;
      if (centerX < -60 || centerX > WORLD.width + 60) {
        continue;
      }

      const left = centerX - spike.width / 2;
      const toothWidth = spike.width / 3;
      const baseY = WORLD.groundY;

      ctx.save();
      ctx.shadowColor = "rgba(78, 31, 16, 0.2)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;

      for (let index = 0; index < 3; index += 1) {
        const toothX = left + index * toothWidth;
        const tipX = toothX + toothWidth * 0.5;
        const tipY = baseY - spike.height - (index === 1 ? 5 : 0);
        const gradient = ctx.createLinearGradient(tipX, tipY, tipX, baseY);
        gradient.addColorStop(0, "#fff0ba");
        gradient.addColorStop(0.24, "#ffb34d");
        gradient.addColorStop(1, "#e4523b");
        ctx.beginPath();
        ctx.moveTo(toothX, baseY);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(toothX + toothWidth, baseY);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = "#7b352a";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(tipX - 3, tipY + 10);
        ctx.lineTo(tipX - 1, baseY - 5);
        ctx.strokeStyle = "rgba(255, 248, 223, 0.52)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawReadyEgg(idlePulse) {
    drawEggShadow(WORLD.heroX, WORLD.groundY + 1, 27 + idlePulse * 2, 0.2);
    drawEgg(
      WORLD.heroX,
      WORLD.groundY - player.height / 2 - 3 + idlePulse * 2,
      player.width,
      player.height,
      -0.02,
      1 + idlePulse * 0.025,
      false,
    );
  }

  function drawRunningEgg(idlePulse) {
    let rotation = 0;
    let squashX = 1;
    let squashY = 1;
    const grounded = player.grounded;
    let drawY = player.y;

    if (grounded) {
      const runBounce = Math.abs(Math.sin(state.elapsed * 13)) * 3;
      drawY -= runBounce;
      drawEggShadow(WORLD.heroX, WORLD.groundY + 1, 26 - runBounce, 0.2);
      rotation = Math.sin(state.elapsed * 13) * 0.045;
    } else {
      drawEggShadow(WORLD.heroX, WORLD.groundY + 1, clamp(26 - (WORLD.groundY - player.y) * 0.04, 10, 27), 0.13);
      rotation = player.vy < 0 ? -0.08 : 0.04;
      squashX = player.vy < 0 ? 0.94 : 1.03;
      squashY = player.vy < 0 ? 1.07 : 0.97;
    }

    const squash = 1 - player.squash * 0.15;
    squashX *= squash;
    squashY *= 2 - squash;
    drawEgg(
      WORLD.heroX,
      drawY + player.height / 2,
      player.width,
      player.height,
      rotation,
      squashY,
      false,
      squashX,
    );
  }

  function drawDyingEgg() {
    if (state.deathReason === "gap") {
      drawEgg(
        WORLD.heroX,
        player.y + player.height / 2,
        player.width,
        player.height,
        player.rotation,
        1,
        false,
      );
      return;
    }

    const shakeX = state.deathTimer < 0.12 ? random(-3, 3) : 0;
    drawEgg(
      WORLD.heroX + shakeX,
      player.y + player.height / 2,
      player.width,
      player.height,
      state.deathTimer * 0.3,
      1,
      true,
    );
  }

  function drawEggShadow(x, y, width, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#163a36";
    ctx.beginPath();
    ctx.ellipse(x, y, width, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEgg(x, centerY, width, height, rotation, squashY, cracked, squashX = 1) {
    ctx.save();
    ctx.translate(x, centerY);
    ctx.rotate(rotation);
    ctx.scale(squashX, squashY);

    const w = width;
    const h = height;

    const activeSprite = sprites[player.form] || sprites.egg;
    if (activeSprite.ready) {
      const transformScale =
        player.transformTimer > 0 ? 0.78 + 0.22 * easeOutCubic(1 - player.transformTimer / 0.24) : 1;
      const drawHeight = h * 1.17 * transformScale;
      const drawWidth = drawHeight * (activeSprite.image.naturalWidth / activeSprite.image.naturalHeight);
      ctx.save();
      ctx.shadowColor = "rgba(80, 49, 12, 0.22)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      ctx.drawImage(activeSprite.image, -drawWidth / 2, -drawHeight / 2 - 4, drawWidth, drawHeight);
      ctx.restore();

      if (cracked) {
        drawCracks(w * 0.95, h * 0.95);
      }
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(-4, 6);
    ctx.fillStyle = "rgba(91, 46, 13, 0.2)";
    ctx.beginPath();
    ctx.ellipse(2, h * 0.43, w * 0.4, h * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#b86a12";
    for (const footX of [-11, 11]) {
      ctx.beginPath();
      ctx.ellipse(footX, h * 0.46, 8.5, 4.4, footX < 0 ? -0.2 : 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const bodyGradient = ctx.createLinearGradient(-w * 0.32, -h * 0.42, w * 0.36, h * 0.44);
    bodyGradient.addColorStop(0, "#fff6a6");
    bodyGradient.addColorStop(0.27, "#ffe364");
    bodyGradient.addColorStop(0.72, "#ffd645");
    bodyGradient.addColorStop(1, "#eea71d");

    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.bezierCurveTo(w * 0.34, -h / 2, w * 0.53, -h * 0.19, w * 0.5, h * 0.13);
    ctx.bezierCurveTo(w * 0.45, h * 0.44, w * 0.24, h * 0.5, 0, h * 0.5);
    ctx.bezierCurveTo(-w * 0.24, h * 0.5, -w * 0.45, h * 0.44, -w * 0.5, h * 0.13);
    ctx.bezierCurveTo(-w * 0.53, -h * 0.19, -w * 0.34, -h / 2, 0, -h / 2);
    ctx.closePath();
    ctx.fillStyle = bodyGradient;
    ctx.fill();
    ctx.strokeStyle = "#67310e";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "#fffbd9";
    ctx.beginPath();
    ctx.ellipse(-w * 0.22, -h * 0.24, w * 0.08, h * 0.15, -0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(255, 129, 88, 0.48)";
    ctx.beginPath();
    ctx.ellipse(-w * 0.28, h * 0.06, 5.2, 3.2, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.28, h * 0.06, 5.2, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    const blinking = player.blinkTimer < 0 || state.mode === "dying";
    ctx.strokeStyle = COLORS.ink;
    ctx.fillStyle = COLORS.ink;
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";

    if (blinking) {
      ctx.beginPath();
      ctx.moveTo(-14, -2);
      ctx.quadraticCurveTo(-10, 1, -6, -2);
      ctx.moveTo(6, -2);
      ctx.quadraticCurveTo(10, 1, 14, -2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(-10, -3, 2.7, 4.2, 0, 0, Math.PI * 2);
      ctx.ellipse(10, -3, 2.7, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fffdf0";
      ctx.beginPath();
      ctx.arc(-10.8, -4.5, 0.9, 0, Math.PI * 2);
      ctx.arc(9.2, -4.5, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = "#67310e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (state.mode === "dying") {
      ctx.arc(0, 7, 5, Math.PI, Math.PI * 2);
    } else {
      ctx.arc(0, 4, 4.2, 0.15, Math.PI - 0.15);
    }
    ctx.stroke();

    drawScarf();

    if (cracked) {
      drawCracks(w, h);
    }

    ctx.restore();
  }

  function drawScarf() {
    ctx.save();
    ctx.translate(-1, 13);
    const flutter = Math.sin(performance.now() / 130) * 2;
    ctx.fillStyle = "#ef5948";
    ctx.beginPath();
    ctx.moveTo(-17, 1);
    ctx.quadraticCurveTo(-33, 3 + flutter, -42, -3 + flutter);
    ctx.quadraticCurveTo(-32, 8 + flutter, -20, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#9b372c";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = "#ff7b5b";
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(23, 0);
    ctx.lineTo(21, 8);
    ctx.quadraticCurveTo(0, 11, -22, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#9b372c";
    ctx.stroke();
    ctx.restore();
  }

  function drawCracks(w, h) {
    ctx.strokeStyle = "rgba(92, 42, 11, 0.88)";
    ctx.lineWidth = 2.2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-w * 0.26, -h * 0.2);
    ctx.lineTo(-w * 0.08, -h * 0.07);
    ctx.lineTo(-w * 0.17, h * 0.06);
    ctx.lineTo(w * 0.03, h * 0.15);
    ctx.lineTo(-w * 0.03, h * 0.29);
    ctx.moveTo(w * 0.03, h * 0.15);
    ctx.lineTo(w * 0.21, h * 0.24);
    ctx.moveTo(-w * 0.08, -h * 0.07);
    ctx.lineTo(w * 0.13, -h * 0.13);
    ctx.lineTo(w * 0.22, -h * 0.04);
    ctx.stroke();
  }

  function drawParticles() {
    for (const particle of particles) {
      ctx.save();
      ctx.globalAlpha = clamp(particle.life / 0.35, 0, 1);
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;

      if (particle.type === "yolk") {
        ctx.beginPath();
        ctx.arc(0, 0, particle.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(-particle.size, -particle.size * 0.35);
        ctx.lineTo(particle.size * 0.72, -particle.size * 0.62);
        ctx.lineTo(particle.size * 0.45, particle.size * 0.52);
        ctx.lineTo(-particle.size * 0.5, particle.size * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(95, 48, 11, 0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawFloaters() {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '700 17px "Avenir Next", "PingFang SC", sans-serif';
    for (const floater of floaters) {
      ctx.globalAlpha = clamp(floater.life / floater.maxLife, 0, 1);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(12, 45, 49, 0.36)";
      ctx.strokeText(floater.text, floater.x, floater.y);
      ctx.fillStyle = floater.color;
      ctx.fillText(floater.text, floater.x, floater.y);
    }
    ctx.restore();
  }

  function drawFormBadge() {
    const isFrog = player.form === "frog";
    const label = isFrog ? "奶蛙形态" : "奶鼠形态";
    const x = WORLD.heroX - (isFrog ? 30 : 32);
    const y = clamp(player.y - 28, 228, WORLD.groundY - 88);

    ctx.save();
    roundedRect(x, y, isFrog ? 60 : 64, 20, 10);
    ctx.fillStyle = isFrog ? "rgba(61, 103, 47, 0.88)" : "rgba(120, 65, 34, 0.88)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 248, 223, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = COLORS.cream;
    ctx.font = '600 10px "Avenir Next", "PingFang SC", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + (isFrog ? 30 : 32), y + 10);
    ctx.restore();
  }

  function drawTopAtmosphere(now) {
    if (state.mode !== "running" || player.grounded) {
      return;
    }

    const dangerDistance = Math.max(0, player.y - WORLD.dangerLineY);
    const proximity = clamp(1 - dangerDistance / 95, 0, 1);
    if (proximity <= 0) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = 0.08 + proximity * 0.1;
    ctx.strokeStyle = "#ff6c52";
    ctx.lineWidth = 2;
    for (let index = 0; index < 6; index += 1) {
      const y = 75 + index * 20 + Math.sin(now / 240 + index) * 3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function frame(timestamp) {
    const dt = Math.min((timestamp - lastFrameTime) / 1000, 1 / 30);
    lastFrameTime = timestamp;
    player.idleTime += dt;

    if (state.mode === "running") {
      updateGame(dt);
    } else if (state.mode === "dying") {
      updateDying(dt);
    }

    if (state.mode !== "ready") {
      updateParticles(dt);
    }

    draw();
    requestAnimationFrame(frame);
  }

  function ensureAudio() {
    if (!state.soundEnabled) {
      return;
    }
    if (!soundEngine) {
      soundEngine = createSoundEngine();
    }
    soundEngine?.resume();
  }

  function playSound(name) {
    ensureAudio();
    if (!soundEngine || !state.soundEnabled) {
      return;
    }
    soundEngine[name === "start" ? "start" : "jump"]();
  }

  function createSoundEngine() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return null;
    }

    const audio = new AudioContext();
    const master = audio.createGain();
    master.gain.value = 0.19;
    master.connect(audio.destination);

    function tone(startFrequency, endFrequency, duration, type = "sine", volume = 0.2, delay = 0) {
      if (!state.soundEnabled) {
        return;
      }
      const startAt = audio.currentTime + delay;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(startFrequency, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), startAt + duration);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.025);
    }

    function noise(duration, volume) {
      if (!state.soundEnabled) {
        return;
      }
      const length = Math.floor(audio.sampleRate * duration);
      const buffer = audio.createBuffer(1, length, audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) {
        const fade = 1 - index / length;
        data[index] = (Math.random() * 2 - 1) * fade * fade;
      }
      const source = audio.createBufferSource();
      const gain = audio.createGain();
      source.buffer = buffer;
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(master);
      source.start();
    }

    return {
      resume() {
        if (audio.state === "suspended") {
          audio.resume();
        }
      },
      start() {
        tone(320, 510, 0.11, "triangle", 0.17);
        tone(510, 760, 0.13, "triangle", 0.13, 0.1);
      },
      jump() {
        tone(410, 690, 0.13, "triangle", 0.15);
      },
      mouseJump() {
        tone(340, 580, 0.11, "triangle", 0.16);
        tone(590, 840, 0.1, "triangle", 0.1, 0.08);
      },
      frogJump() {
        tone(190, 390, 0.16, "sine", 0.16);
        tone(330, 520, 0.12, "sine", 0.09, 0.13);
      },
      land() {
        tone(170, 105, 0.07, "sine", 0.13);
      },
      shatter() {
        noise(0.24, 0.16);
        tone(210, 72, 0.2, "square", 0.09);
      },
    };
  }

  function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    soundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
    soundLabel.textContent = state.soundEnabled ? "声音开" : "声音关";
    eggMusic.muted = !state.soundEnabled;
    mouseMusic.muted = !state.soundEnabled;
    frogMusic.muted = !state.soundEnabled;
    if (state.soundEnabled) {
      ensureAudio();
      soundEngine?.land();
      if (state.mode === "running") {
        setMusicMode(state.musicMode);
      }
    }
  }

  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", startGame);
  soundToggle.addEventListener("click", toggleSound);
  mouseButton.addEventListener("click", () => chooseForm("mouse"));
  frogButton.addEventListener("click", () => chooseForm("frog"));

  jumpButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (event.button !== 0) {
      return;
    }
    jumpButton.setPointerCapture?.(event.pointerId);
    requestJump();
  });

  jumpButton.addEventListener("click", (event) => {
    if (event.detail === 0) {
      requestJump();
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    if (state.mode === "running") {
      requestJump();
    }
  });

  window.addEventListener("pointerup", releaseJump);
  window.addEventListener("pointercancel", releaseJump);

  window.addEventListener("keydown", (event) => {
    if (event.code === "Digit1" || event.code === "Numpad1") {
      event.preventDefault();
      if (!event.repeat) {
        chooseForm("mouse");
      }
      return;
    }
    if (event.code === "Digit2" || event.code === "Numpad2") {
      event.preventDefault();
      if (!event.repeat) {
        chooseForm("frog");
      }
      return;
    }
    if (event.code !== "Space" && event.code !== "ArrowUp" && event.code !== "KeyW") {
      return;
    }
    event.preventDefault();
    if (event.repeat) {
      return;
    }
    ensureAudio();
    requestJump();
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") {
      releaseJump();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      releaseJump();
      lastFrameTime = performance.now();
    }
  });

  window.addEventListener("blur", releaseJump);

  bestValue.textContent = String(state.best);
  finalBest.textContent = String(state.best);
  for (const audio of [eggMusic, mouseMusic, frogMusic]) {
    try {
      audio.volume = 0;
      audio.load();
    } catch (error) {
      // 音频预加载失败不会影响游戏主循环。
    }
  }
  resetWorld();
  requestAnimationFrame(frame);

  // 暴露只读调试接口，便于验证物理与关卡生成，不影响正常游玩。
  window.__BOUNCY_EGG_DEBUG__ = {
    start: startGame,
    requestJump,
    releaseJump,
    chooseForm,
    getState: () => ({
      mode: state.mode,
      distance: state.distance,
      cameraX: state.cameraX,
      deathReason: state.deathReason,
      form: player.form,
      musicMode: state.musicMode,
      player: { x: player.x, y: player.y, vy: player.vy, grounded: player.grounded },
      segments: world.segments.map(({ start, end }) => ({ start, end })),
      spikes: world.spikes.map(({ x, width, height }) => ({ x, width, height })),
    }),
  };
})();
