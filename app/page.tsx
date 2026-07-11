"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Genome = { speed: number; size: number; sense: number; hue: number; efficiency: number };
type Creature = Genome & { x: number; y: number; vx: number; vy: number; energy: number; hunger: number; water: number; eating: boolean; drinking: boolean; age: number; generation: number; target?: number };
type Food = { x: number; y: number; energy: number };
type Bush = { x: number; y: number; radius: number; fruit: number; maxFruit: number };
type Sample = { population: number; food: number; water: number; speed: number };

const TAU = Math.PI * 2;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const fruitPosition = (bush: Bush, index: number) => {
  const angle = index * 2.399 + .35;
  const distance = bush.radius * (.22 + (index % 4) * .18);
  return { x: bush.x + Math.cos(angle) * distance, y: bush.y + Math.sin(angle) * distance * .72 };
};

function seedCreature(width: number, height: number, generation = 1, parent?: Genome): Creature {
  const mutate = (value: number, spread: number, min: number, max: number) =>
    clamp(value + rand(-spread, spread), min, max);
  return {
    x: rand(24, Math.max(25, width - 24)),
    y: rand(24, Math.max(25, height - 24)),
    vx: rand(-1, 1), vy: rand(-1, 1), energy: 90, hunger: rand(68, 100), water: rand(68, 100), eating: false, drinking: false, age: 0, generation,
    speed: parent ? mutate(parent.speed, 0.22, 0.45, 2.7) : rand(0.8, 1.45),
    size: parent ? mutate(parent.size, 0.7, 3.2, 9.5) : rand(4.5, 7.2),
    sense: parent ? mutate(parent.sense, 12, 34, 150) : rand(55, 95),
    hue: parent ? (parent.hue + rand(-14, 14) + 360) % 360 : rand(150, 195),
    efficiency: parent ? mutate(parent.efficiency, 0.035, 0.65, 1.22) : rand(0.82, 1.02),
  };
}

function Stat({ label, value, note, color }: { label: string; value: string; note: string; color: string }) {
  return <div className="stat"><span className="stat-label"><i style={{ background: color }} />{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

export default function Home() {
  const worldRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef({ creatures: [] as Creature[], food: [] as Food[], bushes: [] as Bush[], history: [] as Sample[], time: 0, year: 1, season: "Spring", event: "A calm season", eventTimer: 0, foodRate: 1, waterEffect: 0, waterLevel: 88, width: 900, height: 580 });
  const frame = useRef<number>(0);
  const last = useRef(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1);
  const [mutation, setMutation] = useState(18);
  const mutationRef = useRef(18);
  const [stats, setStats] = useState({ population: 28, food: 78, hunger: 84, water: 88, hydration: 84, generation: 1, avgSpeed: 0, avgSize: 0, year: 1, season: "Spring", event: "A calm season" });

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { mutationRef.current = mutation; }, [mutation]);

  const reset = useCallback(() => {
    const s = sim.current;
    s.creatures = Array.from({ length: 28 }, () => seedCreature(s.width, s.height));
    s.food = Array.from({ length: 22 }, () => ({ x: rand(12, s.width - 12), y: rand(12, s.height - 12), energy: rand(17, 28) }));
    const bushSpots = [[.13,.22],[.37,.18],[.61,.22],[.2,.55],[.48,.62],[.66,.46],[.12,.82]];
    s.bushes = bushSpots.map(([x,y],index) => ({ x:s.width*x, y:s.height*y, radius:18+(index%3)*2, fruit:7+index%4, maxFruit:12 }));
    s.history = []; s.time = 0; s.year = 1; s.season = "Spring"; s.event = "A calm season"; s.eventTimer = 0; s.foodRate = 1; s.waterEffect = 0; s.waterLevel = 88;
  }, []);

  useEffect(() => {
    const canvas = worldRef.current;
    const chart = chartRef.current;
    if (!canvas || !chart) return;
    const ctx = canvas.getContext("2d");
    const chartCtx = chart.getContext("2d");
    if (!ctx || !chartCtx) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sim.current.width = rect.width; sim.current.height = rect.height;
      canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cr = chart.getBoundingClientRect();
      chart.width = Math.round(cr.width * dpr); chart.height = Math.round(cr.height * dpr);
      chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize(); reset();
    const ro = new ResizeObserver(resize); ro.observe(canvas); ro.observe(chart);

    const drawChart = () => {
      const w = chart.clientWidth, h = chart.clientHeight;
      chartCtx.clearRect(0, 0, w, h);
      chartCtx.strokeStyle = "rgba(34,52,43,.09)"; chartCtx.lineWidth = 1;
      for (let i = 1; i < 4; i++) { chartCtx.beginPath(); chartCtx.moveTo(0, h * i / 4); chartCtx.lineTo(w, h * i / 4); chartCtx.stroke(); }
      const hist = sim.current.history;
      const line = (key: "population" | "food" | "water", color: string, max: number) => {
        if (hist.length < 2) return; chartCtx.beginPath();
        hist.forEach((p, i) => { const x = i / (hist.length - 1) * w; const y = h - (p[key] / max) * (h - 8) - 4; i ? chartCtx.lineTo(x, y) : chartCtx.moveTo(x, y); });
        chartCtx.strokeStyle = color; chartCtx.lineWidth = 2; chartCtx.stroke();
      };
      line("food", "#d7a227", 240); line("water", "#4b9db2", 100); line("population", "#20765a", 100);
    };

    const tick = (now: number) => {
      const dt = Math.min(2.2, ((now - (last.current || now)) / 16.67) * speedRef.current); last.current = now;
      const s = sim.current;
      if (!pausedRef.current) {
        s.time += dt;
        const seasons = ["Spring", "Summer", "Autumn", "Winter"];
        s.year = Math.floor(s.time / 1500) + 1; s.season = seasons[Math.floor(s.time / 375) % 4];
        if (s.eventTimer > 0) s.eventTimer -= dt;
        else if (Math.random() < 0.00075 * dt) {
          const eventRoll = Math.random();
          if (eventRoll < .34) { s.event = "Drought — the pond is shrinking"; s.foodRate = .24; s.waterEffect = -.014; }
          else if (eventRoll < .67) { s.event = "Rainfall — the pond is replenishing"; s.foodRate = 1.2; s.waterEffect = .04; }
          else { s.event = "Superbloom — food is abundant"; s.foodRate = 2.6; s.waterEffect = .006; }
          s.eventTimer = 420;
        } else { s.event = "A calm season"; s.foodRate = 1; s.waterEffect = 0; }
        const seasonalRate = s.season === "Spring" ? .75 : s.season === "Summer" ? 1.65 : s.season === "Autumn" ? 1 : .08;
        if (s.food.length < 60 && Math.random() < .012 * dt * s.foodRate * seasonalRate) s.food.push({ x: rand(8, s.width - 8), y: rand(8, s.height - 8), energy: rand(17, 28) });
        const fruitGrowth = .0065 * seasonalRate * s.foodRate * dt;
        for (const bush of s.bushes) bush.fruit = Math.min(bush.maxFruit, bush.fruit + fruitGrowth);
        const seasonalWater = s.season === "Spring" ? .003 : s.season === "Summer" ? -.005 : s.season === "Autumn" ? -.0015 : -.0005;
        s.waterLevel = clamp(s.waterLevel + (seasonalWater + s.waterEffect) * dt, 8, 100);
        const pondX = s.width * .79, pondY = s.height * .73;
        const pondMax = Math.min(s.width, s.height) * .125;
        const pondRadius = pondMax * (.48 + s.waterLevel / 100 * .52);

        const newborns: Creature[] = [];
        for (const c of s.creatures) {
          c.age += dt; c.drinking = false; c.eating = false;
          c.energy -= (.026 + c.speed * .018 + c.size * .002 + c.sense * .000045) * dt / c.efficiency;
          c.hunger = Math.max(0, c.hunger - (.04 + c.speed * .004 + c.size * .0013) * dt / c.efficiency);
          c.water = Math.max(0, c.water - (.045 + c.speed * .004 + c.size * .0012) * dt / c.efficiency);
          if (c.hunger <= 0) c.energy -= .17 * dt;
          if (c.water <= 0) c.energy -= .18 * dt;
          const urgentFoodRange = c.hunger < 62 ? Math.max(c.sense, 210) : c.sense;
          let closest = -1, fruitBush = -1, fruitSlot = -1, best = urgentFoodRange * urgentFoodRange;
          for (let j = 0; j < s.food.length; j++) { const f = s.food[j]; const d = (f.x-c.x)**2 + (f.y-c.y)**2; if (d < best) { best = d; closest = j; } }
          for (let bIndex=0;bIndex<s.bushes.length;bIndex++) { const bush=s.bushes[bIndex]; for(let slot=0;slot<Math.floor(bush.fruit);slot++){const fruit=fruitPosition(bush,slot);const d=(fruit.x-c.x)**2+(fruit.y-c.y)**2;if(d<best){best=d;closest=-1;fruitBush=bIndex;fruitSlot=slot;}} }
          const pondDistance = Math.hypot(pondX - c.x, pondY - c.y);
          const thirsty = c.water < 58;
          const hungry = c.hunger < 62;
          const seekWater = thirsty && (c.water <= c.hunger || c.hunger > 34);
          const seekFood = hungry && !seekWater;
          if (seekWater && pondDistance <= pondRadius * .88 && s.waterLevel > 1) {
            c.drinking = true; c.water = Math.min(100, c.water + 2.2 * dt); s.waterLevel = Math.max(8, s.waterLevel - .0018 * dt); c.vx *= .72; c.vy *= .72;
          } else {
            if (seekWater) { const d = pondDistance || 1; c.vx += (pondX-c.x)/d*.19*dt; c.vy += (pondY-c.y)/d*.19*dt; }
            else if (seekFood && (closest >= 0 || fruitBush >= 0)) { const target=closest>=0?s.food[closest]:fruitPosition(s.bushes[fruitBush],fruitSlot); const d = Math.sqrt(best) || 1; c.vx += (target.x-c.x)/d*.19*dt; c.vy += (target.y-c.y)/d*.19*dt; }
            else if (closest >= 0) { const f = s.food[closest]; const d = Math.sqrt(best) || 1; c.vx += (f.x-c.x)/d*.08*dt; c.vy += (f.y-c.y)/d*.08*dt; }
            else { c.vx += rand(-.05,.05)*dt; c.vy += rand(-.05,.05)*dt; }
            const v = Math.hypot(c.vx,c.vy) || 1; c.vx = c.vx/v*c.speed; c.vy = c.vy/v*c.speed;
          }
          c.x += c.vx*dt; c.y += c.vy*dt;
          if (c.x < c.size || c.x > s.width-c.size) { c.vx *= -1; c.x = clamp(c.x,c.size,s.width-c.size); }
          if (c.y < c.size || c.y > s.height-c.size) { c.vy *= -1; c.y = clamp(c.y,c.size,s.height-c.size); }
          if (c.hunger < 96) for (let j = s.food.length-1; j >= 0; j--) { const f = s.food[j]; if ((f.x-c.x)**2+(f.y-c.y)**2 < (c.size+3)**2) { c.energy += f.energy; c.hunger=Math.min(100,c.hunger+f.energy*2.2);c.eating=true;s.food.splice(j,1); break; } }
          if (c.hunger < 96 && fruitBush >= 0 && fruitSlot < Math.floor(s.bushes[fruitBush].fruit)) { const bush=s.bushes[fruitBush],fruit=fruitPosition(bush,fruitSlot);if((fruit.x-c.x)**2+(fruit.y-c.y)**2<(c.size+5)**2){bush.fruit=Math.max(0,bush.fruit-1);c.energy+=25;c.hunger=Math.min(100,c.hunger+52);c.eating=true;} }
          if (c.energy > 155 && c.hunger > 64 && c.water > 55 && s.creatures.length + newborns.length < 130) {
            c.energy *= .54; const child = seedCreature(s.width,s.height,c.generation+1,c); child.x=c.x; child.y=c.y; child.energy=c.energy; child.hunger=75; child.water=76;
            const m = mutationRef.current / 18; child.speed=clamp(c.speed+rand(-.16,.16)*m,.45,2.7); child.size=clamp(c.size+rand(-.5,.5)*m,3.2,9.5); child.sense=clamp(c.sense+rand(-8,8)*m,34,150); child.efficiency=clamp(c.efficiency+rand(-.025,.025)*m,.65,1.22); newborns.push(child);
          }
        }
        s.creatures = s.creatures.filter(c => c.energy > 0 && c.age < 5200).concat(newborns);
        if (s.creatures.length === 0) s.creatures.push(...Array.from({length:12},()=>seedCreature(s.width,s.height,s.year)));
        if (Math.floor(s.time) % 40 < dt) {
          const avg = (k: keyof Genome) => s.creatures.reduce((a,c)=>a+(c[k] as number),0)/s.creatures.length;
          const hydration = s.creatures.reduce((a,c)=>a+c.water,0)/s.creatures.length;
          const hunger = s.creatures.reduce((a,c)=>a+c.hunger,0)/s.creatures.length;
          const foodCount = s.food.length+s.bushes.reduce((sum,bush)=>sum+Math.floor(bush.fruit),0);
          s.history.push({ population:s.creatures.length, food:foodCount, water:s.waterLevel, speed:avg("speed") }); if (s.history.length > 110) s.history.shift();
          setStats({population:s.creatures.length, food:foodCount, hunger, water:s.waterLevel, hydration, generation:Math.max(...s.creatures.map(c=>c.generation)), avgSpeed:avg("speed"), avgSize:avg("size"), year:s.year, season:s.season, event:s.event});
        }
      }

      ctx.clearRect(0,0,s.width,s.height);
      const bg = ctx.createLinearGradient(0,0,s.width,s.height); bg.addColorStop(0,"#edf3dc"); bg.addColorStop(1,"#d7e8c6"); ctx.fillStyle=bg; ctx.fillRect(0,0,s.width,s.height);
      ctx.fillStyle="rgba(35,75,42,.055)"; for(let x=20;x<s.width;x+=42) for(let y=18;y<s.height;y+=42){ctx.beginPath();ctx.arc(x+(y%84?8:0),y,1.2,0,TAU);ctx.fill();}
      const pondX = s.width * .79, pondY = s.height * .73, pondMax = Math.min(s.width,s.height) * .125, pondRadius = pondMax * (.48 + s.waterLevel / 100 * .52);
      ctx.save(); ctx.translate(pondX,pondY);
      ctx.fillStyle="rgba(126,112,67,.2)"; ctx.beginPath();ctx.ellipse(0,0,pondRadius*1.48,pondRadius*1.12,-.08,0,TAU);ctx.fill();
      const waterGradient=ctx.createRadialGradient(-pondRadius*.3,-pondRadius*.35,3,0,0,pondRadius*1.4);waterGradient.addColorStop(0,"#89cbd0");waterGradient.addColorStop(1,"#4f9ca8");ctx.fillStyle=waterGradient;ctx.beginPath();ctx.ellipse(0,0,pondRadius*1.34,pondRadius,-.08,0,TAU);ctx.fill();
      ctx.strokeStyle="rgba(230,248,231,.38)";ctx.lineWidth=1.2;for(let ring=0;ring<3;ring++){ctx.beginPath();ctx.ellipse(-pondRadius*.15,ring*pondRadius*.16-pondRadius*.15,pondRadius*(.27+ring*.18),pondRadius*(.08+ring*.035),-.08,0,TAU);ctx.stroke();}
      ctx.fillStyle="rgba(26,78,62,.55)";for(let reed=0;reed<7;reed++){const angle=-2.8+reed*.18;const rx=Math.cos(angle)*pondRadius*1.34,ry=Math.sin(angle)*pondRadius;ctx.fillRect(rx,ry-10-rand(0,8),1,12+rand(0,7));}
      ctx.restore();
      for(const bush of s.bushes){ctx.save();ctx.translate(bush.x,bush.y);ctx.fillStyle="#2f7048";for(let leaf=0;leaf<8;leaf++){const a=leaf/8*TAU;ctx.beginPath();ctx.ellipse(Math.cos(a)*bush.radius*.42,Math.sin(a)*bush.radius*.3,bush.radius*.55,bush.radius*.38,a,0,TAU);ctx.fill();}ctx.fillStyle="#245c3b";ctx.beginPath();ctx.arc(0,0,bush.radius*.55,0,TAU);ctx.fill();ctx.restore();for(let fruitIndex=0;fruitIndex<Math.floor(bush.fruit);fruitIndex++){const fruit=fruitPosition(bush,fruitIndex);ctx.fillStyle=fruitIndex%3===0?"#d67237":"#d59a2f";ctx.beginPath();ctx.arc(fruit.x,fruit.y,2.8,0,TAU);ctx.fill();ctx.fillStyle="rgba(255,240,160,.55)";ctx.beginPath();ctx.arc(fruit.x-.8,fruit.y-.8,.7,0,TAU);ctx.fill();}}
      for(const f of s.food){ ctx.fillStyle=f.energy>23?"#e09a24":"#c6a22c"; ctx.beginPath();ctx.arc(f.x,f.y,2.7,0,TAU);ctx.fill(); }
      for(const c of s.creatures){
        ctx.save();ctx.translate(c.x,c.y);ctx.rotate(Math.atan2(c.vy,c.vx));
        ctx.shadowColor=`hsla(${c.hue},55%,25%,.25)`;ctx.shadowBlur=5;ctx.fillStyle=`hsl(${c.hue} 48% ${clamp(36+c.efficiency*12,38,52)}%)`;
        ctx.beginPath();ctx.ellipse(0,0,c.size*1.35,c.size,0,0,TAU);ctx.fill();ctx.shadowBlur=0;
        ctx.fillStyle="rgba(245,250,226,.78)";ctx.beginPath();ctx.arc(c.size*.55,-c.size*.34,1.3,0,TAU);ctx.fill();ctx.restore();
        const barWidth=Math.max(13,c.size*2.8),barY=c.y-c.size-9;ctx.fillStyle="rgba(25,48,42,.3)";ctx.fillRect(c.x-barWidth/2,barY,barWidth,2.5);ctx.fillRect(c.x-barWidth/2,barY+3.5,barWidth,2.5);ctx.fillStyle=c.hunger<25?"#d46f4d":"#d8a03a";ctx.fillRect(c.x-barWidth/2,barY,barWidth*c.hunger/100,2.5);ctx.fillStyle=c.water<25?"#d46f4d":"#70c7dc";ctx.fillRect(c.x-barWidth/2,barY+3.5,barWidth*c.water/100,2.5);
        if(c.eating){ctx.fillStyle="#f2c45b";ctx.beginPath();ctx.arc(c.x+barWidth/2+3,barY+1.2,2.2,0,TAU);ctx.fill();}else if(c.drinking){ctx.fillStyle="rgba(225,250,255,.9)";ctx.beginPath();ctx.arc(c.x+barWidth/2+3,barY+4.8,2.2,0,TAU);ctx.fill();}
      }
      drawChart(); frame.current=requestAnimationFrame(tick);
    };
    frame.current=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame.current);ro.disconnect();};
  }, [reset]);

  const addFood = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const r=event.currentTarget.getBoundingClientRect(), s=sim.current; const x=event.clientX-r.left,y=event.clientY-r.top;
    for(let i=0;i<14&&s.food.length<250;i++)s.food.push({x:clamp(x+rand(-28,28),4,s.width-4),y:clamp(y+rand(-28,28),4,s.height-4),energy:rand(18,28)});
  };

  return <main>
    <header className="topbar"><a className="brand" href="#top" aria-label="Evolv home"><span className="brand-mark">e</span><span>EVOLV</span></a><div className="era"><span>YEAR {stats.year}</span><b>{stats.season.toUpperCase()}</b></div><div className="actions"><button className="ghost" onClick={reset}>↻ <span>Reset</span></button><button className="primary" onClick={()=>setPaused(v=>!v)}>{paused?"▶ Resume":"Ⅱ Pause"}</button></div></header>
    <section className="hero" id="top"><div><p className="eyebrow">NATURAL SELECTION, IN MOTION</p><h1>Life finds a way.<br/><em>Watch it happen.</em></h1></div><p className="intro">A living ecosystem where organisms balance hunger and thirst, fruit ripens with the seasons, and only the best-adapted survive.</p></section>
    <section className="lab">
      <div className="habitat-wrap"><div className="habitat-head"><div><span className="live"><i/> LIVE HABITAT</span><span className="event">{stats.event}</span></div><span>Tap to scatter fruit</span></div><canvas ref={worldRef} onPointerDown={addFood} className="world" aria-label="Live evolution simulation with fruit bushes and a pond. Tap to scatter fruit."/><div className="habitat-foot"><span><i className="dot creature"/> Organisms</span><span><i className="dot nutrient"/> Fruit</span><span><i className="dot bush"/> Bushes</span><span><i className="dot water"/> Pond</span><span className="hint">Gold: hunger · Blue: hydration</span></div></div>
      <aside>
        <div className="panel stats-panel"><div className="panel-title"><span>FIELD NOTES</span><small>LIVE SAMPLE</small></div><div className="stat-grid"><Stat label="Population" value={String(stats.population)} note="living organisms" color="#28785d"/><Stat label="Generation" value={String(stats.generation)} note="highest lineage" color="#667b43"/><Stat label="Hunger" value={`${Math.round(stats.hunger)}%`} note="population average" color="#d59a2f"/><Stat label="Hydration" value={`${Math.round(stats.hydration)}%`} note="population average" color="#55a9bd"/><Stat label="Fruit" value={String(stats.food)} note="ripe and scattered" color="#d67237"/><Stat label="Pond" value={`${Math.round(stats.water)}%`} note="water remaining" color="#3b8fa5"/><Stat label="Avg. speed" value={stats.avgSpeed.toFixed(2)} note="movement trait" color="#c08726"/><Stat label="Avg. size" value={stats.avgSize.toFixed(1)} note="body radius" color="#9b6545"/></div></div>
        <div className="panel controls"><div className="panel-title"><span>EXPERIMENT</span><small>CONTROLS</small></div><label><span>Time flow <b>{speed}×</b></span><input type="range" min="0.5" max="4" step="0.5" value={speed} onChange={e=>setSpeed(Number(e.target.value))}/></label><label><span>Mutation rate <b>{mutation}%</b></span><input type="range" min="2" max="42" step="2" value={mutation} onChange={e=>setMutation(Number(e.target.value))}/></label><p>Higher mutation creates more variation, but useful traits are never guaranteed.</p></div>
        <div className="panel chart-panel"><div className="chart-head"><span>ECOSYSTEM PULSE</span><span><i className="dot creature"/> Population <i className="dot nutrient"/> Food <i className="dot water"/> Water</span></div><canvas ref={chartRef} className="chart" aria-label="Population, food, and pond water history chart"/></div>
      </aside>
    </section>
    <section className="principles"><div><p className="eyebrow">WHAT TO WATCH</p><h2>Evolution has no finish line.</h2></div><div className="principle-grid"><article><b>01</b><h3>Variation</h3><p>Every birth introduces small changes in speed, size, senses, and efficiency.</p></article><article><b>02</b><h3>Selection</h3><p>Seasonal fruit, hunger, thirst, and a changing pond determine which traits pay off.</p></article><article><b>03</b><h3>Inheritance</h3><p>Well-fed survivors reproduce, passing successful traits into the next generation.</p></article></div></section>
    <footer><span>EVOLV / DIGITAL FIELD LAB</span><span>Built for curious minds</span></footer>
  </main>;
}
