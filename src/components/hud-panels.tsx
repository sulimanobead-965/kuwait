import { useEffect, useState, type ReactNode } from "react";
import {
  Award,
  BarChart3,
  Building2,
  Camera,
  Check,
  Dices,
  Flame,
  Landmark,
  Lock,
  Map as MapIcon,
  Music,
  Newspaper,
  RotateCcw,
  ScrollText,
  Siren,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  ACHIEVEMENTS,
  calendarMood,
  COST_ITEMS,
  COST_KEYS,
  costIndex,
  costRevenue,
  CRISES,
  crisisOf,
  ERAS,
  eraOf,
  formatCityDate,
  stats,
  type CostKey,
  type CrisisKind,
  type Sim,
} from "@/game/sim";
import {
  BOND_OFFERS,
  COMPANIES,
  CONSULT_COST,
  CONSULT_MONTHS,
  consulting,
  DEPOSIT_RATE,
  exposure,
  financeIncome,
  isOpen,
  PROJECT_OFFERS,
} from "@/game/finance";

export function fmt(n: number) {
  return Math.floor(n).toLocaleString("en-US");
}

/** Short Arabic money, e.g. ١٫٢ مليون. */
export function money(n: number) {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)} مليون`;
  if (a >= 10_000) return `${Math.round(n / 1000)} ألف`;
  return fmt(n);
}

// ------------------------------------------------------------------ more sheet

export type MoreAction =
  | "districts"
  | "graphs"
  | "laws"
  | "advisors"
  | "disasters"
  | "report"
  | "achievements"
  | "photo"
  | "luck"
  | "music"
  | "mute"
  | "reset";

export function MoreSheet({
  snap,
  music,
  onPick,
  onClose,
}: {
  snap: Sim;
  music: boolean;
  onPick: (a: MoreAction) => void;
  onClose: () => void;
}) {
  const items: { id: MoreAction; label: string; icon: ReactNode }[] = [
    { id: "districts", label: "الأحياء", icon: <MapIcon size={20} /> },
    { id: "report", label: "التقرير السنوي", icon: <Newspaper size={20} /> },
    { id: "graphs", label: "الرسوم", icon: <BarChart3 size={20} /> },
    { id: "advisors", label: "المستشارون", icon: <Users size={20} /> },
    { id: "laws", label: "القوانين", icon: <ScrollText size={20} /> },
    { id: "disasters", label: "الكوارث والأزمات", icon: <Siren size={20} /> },
    { id: "achievements", label: "الإنجازات", icon: <Award size={20} /> },
    { id: "photo", label: "صورة المدينة", icon: <Camera size={20} /> },
    { id: "luck", label: "حظ", icon: <Dices size={20} /> },
    { id: "music", label: music ? "إيقاف الموسيقى" : "تشغيل الموسيقى", icon: <Music size={20} /> },
    {
      id: "mute",
      label: snap.mute ? "تشغيل الأصوات" : "كتم الأصوات",
      icon: snap.mute ? <VolumeX size={20} /> : <Volume2 size={20} />,
    },
    { id: "reset", label: "مدينة جديدة", icon: <RotateCcw size={20} /> },
  ];
  return (
    <div
      className="more-sheet sc-panel pointer-events-auto"
      dir="rtl"
      role="dialog"
      aria-label="المزيد"
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="text-sm font-extrabold">المزيد</p>
        <button type="button" className="sc-x" aria-label="إغلاق" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`more-${item.id}`}
            onClick={() => onPick(item.id)}
            className="more-item"
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ cost of living

export function CostSliders({
  snap,
  onCost,
  onAutoRaise,
}: {
  snap: Sim;
  onCost: (key: CostKey, value: number) => void;
  onAutoRaise: (pct: number) => void;
}) {
  const st = stats(snap);
  const rev = costRevenue(snap, st);
  const index = costIndex(snap);
  return (
    <div className="space-y-2">
      <p className="flex items-center justify-between text-sm font-extrabold">
        <span>مصاريف المعيشة</span>
        <span className={index > 115 ? "text-coral" : ""}>مؤشر الغلاء {index}</span>
      </p>
      <p className="text-xs leading-relaxed opacity-80">
        ما يدفعه الساكن شهرياً. رفعها يزيد دخل الصندوق، لكن الرضا ينزل والناس تطلع. خفضها يجذب
        السكان.
      </p>
      {COST_KEYS.map((key) => (
        <label key={key} className="block text-xs font-extrabold">
          <span className="flex justify-between">
            <span>
              {COST_ITEMS[key].name} {snap.costs[key]}%
            </span>
            <span dir="ltr">+{fmt(rev.rows[key])}/شهر</span>
          </span>
          <input
            type="range"
            min={50}
            max={250}
            step={5}
            value={snap.costs[key]}
            aria-label={COST_ITEMS[key].name}
            data-testid={`cost-${key}`}
            onChange={(e) => onCost(key, Number(e.target.value))}
            className="h-9 w-full accent-sc-leaf"
          />
        </label>
      ))}
      <div className="flex items-center gap-1 text-xs font-extrabold">
        <span className="flex-1">زيادة سنوية تلقائية</span>
        {[0, 2, 5, 10].map((pct) => (
          <button
            key={pct}
            type="button"
            aria-pressed={snap.autoRaise === pct}
            onClick={() => onAutoRaise(pct)}
            className={`sc-menu px-2 text-xs ${snap.autoRaise === pct ? "sc-on" : ""}`}
          >
            {pct === 0 ? "ثابتة" : `${pct}٪`}
          </button>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ companies

export function Companies({
  snap,
  onDeposit,
  onWithdraw,
  onBond,
  onProject,
  onConsult,
}: {
  snap: Sim;
  onDeposit: (amount: number) => void;
  onWithdraw: (amount: number) => void;
  onBond: (index: number) => void;
  onProject: (index: number) => void;
  onConsult: () => void;
}) {
  const f = snap.finance;
  const closed = (id: "bank" | "developer" | "consultant") =>
    !isOpen(snap, id) ? (
      <p className="text-xs font-extrabold text-coral">
        مفلسة ومغلقة لين {formatCityDate(f.down[id])}
      </p>
    ) : null;
  return (
    <div className="space-y-3" dir="rtl">
      <div className="grid grid-cols-3 gap-1 text-center text-xs font-extrabold">
        <div className="sc-lcd h-auto flex-col py-2">
          <span>مستثمر</span>
          <span>{money(exposure(snap))}</span>
        </div>
        <div className="sc-lcd h-auto flex-col py-2">
          <span>عائد شهري</span>
          <span>{money(financeIncome(snap))}</span>
        </div>
        <div className="sc-lcd h-auto flex-col py-2">
          <span>ربح / خسارة</span>
          <span>
            {money(f.earned)} / {money(f.lost)}
          </span>
        </div>
      </div>
      {crisisOf(snap) === "economic" && (
        <p className="rounded-md bg-coral px-2 py-1 text-xs font-extrabold text-sc-ink">
          أزمة اقتصادية: خطر إفلاس البنوك والشركات مرتفع جداً الآن.
        </p>
      )}

      <Company
        title={COMPANIES.bank.name}
        blurb={COMPANIES.bank.blurb}
        icon={<Landmark size={16} />}
      >
        {closed("bank")}
        <p className="text-xs">
          وديعتك <b dir="ltr">{fmt(f.deposit)}</b> د.ك بفائدة {Math.round(DEPOSIT_RATE * 100)}٪
          سنوياً تُضاف شهرياً.
        </p>
        <div className="mt-1 grid grid-cols-4 gap-1">
          {[10_000, 100_000, 1_000_000].map((a) => (
            <button
              key={a}
              type="button"
              data-testid={`deposit-${a}`}
              disabled={!isOpen(snap, "bank") || snap.coins < a}
              onClick={() => onDeposit(a)}
              className="sc-menu px-1 text-xs disabled:opacity-40"
            >
              أودع {money(a)}
            </button>
          ))}
          <button
            type="button"
            disabled={!isOpen(snap, "bank") || f.deposit <= 0}
            onClick={() => onWithdraw(f.deposit)}
            className="sc-menu sc-on px-1 text-xs disabled:opacity-40"
          >
            اسحب الكل
          </button>
        </div>
        <p className="mt-2 text-xs font-extrabold">سندات</p>
        <ul className="mt-1 space-y-1">
          {BOND_OFFERS.map((b, i) =>
            b.issuer !== "bank" ? null : (
              <li key={i}>
                <button
                  type="button"
                  data-testid={`bond-${i}`}
                  disabled={!isOpen(snap, "bank") || snap.coins < b.amount}
                  onClick={() => onBond(i)}
                  className="sc-choice w-full rounded-md px-2 py-1 text-right text-xs disabled:opacity-40"
                >
                  سند {money(b.amount)} · فائدة {Math.round(b.rate * 1000) / 10}٪ · {b.years} سنوات
                </button>
              </li>
            ),
          )}
        </ul>
      </Company>

      <Company
        title={COMPANIES.developer.name}
        blurb={COMPANIES.developer.blurb}
        icon={<Building2 size={16} />}
      >
        {closed("developer")}
        <ul className="space-y-1">
          {PROJECT_OFFERS.map((p, i) => (
            <li key={p.name}>
              <button
                type="button"
                data-testid={`project-${i}`}
                disabled={!isOpen(snap, "developer") || snap.coins < p.amount}
                onClick={() => onProject(i)}
                className="sc-choice w-full rounded-md px-2 py-1 text-right text-xs disabled:opacity-40"
              >
                <b>{p.name}</b> · استثمر {money(p.amount)} ← يرجع {money(p.amount * p.payback)} بعد{" "}
                {p.months} شهر{p.handover ? " + بيوت جاهزة" : ""}
              </button>
            </li>
          ))}
          {BOND_OFFERS.map((b, i) =>
            b.issuer !== "developer" ? null : (
              <li key={`b${i}`}>
                <button
                  type="button"
                  data-testid={`bond-${i}`}
                  disabled={!isOpen(snap, "developer") || snap.coins < b.amount}
                  onClick={() => onBond(i)}
                  className="sc-choice w-full rounded-md px-2 py-1 text-right text-xs disabled:opacity-40"
                >
                  سندات الشركة {money(b.amount)} · فائدة {Math.round(b.rate * 100)}٪ · مخاطرة عالية
                </button>
              </li>
            ),
          )}
        </ul>
        {f.projects.length > 0 && (
          <ul className="mt-1 text-xs">
            {f.projects.map((p) => (
              <li key={p.id}>
                • {p.name}: {money(p.amount)} يكتمل {formatCityDate(p.completes)}
              </li>
            ))}
          </ul>
        )}
      </Company>

      <Company
        title={COMPANIES.consultant.name}
        blurb={COMPANIES.consultant.blurb}
        icon={<ScrollText size={16} />}
      >
        {closed("consultant")}
        {consulting(snap) ? (
          <p className="text-xs font-extrabold text-sc-leaf">
            العقد ساري لين {formatCityDate(f.consultUntil)}
          </p>
        ) : (
          <button
            type="button"
            data-testid="consult"
            disabled={!isOpen(snap, "consultant") || snap.coins < CONSULT_COST}
            onClick={onConsult}
            className="sc-menu w-full text-xs disabled:opacity-40"
          >
            عقد {CONSULT_MONTHS} شهراً بـ {money(CONSULT_COST)} د.ك
          </button>
        )}
      </Company>

      {f.bonds.length > 0 && (
        <div className="text-xs">
          <p className="font-extrabold">سنداتك</p>
          {f.bonds.map((b) => (
            <p key={b.id}>
              • {b.issuer === "bank" ? COMPANIES.bank.name : COMPANIES.developer.name}{" "}
              {money(b.amount)} حتى {formatCityDate(b.matures)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Company({
  title,
  blurb,
  icon,
  children,
}: {
  title: string;
  blurb: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md bg-sc-mint p-2 text-sc-ink">
      <p className="flex items-center gap-1 text-sm font-extrabold">
        {icon} {title}
      </p>
      <p className="mb-1 text-xs opacity-80">{blurb}</p>
      {children}
    </section>
  );
}

// ------------------------------------------------------------------ yearly report

export function YearReport({ snap }: { snap: Sim }) {
  const rows = [...snap.years].reverse();
  const st = stats(snap);
  return (
    <div className="space-y-2" dir="rtl">
      <p className="text-xs leading-relaxed">
        يُقاس كل سنة: عدد السكان والرضا ومؤشر غلاء المعيشة والدخل والمصروف. السنة الحالية حتى الآن:
        دخل {money(snap.ytd.income)} ومصروف {money(snap.ytd.spend)}.
      </p>
      {rows.length === 0 ? (
        <p className="sc-lcd text-sm">أول تقرير يصدر نهاية السنة</p>
      ) : (
        <table className="w-full text-center text-xs">
          <thead>
            <tr className="font-extrabold">
              <th>السنة</th>
              <th>السكان</th>
              <th>الرضا</th>
              <th>الغلاء</th>
              <th>الصافي</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((y, i) => {
              const prev = rows[i + 1];
              const growth =
                prev && prev.residents > 0 ? (y.residents / prev.residents - 1) * 100 : 0;
              return (
                <tr key={y.year} className="border-t border-sc-ink/20">
                  <td>{y.year}</td>
                  <td>
                    {money(y.residents)}
                    {prev && (
                      <span className={growth < 0 ? "text-coral" : "text-sc-leaf"}>
                        {" "}
                        {growth >= 0 ? "▲" : "▼"}
                        {Math.abs(Math.round(growth))}٪
                      </span>
                    )}
                  </td>
                  <td>{y.happy}%</td>
                  <td>{y.costIndex}</td>
                  <td className={y.income - y.spend < 0 ? "text-coral" : ""}>
                    {money(y.income - y.spend)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="text-xs opacity-80">
        الآن: {money(st.residents)} ساكن · رضا {st.happy}% · غلاء {costIndex(snap)}
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ achievements

export function Achievements({ snap }: { snap: Sim }) {
  const era = eraOf(snap);
  return (
    <div className="space-y-2" dir="rtl">
      <div className="flex flex-wrap gap-1">
        {ERAS.map((name, i) => (
          <span
            key={name}
            className={`rounded-full px-2 py-1 text-xs font-extrabold ${
              i < era ? "bg-sc-leaf text-sc-ink" : i === era ? "sc-on" : "bg-sc-ink/30"
            }`}
          >
            {i < era ? "✓ " : i > era ? "🔒 " : "▶ "}
            {name}
          </span>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-1">
        {ACHIEVEMENTS.map((a) => {
          const got = snap.achievements.includes(a.id);
          return (
            <li
              key={a.id}
              className={`rounded-md px-2 py-2 text-xs ${got ? "sc-on" : "bg-sc-mint text-sc-ink opacity-70"}`}
            >
              <span className="flex items-center gap-1 font-extrabold">
                {got ? <Check size={14} /> : <Lock size={12} />} {a.name}
              </span>
              {a.detail && <span className="block opacity-80">{a.detail}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ crises in the disasters panel

export function CrisisButtons({
  snap,
  onCrisis,
}: {
  snap: Sim;
  onCrisis: (kind: CrisisKind) => void;
}) {
  const active = crisisOf(snap);
  return (
    <div className="space-y-1">
      <p className="text-sm font-extrabold">أزمات عالمية</p>
      <p className="text-xs leading-relaxed">
        تأتي نادراً من نفسها وتستمر شهوراً. الأزمة الاقتصادية تهدد البنوك والشركات واستثماراتك،
        والوباء يمنع الفعاليات ويطلّع الناس، والحرب الإقليمية تكلّف دفاعاً مدنياً كل شهر.
      </p>
      {active && (
        <p className="sc-lcd text-sm">
          {CRISES[active].name} لين {formatCityDate(snap.crisis!.until)}
        </p>
      )}
      {(Object.keys(CRISES) as CrisisKind[]).map((kind) => (
        <button
          key={kind}
          type="button"
          data-testid={`crisis-${kind}`}
          disabled={Boolean(active)}
          onClick={() => onCrisis(kind)}
          className="sc-menu inline-flex w-full items-center justify-center gap-2 text-sm disabled:opacity-40"
        >
          <Flame size={16} /> {CRISES[kind].name}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ banners & overlays

export function CrisisBanner({ snap }: { snap: Sim }) {
  const crisis = crisisOf(snap);
  const mood = calendarMood(snap);
  const disaster = snap.disaster && snap.day < snap.disaster.until ? snap.disaster.kind : null;
  const label = crisis
    ? `⚠ ${CRISES[crisis].name}`
    : disaster === "storm"
      ? "🌪 عاصفة رملية"
      : disaster === "flood"
        ? "🌧 أمطار وسيول"
        : disaster === "blackout"
          ? "⚡ انقطاع كهرباء"
          : mood.national
            ? "🇰🇼 العيد الوطني وعيد التحرير"
            : mood.eid
              ? "🌙 عيدكم مبارك"
              : mood.ramadan
                ? "🌙 رمضان كريم"
                : null;
  if (!label) return null;
  return (
    <p className={`crisis-banner ${crisis || disaster ? "is-bad" : "is-good"}`} dir="rtl">
      {label}
    </p>
  );
}

/** Screen-space weather on top of the 3D scene: dust, rain, war glow, pandemic haze. */
export function WeatherOverlay({ snap }: { snap: Sim }) {
  const disaster = snap.disaster && snap.day < snap.disaster.until ? snap.disaster.kind : null;
  const crisis = crisisOf(snap);
  return (
    <div className="weather-layer" aria-hidden="true">
      {disaster === "storm" && <div className="weather-dust" />}
      {disaster === "flood" && <div className="weather-rain" />}
      {disaster === "blackout" && <div className="weather-dark" />}
      {crisis === "war" && <div className="weather-war" />}
      {crisis === "pandemic" && <div className="weather-haze" />}
    </div>
  );
}

// ------------------------------------------------------------------ celebration & welcome

export type Celebration = { title: string; detail: string; kind: "rank" | "era" | "achievement" };

export function CelebrationCard({ item, onClose }: { item: Celebration; onClose: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onClose, 6000);
    return () => window.clearTimeout(id);
  }, [item, onClose]);
  return (
    <div className="celebrate pointer-events-auto" role="status" dir="rtl" onClick={onClose}>
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <i key={i} style={{ ["--i" as string]: i }} />
        ))}
      </div>
      <div className="celebrate-card sc-panel">
        <p className="text-sm font-bold text-sc-leaf">
          {item.kind === "rank" ? "ترقية!" : item.kind === "era" ? "حقبة جديدة" : "إنجاز جديد"}
        </p>
        <p className="mt-1 text-3xl font-extrabold">{item.title}</p>
        <p className="mt-2 text-sm">{item.detail}</p>
        <button type="button" className="sc-menu sc-on mt-3 w-full text-sm" onClick={onClose}>
          يا سلام!
        </button>
      </div>
    </div>
  );
}

export function WelcomeBack({
  daily,
  streak,
  offline,
  months,
  onClose,
}: {
  daily: number;
  streak: number;
  offline: number;
  months: number;
  onClose: () => void;
}) {
  return (
    <div className="celebrate pointer-events-auto" dir="rtl">
      <div className="celebrate-card sc-panel">
        <p className="text-2xl font-extrabold">هلا والله، رجعت!</p>
        {daily > 0 && (
          <p className="mt-2 text-sm">
            مكافأة اليوم <b dir="ltr">+{fmt(daily)}</b> د.ك · أيام متتالية {streak}
          </p>
        )}
        {offline > 0 && (
          <p className="mt-1 text-sm">
            أثناء غيابك اشتغلت المدينة {months} شهراً وربحت <b dir="ltr">+{fmt(offline)}</b> د.ك
          </p>
        )}
        <button type="button" className="sc-menu sc-on mt-3 w-full text-sm" onClick={onClose}>
          يلا نكمل
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ tutorial

export const TUTORIAL: { text: string; target: string }[] = [
  { text: "أهلاً يا مساعد المختار! هذا حيّك. شغّل الوقت من زر ▶ أسفل الشاشة.", target: "speed-1" },
  { text: "ارصف طريقاً: اضغط زر الطرق ثم اسحب بإصبعك على الأرض.", target: "tool-road" },
  {
    text: "ابنِ بيتاً: افتح «سكن وتجارة»، اختر فيلا، ثم اضغط أرضاً بجانب طريق.",
    target: "tool-homes",
  },
  { text: "اجمع الدخل: اضغط العملة الذهبية فوق المباني أو زر «اجمع».", target: "collect" },
  {
    text: "رقِّ مبنى: اضغط أي مبنى ثم «ترقّي». التجارة تصير ناطحة سحاب في المستوى ٥.",
    target: "upgrade",
  },
  {
    text: "افتح الميزانية: الضرائب ومصاريف السكن والتعليم والصحة تحدد رضا الناس.",
    target: "menu-budget",
  },
];

export function TutorialCard({ step, onSkip }: { step: number; onSkip: () => void }) {
  const [hidden, setHidden] = useState(false);
  const item = TUTORIAL[step];
  useEffect(() => {
    if (!item) return;
    const el = document.querySelector(`[data-tut="${item.target}"]`);
    el?.classList.add("tut-pulse");
    return () => el?.classList.remove("tut-pulse");
  }, [item]);
  if (!item || hidden) return null;
  return (
    <div className="tutorial-card sc-panel pointer-events-auto" dir="rtl" data-testid="tutorial">
      <p className="text-xs font-bold text-sc-leaf">
        تعلّم اللعب · {step + 1}/{TUTORIAL.length}
      </p>
      <p className="mt-1 text-sm font-extrabold leading-relaxed">{item.text}</p>
      <div className="mt-2 flex gap-2">
        <button type="button" className="sc-textbtn text-xs" onClick={() => setHidden(true)}>
          إخفاء مؤقت
        </button>
        <button type="button" className="sc-textbtn text-xs" onClick={onSkip}>
          تخطَّ الشرح
        </button>
      </div>
    </div>
  );
}
