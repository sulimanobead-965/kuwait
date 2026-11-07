import { useEffect, useState, type ReactNode } from "react";
import {
  Award,
  Building2,
  Check,
  Flame,
  Landmark,
  Lock,
  Map as MapIcon,
  Newspaper,
  RotateCcw,
  ScrollText,
  Siren,
  Users,
  Languages,
  X,
  ShieldCheck,
  Gauge,
  Cloud,
} from "lucide-react";
import {
  ACHIEVEMENTS,
  calendarMood,
  COST_ITEMS,
  COST_KEYS,
  COST_MAX,
  costIndex,
  costRevenue,
  CRISES,
  crisisOf,
  ERAS,
  eraOf,
  developerOpen,
  disasterPremium,
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
  exposure,
  financeIncome,
  isOpen,
  PROJECT_OFFERS,
  pct,
  INSURER,
  monthlyPremium,
  premiumRate,
  type BondOrder,
  type ProjectOrder,
} from "@/game/finance";
import { NumberField } from "@/components/hud-social";
import { unreadVoices, type VoiceMood } from "@/game/voices";
import {
  DEVELOPER_IDS,
  DEVELOPERS,
  DEVELOPMENT_KINDS,
  DEVELOPMENTS,
  type DeveloperId,
  progressOf,
  type DevelopmentKind,
} from "@/game/developments";
import { currency, dirOf, percentSign, setLang, t, tx, useLang, bigNum, getLang } from "@/i18n";

export function fmt(n: number) {
  return Math.abs(n) >= 1e9 ? bigNum(n, getLang()) : Math.floor(n).toLocaleString("en-US");
}

/** Short money, e.g. «1.2 مليون» / "1.2M", «250 ألف» / "250K". */
export function money(n: number) {
  const a = Math.abs(n);
  if (a >= 1e9) return bigNum(n, getLang());
  if (a >= 1_000_000)
    return t("{n} مليون", { n: (n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1) });
  if (a >= 10_000) return t("{n} ألف", { n: Math.round(n / 1000) });
  return fmt(n);
}

// ------------------------------------------------------------------ language picker

/** Two buttons, «العربية» and "English"; switching re-renders everything in place. */
export function LangPicker({ className = "" }: { className?: string }) {
  const lang = useLang();
  return (
    <div
      className={`lang-picker flex gap-1 ${className}`}
      role="radiogroup"
      aria-label="اللغة / Language"
    >
      {(
        [
          ["ar", "العربية"],
          ["en", "English"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="radio"
          lang={id}
          aria-checked={lang === id}
          data-testid={`lang-${id}`}
          onClick={() => setLang(id)}
          className={`sc-menu h-9 flex-1 px-3 text-sm ${lang === id ? "sc-on" : ""}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
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
  | "reset"
  | "profile"
  | "people"
  | "voices"
  | "board"
  | "stocks"
  | "graphics"
  | "cloud"
  | "language";

export function MoreSheet({
  snap,
  music,
  graphics,
  onPick,
  onClose,
}: {
  snap: Sim;
  music: boolean;
  graphics: "auto" | "high" | "low";
  onPick: (a: MoreAction) => void;
  onClose: () => void;
}) {
  const lang = useLang();
  // "Me" opens its own short list: profile, language, cloud save, new city, districts.
  const [mine, setMine] = useState(false);
  const items: { id: MoreAction | "me"; label: string; icon: ReactNode }[] = mine
    ? [
        { id: "profile", label: t("تعديل ملفي"), icon: <Award size={20} /> },
        // Always offers the other language, written in that language.
        { id: "language", label: lang === "ar" ? "English" : "العربية", icon: <Languages size={20} /> },
        { id: "cloud", label: t("الحفظ السحابي"), icon: <Cloud size={20} /> },
        {
          // How detailed the 3D map is drawn: "light" for slower phones.
          id: "graphics",
          label:
            graphics === "auto"
              ? t("جودة الرسوم: تلقائية")
              : graphics === "high"
                ? t("جودة الرسوم: عالية")
                : t("جودة الرسوم: خفيفة"),
          icon: <Gauge size={20} />,
        },
        { id: "reset", label: t("مدينة جديدة"), icon: <RotateCcw size={20} /> },
      ]
    : [
        {
          id: "report",
          label:
            unreadVoices(snap) > 0
              ? t("التقارير وآراء الناس ({n})", { n: unreadVoices(snap) })
              : t("التقارير وآراء الناس"),
          icon: <Newspaper size={20} />,
        },
        { id: "disasters", label: t("الكوارث والأزمات"), icon: <Siren size={20} /> },
        { id: "people", label: t("اللاعبون"), icon: <Users size={20} /> },
        { id: "me", label: t("ملفي"), icon: <Award size={20} /> },
      ];
  void music;
  return (
    <div
      className="more-sheet sc-panel pointer-events-auto"
      dir={dirOf(lang)}
      role="dialog"
      aria-label={t("المزيد")}
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="flex items-center gap-2 text-sm font-extrabold">
          {mine && (
            <button
              type="button"
              className="text-xs underline underline-offset-4"
              data-testid="more-back"
              onClick={() => setMine(false)}
            >
              {t("رجوع")}
            </button>
          )}
          {mine ? t("ملفي") : t("المزيد")}
        </p>
        <button type="button" className="sc-x" aria-label={t("إغلاق")} onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`more-${item.id}`}
            onClick={() => (item.id === "me" ? setMine(true) : onPick(item.id))}
            className="more-item"
          >
            {item.icon}
            <span lang={item.id === "language" ? (lang === "ar" ? "en" : "ar") : undefined}>
              {item.label}
            </span>
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
  const [showAll, setShowAll] = useState(false);
  const [allRate, setAllRate] = useState(100);
  const index = costIndex(snap);
  return (
    <div className="space-y-2">
      <p className="flex items-center justify-between text-sm font-extrabold">
        <span>{t("رسوم المعيشة · دخل لك")}</span>
        <span className={index > 115 ? "text-coral" : ""}>
          {t("مؤشر الغلاء {n}", { n: index })}
        </span>
      </p>
      <p className="text-xs leading-relaxed opacity-80">
        {t(
          "رسوم يدفعها السكان لصندوقك كل شهر، وهي محسوبة في «دخل الشهر» أعلى اللوحة (مجموعها الآن {total} د.ك). تحدد نسبتها بحرية حتى {max}٪: الرفع المعقول يزيد دخلك، لكن الرضا ينزل والناس تطلع، وفوق ٤٠٠٪ تقريباً يتوقف الناس عن الدفع فيقل الدخل.",
          { max: fmt(COST_MAX), total: fmt(rev.total) },
        )}
      </p>
      <div className="flex items-end gap-1">
        <NumberField
          label={t("طبّق نسبة واحدة على كل البنود")}
          value={allRate}
          onChange={setAllRate}
          suffix={percentSign()}
          testid="cost-all"
        />
        <button
          type="button"
          data-testid="cost-all-apply"
          onClick={() => COST_KEYS.forEach((k) => onCost(k, allRate))}
          className="sc-menu sc-on shrink-0 px-3 text-xs"
        >
          {t("طبّق")}
        </button>
      </div>
      {(showAll ? COST_KEYS : COST_KEYS.slice(0, 5)).map((key) => {
        const v = snap.costs[key];
        const set = (n: number) => onCost(key, Math.max(0, Math.min(COST_MAX, Math.round(n))));
        return (
          <div key={key} className="text-xs font-extrabold">
            <span className="flex justify-between">
              <span>{t(COST_ITEMS[key].name)}</span>
              <span dir="ltr">{t("+{n}/شهر لك", { n: fmt(rev.rows[key]) })}</span>
            </span>
            <span className="mt-0.5 flex items-center gap-1" dir="ltr">
              <button type="button" className="sc-menu px-2 text-xs" onClick={() => set(v / 2)}>
                ÷2
              </button>
              <button type="button" className="sc-menu px-2 text-xs" onClick={() => set(v - 10)}>
                −10
              </button>
              <NumberField
                label=""
                value={v}
                suffix={percentSign()}
                testid={`cost-${key}`}
                onChange={(n) => set(n)}
              />
              <button type="button" className="sc-menu px-2 text-xs" onClick={() => set(v + 10)}>
                +10
              </button>
              <button type="button" className="sc-menu px-2 text-xs" onClick={() => set(v * 10)}>
                ×10
              </button>
            </span>
          </div>
        );
      })}
      <button
        type="button"
        data-testid="cost-show-all"
        onClick={() => setShowAll((v) => !v)}
        className="sc-textbtn h-9 w-full text-xs"
      >
        {showAll
          ? t("اعرض البنود الأساسية فقط")
          : t("اعرض كل البنود ({n})", { n: COST_KEYS.length })}
      </button>
      <div className="flex items-center gap-1 text-xs font-extrabold">
        <span className="flex-1">{t("زيادة سنوية تلقائية")}</span>
        {[0, 5, 10, 50, 100].map((pct) => (
          <button
            key={pct}
            type="button"
            aria-pressed={snap.autoRaise === pct}
            onClick={() => onAutoRaise(pct)}
            className={`sc-menu px-2 text-xs ${snap.autoRaise === pct ? "sc-on" : ""}`}
          >
            {pct === 0 ? t("ثابتة") : `${pct}${percentSign()}`}
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
  onMudaraba,
  onMudarabaWithdraw,
  onSukuk,
  onDevelop,
  onPickSite,
  onInsure,
}: {
  snap: Sim;
  onDeposit: (amount: number, rate: number) => void;
  onWithdraw: (amount: number) => void;
  onBond: (order: number | BondOrder) => void;
  onProject: (order: number | ProjectOrder) => void;
  onConsult: () => void;
  onMudaraba: (amount: number, expected: number) => void;
  onMudarabaWithdraw: () => void;
  onSukuk: (issuer: "islamic" | "developer", amount: number, expected: number, years: number) => void;
  onDevelop: (kind: DevelopmentKind, developer: DeveloperId) => void;
  onPickSite: (kind: DevelopmentKind, developer: DeveloperId) => void;
  onInsure: (on: boolean, kind?: "money" | "disaster") => void;
}) {
  const f = snap.finance;
  const [dev, setDev] = useState<DeveloperId>("marsa");
  const [mudAmount, setMudAmount] = useState(100_000);
  const [mudRate, setMudRate] = useState(8);
  const [sukAmount, setSukAmount] = useState(1_000_000);
  const [sukRate, setSukRate] = useState(7);
  const [sukYears, setSukYears] = useState(3);
  const [depAmount, setDepAmount] = useState(100_000);
  const [depRate, setDepRate] = useState(10);
  const [bondAmount, setBondAmount] = useState(1_000_000);
  const [bondRate, setBondRate] = useState(8);
  const [bondYears, setBondYears] = useState(3);
  const [projAmount, setProjAmount] = useState(250_000);
  const [projReturn, setProjReturn] = useState(40);
  const [projMonths, setProjMonths] = useState(24);
  const closed = (id: "bank" | "islamic" | "developer" | "consultant") =>
    !isOpen(snap, id) ? (
      <p className="text-xs font-extrabold text-coral">
        {t("مفلسة ومغلقة لين {date}", { date: formatCityDate(f.down[id]) })}
      </p>
    ) : null;
  return (
    <div className="space-y-3" dir={dirOf()}>
      <div className="grid grid-cols-3 gap-1 text-center text-xs font-extrabold">
        <div className="sc-lcd h-auto flex-col py-2">
          <span>{t("panel::مستثمر")}</span>
          <span>{money(exposure(snap))}</span>
        </div>
        <div className="sc-lcd h-auto flex-col py-2">
          <span>{t("عائد شهري")}</span>
          <span>{money(financeIncome(snap))}</span>
        </div>
        <div className="sc-lcd h-auto flex-col py-2">
          <span>{t("ربح / خسارة")}</span>
          <span>
            {money(f.earned)} / {money(f.lost)}
          </span>
        </div>
      </div>
      <Insurance snap={snap} onInsure={onInsure} />
      <DisasterInsurance snap={snap} onInsure={(on) => onInsure(on, "disaster")} />
      {crisisOf(snap) === "economic" && (
        <p className="rounded-md bg-coral px-2 py-1 text-xs font-extrabold text-sc-ink">
          {t("أزمة اقتصادية: خطر إفلاس البنوك والشركات مرتفع جداً الآن.")}
        </p>
      )}

      <Company
        title={COMPANIES.islamic.name}
        blurb={COMPANIES.islamic.blurb}
        icon={<Landmark size={16} />}
      >
        {closed("islamic")}
        <p className="text-xs font-extrabold">{t("وديعة مضاربة (بدل الفائدة)")}</p>
        <p className="text-xs">
          {t(
            "رصيدك {amount} د.ك بربح متوقع {rate}. الربح الفعلي يتغير كل شهر حسب أداء استثمارات المصرف، وقد يكون خسارة في الأزمات.",
            { amount: fmt(f.mudaraba), rate: pct(f.mudarabaRate) },
          )}
        </p>
        <div className="mt-1 grid grid-cols-2 gap-1">
          <NumberField
            label={t("المبلغ")}
            value={mudAmount}
            onChange={setMudAmount}
            suffix={currency()}
          />
          <NumberField
            label={t("الربح المتوقع")}
            value={mudRate}
            onChange={setMudRate}
            suffix={percentSign()}
            testid="mudaraba-rate"
          />
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1">
          <button
            type="button"
            data-testid="mudaraba-deposit"
            disabled={!isOpen(snap, "islamic") || snap.coins < mudAmount}
            onClick={() => onMudaraba(mudAmount, mudRate / 100)}
            className="sc-menu sc-on text-xs disabled:opacity-40"
          >
            {t("أودع {amount}", { amount: money(mudAmount) })}
          </button>
          <button
            type="button"
            disabled={!isOpen(snap, "islamic") || f.mudaraba <= 0}
            onClick={onMudarabaWithdraw}
            className="sc-menu text-xs disabled:opacity-40"
          >
            {t("اسحب الوديعة")}
          </button>
        </div>
        <p className="mt-2 text-xs font-extrabold">{t("صكوك (بدل السندات)")}</p>
        <p className="text-xs">
          {t(
            "صكوك مدعومة بأصول حقيقية: الربح حصة من دخل الأصل ويتغير قليلاً، وعند التعثر يرجع لك جزء أكبر من السندات.",
          )}
        </p>
        <div className="mt-1 flex gap-1">
          {[1_000_000, 2_000_000].map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setSukAmount(a)}
              className={`sc-menu flex-1 px-1 text-xs ${sukAmount === a ? "sc-on" : ""}`}
            >
              {money(a)}
            </button>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-3 gap-1">
          <NumberField label={t("القيمة")} value={sukAmount} onChange={setSukAmount} />
          <NumberField
            label={t("الربح المتوقع")}
            value={sukRate}
            onChange={setSukRate}
            suffix={percentSign()}
          />
          <NumberField
            label={t("السنوات")}
            value={sukYears}
            onChange={(v) => setSukYears(Math.max(1, Math.round(v)))}
          />
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1">
          <button
            type="button"
            data-testid="sukuk-islamic"
            disabled={!isOpen(snap, "islamic") || snap.coins < sukAmount}
            onClick={() => onSukuk("islamic", sukAmount, sukRate / 100, sukYears)}
            className="sc-menu text-xs disabled:opacity-40"
          >
            {t("صكوك المصرف")}
          </button>
          <button
            type="button"
            data-testid="sukuk-developer"
            disabled={!isOpen(snap, "developer") || snap.coins < sukAmount}
            onClick={() => onSukuk("developer", sukAmount, sukRate / 100, sukYears)}
            className="sc-menu text-xs disabled:opacity-40"
          >
            {t("صكوك المرسى العقارية")}
          </button>
        </div>
        <p className="mt-1 text-[11px] opacity-80">
          {t("تمويل المرابحة بربح متفق عليه موجود في لوحة الميزانية بجانب تمويل البنك.")}
        </p>
      </Company>

      <Company
        title={COMPANIES.bank.name}
        blurb={COMPANIES.bank.blurb}
        icon={<Landmark size={16} />}
      >
        {closed("bank")}
        <p className="text-xs">
          {t("وديعتك {amount} د.ك بعائد {rate} سنوياً يُضاف شهرياً.", {
            amount: fmt(f.deposit),
            rate: pct(f.depositRate),
          })}
        </p>
        <div className="mt-1 grid grid-cols-4 gap-1">
          {[10_000, 100_000, 1_000_000].map((a) => (
            <button
              key={a}
              type="button"
              data-testid={`deposit-${a}`}
              disabled={!isOpen(snap, "bank") || snap.coins < a}
              onClick={() => onDeposit(a, depRate / 100)}
              className="sc-menu px-1 text-xs disabled:opacity-40"
            >
              {t("أودع {amount}", { amount: money(a) })}
            </button>
          ))}
          <button
            type="button"
            disabled={!isOpen(snap, "bank") || f.deposit <= 0}
            onClick={() => onWithdraw(f.deposit)}
            className="sc-menu sc-on px-1 text-xs disabled:opacity-40"
          >
            {t("اسحب الكل")}
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1">
          <NumberField
            label={t("مبلغ الإيداع")}
            value={depAmount}
            onChange={setDepAmount}
            suffix={currency()}
          />
          <NumberField
            label={t("العائد الذي تطلبه")}
            value={depRate}
            onChange={setDepRate}
            suffix={percentSign()}
            testid="deposit-rate"
          />
        </div>
        <button
          type="button"
          data-testid="deposit-custom"
          disabled={!isOpen(snap, "bank") || snap.coins < depAmount}
          onClick={() => onDeposit(depAmount, depRate / 100)}
          className="sc-menu sc-on mt-1 w-full text-xs disabled:opacity-40"
        >
          {t("أودع {amount} بعائد {rate}٪", { amount: money(depAmount), rate: depRate })}
        </button>
        <p className="mt-1 text-[11px] leading-relaxed opacity-80">
          {t(
            "العائد حر بلا حد. كلما ارتفع زاد خطر إفلاس البنك، فأمّن أموالك من «شركة الأمان للتأمين» أعلى اللوحة لتُعوَّض بالكامل.",
          )}
        </p>
        <p className="mt-2 text-xs font-extrabold">{t("سندات")}</p>
        <ul className="mt-1 space-y-1">
          {BOND_OFFERS.map((b, i) =>
            b.issuer !== "bank" ? null : (
              <li key={i}>
                <button
                  type="button"
                  data-testid={`bond-${i}`}
                  disabled={!isOpen(snap, "bank") || snap.coins < b.amount}
                  onClick={() => onBond(i)}
                  className="sc-choice w-full rounded-md px-2 py-1 text-start text-xs disabled:opacity-40"
                >
                  {t("سند {amount} · فائدة {rate}٪ · {years} سنوات", {
                    amount: money(b.amount),
                    rate: Math.round(b.rate * 1000) / 10,
                    years: b.years,
                  })}
                </button>
              </li>
            ),
          )}
        </ul>
        <p className="mt-2 text-xs font-extrabold">{t("سند بشروطك")}</p>
        <div className="grid grid-cols-3 gap-1">
          <NumberField label={t("القيمة")} value={bondAmount} onChange={setBondAmount} />
          <NumberField
            label={t("العائد")}
            value={bondRate}
            onChange={setBondRate}
            suffix={percentSign()}
          />
          <NumberField
            label={t("السنوات")}
            value={bondYears}
            onChange={(v) => setBondYears(Math.max(1, Math.round(v)))}
          />
        </div>
        <button
          type="button"
          data-testid="bond-custom"
          disabled={!isOpen(snap, "bank") || snap.coins < bondAmount}
          onClick={() =>
            onBond({ issuer: "bank", amount: bondAmount, rate: bondRate / 100, years: bondYears })
          }
          className="sc-menu mt-1 w-full text-xs disabled:opacity-40"
        >
          {t("اشترِ سند {amount} بفائدة {rate}٪", { amount: money(bondAmount), rate: bondRate })}
        </button>
      </Company>

      <Company
        title={COMPANIES.developer.name}
        blurb={COMPANIES.developer.blurb}
        icon={<Building2 size={16} />}
      >
        {closed("developer")}
        <p className="text-xs font-extrabold">{t("مشاريع داخل مدينتك")}</p>
        <p className="mb-1 text-[11px] leading-relaxed opacity-80">
          {t(
            "تستثمر مع الشركة فتسوّر أرض المشروع وتبنيه. أثناء البناء المنطقة محمية ولا يبني فيها أحد غير الشركة، وعند انتهاء المدة يظهر الحي جاهزاً ومسكوناً بشكله المميز. إذا أفلست الشركة يتوقف المشروع.",
          )}
        </p>
        <p className="text-xs font-extrabold">{t("اختر المطور")}</p>
        <div className="mb-1 grid grid-cols-2 gap-1">
          {DEVELOPER_IDS.map((id) => {
            const d = DEVELOPERS[id];
            const open = developerOpen(snap, id);
            return (
              <button
                key={id}
                type="button"
                data-testid={`developer-${id}`}
                aria-pressed={dev === id}
                disabled={!open}
                onClick={() => setDev(id)}
                className={`rounded-md border-2 px-1.5 py-1 text-start text-[11px] disabled:opacity-40 ${
                  dev === id ? "border-sc-ink bg-sc-gold" : "border-sc-ink/30 bg-white/60"
                }`}
              >
                <span className="block font-extrabold">{t(d.name)}</span>
                <span className="block opacity-80">
                  {open ? t(d.blurb) : t("مفلسة ومغلقة مؤقتاً")}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mb-1 text-[11px] opacity-80">
          {t(
            "ترقيات المباني يتوزعها المطورون المفتوحون تلقائياً، والهيئة الحكومية تتكفل بها إذا أفلسوا كلهم، فلا تدفع أنت شيئاً.",
          )}
        </p>
        <ul className="mb-2 space-y-1">
          {DEVELOPMENT_KINDS.map((kind) => {
            const def = DEVELOPMENTS[kind];
            const can = developerOpen(snap, dev) && snap.coins >= def.cost;
            return (
              <li key={kind} className="rounded-md border border-sc-ink/30 bg-white/60 p-1.5">
                <p className="flex justify-between text-xs font-extrabold">
                  <span>{t(def.name)}</span>
                  <span dir="ltr">
                    {money(def.cost)} {currency()}
                  </span>
                </p>
                <p className="text-[11px] opacity-80">
                  {t(def.blurb)} ·{" "}
                  {t("{w}×{h} قطعة · {months} شهر", {
                    w: def.w,
                    h: def.h,
                    months: Math.round(def.months * DEVELOPERS[dev].speed),
                  })}
                </p>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    data-testid={`develop-pick-${kind}`}
                    disabled={!can}
                    onClick={() => onPickSite(kind, dev)}
                    className="sc-menu sc-on px-1 text-xs disabled:opacity-40"
                  >
                    {t("اختر الموقع على الخريطة")}
                  </button>
                  <button
                    type="button"
                    data-testid={`develop-auto-${kind}`}
                    disabled={!can}
                    onClick={() => onDevelop(kind, dev)}
                    className="sc-menu px-1 text-xs disabled:opacity-40"
                  >
                    {t("دع الشركة تختار")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {(snap.sites ?? []).length > 0 && (
          <ul className="mb-2 space-y-1 text-xs">
            {snap.sites.map((site) => (
              <li key={site.id}>
                <span className="font-extrabold">
                  🏗 {t(DEVELOPMENTS[site.kind].name)} · {t(DEVELOPERS[site.developer ?? "marsa"].name)}
                </span>{" "}
                ·{" "}
                {t("اكتمل {pct}٪ · يُسلَّم {date}", {
                  pct: Math.round(progressOf(snap.day, site) * 100),
                  date: formatCityDate(site.completes),
                })}
                <span className="block h-1.5 rounded bg-sc-ink/20">
                  <span
                    className="block h-1.5 rounded bg-sc-orange"
                    style={{ width: `${Math.round(progressOf(snap.day, site) * 100)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs font-extrabold">{t("استثمار مالي فقط")}</p>
        <ul className="space-y-1">
          {PROJECT_OFFERS.map((p, i) => (
            <li key={p.name}>
              <button
                type="button"
                data-testid={`project-${i}`}
                disabled={!isOpen(snap, "developer") || snap.coins < p.amount}
                onClick={() => onProject(i)}
                className="sc-choice w-full rounded-md px-2 py-1 text-start text-xs disabled:opacity-40"
              >
                <b>{t(p.name)}</b> ·{" "}
                {t("استثمر {amount} ← يرجع {back} بعد {months} شهر", {
                  amount: money(p.amount),
                  back: money(p.amount * p.payback),
                  months: p.months,
                })}
                {p.handover ? ` ${t("+ بيوت جاهزة")}` : ""}
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
                  className="sc-choice w-full rounded-md px-2 py-1 text-start text-xs disabled:opacity-40"
                >
                  {t("سندات الشركة {amount} · فائدة {rate}٪ · مخاطرة عالية", {
                    amount: money(b.amount),
                    rate: Math.round(b.rate * 100),
                  })}
                </button>
              </li>
            ),
          )}
        </ul>
        <p className="mt-2 text-xs font-extrabold">{t("استثمار بشروطك")}</p>
        <div className="grid grid-cols-3 gap-1">
          <NumberField label={t("المبلغ")} value={projAmount} onChange={setProjAmount} />
          <NumberField
            label={t("العائد")}
            value={projReturn}
            onChange={setProjReturn}
            suffix={percentSign()}
          />
          <NumberField
            label={t("الأشهر")}
            value={projMonths}
            onChange={(v) => setProjMonths(Math.max(1, Math.round(v)))}
          />
        </div>
        <button
          type="button"
          data-testid="project-custom"
          disabled={!isOpen(snap, "developer") || snap.coins < projAmount}
          onClick={() =>
            onProject({
              name: "استثمار خاص",
              amount: projAmount,
              payback: 1 + projReturn / 100,
              months: projMonths,
              handover: false,
            })
          }
          className="sc-menu mt-1 w-full text-xs disabled:opacity-40"
        >
          {t("استثمر {amount} بعائد {rate}٪", { amount: money(projAmount), rate: projReturn })}
        </button>
        {f.projects.length > 0 && (
          <ul className="mt-1 text-xs">
            {f.projects.map((p) => (
              <li key={p.id}>
                •{" "}
                {t("{name}: {amount} يكتمل {date}", {
                  name: p.name,
                  amount: money(p.amount),
                  date: formatCityDate(p.completes),
                })}
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
            {t("العقد ساري لين {date}", { date: formatCityDate(f.consultUntil) })}
          </p>
        ) : (
          <button
            type="button"
            data-testid="consult"
            disabled={!isOpen(snap, "consultant") || snap.coins < CONSULT_COST}
            onClick={onConsult}
            className="sc-menu w-full text-xs disabled:opacity-40"
          >
            {t("عقد {months} شهراً بـ {amount} د.ك", {
              months: CONSULT_MONTHS,
              amount: money(CONSULT_COST),
            })}
          </button>
        )}
      </Company>

      {f.bonds.length > 0 && (
        <div className="text-xs">
          <p className="font-extrabold">{t("سنداتك")}</p>
          {f.bonds.map((b) => (
            <p key={b.id}>
              •{" "}
              {t(b.sukuk ? "صكوك {company} {amount} حتى {date}" : "سندات {company} {amount} حتى {date}", {
                company: COMPANIES[b.issuer].name,
                amount: money(b.amount),
                date: formatCityDate(b.matures),
              })}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function Insurance({ snap, onInsure }: { snap: Sim; onInsure: (on: boolean) => void }) {
  const f = snap.finance;
  const premium = monthlyPremium(snap);
  return (
    <section
      className={`rounded-md border-2 p-2 ${f.insured ? "border-sc-leaf bg-sc-lime/30" : "border-sc-ink/30 bg-sc-mint"} text-sc-ink`}
      data-testid="insurance"
    >
      <p className="flex items-center gap-1 text-sm font-extrabold">
        <ShieldCheck size={16} /> {t(INSURER)}
      </p>
      <p className="mt-1 text-xs leading-relaxed">
        {t(
          "تأمين شامل: إذا أفلس بنك أو مصرف أو مطور، أو عجز مقترض عن السداد، أو خسرت وديعة مضاربة، تعوّضك الشركة بالكامل، وتدفع عنك أي قسط لا يكفيه رصيدك. القسط الشهري نسبة من كل مبلغ مؤمَّن، ويزيد مع الفائدة:",
        )}
      </p>
      <div className="mt-1 grid grid-cols-4 gap-1 text-center text-[11px] font-extrabold" dir="ltr">
        {[0, 0.1, 0.7, 5].map((r) => (
          <span key={r} className="rounded bg-white/70 px-1 py-0.5">
            {Math.round(r * 100)}
            {percentSign()} → {(Math.round(premiumRate(r) * 1000) / 10).toLocaleString("en-US")}
            {percentSign()}
          </span>
        ))}
      </div>
      <p className="mt-1 text-xs font-extrabold">
        {t("القسط هذا الشهر: {amount} د.ك · دفعت {paid} · عُوّضت {claims}", {
          amount: fmt(premium),
          paid: money(f.premiums),
          claims: money(f.claims),
        })}
      </p>
      <button
        type="button"
        data-testid="insurance-toggle"
        aria-pressed={f.insured}
        onClick={() => onInsure(!f.insured)}
        className={`sc-menu mt-1 w-full text-xs ${f.insured ? "" : "sc-on"}`}
      >
        {f.insured ? t("التأمين مفعّل · إلغاء") : t("أمّن كل أموالي وقروضي")}
      </button>
    </section>
  );
}

export function DisasterInsurance({ snap, onInsure }: { snap: Sim; onInsure: (on: boolean) => void }) {
  const f = snap.finance;
  const on = f.disasterInsured;
  return (
    <section
      className={`rounded-md border-2 p-2 ${on ? "border-sc-leaf bg-sc-lime/30" : "border-sc-ink/30 bg-sc-mint"} text-sc-ink`}
      data-testid="disaster-insurance"
    >
      <p className="flex items-center gap-1 text-sm font-extrabold">
        <ShieldCheck size={16} /> {t("تأمين الكوارث والأزمات")}
      </p>
      <p className="mt-1 text-xs leading-relaxed">
        {t(
          "يدفع عنك فاتورة كل كارثة كاملة (حريق، عاصفة، سيول، انقطاع كهرباء)، وفي الأزمات العالمية (اقتصادية، وباء، حرب) يعوّضك كل شهر عن الدخل اللي نقص ومصاريف الدفاع المدني. القسط الشهري: ٠٫٢٪ من رصيد الخزينة + ٥٪ من دخل الشهر.",
        )}
      </p>
      <p className="mt-1 text-xs font-extrabold">
        {t("القسط هذا الشهر: {amount} د.ك · دفعت {paid} · عُوّضت {claims}", {
          amount: fmt(disasterPremium(snap)),
          paid: money(f.disasterPremiums),
          claims: money(f.disasterClaims),
        })}
      </p>
      <button
        type="button"
        data-testid="disaster-insurance-toggle"
        aria-pressed={on}
        onClick={() => onInsure(!on)}
        className={`sc-menu mt-1 w-full text-xs ${on ? "" : "sc-on"}`}
      >
        {on ? t("تأمين الكوارث مفعّل · إلغاء") : t("أمّن المدينة ضد الكوارث والأزمات")}
      </button>
    </section>
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
        {icon} {t(title)}
      </p>
      <p className="mb-1 text-xs opacity-80">{t(blurb)}</p>
      {children}
    </section>
  );
}

// ------------------------------------------------------------------ yearly report

/** Everything residents said, newest first, with a filter by kind. */
export function Voices({ snap }: { snap: Sim }) {
  const [filter, setFilter] = useState<"all" | VoiceMood>("all");
  const list = (snap.voices ?? []).filter((v) => filter === "all" || v.mood === filter);
  const counts = {
    complaint: (snap.voices ?? []).filter((v) => v.mood === "complaint").length,
    praise: (snap.voices ?? []).filter((v) => v.mood === "praise").length,
    idea: (snap.voices ?? []).filter((v) => v.mood === "idea").length,
  };
  const tabs: { id: "all" | VoiceMood; label: string }[] = [
    { id: "all", label: t("الكل") },
    { id: "complaint", label: t("شكاوى ({n})", { n: counts.complaint }) },
    { id: "praise", label: t("شكر ({n})", { n: counts.praise }) },
    { id: "idea", label: t("اقتراحات ({n})", { n: counts.idea }) },
  ];
  const tone = (m: VoiceMood) =>
    m === "complaint" ? "border-coral" : m === "praise" ? "border-sc-green" : "border-sc-sky";
  const badge = (m: VoiceMood) =>
    m === "complaint" ? t("شكوى") : m === "praise" ? t("شكر") : t("اقتراح");
  return (
    <div className="space-y-2" dir={dirOf()} data-testid="voices">
      <p className="text-xs leading-relaxed">
        {t("ما يقوله سكان مدينتك كل شهر. الشكاوى تتبع مشاكل حقيقية في المدينة: حلّها وتتحول إلى شكر.")}
      </p>
      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={filter === tab.id}
            onClick={() => setFilter(tab.id)}
            className={`sc-menu px-3 text-xs ${filter === tab.id ? "sc-on" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="sc-lcd text-sm">{t("ما في آراء بعد. شغّل الوقت وبيتكلم الناس كل شهر.")}</p>
      ) : (
        <ul className="space-y-1.5">
          {list.map((v) => (
            <li
              key={v.id}
              className={`rounded-md border-s-4 bg-sc-mint p-2 text-sc-ink ${tone(v.mood)}`}
            >
              <div className="flex items-center justify-between gap-2 text-xs font-extrabold">
                <span>
                  {t(v.name)} · <span className="font-medium">{t(v.area)}</span>
                </span>
                <span className="shrink-0 opacity-70">
                  {badge(v.mood)} · {formatCityDate(v.day)}
                </span>
              </div>
              <p className="mt-1 text-sm">{tx(v.text)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function YearReport({ snap }: { snap: Sim }) {
  const rows = [...snap.years].reverse();
  const st = stats(snap);
  return (
    <div className="space-y-2" dir={dirOf()}>
      <p className="text-xs leading-relaxed">
        {t(
          "يُقاس كل سنة: عدد السكان والرضا ومؤشر غلاء المعيشة والدخل والمصروف. السنة الحالية حتى الآن: دخل {income} ومصروف {spend}.",
          { income: money(snap.ytd.income), spend: money(snap.ytd.spend) },
        )}
      </p>
      {rows.length === 0 ? (
        <p className="sc-lcd text-sm">{t("أول تقرير يصدر نهاية السنة")}</p>
      ) : (
        <table className="w-full text-center text-xs">
          <thead>
            <tr className="font-extrabold">
              <th>{t("السنة")}</th>
              <th>{t("السكان")}</th>
              <th>{t("الرضا")}</th>
              <th>{t("الغلاء")}</th>
              <th>{t("الصافي")}</th>
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
                        {Math.abs(Math.round(growth))}
                        {percentSign()}
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
        {t("الآن: {residents} ساكن · رضا {happy}% · غلاء {index}", {
          residents: money(st.residents),
          happy: st.happy,
          index: costIndex(snap),
        })}
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ achievements

export function Achievements({ snap }: { snap: Sim }) {
  const era = eraOf(snap);
  return (
    <div className="space-y-2" dir={dirOf()}>
      <div className="flex flex-wrap gap-1">
        {ERAS.map((name, i) => (
          <span
            key={name}
            className={`rounded-full px-2 py-1 text-xs font-extrabold ${
              i < era ? "bg-sc-leaf text-sc-ink" : i === era ? "sc-on" : "bg-sc-ink/30"
            }`}
          >
            {i < era ? "✓ " : i > era ? "🔒 " : "▶ "}
            {t(name)}
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
                {got ? <Check size={14} /> : <Lock size={12} />} {t(a.name)}
              </span>
              {a.detail && <span className="block opacity-80">{t(a.detail)}</span>}
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
      <p className="text-sm font-extrabold">{t("أزمات عالمية")}</p>
      <p className="text-xs leading-relaxed">
        {t(
          "تأتي نادراً من نفسها وتستمر شهوراً. الأزمة الاقتصادية تهدد البنوك والشركات واستثماراتك، والوباء يمنع الفعاليات ويطلّع الناس، والحرب الإقليمية تكلّف دفاعاً مدنياً كل شهر.",
        )}
      </p>
      {active && (
        <p className="sc-lcd text-sm">
          {t("{name} لين {date}", {
            name: CRISES[active].name,
            date: formatCityDate(snap.crisis!.until),
          })}
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
          <Flame size={16} /> {t(CRISES[kind].name)}
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
    ? `⚠ ${t(CRISES[crisis].name)}`
    : disaster === "storm"
      ? `🌪 ${t("عاصفة رملية")}`
      : disaster === "flood"
        ? `🌧 ${t("أمطار وسيول")}`
        : disaster === "blackout"
          ? `⚡ ${t("انقطاع كهرباء")}`
          : mood.national
            ? `🇰🇼 ${t("العيد الوطني وعيد التحرير")}`
            : mood.eid
              ? `🌙 ${t("عيدكم مبارك")}`
              : mood.ramadan
                ? `🌙 ${t("رمضان كريم")}`
                : null;
  if (!label) return null;
  return (
    <p className={`crisis-banner ${crisis || disaster ? "is-bad" : "is-good"}`} dir={dirOf()}>
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
    <div className="celebrate pointer-events-auto" role="status" dir={dirOf()} onClick={onClose}>
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <i key={i} style={{ ["--i" as string]: i }} />
        ))}
      </div>
      <div className="celebrate-card sc-panel">
        <p className="text-sm font-bold text-sc-leaf">
          {t(item.kind === "rank" ? "ترقية!" : item.kind === "era" ? "حقبة جديدة" : "إنجاز جديد")}
        </p>
        <p className="mt-1 text-3xl font-extrabold">{tx(item.title)}</p>
        <p className="mt-2 text-sm">{tx(item.detail)}</p>
        <button type="button" className="sc-menu sc-on mt-3 w-full text-sm" onClick={onClose}>
          {t("يا سلام!")}
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
    <div className="celebrate pointer-events-auto" dir={dirOf()}>
      <div className="celebrate-card sc-panel">
        <p className="text-2xl font-extrabold">{t("هلا والله، رجعت!")}</p>
        {daily > 0 && (
          <p className="mt-2 text-sm">
            {t("مكافأة اليوم +{amount} د.ك · أيام متتالية {streak}", {
              amount: fmt(daily),
              streak,
            })}
          </p>
        )}
        {offline > 0 && (
          <p className="mt-1 text-sm">
            {t("أثناء غيابك اشتغلت المدينة {months} شهراً وربحت +{amount} د.ك", {
              months,
              amount: fmt(offline),
            })}
          </p>
        )}
        <button type="button" className="sc-menu sc-on mt-3 w-full text-sm" onClick={onClose}>
          {t("يلا نكمل")}
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
    <div className="tutorial-card sc-panel pointer-events-auto" dir={dirOf()} data-testid="tutorial">
      <p className="text-xs font-bold text-sc-leaf">
        {t("تعلّم اللعب")} · {step + 1}/{TUTORIAL.length}
      </p>
      <p className="mt-1 text-sm font-extrabold leading-relaxed">{t(item.text)}</p>
      <div className="mt-2 flex gap-2">
        <button type="button" className="sc-textbtn text-xs" onClick={() => setHidden(true)}>
          {t("إخفاء مؤقت")}
        </button>
        <button type="button" className="sc-textbtn text-xs" onClick={onSkip}>
          {t("تخطَّ الشرح")}
        </button>
      </div>
    </div>
  );
}
