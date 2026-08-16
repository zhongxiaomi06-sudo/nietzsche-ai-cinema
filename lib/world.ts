// World data types + client loader + fate branches + dimension colors.
// Ported from the original 《尼采·最后的十二年》 static experience.

export type Dim = { k: string; name: string };
export type State = Record<string, number>;

export type Agent = {
  id: string;
  name: string;
  role: string;
  initials: string;
  traits?: string[];
  goals?: string[];
  bio?: string;
  relToN?: string;
  voice?: string;
  psyche?: {
    archetype?: string;
    desire?: string;
    fear?: string;
    contradiction?: string;
    mask?: string;
    truth?: string;
    wound?: string;
    innerConflict?: string;
    ties?: string[];
  };
};

export type Chrono = {
  tick: number;
  date: string;
  label: string;
  anchor?: boolean;
  event: string;
  actors: string[];
};

export type Scholarship = {
  topic: string;
  finding: string;
  sources?: string[];
  acts?: number[];
};

export type WorldTheme = { name: string; desc: string; signal: string[] };

export type World = {
  meta: { title: string; source: string; engine: string; note: string };
  dims: Dim[];
  base: State;
  worldThemes: WorldTheme[];
  epoch: { year: string; context: string[]; forces: string[] };
  agents: Agent[];
  graph: { from: string; to: string; type: string; weight: number }[];
  memory: { year: string; who: string; text: string }[];
  chronology: Chrono[];
  sim: {
    actionBank: Record<string, string[]>;
    moodBank: Record<string, string[]>;
    monologueBank: Record<string, string[]>;
    effects: Record<string, State[]>;
    micro: Record<string, string[]>;
    telemetry?: unknown;
  };
  godPresets?: unknown;
  scholarship: Scholarship[];
};

export const READER_SEED = 1888;

// Dimension colors (verbatim from the original).
export const DCOLOR: Record<string, string> = {
  health: "#5fae7e",
  fame: "#c9a24a",
  solitude: "#7d92c4",
  thought: "#9b7bd0",
  will: "#d08a4a",
  love: "#d2648e",
  suffering: "#c0413a",
  freedom: "#4aa6b8",
};

// Fate branches: 2 per act, injecting a god-view variable that re-routes fate.
export const BRANCHES: { l: string; v: string }[][] = [
  [{ l: "封笔隐居山林", v: "放下笔，于恩加丁山间静养，不再写作" }, { l: "以焚身之速狂写", v: "不顾病体，以焚身之速继续写作" }],
  [{ l: "献书遭冷后隐忍", v: "献书科西玛遭冷遇，默默收起骄傲" }, { l: "愤而与其决裂", v: "对瓦格纳圈彻底失望，愤而决裂" }],
  [{ l: "收敛光芒蛰伏", v: "收敛超新星般的光芒，蛰伏等待" }, { l: "向全欧宣告自己", v: "向整个欧洲宣告自己的到来" }],
  [{ l: "与瓦格纳和解", v: "在记忆里与瓦格纳和解" }, { l: "把旧神钉上十字架", v: "写《尼采反对瓦格纳》，把旧神钉上十字架" }],
  [{ l: "拒绝被推介", v: "拒绝勃兰兑斯的早期推介，保持孤绝" }, { l: "借声名走向人群", v: "借哥本哈根的声名，缓缓走向人群" }],
  [{ l: "寄出和解的信", v: "向莎乐美寄出和解的信" }, { l: "把旧爱写进书里", v: "把莎乐美写进书里，任其灼烫" }],
  [{ l: "收回那封狂信", v: "收回写给国王的狂信，归于沉默" }, { l: "让神谕倾泻而出", v: "让神谕明信片倾泻而出，致国王与宰相" }],
  [{ l: "平静接受命运", v: "平静接受自己已成为神话的命运" }, { l: "以雷霆回应世界", v: "以雷霆回应世界：我枪决了该亚法" }],
  [{ l: "放生那匹马，转身离去", v: "在都灵广场放生那匹老马，转身离去" }, { l: "抱住马颈，防线溃决", v: "抱住马颈痛哭，防线彻底溃决" }],
  [{ l: "由奥维贝克护送回乡", v: "由奥维贝克接出，母亲温柔照料" }, { l: "在疯癫中独自漂流", v: "在疯癫中独自漂流，无人接住" }],
  [{ l: "遗稿任妹篡改", v: "逝世前任由伊丽莎白篡改遗稿" }, { l: "留下真遗嘱护稿", v: "留下真遗嘱，护住未竟的稿" }],
  [{ l: "声名沉入寂静", v: "逝世后声名沉入长久的寂静" }, { l: "化作世纪惊雷", v: "逝世后化作整个世纪的惊雷" }],
];

let _worldCache: World | null = null;

export async function loadWorld(): Promise<World> {
  if (_worldCache) return _worldCache;
  const r = await fetch("/twinWorld.data", { cache: "force-cache" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const w = (await r.json()) as World;
  _worldCache = w;
  return w;
}
