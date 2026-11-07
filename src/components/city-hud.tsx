import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronsRight,
  Cloud,
  FastForward,
  Flame,
  Grid2x2,
  Landmark,
  LayoutGrid,
  Minus,
  Pause,
  Play,
  Plus,
  Route,
  Trash2,
  Trophy,
  Users,
  Building2,
  CloudRain,
  Landmark as Bank,
  X,
  Zap,
  ZapOff,
  SunMoon,
  Home,
  Eraser,
  Factory,
  RotateCcw,
  RotateCw,
  Navigation2,
} from "lucide-react";
import { CATALOG, kindsIn, maxLevelOf, ROAD_COST, type Category, type Kind } from "@/game/catalog";
import {
  BuilderCard,
  NumberField,
  People,
  PeopleButton,
  type Player,
} from "@/components/hud-social";
import { LAW_DEFS, LAW_KEYS } from "@/game/laws";
import { murabahaInstallment, type BondOrder, type ProjectOrder } from "@/game/finance";
import type { NpcId } from "@/game/npcs";
import { DEVELOPERS, type DeveloperId, type DevelopmentKind } from "@/game/developments";
import { unreadCount } from "@/game/npcs";
import {
  Achievements,
  CelebrationCard,
  Companies,
  CostSliders,
  CrisisBanner,
  CrisisButtons,
  money,
  LangPicker,
  MoreSheet,
  TutorialCard,
  WeatherOverlay,
  YearReport,
  Voices,
  type Celebration,
  type MoreAction,
} from "@/components/hud-panels";
import {
  bulletin,
  demand,
  formatCityDate,
  incomePerSec,
  metrics,
  monthlyIncome,
  AUTO_COLLECT_STEPS,
  monthlyUpkeep,
  priceOf,
  QUESTS,
  stats,
  upgradeCost,
  coastal,
  blockReason,
  disasterBill,
  EVENTS,
  feeRevenue,
  loanInstallment,
  MODEL_AREAS,
  RANKS,
  rankOf,
  GOVERNOR_UPGRADE_SHARE,
  upgradeDeveloper,
  housingAidCost,
  effectiveHousing,
  ERAS,
  isUnlocked,
  neighborEffect,
  type CostKey,
  type CrisisKind,
  serviceCoverage,
  SERVICE_NAMES,
  type EventKind,
  type ModelKind,
  type DisasterKind,
  type Ordinances,
  type LawBudget,
  lawPayment,
  lawStrength,
  LAW_MAX_PCT,
  lawMonthly,
  type Sample,
  type Sim,
  type ZonePick,
  demolishPreview,
} from "@/game/sim";
import type { DayMode } from "@/game/three/day-night";
import { districtById } from "@/game/districts";
import { obligations, type Obligation } from "@/game/obligations";
import { Board, MegaProjects } from "@/components/hud-board";
import { StockMarket } from "@/components/hud-stocks";
import { CloudPanel } from "@/components/hud-cloud";
import type { StockId } from "@/game/stocks";
import { boardFee, projectMoney, type BoardState, type DeptId } from "@/game/board";
import { currency, dirOf, percentSign, setLang, t, tx, useLang, bigNum, getLang } from "@/i18n";

export type PayTarget =
  | { kind: "all" }
  | { kind: "loan" }
  | { kind: "murabaha"; id: string }
  | { kind: "npc"; id: NpcId };

export type HudTool =
  | { kind: "road" }
  | { kind: "bulldoze" }
  | { kind: "demolish" }
  | { kind: "zone" }
  | { kind: "build"; building: Kind }
  | { kind: "site"; project: DevelopmentKind; developer: DeveloperId }
  | null;

type GraphKey = Exclude<keyof Sample, "day">;
/** Related panels shown as tabs of one window. */
const PANEL_GROUPS: { title: string; tabs: { id: Panel; label: string }[] }[] = [
  {
    title: "الميزانية والمشاريع",
    tabs: [
      { id: "budget", label: "الميزانية" },
      { id: "laws", label: "القوانين" },
      { id: "projects", label: "المشاريع" },
    ],
  },
  {
    title: "مجلس الإدارة والمستشارون",
    tabs: [
      { id: "board", label: "مجلس الإدارة" },
      { id: "advisors", label: "المستشارون" },
    ],
  },
  {
    title: "التقارير وآراء الناس",
    tabs: [
      { id: "report", label: "التقرير السنوي" },
      { id: "graphs", label: "الرسوم" },
      { id: "voices", label: "آراء الناس" },
      { id: "achievements", label: "الإنجازات" },
    ],
  },
  {
    title: "الاستثمار",
    tabs: [
      { id: "companies", label: "الشركات" },
      { id: "stocks", label: "سوق الأسهم" },
    ],
  },
];
const inGroup = (p: Panel | null, i: number) => p !== null && PANEL_GROUPS[i]!.tabs.some((tab) => tab.id === p);
const groupOf = (p: Panel | null) => (p ? PANEL_GROUPS.find((g) => g.tabs.some((tab) => tab.id === p)) : undefined);
const BUDGET_GROUP: Panel[] = PANEL_GROUPS[0]!.tabs.map((tab) => tab.id);

type Panel =
  | "graphs"
  | "budget"
  | "laws"
  | "advisors"
  | "disasters"
  | "projects"
  | "companies"
  | "report"
  | "achievements"
  | "people"
  | "voices"
  | "board"
  | "stocks"
  | "cloud";

const SERIES: { key: GraphKey; label: string; token: string }[] = [
  { key: "water", label: "ماء %", token: "--color-sc-sky" },
  { key: "power", label: "كهرباء %", token: "--color-sc-orange" },
  { key: "crime", label: "الجريمة", token: "--color-coral" },
  { key: "pop", label: "السكان", token: "--color-sc-leaf" },
  { key: "funds", label: "الأموال", token: "--color-sc-gold" },
  { key: "pollution", label: "التلوث", token: "--color-sc-pink" },
  { key: "traffic", label: "الزحمة", token: "--color-sand" },
  { key: "unemployment", label: "البطالة", token: "--color-ink" },
  { key: "industry", label: "الصناعة", token: "--color-gulf" },
  { key: "approval", label: "الرضا", token: "--color-sc-lime" },
  { key: "size", label: "حجم المدينة", token: "--color-sc-green" },
  { key: "commerce", label: "التجارة", token: "--color-sc-sky" },
  { key: "land", label: "قيمة الأرض", token: "--color-sand" },
  { key: "health", label: "الصحة", token: "--color-sc-leaf" },
  { key: "education", label: "التعليم", token: "--color-gulf" },
];

const LAWS: { key: keyof Ordinances; title: string; detail: string }[] = LAW_KEYS.map((key) => ({
  key,
  title: LAW_DEFS[key].title,
  detail: LAW_DEFS[key].detail,
}));

function Laws({
  snap,
  onOrdinance,
  onLawBudget,
}: {
  snap: Sim;
  onOrdinance: (key: keyof Ordinances, value: boolean) => void;
  onLawBudget: (key: keyof Ordinances, patch: Partial<LawBudget>) => void;
}) {
  return (
    <div className="space-y-2" dir={dirOf()}>
      <p className="text-xs leading-relaxed">
        {t(
          "لكل قانون تختار بالمؤشر نسبة سنوية من دخل المدينة تُصرف عليه، وتُقسّط على أشهر السنة. كلما زادت النسبة قوي أثر القانون، حتى ٣ أضعاف.",
        )}
      </p>
      <p className="sc-lcd h-auto py-1 text-xs">
        {t("القوانين المفعّلة {on} من {all} · تكلفتها {amount} د.ك شهرياً", {
          on: LAWS.filter((l) => snap.ordinances[l.key]).length,
          all: LAWS.length,
          amount: fmt(LAWS.reduce((n, l) => n + lawMonthly(snap, l.key), 0)),
        })}
      </p>
      <ul className="space-y-2">
        {LAWS.map((law) => {
          const on = snap.ordinances[law.key];
          if (!on)
            return (
              <li key={law.key} data-testid={`law-${law.key}`}>
                <button
                  type="button"
                  aria-pressed={false}
                  onClick={() => onOrdinance(law.key, true)}
                  className="flex w-full items-center gap-2 rounded-md border-2 border-sc-ink/30 bg-sc-mint p-2 text-start text-sc-ink"
                >
                  <span className="grid h-6 w-6 place-items-center rounded border-2 border-sc-ink bg-white" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold">{t(law.title)}</span>
                    <span className="block text-xs opacity-80">{t(law.detail)}</span>
                  </span>
                </button>
              </li>
            );
          const b = snap.lawBudget[law.key];
          const strength = lawStrength(snap, law.key);
          return (
            <li
              key={law.key}
              data-testid={`law-${law.key}`}
              className={`rounded-md border-2 p-2 ${on ? "border-sc-ink bg-sc-gold/40" : "border-sc-ink/30 bg-sc-mint"} text-sc-ink`}
            >
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onOrdinance(law.key, !on)}
                className="flex w-full items-center gap-2 text-start"
              >
                <span className="grid h-6 w-6 place-items-center rounded border-2 border-sc-ink bg-white">
                  {on ? <Check size={16} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold">{t(law.title)}</span>
                  <span className="block text-xs opacity-80">{t(law.detail)}</span>
                </span>
              </button>
              <label className="mt-1 block text-xs font-extrabold">
                {t("النسبة السنوية من دخل المدينة: {n}٪", { n: b.value })}
                <input
                  type="range"
                  min={0}
                  max={LAW_MAX_PCT}
                  step={0.5}
                  value={b.value}
                  data-testid={`law-${law.key}-value`}
                  aria-label={t("نسبة تمويل القانون")}
                  onChange={(e) => onLawBudget(law.key, { value: Number(e.target.value) })}
                  className="mt-1 h-9 w-full accent-sc-leaf"
                />
              </label>
              <p className="mt-1 text-[11px] font-extrabold">
                {t("يكلف {amount} د.ك سنوياً (يُقسّط شهرياً) · قوة الأثر {pct}٪", {
                  amount: fmt(lawPayment(snap, law.key) * 12),
                  pct: Math.round(strength * 100),
                })}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function fmt(n: number) {
  return Math.abs(n) >= 1e9 ? bigNum(n, getLang()) : Math.floor(n).toLocaleString("en-US");
}

export function CityHud({
  snap,
  tool,
  cat,
  selectedId,
  stored,
  confirmReset,
  toasts,
  onStart,
  onDistricts,
  onFocusDistrict,
  onSpeed,
  onCategory,
  onRoad,
  onBulldoze,
  onDemolish,
  onZone,
  onBuild,
  onTax,
  onCost,
  onAutoRaise,
  onDeposit,
  onWithdraw,
  onBond,
  onProject,
  onConsult,
  onMudaraba,
  onMudarabaWithdraw,
  onSukuk,
  onMurabaha,
  onHousingAid,
  onGiveAid,
  onInsure,
  onDevelop,
  onPickSite,
  onCrisis,
  onPhoto,
  onMusic,
  music,
  tutorial,
  onTutorialSkip,
  onPanel,
  celebration,
  onCelebrationClose,
  onLoan,
  player,
  onEditPlayer,
  onBuilderHire,
  onBuilderFire,
  onBuilderShare,
  onNpcOpen,
  onChat,
  onLend,
  onBorrow,
  onNpcRepay,
  onPay,
  onEvent,
  onModel,
  onOrdinance,
  onLawBudget,
  onDisaster,
  onRandom,
  onLuck,
  onUpgrade,
  onCollect,
  onAutoCollect,
  onMute,
  onAskReset,
  onReset,
  onCancelReset,
  onZoom,
  onRotate,
  heading,
  graphics,
  onGraphics,
  onDayMode,
  dayMode,
  zone,
  onZoneApply,
  onVoicesSeen,
  onBoard,
  onPower,
  onApprove,
  onParam,
  onOrder,
  onCancelOrder,
  onBuyStock,
  onSellStock,
  onDemolishApply,
  onZoneCancel,
}: {
  snap: Sim;
  tool: HudTool;
  cat: Category;
  selectedId: string | null;
  stored: number;
  confirmReset: boolean;
  toasts: { id: number; text: string }[];
  onStart: () => void;
  onDistricts: () => void;
  onFocusDistrict: () => void;
  onSpeed: (n: 0 | 1 | 2 | 3) => void;
  onCategory: (id: Category) => void;
  onRoad: () => void;
  onBulldoze: () => void;
  onDemolish: () => void;
  onZone: () => void;
  onBuild: (kind: Kind) => void;
  onTax: (n: number) => void;
  onCost: (key: CostKey, value: number) => void;
  onAutoRaise: (pct: number) => void;
  onDeposit: (amount: number, rate: number) => void;
  onWithdraw: (amount: number) => void;
  onBond: (order: number | BondOrder) => void;
  onProject: (order: number | ProjectOrder) => void;
  player: Player;
  onEditPlayer: () => void;
  onBuilderHire: () => void;
  onBuilderFire: () => void;
  onBuilderShare: (pct: number) => void;
  onNpcOpen: (id: NpcId) => void;
  onChat: (id: NpcId, text: string) => void;
  onLend: (id: NpcId, amount: number, rate: number, months: number) => void;
  onBorrow: (id: NpcId, amount: number, rate: number, months: number) => void;
  onNpcRepay: (id: NpcId) => void;
  onConsult: () => void;
  onMudaraba: (amount: number, expected: number) => void;
  onMudarabaWithdraw: () => void;
  onSukuk: (issuer: "islamic" | "developer", amount: number, expected: number, years: number) => void;
  onMurabaha: (amount: number, profit: number, months: number) => void;
  onHousingAid: (pct: number) => void;
  onGiveAid: (amount: number) => void;
  onInsure: (on: boolean, kind?: "money" | "disaster") => void;
  onDevelop: (kind: DevelopmentKind, developer: DeveloperId) => void;
  onPickSite: (kind: DevelopmentKind, developer: DeveloperId) => void;
  onCrisis: (kind: CrisisKind) => void;
  onPhoto: () => void;
  onMusic: () => void;
  music: boolean;
  tutorial: number;
  onTutorialSkip: () => void;
  onPanel: (panel: string | null) => void;
  celebration: Celebration | null;
  onCelebrationClose: () => void;
  onLoan: (amount: number, rate: number) => void;
  onPay: (target: PayTarget, amount?: number) => void;
  onEvent: (kind: EventKind) => void;
  onModel: (kind: ModelKind) => void;
  onOrdinance: (key: keyof Ordinances, value: boolean) => void;
  onLawBudget: (key: keyof Ordinances, patch: Partial<LawBudget>) => void;
  onDisaster: (kind: DisasterKind) => void;
  onRandom: (value: boolean) => void;
  onLuck: () => void;
  onUpgrade: () => void;
  onCollect: () => void;
  onAutoCollect: (months: number) => void;
  onMute: () => void;
  onAskReset: () => void;
  onReset: () => void;
  onCancelReset: () => void;
  onZoom: (factor: number) => void;
  onRotate: (by: number | "north") => void;
  heading: number;
  graphics: "auto" | "high" | "low";
  onGraphics: (mode: "auto" | "high" | "low") => void;
  onDayMode: (mode: DayMode) => void;
  dayMode: DayMode;
  zone: { c0: number; r0: number; c1: number; r1: number } | null;
  onZoneApply: (pick: ZonePick) => void;
  onVoicesSeen: () => void;
  onBoard: (patch: Partial<BoardState>) => void;
  onPower: (dept: DeptId, on: boolean) => void;
  onApprove: (key: string) => void;
  onParam: (dept: DeptId, key: string, value: number) => void;
  onOrder: (dept: DeptId, kind: Kind, count: number) => void;
  onCancelOrder: (id: string) => void;
  onBuyStock: (id: StockId, pct: number) => void;
  onSellStock: (id: StockId, pct: number) => void;
  onDemolishApply: () => void;
  onZoneCancel: () => void;
}) {
  const lang = useLang();
  const dir = dirOf(lang);
  const [panel, setPanelState] = useState<Panel | null>(null);
  const [more, setMore] = useState(false);
  const setPanel = (next: Panel | null | ((p: Panel | null) => Panel | null)) =>
    setPanelState((p) => {
      const value = typeof next === "function" ? next(p) : next;
      onPanel(value);
      return value;
    });
  const [tray, setTray] = useState(false);
  const [span, setSpan] = useState<1 | 10 | 100>(10);
  const [onKeys, setOnKeys] = useState<GraphKey[]>(["pop", "approval", "unemployment"]);
  const [ticker, setTicker] = useState(0);

  const hasLegacy =
    typeof localStorage !== "undefined" && localStorage.getItem("omdat-kuwait-v1") !== null;
  const st = stats(snap);
  const selected = snap.buildings.find((b) => b.id === selectedId) ?? null;
  const lines = bulletin(snap, st);
  const dem = demand(snap, st);
  const line = lines[ticker % lines.length] ?? "";
  const unseenVoices = (snap.voices ?? []).some((v) => v.day > (snap.voicesSeen ?? -1));
  useEffect(() => {
    if (panel === "voices" && unseenVoices) onVoicesSeen();
  }, [panel, unseenVoices, onVoicesSeen]);

  useEffect(() => {
    const id = window.setInterval(() => setTicker((n) => n + 1), 3400);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setPanel(null);
    setTray(false);
  }, [snap.district]);
  function togglePanel(next: Panel) {
    // A button opens its group; pressing it again while any tab of it is open closes it.
    const group = PANEL_GROUPS.find((g) => g.tabs.some((tab) => tab.id === next));
    setPanel((p) => (p === next || (group && p && group.tabs.some((tab) => tab.id === p)) ? null : next));
  }

  function openCat(id: Category) {
    if (tray && (cat === id || (id === "housing" && cat === "commerce"))) {
      setTray(false);
      return;
    }
    onCategory(id);
    setTray(true);
  }

  const cards = cat === "commerce" || cat === "housing" ? kindsIn(cat) : tray ? kindsIn(cat) : [];

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-10">
        {snap.started && <WeatherOverlay snap={snap} />}
        {snap.started && (
          <div className="hud-tools safe-top pointer-events-auto absolute right-1 top-0 flex flex-col items-center gap-1 pt-2">
            <Round
              label={t("سكن وتجارة")}
              tut="tool-homes"
              on={tray && (cat === "housing" || cat === "commerce")}
              onClick={() => openCat("housing")}
            >
              <LayoutGrid size={18} />
            </Round>
            <Round label={t("طرق")} tut="tool-road" on={tool?.kind === "road"} onClick={onRoad}>
              <Route size={18} />
            </Round>
            <Round
              label={t("تنظيم منطقة")}
              on={tool?.kind === "zone" || zone !== null}
              onClick={onZone}
            >
              <Grid2x2 size={18} />
            </Round>
            <Round
              label={t("كهرباء وماء وخدمات")}
              on={tray && cat === "services"}
              onClick={() => openCat("services")}
            >
              <Zap size={18} />
            </Round>
            <Round
              label={t("معالم")}
              on={tray && cat === "landmarks"}
              onClick={() => openCat("landmarks")}
            >
              <Landmark size={18} />
            </Round>
            <Round
              label={t("صناعة وميناء ومصفاة")}
              on={tray && cat === "industry"}
              onClick={() => openCat("industry")}
            >
              <Factory size={18} />
            </Round>
            <Round label={t("هدم")} on={tool?.kind === "bulldoze"} onClick={onBulldoze}>
              <Trash2 size={18} />
            </Round>
            <Round
              label={t("هدم منطقة")}
              on={tool?.kind === "demolish"}
              onClick={onDemolish}
            >
              <Eraser size={18} />
            </Round>
            <Rci r={dem.r} c={dem.c} i={dem.i} />
          </div>
        )}
        {snap.started && (
          <button
            type="button"
            data-testid="rank"
            onClick={() => togglePanel("advisors")}
            className="hud-badge pointer-events-auto absolute left-2 top-0 mt-2 flex flex-col items-start rounded-md bg-sc-ink/85 px-2 py-1 text-start text-sc-mint"
            dir={dir}
          >
            <span className="flex items-center gap-1.5 text-sm font-extrabold">
              <span className="text-2xl leading-none">{player.avatar}</span>
              <span className="flex flex-col leading-tight">
                <span data-testid="player-label">{player.name}</span>
                <span className="flex items-center gap-1 text-xs text-sc-gold">
                  <Trophy size={12} /> {t(RANKS[rankOf(st.residents)]!.title)}
                </span>
              </span>
            </span>
            <span className={`text-xs font-bold ${st.happy < 40 ? "text-coral" : "text-sc-lime"}`}>
              {t("رضا الناس {n}%", { n: st.happy })}
            </span>
          </button>
        )}
        {snap.started && (
          <div className="hud-left pointer-events-auto absolute flex flex-col gap-2">
            <PeopleButton unread={unreadCount(snap)} onClick={() => togglePanel("people")} />
            <Round label={t("تقريب")} onClick={() => onZoom(1.28)}>
              <Plus size={18} />
            </Round>
            <Round label={t("تبعيد")} onClick={() => onZoom(1 / 1.28)}>
              <Minus size={18} />
            </Round>
            <Round label={t("لف الخريطة يساراً")} onClick={() => onRotate(-45)}>
              <RotateCcw size={18} />
            </Round>
            <Round label={t("لف الخريطة يميناً")} onClick={() => onRotate(45)}>
              <RotateCw size={18} />
            </Round>
            <Round
              label={t("البوصلة: اضغط ليصير الشمال للأعلى")}
              testid="compass"
              on={heading === 0}
              onClick={() => onRotate("north")}
            >
              <span className="relative block h-[18px] w-[18px]" style={{ transform: `rotate(${heading}deg)` }}>
                <Navigation2 size={18} className="absolute inset-0" fill="currentColor" />
              </span>
            </Round>
            <Round
              label={t("الإضاءة: {mode}", {
                mode: dayMode === "auto" ? "تلقائية" : dayMode === "day" ? "نهار" : "ليل",
              })}
              testid="day-mode"
              on={dayMode === "night"}
              onClick={() =>
                onDayMode(dayMode === "auto" ? "day" : dayMode === "day" ? "night" : "auto")
              }
            >
              <SunMoon size={18} />
            </Round>
            <span className="view-3d-badge" dir={dir}>
              {t(
                dayMode === "night"
                  ? "ليل المدينة"
                  : dayMode === "day"
                    ? "نهار المدينة"
                    : "دورة النهار والليل",
              )}
            </span>
          </div>
        )}
      </div>

      {snap.district && snap.started && (
        <div className="pointer-events-none absolute bottom-48 left-1/2 z-20 -translate-x-1/2">
          <button
            type="button"
            data-testid="current-district"
            onClick={onFocusDistrict}
            className="district-focus pointer-events-auto"
          >
            {t(districtById(snap.district)?.name ?? "")} ·{" "}
            {t(snap.district === "free" ? "عرض المدينة" : "عرض القطع")}
          </button>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col">
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-x-0 top-2 flex flex-col items-center gap-1 px-16">
            {snap.started && <CrisisBanner snap={snap} />}
            {!snap.started &&
              toasts.map((item) => (
                <p key={item.id} className="sc-lcd text-sm">
                  {tx(item.text)}
                </p>
              ))}
          </div>
          {zone && tool?.kind === "demolish" ? (
            <DemolishCard snap={snap} zone={zone} onApply={onDemolishApply} onCancel={onZoneCancel} />
          ) : (
            zone && <ZoneCard onApply={onZoneApply} onCancel={onZoneCancel} />
          )}
          {panel && snap.started && (
            <section
              className="hud-panel sc-panel pointer-events-auto absolute bottom-2 left-2 right-16 top-2 flex flex-col overflow-hidden rounded-md"
              dir={dir}
            >
              <div className="sc-title m-2">
                <button
                  type="button"
                  className="sc-x"
                  aria-label={t("إغلاق")}
                  onClick={() => setPanel(null)}
                >
                  <X size={18} />
                </button>
                <h2 className="flex-1 text-center text-base">
                  {groupOf(panel) ? t(groupOf(panel)!.title) : null}
                  {panel === "disasters" && t("الكوارث")}
                  {panel === "people" && t("اللاعبون والمحادثات")}
                  {panel === "cloud" && t("الحفظ السحابي")}
                </h2>
              </div>
              {groupOf(panel) && (
                <div className="mx-2 mb-2 flex gap-1" role="tablist" data-testid="panel-tabs">
                  {groupOf(panel)!.tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={panel === tab.id}
                      data-testid={`tab-${tab.id}`}
                      onClick={() => setPanel(tab.id)}
                      className={`sc-menu h-9 min-w-0 flex-1 px-1 text-xs ${panel === tab.id ? "sc-on" : ""}`}
                    >
                      {t(tab.label)}
                    </button>
                  ))}
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                {panel === "graphs" && (
                  <Graphs
                    snap={snap}
                    span={span}
                    onKeys={onKeys}
                    onSpan={setSpan}
                    onToggle={(key) =>
                      setOnKeys((list) =>
                        list.includes(key) ? list.filter((k) => k !== key) : [...list, key],
                      )
                    }
                  />
                )}
                {panel === "budget" && (
                  <Budget
                    snap={snap}
                    onTax={onTax}
                    onCost={onCost}
                    onAutoRaise={onAutoRaise}
                    onMurabaha={onMurabaha}
                    onHousingAid={onHousingAid}
                    onGiveAid={onGiveAid}
                    onLoan={onLoan}
                    onPay={onPay}
                    stored={stored}
                    onCollect={onCollect}
                    onAutoCollect={onAutoCollect}
                  />
                )}
                {panel === "companies" && (
                  <Companies
                    snap={snap}
                    onDeposit={onDeposit}
                    onWithdraw={onWithdraw}
                    onBond={onBond}
                    onProject={onProject}
                    onConsult={onConsult}
                    onMudaraba={onMudaraba}
                    onMudarabaWithdraw={onMudarabaWithdraw}
                    onSukuk={onSukuk}
                    onDevelop={(kind, dev) => {
                      onDevelop(kind, dev);
                      setPanel(null);
                    }}
                    onInsure={onInsure}
                    onPickSite={(kind, dev) => {
                      onPickSite(kind, dev);
                      setPanel(null);
                    }}
                  />
                )}
                {panel === "report" && <YearReport snap={snap} />}
                {panel === "voices" && <Voices snap={snap} />}
                {panel === "stocks" && <StockMarket snap={snap} onBuy={onBuyStock} onSell={onSellStock} />}
                {panel === "cloud" && <CloudPanel snap={snap} />}
                {panel === "board" && (
                  <Board
                    snap={snap}
                    onBoard={onBoard}
                    onPower={onPower}
                    onApprove={onApprove}
                    onParam={onParam}
                    onOrder={onOrder}
                    onCancelOrder={onCancelOrder}
                  />
                )}
                {panel === "achievements" && <Achievements snap={snap} />}
                {panel === "people" && (
                  <People
                    snap={snap}
                    player={player}
                    onOpen={onNpcOpen}
                    onChat={onChat}
                    onLend={onLend}
                    onBorrow={onBorrow}
                    onRepay={onNpcRepay}
                  />
                )}
                {panel === "projects" && (
                  <div className="mb-3">
                    <BuilderCard
                      snap={snap}
                      onHire={onBuilderHire}
                      onFire={onBuilderFire}
                      onShare={onBuilderShare}
                    />
                  </div>
                )}
                {panel === "projects" && (
                  <Projects
                    snap={snap}
                    onEvent={(kind) => {
                      onEvent(kind);
                      setPanel(null);
                    }}
                    onModel={(kind) => {
                      onModel(kind);
                      setPanel(null);
                    }}
                  />
                )}
                {panel === "projects" && (
                  <MegaProjects snap={snap} onApprove={onApprove} />
                )}
                {panel === "laws" && (
                  <Laws snap={snap} onOrdinance={onOrdinance} onLawBudget={onLawBudget} />
                )}
                {panel === "advisors" && <Advisors snap={snap} />}
                {panel === "disasters" && (
                  <>
                    <Disasters snap={snap} onDisaster={onDisaster} onRandom={onRandom} />
                    <div className="mt-3">
                      <CrisisButtons snap={snap} onCrisis={onCrisis} />
                    </div>
                  </>
                )}
              </div>
            </section>
          )}
          {!snap.started && (
            <div className="absolute inset-x-0 bottom-0">
              <div
                className="sc-panel pointer-events-auto safe-bottom mx-2 rounded-t-xl px-4 pt-5"
                dir={dir}
              >
                <LangPicker />
                <p className="text-sm font-bold text-sc-leaf">
                  {RANKS.map((r) => t(r.title)).join(lang === "ar" ? " ← " : " → ")}
                </p>
                <h2 className="mt-1 text-3xl font-extrabold leading-tight">{t("المحافظ")}</h2>
                <p className="mt-2 text-base leading-relaxed">
                  {t(
                    "ابدأ مساعداً للمختار على خريطة الكويت الحقيقية. أرضِ الناس بالخدمات والأسعار العادلة لتكبر منطقتك وتترقّى.",
                  )}
                </p>
                <button
                  type="button"
                  data-testid="choose-neighborhood"
                  onClick={onDistricts}
                  className="sc-menu sc-on mt-4 w-full text-base"
                >
                  {t("اختر الحي وابدأ")}
                </button>
                {hasLegacy && (
                  <button
                    type="button"
                    data-testid="start-city"
                    onClick={onStart}
                    className="mt-2 w-full py-2 text-sm underline underline-offset-4"
                  >
                    {t("استئناف مدينة الكويت القديمة")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {snap.started && (
          <footer className="sc-status pointer-events-auto safe-bottom" dir={dir}>
            {confirmReset && (
              <div className="flex items-center gap-2 px-3 py-2">
                <p className="flex-1 text-sm text-sc-mint">
                  {t("إعادة المدينة الحالية من الصفر؟ مدن الأحياء الأخرى محفوظة.")}
                </p>
                <button type="button" onClick={onReset} className="sc-menu sc-on h-11 px-3 text-sm">
                  {t("امسح")}
                </button>
                <button type="button" onClick={onCancelReset} className="sc-textbtn text-sm">
                  {t("لا")}
                </button>
              </div>
            )}
            {selected && (
              <div className="mx-2 mt-2 flex items-center gap-2 rounded-md bg-sc-mint px-2 py-1 text-sc-ink">
                <img
                  src={`/game/${selected.kind}.png`}
                  alt=""
                  className="h-12 w-12 object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">
                    {t(CATALOG[selected.kind].name)} ·{" "}
                    {t("مستوى {level}/{max}", {
                      level: selected.level,
                      max: maxLevelOf(selected.kind),
                    })}
                    {selected.level >= 4 ? ` · ${t("ناطحة سحاب")}` : ""}
                  </p>
                  <p className="text-xs">
                    {t("{n} د.ك/ث", { n: incomePerSec(selected, snap).toFixed(1) })}
                    {coastal(selected.c, selected.r) && CATALOG[selected.kind].coastBoost
                      ? ` · ${t("كورنيش")}`
                      : ""}
                  </p>
                  {neighborEffect(snap, selected).notes.length > 0 && (
                    <p className="truncate text-xs">
                      {neighborEffect(snap, selected).notes.join(" · ")}
                    </p>
                  )}
                  {selected.level < maxLevelOf(selected.kind) && (
                    <p className="text-xs">
                      {t("الترقية على {company}، والسكان يدفعون: ٩٩٪ لك و١٪ للمطور", {
                        company: DEVELOPERS[upgradeDeveloper(snap)].name,
                      })}
                    </p>
                  )}
                  {blockReason(selected, snap) && (
                    <p className="text-xs text-coral">{blockReason(selected, snap)}</p>
                  )}
                </div>
                <button
                  type="button"
                  data-tut="upgrade"
                  data-testid="upgrade"
                  disabled={selected.level >= maxLevelOf(selected.kind)}
                  onClick={onUpgrade}
                  className="sc-menu h-11 shrink-0 px-3 text-xs disabled:opacity-40"
                >
                  {selected.level >= maxLevelOf(selected.kind)
                    ? t("مكتمل")
                    : t("ترقّي · +{amount} لك", {
                        amount: fmt(
                          priceOf(upgradeCost(selected.kind, selected.level), snap) *
                            GOVERNOR_UPGRADE_SHARE,
                        ),
                      })}
                </button>
              </div>
            )}
            {tray && tool?.kind !== "road" && tool?.kind !== "bulldoze" && (
              <div className="pt-2">
                {(cat === "housing" || cat === "commerce") && (
                  <div className="mb-1 flex gap-1 px-2">
                    <button
                      type="button"
                      aria-pressed={cat === "housing"}
                      onClick={() => onCategory("housing")}
                      className={`sc-menu px-3 text-sm ${cat === "housing" ? "sc-on" : ""}`}
                    >
                      {t("سكن")}
                    </button>
                    <button
                      type="button"
                      aria-pressed={cat === "commerce"}
                      onClick={() => onCategory("commerce")}
                      className={`sc-menu px-3 text-sm ${cat === "commerce" ? "sc-on" : ""}`}
                    >
                      {t("تجارة")}
                    </button>
                  </div>
                )}
                <div className="flex gap-2 overflow-x-auto px-2 pb-1">
                  {cards.map((def) => {
                    const price = priceOf(def.cost, snap);
                    const on = tool?.kind === "build" && tool.building === def.kind;
                    const poor = price > 0 && snap.coins < price;
                    const locked = !isUnlocked(snap, def.kind);
                    return (
                      <button
                        key={def.kind}
                        type="button"
                        data-testid={`build-${def.kind}`}
                        aria-pressed={on}
                        disabled={locked}
                        title={
                          locked ? t("يُفتح في حقبة {era}", { era: ERAS[def.era ?? 0]! }) : t(def.blurb)
                        }
                        onClick={() => onBuild(def.kind)}
                        className={`relative flex w-24 shrink-0 flex-col items-center rounded-md border-2 px-1 py-1 ${
                          on ? "sc-on border-sc-ink" : "border-sc-ink bg-sc-mint text-sc-ink"
                        } ${poor || locked ? "opacity-50" : ""}`}
                      >
                        {locked && (
                          <span className="absolute inset-x-0 top-1 text-center text-[10px] font-extrabold">
                            🔒 {t(ERAS[def.era ?? 0]!)}
                          </span>
                        )}
                        <img
                          src={`/game/${def.kind}.png`}
                          alt=""
                          className="h-12 w-full object-contain"
                        />
                        <span className="mt-1 w-full truncate text-center text-xs font-extrabold">
                          {t(def.name)}
                        </span>
                        <span className="text-xs">
                          {def.needsCoast ? `${t("على البحر")} · ` : ""}
                          {price === 0 ? t("مجاني") : money(price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {tool?.kind === "road" && (
              <p className="px-3 pt-2 text-xs font-bold text-sc-lime">
                {t(
                  "اسحب والطريق يلف مع اليابسة. الشوارع الرئيسية ثابتة في الأحياء، والجانبي بين القطع.",
                )}{" "}
                {priceOf(ROAD_COST, snap) === 0
                  ? t("مجاني.")
                  : t("{amount} د.ك.", { amount: priceOf(ROAD_COST, snap) })}
              </p>
            )}
            {tool?.kind === "bulldoze" && (
              <p className="px-3 pt-2 text-xs font-bold text-sc-gold">
                {t("اضغط مبنى أو طريق. يرجع لك نصف التكلفة.")}
              </p>
            )}
            {tool?.kind === "demolish" && !zone && (
              <p className="px-3 pt-2 text-xs font-bold text-sc-gold">
                {t("اسحب بإصبع لتحديد منطقة الهدم ثم أكّد. حرّك الخريطة بإصبعين، أو اسحب إلى طرف الشاشة لتتحرك معك.")}
              </p>
            )}
            {more && (
              <MoreSheet
                snap={snap}
                music={music}
                graphics={graphics}
                onClose={() => setMore(false)}
                onPick={(action: MoreAction) => {
                  setMore(false);
                  if (action === "districts") onDistricts();
                  else if (action === "photo") onPhoto();
                  else if (action === "luck") onLuck();
                  else if (action === "music") onMusic();
                  else if (action === "mute") onMute();
                  else if (action === "reset") onAskReset();
                  else if (action === "profile") onEditPlayer();
                  else if (action === "language") setLang(lang === "ar" ? "en" : "ar");
                  else if (action === "graphics")
                    onGraphics(graphics === "auto" ? "low" : graphics === "low" ? "high" : "auto");
                  else setPanel(action);
                }}
              />
            )}
            <div className="hud-actions flex gap-1.5 px-2 py-2">
              <Menu
                on={panel !== null && BUDGET_GROUP.includes(panel)}
                tut="menu-budget"
                testid="menu-budget"
                onClick={() => togglePanel("budget")}
              >
                {t("الميزانية")}
              </Menu>
              <Menu on={inGroup(panel, 3)} testid="menu-companies" onClick={() => togglePanel("companies")}>
                {t("الاستثمار")}
              </Menu>
              <Menu on={inGroup(panel, 1)} testid="menu-board" onClick={() => togglePanel("board")}>
                {t("المجلس")}
              </Menu>
              {stored > 0 ? (
                <button
                  type="button"
                  data-tut="collect"
                  data-testid="collect-all"
                  onClick={onCollect}
                  className="sc-menu sc-on min-w-0 flex-1 flex-col px-1 leading-tight"
                >
                  <span className="block">{t("اجمع")}</span>
                  <span className="block truncate" dir="ltr">
                    {money(stored)}
                  </span>
                </button>
              ) : null}
              <Menu on={more} testid="menu-more" onClick={() => setMore((m) => !m)}>
                {t("المزيد")}
              </Menu>
            </div>
            <div className="hud-status flex items-center gap-1 overflow-x-auto px-2 pb-2" dir="ltr">
              <Round label={t("إيقاف")} on={snap.speed === 0} onClick={() => onSpeed(0)}>
                <Pause size={16} />
              </Round>
              <Round
                label={t("تشغيل")}
                tut="speed-1"
                on={snap.speed === 1}
                onClick={() => onSpeed(1)}
              >
                <Play size={16} />
              </Round>
              <Round label={t("سريع")} on={snap.speed === 2} onClick={() => onSpeed(2)}>
                <FastForward size={16} />
              </Round>
              <Round label={t("أسرع")} on={snap.speed === 3} onClick={() => onSpeed(3)}>
                <ChevronsRight size={16} />
              </Round>
              <span className="sc-lcd shrink-0 text-sm" dir="ltr" data-hud="date">
                {formatCityDate(snap.day)}
              </span>
              <span
                className={`sc-lcd shrink-0 text-sm ${snap.coins < 0 ? "text-coral" : ""}`}
                data-testid="coins"
                id="hud-coins"
              >
                <span dir="ltr">{money(snap.coins)}</span>
                <span className="text-xs">{currency()}</span>
              </span>
              <span className="sc-lcd shrink-0 gap-1 text-sm" title={t("السكان")}>
                <Users size={13} />
                <span dir="ltr">{money(st.residents)}</span>
              </span>
            </div>
            <button
              type="button"
              className="hud-ticker sc-ticker flex w-full items-center px-3 text-start text-sm"
              dir={dir}
              data-testid="ticker"
              onClick={() => togglePanel("voices")}
            >
              <span className="truncate">{line}</span>
            </button>
            <NewsTicker toasts={toasts} dir={dir} />
          </footer>
        )}
        {snap.started && tutorial >= 0 && !panel && (
          <TutorialCard step={tutorial} onSkip={onTutorialSkip} />
        )}
        {celebration && <CelebrationCard item={celebration} onClose={onCelebrationClose} />}
      </div>
    </>
  );
}

/**
 * The red news strip: always one line high (so the bar above never jumps), with the
 * latest news sliding across it like a TV ticker. Arabic runs left to right, English
 * right to left.
 */
function NewsTicker({ toasts, dir }: { toasts: { id: number; text: string }[]; dir: "rtl" | "ltr" }) {
  const [news, setNews] = useState<{ id: number; text: string }[]>([]);
  useEffect(() => {
    if (!toasts.length) return;
    setNews((list) => {
      const seen = new Set(list.map((n) => n.id));
      const fresh = toasts.filter((n) => !seen.has(n.id));
      return fresh.length ? [...list, ...fresh].slice(-4) : list;
    });
  }, [toasts]);
  // Newest first: it is the part that comes into view as soon as the strip restarts.
  const line = [...news].reverse().map((n) => tx(n.text)).join("   ◆   ");
  const latest = news[news.length - 1]?.id ?? 0;
  const seconds = Math.max(9, line.length * 0.16);
  return (
    <div
      className="hud-news relative h-7 w-full overflow-hidden bg-[#b8322a] text-sm font-bold leading-7 text-white"
      dir={dir}
      role="status"
      aria-live="polite"
      data-testid="news-strip"
    >
      {line ? (
        <span
          key={latest}
          className={`news-run absolute top-0 whitespace-nowrap ${dir === "rtl" ? "news-run-rtl" : "news-run-ltr"}`}
          style={{ animationDuration: `${seconds}s` }}
        >
          {line}
        </span>
      ) : null}
    </div>
  );
}

function ZoneCard({
  onApply,
  onCancel,
}: {
  onApply: (pick: ZonePick) => void;
  onCancel: () => void;
}) {
  const [pick, setPick] = useState<ZonePick>({
    streets: true,
    schools: false,
    fire: false,
    landmarks: false,
    parks: false,
  });
  useLang();
  const chips: { key: keyof ZonePick; label: string }[] = [
    { key: "streets", label: "شوارع" },
    { key: "schools", label: "مدارس" },
    { key: "fire", label: "مركز إطفاء" },
    { key: "landmarks", label: "معالم" },
    { key: "parks", label: "حدائق" },
  ];
  return (
    <div
      className="sc-panel pointer-events-auto absolute inset-x-3 bottom-2 rounded-xl px-3 py-3"
      dir={dirOf()}
    >
      <p className="text-sm font-extrabold">{t("تنظيم المنطقة")}</p>
      <p className="mt-1 text-xs leading-relaxed">
        {t(
          "في الحي تُملأ القطعة المرقّمة كلها. خارجها وفي المنطقة الحرة يُبنى كل ما حدّدته، مع شوارع إن أبقيتها مفعّلة.",
        )}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            aria-pressed={pick[chip.key]}
            onClick={() => setPick((p) => ({ ...p, [chip.key]: !p[chip.key] }))}
            className={`sc-menu px-3 text-xs ${pick[chip.key] ? "sc-on" : ""}`}
          >
            {t(chip.label)}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="sc-menu sc-on h-11 flex-1 text-sm"
          onClick={() => onApply(pick)}
        >
          {t("نفّذ التخطيط")}
        </button>
        <button type="button" className="sc-menu h-11 px-3 text-sm" onClick={onCancel}>
          {t("إلغاء")}
        </button>
      </div>
    </div>
  );
}

function Graphs({
  snap,
  span,
  onKeys,
  onSpan,
  onToggle,
}: {
  snap: Sim;
  span: 1 | 10 | 100;
  onKeys: GraphKey[];
  onSpan: (n: 1 | 10 | 100) => void;
  onToggle: (key: GraphKey) => void;
}) {
  const months = span === 1 ? 12 : span === 10 ? 120 : 1200;
  const rows = useMemo(() => {
    const history = snap.history.slice(-months);
    return [...history, metrics(snap)];
  }, [snap, months]);
  const active = SERIES.filter((s) => onKeys.includes(s.key));
  return (
    <div dir="ltr">
      <GraphCanvas rows={rows} active={active} />
      <div className="mt-2 flex gap-1">
        {([1, 10, 100] as const).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={span === n}
            onClick={() => onSpan(n)}
            className={`sc-menu flex-1 text-sm ${span === n ? "sc-on" : ""}`}
          >
            {t(n === 1 ? "سنة" : n === 10 ? "10 سنوات" : "100 سنة")}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1" dir={dirOf()}>
        {SERIES.map((item) => {
          const on = onKeys.includes(item.key);
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(item.key)}
              className={`flex h-11 items-center gap-1 rounded-md px-2 text-xs font-extrabold ${on ? "sc-on" : "sc-menu"}`}
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center">
                {on ? <Check size={14} /> : null}
              </span>
              <span className="truncate">{t(item.label)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GraphCanvas({
  rows,
  active,
}: {
  rows: Sample[];
  active: { key: GraphKey; token: string }[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sig = `${rows.length}:${active.map((a) => a.key).join(",")}:${Math.round(rows.at(-1)?.approval ?? 0)}:${Math.round(rows.at(-1)?.pop ?? 0)}`;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const css = getComputedStyle(document.documentElement);
      ctx.strokeStyle = css.getPropertyValue("--color-sc-ink").trim() || "black";
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(8, h - 14);
      ctx.lineTo(w - 8, h - 14);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (rows.length < 2) return;
      for (const series of active) {
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = css.getPropertyValue(series.token).trim() || "black";
        rows.forEach((row, i) => {
          const x = 8 + (i / (rows.length - 1)) * (w - 16);
          const value = Math.max(0, Math.min(100, row[series.key]));
          const y = 8 + (1 - value / 100) * (h - 26);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [sig, rows, active]);
  return (
    <canvas ref={ref} className="h-40 w-full rounded-md bg-sc-mint" aria-label={t("رسم المدينة")} />
  );
}

function Budget({
  snap,
  onTax,
  onCost,
  onAutoRaise,
  onMurabaha,
  onHousingAid,
  onGiveAid,
  onLoan,
  onPay,
  stored,
  onCollect,
  onAutoCollect,
}: {
  snap: Sim;
  stored: number;
  onCollect: () => void;
  onAutoCollect: (months: number) => void;
  onTax: (n: number) => void;
  onCost: (key: CostKey, value: number) => void;
  onAutoRaise: (pct: number) => void;
  onMurabaha: (amount: number, profit: number, months: number) => void;
  onHousingAid: (pct: number) => void;
  onGiveAid: (amount: number) => void;
  onLoan: (amount: number, rate: number) => void;
  onPay: (target: PayTarget, amount?: number) => void;
}) {
  const st = stats(snap);
  const projects = projectMoney(snap);
  const income = monthlyIncome(snap) + feeRevenue(snap, st) + projects.income;
  const due = loanInstallment(snap);
  const cost =
    monthlyUpkeep(snap) + due + housingAidCost(snap, st) + projects.upkeep + boardFee(snap);
  const [loanAmount, setLoanAmount] = useState(10_000);
  const [loanRate, setLoanRate] = useState(12);
  const every = snap.autoCollect ?? 0;
  const step = Math.max(0, AUTO_COLLECT_STEPS.indexOf(every as (typeof AUTO_COLLECT_STEPS)[number]));
  const everyLabel = [
    t("يدوي (أنت تجمع)"),
    t("كل شهر"),
    t("كل ٣ أشهر"),
    t("كل ٦ أشهر"),
    t("كل سنة"),
    t("كل سنتين"),
    t("كل ٥ سنوات"),
  ][step]!;
  return (
    <div className="space-y-3" dir={dirOf()}>
      <div className="rounded-md bg-sc-mint p-2 text-sc-ink" data-testid="collect-box">
        <p className="text-sm font-extrabold">{t("جمع دخل المباني")}</p>
        <button
          type="button"
          data-testid="budget-collect"
          disabled={stored <= 0}
          onClick={onCollect}
          className="sc-menu sc-on mt-1 h-10 w-full text-sm disabled:opacity-40"
        >
          {t("اجمع الآن ({amount} د.ك)", { amount: fmt(stored) })}
        </button>
        <label className="mt-2 block text-xs font-extrabold">
          {t("الجمع التلقائي: {every}", { every: everyLabel })}
          <input
            type="range"
            min={0}
            max={AUTO_COLLECT_STEPS.length - 1}
            step={1}
            value={step}
            data-testid="auto-collect"
            aria-label={t("كل كم يُجمع الدخل تلقائياً")}
            onChange={(e) => onAutoCollect(AUTO_COLLECT_STEPS[Number(e.target.value)] ?? 0)}
            className="mt-1 h-9 w-full accent-sc-leaf"
          />
        </label>
        <p className="text-[11px] opacity-80">
          {t("مع الجمع التلقائي تحتفظ المباني بدخل الفترة كاملاً حتى موعد الجمع، فما يضيع شيء.")}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center text-xs font-extrabold">
        <div className="sc-lcd h-auto flex-col py-2">
          <span>{t("دخل الشهر")}</span>
          <span dir="ltr">{fmt(income)}</span>
        </div>
        <div className="sc-lcd h-auto flex-col py-2">
          <span>{t("المصروف")}</span>
          <span dir="ltr">{fmt(cost)}</span>
        </div>
        <div className="sc-lcd h-auto flex-col py-2">
          <span>{t("الفرق")}</span>
          <span dir="ltr" className={income - cost < 0 ? "text-coral" : ""}>
            {fmt(income - cost)}
          </span>
        </div>
      </div>
      <p className="text-xs" data-testid="income-breakdown">
        {t("دخل الشهر = رسوم المعيشة {fees} + دخل المباني {buildings} د.ك", {
          fees: fmt(feeRevenue(snap, st)),
          buildings: fmt(monthlyIncome(snap)),
        })}
      </p>
      <label className="block text-sm font-extrabold">
        {t("الضريبة {n}%", { n: snap.tax })}
        <span className="block text-xs font-medium opacity-80">
          {t("أعلى = دخل أكبر من المباني، لكن الرضا ينزل فوق ٨٪.")}
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(300, Math.ceil(snap.tax / 100) * 100)}
          step={5}
          value={snap.tax}
          aria-label={t("نسبة الضريبة")}
          onChange={(e) => onTax(Number(e.target.value))}
          className="mt-1 h-11 w-full accent-sc-leaf"
        />
      </label>
      <div className="w-40">
        <NumberField
          label={t("أو اكتب أي نسبة (بلا حد أعلى)")}
          value={snap.tax}
          onChange={onTax}
          suffix={percentSign()}
          testid="tax-value"
        />
      </div>
      <CostSliders snap={snap} onCost={onCost} onAutoRaise={onAutoRaise} />
      <HousingAid snap={snap} onHousingAid={onHousingAid} onGiveAid={onGiveAid} />
      <Murabaha snap={snap} onMurabaha={onMurabaha} />
      <div className="rounded-md bg-sc-mint p-2 text-sc-ink">
        <p className="flex items-center gap-1 text-sm font-extrabold">
          <Bank size={16} /> {t("قرض البنك")}
        </p>
        <p className="mt-1 text-xs leading-relaxed">
          {t(
            "اختر أي مبلغ وأي فائدة، من ٠٪ إلى ما تريد، والبنك يوافق دائماً بلا حد أعلى. القسط ينخصم كل شهر تلقائياً.",
          )}{" "}
          {snap.loan > 0 ? t("القسط الحالي {amount} د.ك.", { amount: fmt(due) }) : ""}{" "}
          {t("الدين الحالي {debt} د.ك.", { debt: fmt(snap.loan) })}
        </p>
        {snap.coins < 0 && (
          <p className="mt-1 text-xs font-extrabold text-coral">
            {t("الرصيد بالسالب: خذ قرضاً لتغطية العجز.")}
          </p>
        )}
        <div className="mt-2 grid grid-cols-2 gap-1">
          <NumberField
            label={t("المبلغ")}
            value={loanAmount}
            onChange={setLoanAmount}
            suffix={currency()}
            testid="loan-amount"
          />
          <NumberField
            label={t("الفائدة")}
            value={loanRate}
            onChange={setLoanRate}
            suffix={percentSign()}
            testid="loan-rate"
          />
        </div>
        <button
          type="button"
          data-testid="loan-take"
          onClick={() => onLoan(loanAmount, loanRate / 100)}
          className="sc-menu sc-on mt-1 w-full text-xs"
        >
          {t("اقترض {amount} د.ك بفائدة {rate}٪", { amount: fmt(loanAmount), rate: loanRate })}
        </button>
      </div>
      <Obligations snap={snap} onPay={onPay} />
    </div>
  );
}

/** Every debt in one card: pay one or all of them, in full or in part. */
function Obligations({
  snap,
  onPay,
}: {
  snap: Sim;
  onPay: (target: PayTarget, amount?: number) => void;
}) {
  const list = obligations(snap);
  const total = list.reduce((a, o) => a + o.left, 0);
  const [part, setPart] = useState(10_000);
  const label = (o: Obligation) =>
    o.kind === "loan"
      ? t("قرض البنك")
      : o.kind === "murabaha"
        ? t("تمويل مرابحة")
        : t("دين {name}", { name: t(o.name) });
  const target = (o: Obligation): PayTarget =>
    o.kind === "loan" ? { kind: "loan" } : o.kind === "murabaha" ? { kind: "murabaha", id: o.id } : { kind: "npc", id: o.id };
  return (
    <div className="rounded-md bg-sc-mint p-2 text-sc-ink" data-testid="obligations">
      <p className="flex items-center gap-1 text-sm font-extrabold">
        <Check size={16} /> {t("الالتزامات")}
      </p>
      {total <= 0.5 ? (
        <p className="mt-1 text-xs">{t("ما عليك أي التزامات. ممتاز!")}</p>
      ) : (
        <>
          <p className="mt-1 text-xs leading-relaxed">
            {t("مجموع ما عليك {amount} د.ك. سدّد الكل أو جزءاً منه، لكل التزام أو لها جميعاً.", {
              amount: fmt(total),
            })}
          </p>
          <div className="mt-2">
            <NumberField
              label={t("مبلغ السداد الجزئي")}
              value={part}
              onChange={setPart}
              suffix={currency()}
              testid="pay-part"
            />
          </div>
          <ul className="mt-2 space-y-1">
            {list.map((o) => (
              <li
                key={o.kind === "loan" ? "loan" : `${o.kind}-${o.id}`}
                className="rounded bg-white/60 p-1.5 text-xs"
              >
                <div className="flex items-center justify-between gap-1 font-extrabold">
                  <span>{label(o)}</span>
                  <span dir="ltr">{fmt(o.left)}</span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    disabled={snap.coins <= 0}
                    onClick={() => onPay(target(o), part)}
                    className="sc-menu text-xs disabled:opacity-40"
                  >
                    {t("سدّد {amount}", { amount: fmt(Math.min(part, o.left)) })}
                  </button>
                  <button
                    type="button"
                    disabled={snap.coins <= 0}
                    onClick={() => onPay(target(o))}
                    className="sc-menu sc-on text-xs disabled:opacity-40"
                  >
                    {t("سدّد كاملاً")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 grid grid-cols-2 gap-1">
            <button
              type="button"
              data-testid="pay-part-all"
              disabled={snap.coins <= 0}
              onClick={() => onPay({ kind: "all" }, part)}
              className="sc-menu text-xs disabled:opacity-40"
            >
              {t("سدّد {amount} من الكل", { amount: fmt(Math.min(part, total)) })}
            </button>
            <button
              type="button"
              data-testid="pay-all"
              disabled={snap.coins <= 0}
              onClick={() => onPay({ kind: "all" })}
              className="sc-menu sc-on text-xs disabled:opacity-40"
            >
              {t("سدّد كل الالتزامات")}
            </button>
          </div>
          {snap.coins < total && (
            <p className="mt-1 text-xs opacity-80">
              {t("رصيدك أقل من المجموع، فيُسدَّد ما يكفيه الرصيد.")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function DemolishCard({
  snap,
  zone,
  onApply,
  onCancel,
}: {
  snap: Sim;
  zone: { c0: number; r0: number; c1: number; r1: number };
  onApply: () => void;
  onCancel: () => void;
}) {
  useLang();
  const p = demolishPreview(snap, zone.c0, zone.r0, zone.c1, zone.r1);
  const empty = p.buildings + p.roads === 0;
  return (
    <div
      className="sc-panel pointer-events-auto absolute inset-x-3 bottom-2 rounded-xl px-3 py-3"
      dir={dirOf()}
      data-testid="demolish-card"
    >
      <p className="text-sm font-extrabold">{t("هدم المنطقة المحددة")}</p>
      <p className="mt-1 text-xs leading-relaxed">
        {empty
          ? t("ما في شيء تهدّه في هذه المنطقة.")
          : t("سيُهدم {buildings} مبنى و{roads} شارع، ويرجع لك {amount} د.ك (نصف التكلفة).", {
              buildings: fmt(p.buildings),
              roads: fmt(p.roads),
              amount: fmt(p.refund),
            })}
        {p.kept > 0 && (
          <span className="block opacity-80">
            {t("{n} عنصر محمي لن يُهدم (مشاريع قيد التطوير أو الشارع الرئيسي).", { n: fmt(p.kept) })}
          </span>
        )}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          data-testid="demolish-apply"
          disabled={empty}
          className="sc-menu sc-on h-11 flex-1 text-sm disabled:opacity-40"
          onClick={onApply}
        >
          {t("اهدم المنطقة")}
        </button>
        <button type="button" className="sc-menu h-11 px-3 text-sm" onClick={onCancel}>
          {t("إلغاء")}
        </button>
      </div>
    </div>
  );
}

function HousingAid({
  snap,
  onHousingAid,
  onGiveAid,
}: {
  snap: Sim;
  onHousingAid: (pct: number) => void;
  onGiveAid: (amount: number) => void;
}) {
  const st = stats(snap);
  const [grant, setGrant] = useState(Math.max(1000, Math.round(st.pop * 5)));
  const aid = snap.housingAid ?? 0;
  const active = (snap.aidUntil ?? 0) > snap.day;
  return (
    <div className="rounded-md bg-sc-mint p-2 text-sc-ink" data-testid="housing-aid">
      <p className="flex items-center gap-1 text-sm font-extrabold">
        <Home size={16} /> {t("دعم السكن والإعانات")}
      </p>
      <p className="mt-1 text-xs leading-relaxed">
        {t(
          "تدفع البلدية جزءاً من إيجار كل أسرة كل شهر. ١٠٠٪ يعني سكن مجاني، وأكثر من ١٠٠٪ يعني إعانة نقدية فوق الإيجار. الدعم يرفع الرضا ويجذب السكان، ويُصرف من الميزانية.",
        )}
      </p>
      <div className="mt-1 flex items-end gap-1" dir="ltr">
        {[0, 25, 50, 100].map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={aid === p}
            onClick={() => onHousingAid(p)}
            className={`sc-menu px-2 text-xs ${aid === p ? "sc-on" : ""}`}
          >
            {p}
            {percentSign()}
          </button>
        ))}
        <NumberField
          label=""
          value={aid}
          onChange={(v) => onHousingAid(v)}
          suffix={percentSign()}
          testid="housing-aid-pct"
        />
      </div>
      <p className="mt-1 text-xs font-extrabold">
        {t("تكلفة الدعم: {amount} د.ك شهرياً · الإيجار الذي يشعر به الناس: {rent}٪", {
          amount: fmt(housingAidCost(snap, st)),
          rent: Math.round(effectiveHousing(snap)),
        })}
      </p>
      <p className="mt-2 text-xs font-extrabold">{t("مساعدة عاجلة لمرة واحدة")}</p>
      <p className="text-[11px] opacity-80">
        {t("ترفع الرضا لستة أشهر، مفيدة وقت الأزمات والكوارث.")}
        {active
          ? " " + t("مساعدة سارية: الرضا +{n}", { n: snap.aidHappy ?? 0 })
          : ""}
      </p>
      <div className="mt-1 flex items-end gap-1">
        <NumberField
          label=""
          value={grant}
          onChange={setGrant}
          suffix={currency()}
          testid="aid-amount"
        />
        <button
          type="button"
          data-testid="aid-give"
          disabled={snap.coins < grant || grant <= 0}
          onClick={() => onGiveAid(grant)}
          className="sc-menu sc-on shrink-0 px-3 text-xs disabled:opacity-40"
        >
          {t("اصرف المساعدة")}
        </button>
      </div>
    </div>
  );
}

function Murabaha({
  snap,
  onMurabaha,
}: {
  snap: Sim;
  onMurabaha: (amount: number, profit: number, months: number) => void;
}) {
  const [amount, setAmount] = useState(50_000);
  const [profit, setProfit] = useState(8);
  const [months, setMonths] = useState(24);
  const owed = snap.finance.murabaha.reduce((t, m) => t + m.left, 0);
  return (
    <div className="rounded-md bg-sc-mint p-2 text-sc-ink" data-testid="murabaha-card">
      <p className="flex items-center gap-1 text-sm font-extrabold">
        <Bank size={16} /> {t("تمويل إسلامي (مرابحة)")}
      </p>
      <p className="mt-1 text-xs leading-relaxed">
        {t(
          "بديل القرض: المصرف الإسلامي يشتري ما تحتاجه المدينة ويبيعه لك بربح متفق عليه من البداية، وتسدّد بأقساط ثابتة لا تزيد. التأخير لا يضيف فوائد، فقط تبرع خيري بسيط. تقدر تأخذ التمويل والقرض معاً.",
        )}
      </p>
      {owed > 0 && (
        <p className="mt-1 text-xs font-extrabold">
          {t("عليك للمصرف {owed} د.ك · القسط {installment} شهرياً", {
            owed: fmt(owed),
            installment: fmt(murabahaInstallment(snap)),
          })}
        </p>
      )}
      <div className="mt-1 grid grid-cols-3 gap-1">
        <NumberField
          label={t("المبلغ")}
          value={amount}
          onChange={setAmount}
          suffix={currency()}
          testid="murabaha-amount"
        />
        <NumberField
          label={t("ربح المصرف")}
          value={profit}
          onChange={setProfit}
          suffix={percentSign()}
          testid="murabaha-profit"
        />
        <NumberField
          label={t("الأشهر")}
          value={months}
          onChange={(v) => setMonths(Math.max(1, Math.round(v)))}
        />
      </div>
      <button
        type="button"
        data-testid="murabaha-take"
        onClick={() => onMurabaha(amount, profit / 100, months)}
        className="sc-menu sc-on mt-1 w-full text-xs"
      >
        {t("خذ تمويل {amount} د.ك بربح {rate}٪", { amount: fmt(amount), rate: profit })}
      </button>
    </div>
  );
}

function Projects({
  snap,
  onEvent,
  onModel,
}: {
  snap: Sim;
  onEvent: (kind: EventKind) => void;
  onModel: (kind: ModelKind) => void;
}) {
  const running = snap.event && snap.day < snap.event.until ? snap.event : null;
  return (
    <div className="space-y-3" dir={dirOf()}>
      <p className="flex items-center gap-1 text-sm font-extrabold">
        <Building2 size={16} /> {t("مناطق نموذجية جاهزة")}
      </p>
      <p className="text-xs leading-relaxed">
        {t(
          "تُبنى بالكامل في أقرب أرض فاضية تكفيها، بشوارعها وخدماتها، بسعر أقل من البناء قطعة قطعة.",
        )}
      </p>
      <ul className="space-y-2">
        {(Object.keys(MODEL_AREAS) as ModelKind[]).map((kind) => {
          const def = MODEL_AREAS[kind];
          const poor = snap.coins < def.cost;
          return (
            <li key={kind}>
              <button
                type="button"
                data-testid={`model-${kind}`}
                onClick={() => onModel(kind)}
                className={`sc-choice w-full rounded-md px-2 py-2 text-start ${poor ? "opacity-60" : ""}`}
              >
                <span className="flex justify-between text-sm font-extrabold">
                  <span>{t(def.name)}</span>
                  <span dir="ltr">
                    {fmt(def.cost)} {currency()}
                  </span>
                </span>
                <span className="block text-xs font-medium opacity-80">{t(def.blurb)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="flex items-center gap-1 text-sm font-extrabold">
        <Trophy size={16} /> {t("فعاليات ورياضة")}
      </p>
      <p className="text-xs leading-relaxed">
        {t("الفعالية ترفع الرضا والدخل وتجذب سكاناً جدداً طوال مدتها، وتترك سمعة دائمة للمنطقة.")}
      </p>
      {running && (
        <p className="sc-lcd text-sm">
          {t("{name} لين {date}", {
            name: EVENTS[running.kind].name,
            date: formatCityDate(running.until),
          })}
        </p>
      )}
      <ul className="space-y-2">
        {(Object.keys(EVENTS) as EventKind[]).map((kind) => {
          const def = EVENTS[kind];
          const poor = snap.coins < def.cost;
          return (
            <li key={kind}>
              <button
                type="button"
                data-testid={`event-${kind}`}
                disabled={Boolean(running)}
                onClick={() => onEvent(kind)}
                className={`sc-choice w-full rounded-md px-2 py-2 text-start disabled:opacity-40 ${poor ? "opacity-60" : ""}`}
              >
                <span className="flex justify-between text-sm font-extrabold">
                  <span>{t(def.name)}</span>
                  <span dir="ltr">
                    {fmt(def.cost)} {currency()}
                  </span>
                </span>
                <span className="block text-xs font-medium opacity-80">
                  {t(def.blurb)}{" "}
                  {t("{days} يوم · دخل +{income}٪ · رضا +{happy}", {
                    days: def.days,
                    income: Math.round(def.income * 100),
                    happy: def.happy,
                  })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Advisors({ snap }: { snap: Sim }) {
  const st = stats(snap);
  const m = metrics(snap, st);
  const q = QUESTS[snap.quest];
  const rank = rankOf(st.residents);
  const next = RANKS[rank + 1];
  const cover = serviceCoverage(snap);
  const rows: [string, string][] = [
    ["السكان", `${money(st.residents)} / ${money(st.capacity * 15)}`],
    ["الرضا", `${st.happy}%`],
    ["الكهرباء", `${Math.round(m.power)}%`],
    ["الماء", `${Math.round(m.water)}%`],
    ["الجريمة", String(Math.round(m.crime))],
    ["البطالة", String(Math.round(m.unemployment))],
    ["التلوث", String(Math.round(m.pollution))],
    ["الزحمة", String(Math.round(m.traffic))],
    ["الصحة", String(Math.round(m.health))],
    ["التعليم", String(Math.round(m.education))],
    ["قيمة الأرض", String(Math.round(m.land))],
  ];
  return (
    <div className="space-y-2" dir={dirOf()}>
      <ul className="space-y-1">
        {bulletin(snap, st).map((text) => (
          <li key={text} className="rounded-md bg-sc-mint px-2 py-2 text-sm font-bold text-sc-ink">
            {text}
          </li>
        ))}
      </ul>
      <p className="rounded-md bg-sc-mint px-2 py-2 text-sm font-extrabold text-sc-ink">
        {t("لقبك: {title}", { title: RANKS[rank]!.title })} ·{" "}
        {next
          ? t("{n} ساكن للترقية إلى {title}", {
              n: money(Math.max(0, next.pop - st.residents)),
              title: next.title,
            })
          : t("أعلى لقب")}
      </p>
      <div className="grid grid-cols-5 gap-1 text-center text-xs font-extrabold">
        {(Object.keys(cover) as (keyof typeof cover)[]).map((key) => (
          <p
            key={key}
            className={`sc-lcd h-auto flex-col py-1 ${cover[key] < 0.6 ? "text-coral" : ""}`}
          >
            <span>{t(SERVICE_NAMES[key])}</span>
            <span dir="ltr">{Math.round(cover[key] * 100)}%</span>
          </p>
        ))}
      </div>
      {q && (
        <p className="text-sm font-extrabold">
          {t("المهمة: {quest}", { quest: q.text })} ·{" "}
          {Math.min(q.total, Math.round(q.progress(snap)))}/{q.total}
        </p>
      )}
      <div className="grid grid-cols-2 gap-1">
        {rows.map(([label, value]) => (
          <p key={label} className="sc-lcd h-auto justify-between py-2 text-xs">
            <span>{t(label)}</span>
            <span dir="ltr">{value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function Disasters({
  snap,
  onDisaster,
  onRandom,
}: {
  snap: Sim;
  onDisaster: (kind: DisasterKind) => void;
  onRandom: (value: boolean) => void;
}) {
  const active = snap.disaster && snap.day < snap.disaster.until ? snap.disaster : null;
  return (
    <div className="space-y-2" dir={dirOf()}>
      <p className="text-sm leading-relaxed">
        {t(
          "الكوارث تضرب المدينة من نفسها وكل وحدة تكلّف الصندوق: الحريق يحرق مبنى، العاصفة والسيول تنزل الرضا، وانقطاع الكهرباء يوقف الإنتاج. إذا صار رصيدك بالسالب خذ قرضاً من الميزانية.",
        )}
      </p>
      {active && (
        <p className="sc-lcd text-sm">
          {t("جارية لين {date}", { date: formatCityDate(active.until) })}
        </p>
      )}
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          className="sc-menu inline-flex w-full items-center justify-center gap-2 text-sm"
          onClick={() => onDisaster("fire")}
        >
          <Flame size={16} /> {t("حريق")}
        </button>
        <button
          type="button"
          className="sc-menu inline-flex w-full items-center justify-center gap-2 text-sm"
          onClick={() => onDisaster("storm")}
        >
          <Cloud size={16} /> {t("عاصفة رملية")}
        </button>
        <button
          type="button"
          className="sc-menu inline-flex w-full items-center justify-center gap-2 text-sm"
          onClick={() => onDisaster("blackout")}
        >
          <ZapOff size={16} /> {t("انقطاع كهرباء")}
        </button>
        <button
          type="button"
          className="sc-menu inline-flex w-full items-center justify-center gap-2 text-sm"
          onClick={() => onDisaster("flood")}
        >
          <CloudRain size={16} /> {t("أمطار وسيول")}
        </button>
        <p className="text-xs">
          {t("الخسارة المتوقعة الآن: حريق {fire} · عاصفة {storm} · سيول {flood} د.ك", {
            fire: fmt(disasterBill(snap, "fire")),
            storm: fmt(disasterBill(snap, "storm")),
            flood: fmt(disasterBill(snap, "flood")),
          })}
        </p>
      </div>
      <button
        type="button"
        aria-pressed={snap.randomDisasters}
        onClick={() => onRandom(!snap.randomDisasters)}
        className={`sc-menu w-full text-sm ${snap.randomDisasters ? "sc-on" : ""}`}
      >
        {t(
          snap.randomDisasters
            ? "الكوارث تضرب عشوائياً (اضغط للإيقاف)"
            : "تفعيل الكوارث العشوائية",
        )}
      </button>
    </div>
  );
}

function Rci({ r, c, i }: { r: number; c: number; i: number }) {
  return (
    <div
      className="mt-1 flex gap-1 rounded-md bg-sc-ink px-1 py-1"
      aria-label={t("طلب السكن والتجارة والصناعة")}
      dir="ltr"
    >
      <Meter label="R" value={r} tone="bg-sc-green" />
      <Meter label="C" value={c} tone="bg-sc-sky" />
      <Meter label="I" value={i} tone="bg-sc-gold" />
    </div>
  );
}

function Meter({ label, value, tone }: { label: string; value: number; tone: string }) {
  const up = value >= 0;
  const h = Math.round((Math.abs(value) / 100) * 50);
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs font-extrabold text-sc-lime">{label}</span>
      <div className="relative h-16 w-3 overflow-hidden rounded-full bg-sc-bar">
        <div
          className={`absolute inset-x-0 ${tone}`}
          style={{ height: `${h}%`, top: up ? `${50 - h}%` : "50%" }}
        />
      </div>
    </div>
  );
}

function Round({
  label,
  on,
  onClick,
  children,
  testid,
  tut,
}: {
  label: string;
  on?: boolean;
  onClick: () => void;
  children: ReactNode;
  testid?: string;
  tut?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      data-testid={testid}
      data-tut={tut}
      onClick={onClick}
      className={`sc-round ${on ? "sc-on" : ""}`}
    >
      {children}
    </button>
  );
}

function Menu({
  on,
  onClick,
  children,
  testid,
  tut,
}: {
  on?: boolean;
  onClick: () => void;
  children: ReactNode;
  testid?: string;
  tut?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      data-tut={tut}
      aria-pressed={on}
      onClick={onClick}
      className={`sc-menu min-w-0 flex-1 px-1 leading-tight ${on ? "sc-on" : ""}`}
    >
      <span className="block truncate">{children}</span>
    </button>
  );
}
