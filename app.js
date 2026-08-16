(() => {
  const $ = id => document.getElementById(id);
  const screens = { intro: $("introScreen"), game: $("gameScreen"), reveal: $("revealScreen") };
  const canvas = $("gameCanvas"), ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  let game, soundOn = true, audioCtx;

  // Exactly seven Level 1 blocks: six required treasures and one TNT surprise.
  const blockTemplate = [
    { x: 105, y: 585, t: "banana", hint: 1 },
    { x: 270, y: 610, t: "diamond", hint: 1 },
    { x: 465, y: 585, t: "banana" },
    { x: 620, y: 640, t: "cake", hint: 1 },
    { x: 150, y: 770, t: "diamond", hint: 1 },
    { x: 365, y: 780, t: "tnt" },
    { x: 570, y: 835, t: "banana", hint: 1 }
  ];
  const maze = [
    {x:0,y:0,w:720,h:30},{x:0,y:890,w:720,h:30},{x:0,y:0,w:30,h:920},{x:690,y:0,w:30,h:920},
    // Every barrier has at least two openings, creating alternate escape routes.
    {x:30,y:755,w:150,h:34},{x:330,y:755,w:150,h:34},{x:630,y:755,w:60,h:34},
    {x:150,y:605,w:170,h:34},{x:500,y:605,w:190,h:34},
    {x:30,y:455,w:120,h:34},{x:320,y:455,w:150,h:34},{x:630,y:455,w:60,h:34},
    {x:150,y:305,w:170,h:34},{x:500,y:305,w:190,h:34},
    {x:30,y:155,w:150,h:34},{x:330,y:155,w:150,h:34}
  ];

  function show(name) { Object.entries(screens).forEach(([key, node]) => node.classList.toggle("hidden", key !== name)); }
  function tone(freq, duration=.1, type="square", volume=.06) {
    if (!soundOn) return;
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator(), gain = audioCtx.createGain();
    oscillator.type = type; oscillator.frequency.value = freq;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration);
    oscillator.connect(gain).connect(audioCtx.destination); oscillator.start(); oscillator.stop(audioCtx.currentTime + duration);
  }
  function rect(x,y,w,h,color) { ctx.fillStyle=color; ctx.fillRect(x,y,w,h); }
  function burst(x,y,color,count=14) {
    for(let i=0;i<count;i++) game.particles.push({x,y,vx:(Math.random()-.5)*12,vy:(Math.random()-.7)*12,life:35+Math.random()*20,color});
  }
  function setHud(level, title) { $("levelLabel").textContent=level; $("questTitle").textContent=title; }
  function hideAllStats() { $("treasureStats").classList.add("hidden"); $("escapeStats").classList.add("hidden"); $("fightStats").classList.add("hidden"); }

  function startGame() {
    game={mode:"mine",player:{x:355,y:525,dx:0,dy:0},blocks:blockTemplate.map(b=>({...b,hits:0,mined:false})),bananas:0,diamonds:0,cake:false,seconds:45,last:0,active:true,particles:[],shake:0};
    setHud("LEVEL 1","MINE THE PARTY TREASURE"); hideAllStats();
    $("treasureStats").classList.remove("hidden"); $("xpBar").classList.remove("hidden");
    $("mineButton").classList.remove("hidden"); $("mineButton").disabled=false; $("mineButton").textContent="⛏ MINE BLOCK";
    $("bananaCount").textContent=0; $("diamondCount").textContent=0; $("cakeCount").textContent="❌"; $("timer").textContent="00:45"; $("xpFill").style.width="0%";
    $("gameMessage").textContent="Find a glowing underground block and hit it 3 times!";
    show("game"); tone(440); requestAnimationFrame(loop);
  }
  function progress() {
    const total=game.bananas+game.diamonds+(game.cake?1:0);
    $("xpFill").style.width=`${Math.min(100,total/6*100)}%`;
    if(game.bananas>=3&&game.diamonds>=2&&game.cake) startEscape();
  }
  function startEscape() {
    game.mode="escape"; game.blocks=[]; game.player={x:75,y:835,dx:0,dy:0}; game.monster={x:360,y:75,speed:3.15}; game.exit={x:635,y:75,w:74,h:74}; game.escapeSeconds=45; game.escapeStartedAt=0; game.last=0; game.particles=[];
    setHud("LEVEL 2","ESCAPE THE LITTLE MONSTER"); hideAllStats();
    $("escapeStats").classList.remove("hidden"); $("xpBar").classList.add("hidden"); $("mineButton").classList.add("hidden"); $("escapeTimer").textContent="00:45";
    $("gameMessage").textContent="👾 RUN! Choose your route, dodge the chasing monster and reach the top-right EXIT!";
    [520,660,780].forEach((f,i)=>setTimeout(()=>tone(f,.18,"triangle"),i*120));
  }
  function startFight() {
    game.mode="fight"; game.player={x:360,y:820,dx:0,dy:0}; game.monsters=[
      {x:150,y:210,hits:0,maxHits:5,speed:1.45,scale:1.15,defeated:false},
      {x:570,y:225,hits:0,maxHits:5,speed:1.5,scale:1.15,defeated:false},
      {x:360,y:430,hits:0,maxHits:10,speed:1.15,scale:1.75,boss:true,defeated:false}
    ]; game.lives=10; game.lastMonsterHit=0; game.lastPlayerHit=0; game.last=0; game.particles=[]; game.shake=0;
    setHud("LEVEL 3","FIGHT THE MONSTER"); hideAllStats();
    $("fightStats").classList.remove("hidden"); $("monsterDefeated").textContent="0"; updateLives(); $("xpBar").classList.add("hidden");
    $("mineButton").classList.remove("hidden"); $("mineButton").disabled=false; $("mineButton").textContent="⚔️ HIT MONSTER";
    $("gameMessage").textContent="HINT: Hit each small monster 5 times and the BIG BOSS 10 times!";
    [330,440,550].forEach((f,i)=>setTimeout(()=>tone(f,.16,"sawtooth"),i*110));
  }
  function reveal() {
    game.active=false; [660,880,1100,1320].forEach((f,i)=>setTimeout(()=>tone(f,.22,"triangle"),i*110)); setTimeout(()=>show("reveal"),500);
  }
  function failEscape() {
    game.active=false; $("gameMessage").textContent="👾 The monster caught you! Try Level 2 again."; tone(90,.35,"sawtooth",.1);
    setTimeout(()=>{game.active=true;startEscape();requestAnimationFrame(loop)},900);
  }
  function finishMineTimeout() { if(!game?.active)return; game.active=false; $("mineButton").disabled=true; $("gameMessage").textContent="Time's up — but every adventurer is invited!"; setTimeout(()=>show("reveal"),900); }
  function move(direction) {
    if(!game?.active)return; const p=game.player,s=game.mode==="escape"?42:31;
    if(direction==="left")p.dx=-s;if(direction==="right")p.dx=s;if(direction==="up")p.dy=-s;if(direction==="down")p.dy=s;tone(150,.025,"sine",.025);
  }
  function action() { if(game?.mode==="fight") hitMonster(); else mine(); }
  function updateLives() { $("playerLives").textContent="🍌".repeat(Math.max(0,game.lives)); $("playerLives").setAttribute("aria-label",`${game.lives} banana lives remaining`); }
  function mine() {
    if(!game?.active||game.mode!=="mine")return;
    const p=game.player,b=game.blocks.find(x=>!x.mined&&Math.hypot(x.x-p.x,x.y-p.y)<76);
    if(!b){$("gameMessage").textContent="Move closer to an underground block first!";tone(130,.08);return}
    p.x=b.x;p.y=b.y;p.dx=p.dy=0;b.hits++;game.shake=5;tone(170+b.hits*45,.09);burst(b.x,b.y,"#b7bec4",7);
    if(b.hits<3){$("gameMessage").textContent=`CRACK ${b.hits}/3 — hit it again!`;return}
    b.mined=true;burst(b.x,b.y,"#e5d1a1",22);
    if(b.t==="tnt"){tone(90,.35,"sawtooth",.1);game.shake=16;burst(b.x,b.y,"#ff6a32",45);$("gameMessage").textContent="💥 TNT! BOOM! No treasure here — keep going!";return}
    tone(b.t==="cake"?660:b.t==="diamond"?800:530,.2,"triangle");
    if(b.t==="banana")$("bananaCount").textContent=++game.bananas;
    if(b.t==="diamond")$("diamondCount").textContent=++game.diamonds;
    if(b.t==="cake"){game.cake=true;$("cakeCount").textContent="✅"}
    $("gameMessage").textContent=b.t==="cake"?"🎂 LEGENDARY BIRTHDAY CAKE FOUND!":`✨ ${b.t.toUpperCase()} FOUND!`;progress();
  }
  function hitMonster() {
    if(!game?.active||game.mode!=="fight")return;
    const p=game.player,targets=game.monsters.filter(m=>!m.defeated).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)),m=targets[0];
    if(!m||Math.hypot(p.x-m.x,p.y-m.y)>115+(m.boss?25:0)){$("gameMessage").textContent="Move closer to a monster, then tap HIT MONSTER!";tone(120,.08);return}
    const now=performance.now();if(now-game.lastPlayerHit<350)return;game.lastPlayerHit=now;
    m.hits++; game.shake=12; burst(m.x,m.y,m.boss?"#ff8238":"#ffcf38",m.boss?38:25); tone(250+m.hits*55,.16,"sawtooth",.09);
    $("gameMessage").textContent=m.hits<m.maxHits?`${m.boss?"BOSS":"Monster"} hit ${m.hits}/${m.maxHits} — keep fighting!`:`🏆 ${m.boss?"BIG BOSS":"MONSTER"} DEFEATED!`;
    m.x=Math.min(W-65,m.x+(m.x>p.x?45:-45)); m.y=Math.max(80,Math.min(H-80,m.y+(m.y>p.y?25:-25)));
    if(m.hits>=m.maxHits){m.defeated=true;const defeated=game.monsters.filter(enemy=>enemy.defeated).length;$("monsterDefeated").textContent=defeated;if(defeated===game.monsters.length){$("mineButton").disabled=true;$("gameMessage").textContent="🏆 ALL MONSTERS DEFEATED! Invitation unlocked!";setTimeout(reveal,450)}}
  }
  function monsterFightMove(dt) {
    const p=game.player,now=performance.now();
    for(const m of game.monsters.filter(enemy=>!enemy.defeated)){
      const dx=p.x-m.x,dy=p.y-m.y,distance=Math.hypot(dx,dy)||1;m.x+=dx/distance*m.speed*dt;m.y+=dy/distance*m.speed*dt;m.x=Math.max(55,Math.min(W-55,m.x));m.y=Math.max(75,Math.min(H-55,m.y));
      if(distance<(m.boss?82:62)&&now-game.lastMonsterHit>1100){
      game.lastMonsterHit=now;game.lives--;updateLives();game.shake=14;burst(p.x,p.y,"#ffd22a",22);tone(95,.3,"sawtooth",.1);
      const pushX=(p.x-m.x)/(distance||1),pushY=(p.y-m.y)/(distance||1);p.x=Math.max(35,Math.min(W-35,p.x+pushX*95));p.y=Math.max(70,Math.min(H-35,p.y+pushY*95));
      $("gameMessage").textContent=game.lives>0?`The monster hit back! ${game.lives} banana lives left.`:"No banana lives left — restarting Level 3!";
      if(game.lives<=0){game.active=false;setTimeout(()=>{game.active=true;startFight();requestAnimationFrame(loop)},1000)}
      break;
      }
    }
  }
  function collides(entity,r=28){return maze.some(w=>entity.x+r>w.x&&entity.x-r<w.x+w.w&&entity.y+r>w.y&&entity.y-r<w.y+w.h)}
  function tryMove(entity,nx,ny,r=28){const ox=entity.x,oy=entity.y;entity.x=nx;if(collides(entity,r))entity.x=ox;entity.y=ny;if(collides(entity,r))entity.y=oy;entity.x=Math.max(r,Math.min(W-r,entity.x));entity.y=Math.max(r,Math.min(H-r,entity.y))}
  function monsterMove(dt){
    const m=game.monster,p=game.player,step=32,origin=48,cols=20,rows=26;
    const cellFor=e=>({c:Math.max(0,Math.min(cols-1,Math.round((e.x-origin)/step))),r:Math.max(0,Math.min(rows-1,Math.round((e.y-origin)/step)))});
    const pointFor=(c,r)=>({x:origin+c*step,y:origin+r*step});
    const start=cellFor(m),goal=cellFor(p),startKey=`${start.c},${start.r}`,goalKey=`${goal.c},${goal.r}`;
    const queue=[start],parents=new Map([[startKey,null]]),directions=[[1,0],[-1,0],[0,1],[0,-1]];
    for(let i=0;i<queue.length&&i<520;i++){
      const current=queue[i],key=`${current.c},${current.r}`;if(key===goalKey)break;
      for(const [dc,dr] of directions){const c=current.c+dc,r=current.r+dr,nextKey=`${c},${r}`;if(c<0||r<0||c>=cols||r>=rows||parents.has(nextKey))continue;const point=pointFor(c,r);if(collides(point,24))continue;parents.set(nextKey,key);queue.push({c,r})}
    }
    let targetKey=goalKey;if(!parents.has(targetKey)){const dx=p.x-m.x,dy=p.y-m.y,len=Math.hypot(dx,dy)||1;tryMove(m,m.x+dx/len*m.speed*dt,m.y+dy/len*m.speed*dt,26);return}
    while(parents.get(targetKey)&&parents.get(targetKey)!==startKey)targetKey=parents.get(targetKey);
    const [tc,tr]=targetKey.split(",").map(Number),target=pointFor(tc,tr),dx=target.x-m.x,dy=target.y-m.y,len=Math.hypot(dx,dy)||1,s=m.speed*dt;
    tryMove(m,m.x+dx/len*s,m.y+dy/len*s,26);
  }
  function loop(time) {
    if(!game?.active)return; const dt=Math.min((time-game.last)/16.67||1,2);game.last=time;const p=game.player;
    if(game.mode==="mine"){
      p.x+=p.dx*dt;p.y+=p.dy*dt;p.dx*=.7;p.dy*=.7;p.x=Math.max(28,Math.min(W-28,p.x));p.y=Math.max(520,Math.min(H-28,p.y));
      const near=game.blocks.filter(b=>!b.mined).map(b=>({b,d:Math.hypot(b.x-p.x,b.y-p.y)})).filter(item=>item.d<76).sort((a,b)=>a.d-b.d)[0];if(near){p.x=near.b.x;p.y=near.b.y;p.dx=p.dy=0;$("gameMessage").textContent="Aligned with block — tap MINE BLOCK!"}
      const sec=45-Math.floor(time/1000-(game.startedAt||(game.startedAt=time/1000)));if(sec!==game.seconds&&sec>=0){game.seconds=sec;$("timer").textContent=`00:${String(sec).padStart(2,"0")}`;if(sec<6)tone(250,.05)}if(sec<=0)return finishMineTimeout();
    } else if(game.mode==="escape") {
      tryMove(p,p.x+p.dx*dt,p.y+p.dy*dt,26);p.dx*=.7;p.dy*=.7;if(!game.escapeStartedAt)game.escapeStartedAt=time/1000;
      const sec=45-Math.floor(time/1000-game.escapeStartedAt);if(sec!==game.escapeSeconds&&sec>=0){game.escapeSeconds=sec;$("escapeTimer").textContent=`00:${String(sec).padStart(2,"0")}`;if(sec<6)tone(300,.05)}
      monsterMove(dt);if(Math.hypot(p.x-game.monster.x,p.y-game.monster.y)<48)return failEscape();const e=game.exit;if(Math.abs(p.x-e.x)<e.w/2&&Math.abs(p.y-e.y)<e.h/2){$("gameMessage").textContent="🚪 ESCAPED! Level 3 unlocked!";startFight()}else if(sec<=0)return failEscape();
    } else {
      p.x+=p.dx*dt;p.y+=p.dy*dt;p.dx*=.7;p.dy*=.7;p.x=Math.max(35,Math.min(W-35,p.x));p.y=Math.max(70,Math.min(H-35,p.y));monsterFightMove(dt);
    }
    draw(time);requestAnimationFrame(loop);
  }
  function drawBlock(b,time){if(b.mined){rect(b.x-34,b.y-34,68,68,b.t==="tnt"?"#6b201c":"#3f2a27");return}const glow=b.hint&&Math.sin(time/170)>-.3;if(glow){ctx.fillStyle="rgba(82,234,240,.32)";ctx.fillRect(b.x-42,b.y-42,84,84)}rect(b.x-34,b.y-34,68,68,"#686f77");rect(b.x-27,b.y-27,54,54,"#858d94");ctx.strokeStyle=glow?"#7fffff":"#454c55";ctx.lineWidth=3+b.hits;ctx.beginPath();ctx.moveTo(b.x-22,b.y-17);ctx.lineTo(b.x-4,b.y-2);ctx.lineTo(b.x-18,b.y+18);if(b.hits>0){ctx.moveTo(b.x+22,b.y-21);ctx.lineTo(b.x+4,b.y+5);ctx.lineTo(b.x+20,b.y+22)}if(b.hits>1){ctx.moveTo(b.x-5,b.y-28);ctx.lineTo(b.x+5,b.y-7);ctx.lineTo(b.x-5,b.y+29)}ctx.stroke()}
  function drawPlayer(p){ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle="#ffd22a";ctx.strokeStyle="#14223f";ctx.lineWidth=7;ctx.beginPath();ctx.roundRect(-27,-39,54,76,21);ctx.fill();ctx.stroke();ctx.fillStyle="#bfc9d0";ctx.fillRect(-30,-21,60,26);ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(-12,-8,12,0,7);ctx.arc(12,-8,12,0,7);ctx.fill();ctx.fillStyle="#15213c";ctx.beginPath();ctx.arc(-9,-8,5,0,7);ctx.arc(9,-8,5,0,7);ctx.fill();ctx.fillStyle="#316db7";ctx.fillRect(-24,17,48,25);ctx.restore()}
  function drawMonster(m,time,scale=1){ctx.save();ctx.translate(m.x,m.y);ctx.scale(scale,scale);ctx.translate(0,Math.sin(time/120)*4);ctx.fillStyle="#7a45cf";ctx.strokeStyle="#261342";ctx.lineWidth=7;ctx.beginPath();ctx.roundRect(-31,-34,62,68,18);ctx.fill();ctx.stroke();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(-12,-8,10,0,7);ctx.arc(12,-8,10,0,7);ctx.fill();ctx.fillStyle="#111";ctx.beginPath();ctx.arc(-9,-7,4,0,7);ctx.arc(15,-7,4,0,7);ctx.fill();ctx.fillStyle="#fff";ctx.fillRect(-18,15,36,8);ctx.restore()}
  function drawMine(time){ctx.clearRect(0,0,W,H);rect(0,0,W,345,"#328bd8");for(let i=0;i<8;i++){rect((i*111+30)%W,80+(i%3)*52,75,20,"#e9f7ff");rect((i*111+52)%W,60+(i%3)*52,35,20,"#e9f7ff")}rect(0,345,W,165,"#499748");[[60,290],[620,285],[150,445],[510,480]].forEach(([x,y])=>{rect(x,y,28,105,"#6a3e24");rect(x-34,y-60,95,72,"#247343");rect(x-14,y-91,55,43,"#309653")});rect(0,510,W,H-510,"#5d3b27");for(let y=510;y<H;y+=72)for(let x=0;x<W;x+=90)rect(x,y+(x%180?18:0),74,54,y%144?"#70452d":"#68402b");game.blocks.forEach(b=>drawBlock(b,time));drawPlayer(game.player)}
  function drawEscape(time){ctx.clearRect(0,0,W,H);rect(0,0,W,H,"#203a49");for(let y=0;y<H;y+=64)for(let x=0;x<W;x+=64)rect(x,y,60,60,(x/64+y/64)%2?"#355967":"#2a4856");maze.forEach((w,i)=>{rect(w.x,w.y,w.w,w.h,i%2?"#4d6a73":"#5d7a83");ctx.strokeStyle="#1d2f36";ctx.lineWidth=3;ctx.strokeRect(w.x+1,w.y+1,w.w-2,w.h-2)});const e=game.exit,glow=.55+.35*Math.sin(time/150);ctx.fillStyle=`rgba(80,255,173,${glow})`;ctx.fillRect(e.x-e.w/2-12,e.y-e.h/2-12,e.w+24,e.h+24);rect(e.x-e.w/2,e.y-e.h/2,e.w,e.h,"#103c2c");ctx.fillStyle="#b7ffcf";ctx.font="900 20px Arial";ctx.textAlign="center";ctx.fillText("EXIT",e.x,e.y+6);drawMonster(game.monster,time);drawPlayer(game.player)}
  function drawFight(time){ctx.clearRect(0,0,W,H);rect(0,0,W,H,"#401f43");for(let y=0;y<H;y+=80)for(let x=0;x<W;x+=80)rect(x,y,74,74,(x/80+y/80)%2?"#56305c":"#4a284f");for(const m of game.monsters.filter(enemy=>!enemy.defeated)){const width=m.boss?150:100;ctx.fillStyle=m.boss?"rgba(255,90,40,.22)":"rgba(255,208,42,.15)";ctx.beginPath();ctx.arc(m.x,m.y,(m.boss?150:100)+Math.sin(time/130)*7,0,Math.PI*2);ctx.fill();drawMonster(m,time,m.scale);rect(m.x-width/2,m.y-(m.boss?105:75),width,12,"#261342");rect(m.x-width/2+2,m.y-(m.boss?103:73),(width-4)*(1-m.hits/m.maxHits),8,m.boss?"#ff6338":"#65e47c");ctx.fillStyle="#fff";ctx.font=`900 ${m.boss?18:14}px Arial`;ctx.textAlign="center";ctx.fillText(m.boss?`BIG BOSS ${m.hits}/10`:`MONSTER ${m.hits}/5`,m.x,m.y-(m.boss?115:84))}drawPlayer(game.player);ctx.fillStyle="#fff";ctx.font="900 22px Arial";ctx.textAlign="center";ctx.fillText("GET CLOSE + TAP HIT MONSTER",W/2,55)}
  function draw(time){ctx.save();if(game.shake>0){ctx.translate((Math.random()-.5)*game.shake,(Math.random()-.5)*game.shake);game.shake*=.78}if(game.mode==="mine")drawMine(time);else if(game.mode==="escape")drawEscape(time);else drawFight(time);game.particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.35;p.life--;rect(p.x,p.y,6,6,p.color)});game.particles=game.particles.filter(p=>p.life>0);ctx.restore()}

  $("startButton").onclick=()=>{audioCtx||=new(window.AudioContext||window.webkitAudioContext)();audioCtx.resume?.();startGame()};
  document.querySelectorAll("[data-direction]").forEach(button=>button.addEventListener("pointerdown",event=>{event.preventDefault();move(button.dataset.direction)}));
  window.addEventListener("keydown",event=>{const keys={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down"};if(keys[event.key]){event.preventDefault();move(keys[event.key])}if(event.key===" "&&game?.active&&game.mode!=="escape"){event.preventDefault();action()}});
  $("mineButton").onclick=action; $("soundButton").onclick=()=>{soundOn=!soundOn;$("soundButton").textContent=soundOn?"🔊":"🔇";if(soundOn)tone(440)};
  $("skipButton").onclick=()=>{if(game)game.active=false;show("reveal")}; $("replayButton").onclick=startGame;
})();
