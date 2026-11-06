import { useState } from "react";
import { Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import {
  boardFee,
  DEPT_PARAMS,
  deptParam,
  ORDER_KINDS,
  DEPARTMENTS,
  DEPT_IDS,
  MEGA_KEYS,
  PROJECT_KEYS,
  PROJECTS,
  projectCost,
  projectMoney,
  projectScale,
  type BoardState,
  type DeptId,
} from "@/game/board";
import { formatCityDate, type Sim } from "@/game/sim";
import { CATALOG, type Kind } from "@/game/catalog";
import { NumberField } from "@/components/hud-social";
import { currency, dirOf, percentSign, t, tx } from "@/i18n";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

const EFFECT_LABELS: Record<string, string> = {
  happy: "الرضا",
  pollution: "التلوث",
  traffic: "الزحمة",
  crime: "الجريمة",
  health: "الصحة",
  education: "التعليم",
  unemployment: "البطالة",
};

/**
 * The board of directors: automatic play, the board's pay, each director's powers
 * and department projects, and the latest decisions.
 */
export function Board({
  snap,
  onBoard,
  onPower,
  onApprove,
  onParam,
  onOrder,
  onCancelOrder,
}: {
  snap: Sim;
  onBoard: (patch: Partial<BoardState>) => void;
  onPower: (dept: DeptId, on: boolean) => void;
  onApprove: (key: string) => void;
  onParam: (dept: DeptId, key: string, value: number) => void;
  onOrder: (dept: DeptId, kind: Kind, count: number) => void;
  onCancelOrder: (id: string) => void;
}) {
  const b = snap.board;
  const [open, setOpen] = useState<DeptId | null>(null);
  const money = projectMoney(snap);
  const scale = projectScale(snap);
  return (
    <div className="space-y-3" dir={dirOf()} data-testid="board">
      <div className="rounded-md bg-sc-mint p-2 text-sc-ink">
        <p className="flex items-center gap-1 text-sm font-extrabold">
          <Briefcase size={16} /> {t("اللعب الآلي")}
        </p>
        <p className="mt-1 text-xs leading-relaxed">
          {t(
            "سلّم إدارة المدينة للمجلس: يبني البيوت والخدمات ويرقّيها، ويضبط الضرائب، ويأخذ التمويل ويسدده، ويودع الفائض، ويبني المصافي والمجمعات. تبقى كل صلاحياتك وتقدر تلعب في أي وقت.",
          )}
        </p>
        <button
          type="button"
          data-testid="board-auto"
          aria-pressed={b.auto}
          onClick={() => onBoard({ auto: !b.auto })}
          className={`sc-menu mt-2 w-full text-sm ${b.auto ? "sc-on" : ""}`}
        >
          {b.auto ? t("المجلس يدير المدينة الآن · اضغط للإيقاف") : t("سلّم الإدارة للمجلس")}
        </button>
      </div>

      <div className="rounded-md bg-sc-mint p-2 text-sc-ink">
        <p className="text-sm font-extrabold">{t("مكافأة المجلس")}</p>
        <p className="mt-1 text-xs leading-relaxed">
          {t("تُدفع فقط والمجلس يدير: راتب شهري نسبة من دخل الشهر، ومكافأة سنوية نسبة من ربح السنة.")}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1">
          <NumberField
            label={t("الراتب الشهري")}
            value={b.feePct}
            onChange={(v) => onBoard({ feePct: v })}
            suffix={percentSign()}
            testid="board-fee"
          />
          <NumberField
            label={t("المكافأة السنوية")}
            value={b.bonusPct}
            onChange={(v) => onBoard({ bonusPct: v })}
            suffix={percentSign()}
            testid="board-bonus"
          />

        </div>
        <p className="mt-2 text-xs">
          {t("راتب هذا الشهر {fee} · المدفوع هذه السنة {year} · المجموع {total} {cur}", {
            fee: fmt(boardFee({ ...snap, board: { ...b, auto: true } })),
            year: fmt(b.paidYear),
            total: fmt(b.paid),
            cur: currency(),
          })}
        </p>
        <p className="mt-1 text-xs">
          {t("مشاريع الإدارات تعود بـ {income} وتكلف {upkeep} {cur} شهرياً", {
            income: fmt(money.income),
            upkeep: fmt(money.upkeep),
            cur: currency(),
          })}
        </p>
      </div>

      <div>
        <p className="mb-1 text-sm font-extrabold">{t("أعضاء المجلس")}</p>
        <ul className="space-y-1.5">
          {DEPT_IDS.map((id) => {
            const d = DEPARTMENTS[id];
            const keys = PROJECT_KEYS.filter((k) => PROJECTS[k]!.dept === id);
            const mine = b.projects.filter((p) => PROJECTS[p.key]!.dept === id);
            const isOpen = open === id;
            return (
              <li key={id} className="rounded-md bg-sc-mint p-2 text-sc-ink" data-testid={`dept-${id}`}>
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="flex-1 text-start"
                    onClick={() => setOpen(isOpen ? null : id)}
                    aria-expanded={isOpen}
                  >
                    <span className="flex items-center gap-1 text-sm font-extrabold">
                      {t(d.name)}
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                    <span className="block text-xs font-medium">
                      {t(d.director)} · {t(d.role)}
                    </span>
                    {mine.length > 0 && (
                      <span className="block text-xs opacity-80">
                        {t("{open} مشروع يعمل · {building} قيد التنفيذ", {
                          open: mine.filter((p) => p.open).length,
                          building: mine.filter((p) => !p.open).length,
                        })}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-pressed={b.powers[id]}
                    onClick={() => onPower(id, !b.powers[id])}
                    className={`sc-menu shrink-0 px-2 text-xs ${b.powers[id] ? "sc-on" : ""}`}
                    title={t("صلاحية التصرف في اللعب الآلي")}
                  >
                    {b.powers[id] ? t("مفوّض") : t("موقوف")}
                  </button>
                </div>
                {isOpen && (
                  <DirectorOrders
                    snap={snap}
                    dept={id}
                    onParam={onParam}
                    onOrder={onOrder}
                    onCancelOrder={onCancelOrder}
                  />
                )}
                {isOpen && (
                  <ul className="mt-2 space-y-1">
                    {keys.map((k) => {
                      const p = PROJECTS[k]!;
                      const runs = b.projects.filter((x) => x.key === k);
                      const pending = runs.find((x) => !x.open);
                      const cost = projectCost(snap, k);
                      const effects = Object.entries(p.effects ?? {})
                        .map(([e, v]) => `${t(EFFECT_LABELS[e]!)} ${v! > 0 ? "+" : ""}${v}`)
                        .join(" · ");
                      return (
                        <li key={k} className="rounded bg-white/60 p-1.5 text-xs">
                          <div className="flex items-center justify-between gap-1 font-extrabold">
                            <span>{t(p.name)}</span>
                            {runs.length > 0 && <span className="opacity-70">×{runs.length}</span>}
                          </div>
                          <p className="mt-0.5">{t(p.blurb)}</p>
                          <p className="mt-0.5 opacity-80">
                            {t("التكلفة {cost} · مصروف شهري {upkeep} · عائد شهري {income} {cur} · {months} شهر", {
                              cost: fmt(cost),
                              upkeep: fmt(p.upkeep * scale),
                              income: fmt(p.income * scale),
                              cur: currency(),
                              months: p.months,
                            })}
                          </p>
                          {effects && <p className="mt-0.5 opacity-80">{effects}</p>}
                          {p.build && (
                            <p className="mt-0.5 opacity-80">
                              {t("يبني {n} × {kind}", { n: p.build.count, kind: t(kindName(p.build.kind)) })}
                            </p>
                          )}
                          {pending && (
                            <p className="mt-0.5 font-bold">
                              {t("قيد التنفيذ حتى {date}", { date: formatCityDate(pending.completes) })}
                            </p>
                          )}
                          <button
                            type="button"
                            data-testid={`approve-${k}`}
                            disabled={cost > 0 && snap.coins < cost}
                            onClick={() => onApprove(k)}
                            className="sc-menu sc-on mt-1 w-full text-xs disabled:opacity-40"
                          >
                            {t("اعتمد المشروع ({cost} {cur})", { cost: fmt(cost), cur: currency() })}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className="mb-1 text-sm font-extrabold">{t("قرارات المجلس")}</p>
        {b.log.length === 0 ? (
          <p className="sc-lcd text-sm">{t("لا قرارات بعد.")}</p>
        ) : (
          <ul className="space-y-1">
            {b.log.slice(0, 20).map((line, i) => (
              <li key={i} className="rounded bg-sc-mint px-2 py-1 text-xs text-sc-ink">
                {tx(line)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** National mega projects: big cost, years of work, big return. */
export function MegaProjects({ snap, onApprove }: { snap: Sim; onApprove: (key: string) => void }) {
  const scale = projectScale(snap);
  return (
    <div className="mt-3 space-y-2" dir={dirOf()} data-testid="mega">
      <p className="flex items-center gap-1 text-sm font-extrabold">
        <Briefcase size={16} /> {t("مشاريع كبرى")}
      </p>
      <p className="text-xs leading-relaxed">
        {t("مشاريع وطنية بتكلفة كبيرة وسنوات من العمل، وعائد شهري كبير بعد اكتمالها. تكبر أرقامها مع حجم المدينة.")}
      </p>
      <ul className="space-y-2">
        {MEGA_KEYS.map((k) => {
          const p = PROJECTS[k]!;
          const cost = projectCost(snap, k);
          const runs = snap.board.projects.filter((x) => x.key === k);
          const pending = runs.find((x) => !x.open);
          const yearly = p.income * 12 * scale;
          return (
            <li key={k} className="rounded-md bg-sc-mint p-2 text-sc-ink">
              <div className="flex justify-between gap-2 text-sm font-extrabold">
                <span>{t(p.name)}</span>
                <span dir="ltr">
                  {fmt(cost)} {currency()}
                </span>
              </div>
              <p className="mt-0.5 text-xs">{t(p.blurb)}</p>
              <p className="mt-0.5 text-xs opacity-80">
                {t("{dept} · {months} شهر · عائد سنوي {yearly} {cur} · يسترد التكلفة في {years} سنة", {
                  dept: t(DEPARTMENTS[p.dept].name),
                  months: p.months,
                  yearly: fmt(yearly),
                  cur: currency(),
                  years: Math.round((cost / Math.max(1, yearly - p.upkeep * 12 * scale)) * 10) / 10,
                })}
              </p>
              {pending && (
                <p className="mt-0.5 text-xs font-bold">
                  {t("قيد التنفيذ حتى {date}", { date: formatCityDate(pending.completes) })}
                </p>
              )}
              {runs.some((x) => x.open) && <p className="mt-0.5 text-xs font-bold">{t("يعمل ويدرّ عائداً")}</p>}
              <button
                type="button"
                data-testid={`mega-${k}`}
                disabled={snap.coins < cost}
                onClick={() => onApprove(k)}
                className="sc-menu sc-on mt-1 w-full text-xs disabled:opacity-40"
              >
                {t("اعتمد المشروع ({cost} {cur})", { cost: fmt(cost), cur: currency() })}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The governor's settings and building orders for one director. */
function DirectorOrders({
  snap,
  dept,
  onParam,
  onOrder,
  onCancelOrder,
}: {
  snap: Sim;
  dept: DeptId;
  onParam: (dept: DeptId, key: string, value: number) => void;
  onOrder: (dept: DeptId, kind: Kind, count: number) => void;
  onCancelOrder: (id: string) => void;
}) {
  const kinds = ORDER_KINDS[dept];
  const [kind, setKind] = useState<Kind | "">(kinds[0] ?? "");
  const [count, setCount] = useState(3);
  const orders = snap.board.orders.filter((o) => o.dept === dept);
  const unit = (u: string) => (u === "%" ? percentSign() : u === "x" ? "×" : "");
  return (
    <div className="mt-2 rounded bg-white/60 p-1.5 text-xs" data-testid={`orders-${dept}`}>
      <p className="font-extrabold">{t("المطلوب من المدير")}</p>
      <div className="mt-1 grid grid-cols-2 gap-1">
        {DEPT_PARAMS[dept].map((p) => (
          <NumberField
            key={p.key}
            label={t(p.label)}
            value={deptParam(snap, dept, p.key)}
            onChange={(v) => onParam(dept, p.key, v)}
            suffix={unit(p.unit)}
            testid={`param-${dept}-${p.key}`}
          />
        ))}
      </div>
      {kinds.length > 0 && (
        <>
          <p className="mt-2 font-extrabold">{t("أوامر بناء")}</p>
          <div className="mt-1 flex items-end gap-1">
            <label className="block flex-1 font-extrabold">
              {t("البند")}
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
                data-testid={`order-kind-${dept}`}
                className="mt-0.5 h-9 w-full rounded-md border-2 border-sc-ink bg-white px-1 text-sm"
              >
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {t(CATALOG[k].name)}
                  </option>
                ))}
              </select>
            </label>
            <div className="w-20">
              <NumberField label={t("العدد")} value={count} onChange={setCount} testid={`order-count-${dept}`} />
            </div>
          </div>
          <button
            type="button"
            data-testid={`order-add-${dept}`}
            disabled={!kind || count < 1}
            onClick={() => kind && onOrder(dept, kind, count)}
            className="sc-menu sc-on mt-1 w-full text-xs disabled:opacity-40"
          >
            {kind
              ? t("اطلب بناء {n} × {kind}", { n: Math.round(count), kind: t(CATALOG[kind].name) })
              : t("اطلب")}
          </button>
          {orders.length > 0 && (
            <ul className="mt-1 space-y-1">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-1 rounded bg-sc-mint px-1.5 py-1">
                  <span>
                    {t("{kind}: بُني {done} من {count}", {
                      kind: t(CATALOG[o.kind].name),
                      done: o.built,
                      count: o.count,
                    })}
                  </span>
                  <button type="button" className="sc-menu px-2 text-xs" onClick={() => onCancelOrder(o.id)}>
                    {t("إلغاء")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function kindName(kind: Kind) {
  return CATALOG[kind].name;
}
