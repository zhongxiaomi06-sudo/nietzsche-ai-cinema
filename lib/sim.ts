// Deterministic simulation engine — faithful port of the original localSim / simTrajectory.
import type { World, Dim, State } from "./world";
import { READER_SEED } from "./world";

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

export function hseed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function pickN<T>(arr: T[] | undefined, n: number, seed: number): T[] {
  if (!arr || !arr.length) return [];
  const r = rng(seed);
  const c = [...arr];
  const out: T[] = [];
  while (out.length < n && c.length) {
    out.push(c.splice(Math.floor(r() * c.length), 1)[0]);
  }
  return out;
}

export type ActorOut = {
  id: string;
  name: string;
  action: string;
  action2: string;
  monologue: string;
  monologue2: string;
};

export type SimEvent = { who: string; text: string; kind: string };

// Per-agent activation for the relation-graph visualization.
export type AgentActivation = {
  id: string;
  name: string;
  initials: string;
  activation: number; // 0..1 how strongly this agent is "lit up" this act
  onStage: boolean; // is this agent a chronology actor this act
};

// A live relation edge (weight modulated by the current fate-line).
export type RelationEdge = {
  from: string;
  to: string;
  type: string;
  weight: number; // -1..1 signed relationship
  intensity: number; // 0..1 how active this tie is this act
};

export type SimResult = {
  actors: ActorOut[];
  events: SimEvent[];
  micro: string[];
  deltas: State;
  godDeltas: State;
  worldMood: number;
  narrative: string;
  emergent: string;
  agents: AgentActivation[];
  relations: RelationEdge[];
  couplingNote?: string; // human-readable note on which coupling dominated
};

export type Frame = {
  tick: number;
  state: State;
  deltas: State;
  godDeltas: State;
  res: SimResult;
  god: string;
};

const EM_MAP: Record<string, string> = {
  thought: "他的思想仍在燃烧，而身体已跟不上它。",
  love: "爱在他身上总是一道未愈的伤口，既渴望又逃避。",
  solitude: "孤独不是选择，是命运替他做好的安排。",
  suffering: "痛苦被他炼成了一种方法——重估一切的杠杆。",
  freedom: "自由在他这里既是礼物，也是放逐。",
  will: "意志是他唯一不肯交出的东西。",
  fame: "声名像影子，总在身后才追上本人。",
  health: "身体是这座思想的最后一座监狱。",
};

// ===== Multi-agent evolution parameters =====
// Dimension coupling matrix: how each dimension's LEVEL bleeds into others per tick.
// Applied as small forces so the eight dimensions co-evolve rather than move independently.
// coupling[a][b] = c means "a high level of a pushes b by c * (a-50)/50 each tick".
type Coup = { from: string; to: string; c: number; note: string };
const COUPLINGS: Coup[] = [
  { from: "suffering", to: "thought", c: 0.09, note: "痛苦被炼成重估一切的杠杆——思想因之更利" },
  { from: "suffering", to: "health", c: -0.07, note: "长期痛苦持续侵蚀这具身体" },
  { from: "will", to: "health", c: 0.06, note: "意志代偿：他以意志支撑起衰败的身体" },
  { from: "will", to: "suffering", c: -0.04, note: "意志把痛苦驯为可承受之物" },
  { from: "solitude", to: "love", c: -0.08, note: "孤独把爱越推越远" },
  { from: "solitude", to: "thought", c: 0.05, note: "孤绝反而让思想更纯粹地燃烧" },
  { from: "health", to: "will", c: 0.05, note: "身体尚存时，意志更易伸展" },
  { from: "fame", to: "suffering", c: 0.05, note: "声名带来被误读的预感，化作新的痛苦" },
  { from: "thought", to: "fame", c: 0.04, note: "思想的锋芒缓慢累积为身后的声名" },
  { from: "love", to: "solitude", c: -0.05, note: "被爱触及时，孤独略略退潮" },
];

// Non-linear thresholds: cascade forces that only fire in extreme regimes.
function thresholdForces(state: State, t: number): { d: State; note?: string } {
  const d: State = {};
  let note: string | undefined;
  const add = (k: string, v: number) => (d[k] = (d[k] || 0) + v);
  if ((state.health || 0) < 25) {
    // collapse regime — body failing drags everything toward the breakdown
    add("suffering", 4);
    add("will", -3);
    add("solitude", 2);
    note = "身体跌入崩溃临界：衰败开始自我加速";
  }
  if ((state.will || 0) > 78 && (state.health || 0) < 40) {
    // will over-compensation burns the body faster
    add("health", -3);
    add("thought", 3);
    note = note || "意志过度代偿：燃烧得更亮，也更快烧尽";
  }
  if ((state.solitude || 0) > 80) {
    add("suffering", 3);
    add("freedom", 2);
    note = note || "孤独抵达极点：既是深渊，也是最后的自由";
  }
  if (t >= 8 && (state.suffering || 0) > 70) {
    add("thought", -4);
    add("health", -3);
    note = note || "痛苦压过思想：都灵的秋光里，语言开始瓦解";
  }
  return { d, note };
}

function localSim(
  w: World,
  DIMS: Dim[],
  t: number,
  state: State,
  seed: number,
  god: string,
): SimResult {
  const chrono = w.chronology[t];
  const AB = w.sim.actionBank,
    MB = w.sim.monologueBank,
    MOOD = w.sim.moodBank,
    MC = w.sim.micro,
    EF = w.sim.effects;
  const actors = chrono.actors
    .map((id) => {
      const a = w.agents.find((x) => x.id === id);
      return a ? { id, name: a.name } : null;
    })
    .filter(Boolean) as { id: string; name: string }[];
  const r = rng(hseed(String(seed) + ":" + t));
  const actorOut: ActorOut[] = [];
  const events: SimEvent[] = [];
  const deltas: State = {};
  const godDeltas: State = {};
  DIMS.forEach((d) => (deltas[d.k] = 0));
  const scale = t >= 8 ? 1.6 : 1;
  let mood = 0.3;
  // Multi-agent: seed each agent's activation this act (0..1). On-stage actors start high.
  const activation: Record<string, number> = {};
  const onStage = new Set(actors.map((a) => a.id));
  for (const a of actors) {
    const acts = pickN(AB[a.id] || [], 2, hseed(String(seed) + ":act:" + t + ":" + a.id));
    const monos = pickN(MB[a.id] || [], 2, hseed(String(seed) + ":mono:" + t + ":" + a.id));
    const mo = pickN(MOOD[a.id] || ["静水"], 1, hseed(String(seed) + ":m:" + t + ":" + a.id))[0];
    mood = typeof mo === "number" ? mo : mood;
    actorOut.push({
      id: a.id,
      name: a.name,
      action: acts[0] || "（静默）",
      action2: acts[1] || "",
      monologue: monos[0] || "",
      monologue2: monos[1] || "",
    });
    const eg = EF[a.id] || [];
    const eff = eg.length ? eg[Math.floor(r() * eg.length)] : {};
    let mag = 0;
    for (const d of DIMS) {
      if (typeof eff[d.k] === "number") {
        const v = eff[d.k] * (a.id === "horse" && t === 8 ? 2 : 1) * (a.id === "illness" ? scale : 1);
        deltas[d.k] += v;
        mag += Math.abs(v);
      }
    }
    // activation from this agent's own effect magnitude (normalized), floor 0.55 for on-stage
    activation[a.id] = Math.max(0.55, Math.min(1, 0.5 + mag / 16));
    events.push({ who: a.name, text: acts[0] || "", kind: "action" });
  }
  // environmental micro-events
  const microIds = ["nietzsche", "lou", "elisabeth", "cosima", "overbeck", "public", "epoch", "wagner", "horse", "fame"];
  const micro: string[] = [];
  const mN = 7 + (t % 3);
  for (let i = 0; i < mN; i++) {
    const id = microIds[(t * 3 + i) % microIds.length];
    const pool = MC[id] || MC["epoch"] || [];
    if (pool.length) micro.push(pool[(t * 5 + i * 2) % pool.length]);
  }
  // god-view → eight-dimension deltas
  if (god && god.trim()) {
    events.push({ who: "上帝视角", text: god.trim(), kind: "god" });
    const g = god;
    if (/写|作|思|想|书|文|哲|超人|重估/.test(g)) deltas.thought += 5;
    if (/爱|友|聚|笑|亲|莎|和|温|柔|抱/.test(g)) {
      deltas.love += 5;
      deltas.solitude -= 3;
    }
    if (/病|痛|倒|晕|疯|漂流|衰|弱/.test(g)) {
      deltas.health -= 5;
      deltas.suffering += 3;
    }
    if (/旅|走|山|湖|野|离|放|去|转|远|漂/.test(g)) {
      deltas.freedom += 5;
      deltas.solitude += 2;
    }
    if (/争|战|锤|抗|怒|雷|枪|钉|决裂|反|叛/.test(g)) {
      deltas.will += 5;
      deltas.suffering += 2;
    }
    if (/信|神|祷|灵|马|静|隐|蛰|默|修/.test(g)) {
      deltas.suffering -= 3;
      deltas.love += 2;
    }
    if (/名|声|刊|版|欧洲|推介|惊雷|誉|盛/.test(g)) deltas.fame += 5;
    if (/烧|弃|忘|封|沉默|收起|隐退|归隐/.test(g)) {
      deltas.freedom += 3;
      deltas.suffering += 1;
    }
    deltas.freedom += 3;
    const hit = DIMS.reduce((a, d) => a + Math.abs(deltas[d.k] || 0), 0);
    if (hit < 8) {
      const dir = /不|无|未|没|拒绝|停止|放弃|熄灭/.test(g) ? -1 : 1;
      deltas.will += dir * 4;
      deltas.freedom += dir * 4;
      deltas.thought += dir * 3;
      deltas.solitude += -dir * 3;
    }
    DIMS.forEach((d) => {
      const v = deltas[d.k];
      if (v) godDeltas[d.k] = v;
    });
    // A god-edit lights up Nietzsche and anyone whose name/keywords appear.
    activation["nietzsche"] = 1;
    for (const ag of w.agents) {
      if (ag.id === "nietzsche") continue;
      const hitName = ag.name && g.includes(ag.name.slice(0, 2));
      if (hitName) activation[ag.id] = Math.max(activation[ag.id] || 0, 0.9);
    }
  }

  // ===== Relation-graph propagation (one hop) =====
  // Active agents propagate influence along signed graph edges to their ties.
  // Positive ties spread activation; the aggregate of active-agent × edge feeds dimensions.
  const propagated: Record<string, number> = { ...activation };
  for (const e of w.graph) {
    const srcAct = activation[e.from] || 0;
    if (srcAct <= 0.01) continue;
    const spread = srcAct * Math.abs(e.weight) * 0.6;
    propagated[e.to] = Math.min(1, (propagated[e.to] || 0) + spread);
    // Nietzsche's own ties feed back into dimensions by relationship type.
    if (e.from === "nietzsche" || e.to === "nietzsche") {
      const other = e.from === "nietzsche" ? e.to : e.from;
      const force = (activation[other] || 0) * e.weight * 1.4;
      if (!force) continue;
      switch (e.type) {
        case "love":
          deltas.love = (deltas.love || 0) + force;
          deltas.solitude = (deltas.solitude || 0) - force * 0.6;
          break;
        case "ally":
          deltas.solitude = (deltas.solitude || 0) - Math.abs(force) * 0.8;
          deltas.will = (deltas.will || 0) + Math.abs(force) * 0.4;
          break;
        case "antagonist":
          deltas.suffering = (deltas.suffering || 0) + Math.abs(force);
          deltas.will = (deltas.will || 0) + Math.abs(force) * 0.5;
          break;
        case "rival":
          deltas.will = (deltas.will || 0) + Math.abs(force) * 0.7;
          deltas.love = (deltas.love || 0) - Math.abs(force) * 0.3;
          break;
        case "mirror":
          deltas.thought = (deltas.thought || 0) + Math.abs(force) * 0.8;
          deltas.suffering = (deltas.suffering || 0) + Math.abs(force) * 0.4;
          break;
        case "family":
          deltas.love = (deltas.love || 0) + force * 0.5;
          break;
      }
    }
  }

  // ===== Dimension coupling (multi-factor weighting) =====
  let couplingNote: string | undefined;
  let maxCoup = 0;
  for (const cp of COUPLINGS) {
    const level = state[cp.from] || 0;
    const force = cp.c * ((level - 50) / 50) * 6; // scaled per-tick force
    if (!force) continue;
    deltas[cp.to] = (deltas[cp.to] || 0) + force;
    if (Math.abs(force) > maxCoup) {
      maxCoup = Math.abs(force);
      couplingNote = cp.note;
    }
  }

  // ===== Non-linear threshold cascades =====
  const thr = thresholdForces(state, t);
  for (const k of Object.keys(thr.d)) deltas[k] = (deltas[k] || 0) + thr.d[k];
  if (thr.note && (maxCoup < 2 || t >= 8)) couplingNote = thr.note;

  // Assemble agent-activation list for the relation-graph viz.
  const agents: AgentActivation[] = w.agents.map((ag) => ({
    id: ag.id,
    name: ag.name,
    initials: ag.initials || ag.name.slice(0, 1),
    activation: Math.min(1, propagated[ag.id] || 0),
    onStage: onStage.has(ag.id),
  }));
  // Live relation edges: keep edges touching any active node, intensity from both ends.
  const relations: RelationEdge[] = w.graph
    .map((e) => {
      const ia = propagated[e.from] || 0;
      const ib = propagated[e.to] || 0;
      return { from: e.from, to: e.to, type: e.type, weight: e.weight, intensity: Math.min(1, (ia + ib) / 2) };
    })
    .filter((e) => e.intensity > 0.05);
  // emergent insight
  const top = DIMS.slice().sort((a, b) => (state[b.k] || 0) - (state[a.k] || 0))[0];
  let emergent = EM_MAP[top.k] || "命运在都灵的秋光里自行汇聚。";
  if (t === 8) emergent = "车夫的鞭子落下时，他在老马身上认出了被驱使的思想本身；防线溃决。";
  else if (t === 6) emergent = "布克哈特把那封狂信转给奥维贝克——这一转手，间接决定了谁在终点伸手。";
  else if (t === 11) emergent = "名字在身后升起，也被剪辑与挪用——他一生抗拒的简化，正以最盛大的方式降临。";
  const narrative = `第 ${t + 1} 幕 · ${chrono.date}《${chrono.label}》：${chrono.event}`;
  return {
    actors: actorOut,
    events,
    micro,
    deltas,
    godDeltas,
    worldMood: Number((mood * 0.6 + 0.2).toFixed(3)),
    narrative,
    emergent,
    agents,
    relations,
    couplingNote,
  };
}

export function simTrajectory(w: World, DIMS: Dim[], godObj: Record<number, string>): Frame[] {
  const base: State = { ...(w.base || {}) };
  const state: State = { ...base };
  const n = w.chronology.length;
  const out: Frame[] = [];
  const carried: State = {};
  DIMS.forEach((d) => (carried[d.k] = 0));
  let forked = false;
  for (let t = 0; t < n; t++) {
    const g = godObj[t] || "";
    const res = localSim(w, DIMS, t, state, READER_SEED, g);
    const step: State = { ...res.deltas };
    if (forked) {
      DIMS.forEach((d) => {
        step[d.k] += carried[d.k] * 0.32;
      });
    }
    for (const d of DIMS) state[d.k] = clamp(state[d.k] + (step[d.k] || 0));
    out.push({ tick: t, state: { ...state }, deltas: step, godDeltas: res.godDeltas, res, god: g });
    if (g) {
      DIMS.forEach((d) => {
        carried[d.k] += res.godDeltas[d.k] || 0;
      });
      forked = true;
    }
  }
  return out;
}

// ===================================================================
// Multi-agent gambit — issue interventions on ANY agent and propagate
// the shock across the signed relation graph (multi-hop), then regroup
// factions and surface the cascade path. Pure & deterministic.
// ===================================================================
export type GambitAction = "draw" | "rupture" | "ally";
export const GAMBIT_ACTIONS: GambitAction[] = ["draw", "rupture", "ally"];

// Each intervention perturbs the target's stance toward Nietzsche and its ties.
// draw = pull the target closer to N (+valence, +heat)
// rupture = break with the target (−valence toward N, high heat)
// ally = bind the target into N's camp (+valence, spreads to the target's own allies)
const GAMBIT_KICK: Record<GambitAction, { self: number; heat: number }> = {
  draw: { self: 0.55, heat: 0.9 },
  rupture: { self: -0.7, heat: 1.0 },
  ally: { self: 0.7, heat: 0.85 },
};

export type GambitNode = {
  id: string;
  name: string;
  initials: string;
  heat: number; // 0..1 how shaken this agent is by the gambit
  valence: number; // -1..1 net stance toward Nietzsche after propagation
  faction: "inner" | "hostile" | "drift"; // camp after regrouping
  intervened: boolean;
};
export type GambitEdge = {
  from: string;
  to: string;
  type: string;
  baseWeight: number;
  effWeight: number; // weight after gambit shocks
  delta: number; // effWeight - baseWeight
  heat: number; // 0..1 how active this tie is in the cascade
  onShockPath: boolean;
};
export type GambitResult = {
  nodes: Record<string, GambitNode>;
  edges: GambitEdge[];
  shockPath: { from: string; to: string; hop: number }[];
  factions: { inner: string[]; hostile: string[]; drift: string[] };
  summary: string;
  hops: number;
};

// A relationship type's baseline sign toward "closeness" (positive = binds).
function relSign(type: string): number {
  switch (type) {
    case "love":
    case "ally":
    case "family":
      return 1;
    case "antagonist":
      return -1;
    case "rival":
      return -0.4;
    case "mirror":
      return 0.5;
    default:
      return 0.15;
  }
}

export function gambitPropagate(
  w: World,
  interventions: Record<string, GambitAction>,
): GambitResult {
  const ids = w.agents.map((a) => a.id);
  const heat: Record<string, number> = {};
  const valence: Record<string, number> = {};
  ids.forEach((id) => {
    heat[id] = 0;
    // baseline valence toward Nietzsche from the direct edge, if any
    const e = w.graph.find(
      (g) => (g.from === "nietzsche" && g.to === id) || (g.to === "nietzsche" && g.from === id),
    );
    valence[id] = e ? relSign(e.type) * Math.sign(e.weight || 1) * Math.min(1, Math.abs(e.weight) || 0.5) : 0;
  });

  // Seed the interventions.
  const seeds = Object.keys(interventions);
  const shockPath: { from: string; to: string; hop: number }[] = [];
  const edgeHeat: Record<string, number> = {};
  for (const id of seeds) {
    const k = GAMBIT_KICK[interventions[id]];
    heat[id] = Math.max(heat[id], k.heat);
    valence[id] = Math.max(-1, Math.min(1, valence[id] + k.self));
  }

  // Multi-hop BFS propagation along signed edges (up to 3 hops, decaying).
  const MAX_HOP = 3;
  let frontier = new Set(seeds);
  const seen = new Set(seeds);
  let maxHop = 0;
  for (let hop = 1; hop <= MAX_HOP && frontier.size; hop++) {
    const next = new Set<string>();
    const decay = Math.pow(0.55, hop - 1);
    for (const src of Array.from(frontier)) {
      const srcHeat = heat[src];
      if (srcHeat <= 0.05) continue;
      for (const e of w.graph) {
        let other: string | null = null;
        if (e.from === src) other = e.to;
        else if (e.to === src) other = e.from;
        if (!other) continue;
        const sign = relSign(e.type) * Math.sign(e.weight || 1);
        const flow = srcHeat * Math.abs(e.weight) * 0.6 * decay;
        if (flow < 0.04) continue;
        // heat spreads regardless of sign; valence carries the signed influence
        heat[other] = Math.min(1, heat[other] + flow);
        valence[other] = Math.max(-1, Math.min(1, valence[other] + sign * (valence[src] >= 0 ? flow : -flow)));
        const ek = e.from + "→" + e.to;
        edgeHeat[ek] = Math.min(1, (edgeHeat[ek] || 0) + flow);
        shockPath.push({ from: src, to: other, hop });
        if (!seen.has(other)) {
          seen.add(other);
          next.add(other);
        }
        maxHop = hop;
      }
    }
    frontier = next;
  }

  // Assemble nodes + faction regrouping.
  const nodes: Record<string, GambitNode> = {};
  const factions = { inner: [] as string[], hostile: [] as string[], drift: [] as string[] };
  for (const ag of w.agents) {
    if (ag.id === "nietzsche") {
      nodes[ag.id] = { id: ag.id, name: ag.name, initials: ag.initials || ag.name.slice(0, 1), heat: 1, valence: 1, faction: "inner", intervened: false };
      factions.inner.push(ag.id);
      continue;
    }
    const v = valence[ag.id];
    const h = heat[ag.id];
    let faction: GambitNode["faction"] = "drift";
    if (v > 0.28) faction = "inner";
    else if (v < -0.28) faction = "hostile";
    nodes[ag.id] = {
      id: ag.id,
      name: ag.name,
      initials: ag.initials || ag.name.slice(0, 1),
      heat: h,
      valence: v,
      faction,
      intervened: !!interventions[ag.id],
    };
    factions[faction].push(ag.id);
  }

  // Effective edges (weight shifted by the two endpoints' valence pull).
  const shockKeys = new Set(shockPath.map((s) => s.from + "→" + s.to).concat(shockPath.map((s) => s.to + "→" + s.from)));
  const edges: GambitEdge[] = w.graph.map((e) => {
    const pull = ((valence[e.from] || 0) + (valence[e.to] || 0)) / 2;
    const sign = relSign(e.type) >= 0 ? 1 : -1;
    const eff = Math.max(-1, Math.min(1, e.weight + sign * pull * 0.4));
    const ek = e.from + "→" + e.to;
    return {
      from: e.from,
      to: e.to,
      type: e.type,
      baseWeight: e.weight,
      effWeight: eff,
      delta: eff - e.weight,
      heat: edgeHeat[ek] || 0,
      onShockPath: shockKeys.has(ek),
    };
  });

  // Summary of the cascade.
  const nInt = seeds.length;
  const shaken = Object.values(nodes).filter((n) => !n.intervened && n.id !== "nietzsche" && n.heat > 0.12).length;
  const flipped = Object.values(nodes).filter((n) => n.intervened).map((n) => n.name);
  let summary = "";
  if (nInt === 0) {
    summary = "尚无干预。点选任意人物并施加「拉近／决裂／结盟」，冲击将沿关系网扩散。";
  } else {
    summary = `你对 ${flipped.join("、")} 施加了 ${nInt} 次干预；冲击经 ${maxHop} 跳扩散，波及 ${shaken} 位旁观者，阵营重组为 内圈 ${factions.inner.length - 1} · 敌对 ${factions.hostile.length} · 游离 ${factions.drift.length}。`;
  }

  return { nodes, edges, shockPath, factions, summary, hops: maxHop };
}

// Translate a set of gambit interventions into a single god-view rewrite line
// whose wording the god keyword-parser reliably picks up — so applying it feeds
// straight into the existing fate-rewrite pipeline (8-dim trajectory + AI rewrite
// + downstream carry). Returns "" when there is nothing to apply.
const GAMBIT_PHRASE: Record<GambitAction, (name: string) => string> = {
  draw: (n) => `拉近了与${n}的距离，重修旧日的温情与亲近`,
  ally: (n) => `与${n}结盟，聚拢志同道合者以壮声势`,
  rupture: (n) => `与${n}彻底决裂，愤而反目、划清界限`,
};

export function gambitToGod(w: World, interventions: Record<string, GambitAction>): string {
  const ids = Object.keys(interventions);
  if (!ids.length) return "";
  const parts = ids.map((id) => {
    const name = w.agents.find((a) => a.id === id)?.name || id;
    return GAMBIT_PHRASE[interventions[id]](name);
  });
  // Fold into one clause; the parser scans the whole string for trigger words.
  return `在这一幕，尼采${parts.join("；又")}——关系网就此重组，命运随之偏转。`;
}

export function firstGodIdx(godObj: Record<number, string>, total: number): number {
  for (let i = 0; i < total; i++) if (godObj[i]) return i;
  return -1;
}

export function moodWord(m: number): string {
  if (m > 0.62) return "炽烈";
  if (m > 0.45) return "不安";
  if (m > 0.3) return "苍冷";
  return "孤峭";
}

export function scholarsFor(w: World, idx: number) {
  const sch = w.scholarship || [];
  return sch.filter((s) => (s.acts || []).includes(idx)).slice(0, 3);
}

export { clamp };
