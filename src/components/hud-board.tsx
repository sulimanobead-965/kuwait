import { useState } from "react";
import { Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import {
  boardFee,
  DEPARTMENTS,
  DEPT_IDS,
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
}: {
  snap: Sim;
  onBoard: (patch: Partial<BoardState>) => void;
  onPower: (dept: DeptId, on: boolean) => void;
  onApprove: (key: string) => void;
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
        <div className="mt-2 grid grid-cols-3 gap-1">
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
          <NumberField
            label={t("ميزانية البناء")}
            value={b.buildShare}
            onChange={(v) => onBoard({ buildShare: Math.min(100, v) })}
            suffix={percentSign()}
            testid="board-build"
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

function kindName(kind: Kind) {
  return CATALOG[kind].name;
}
