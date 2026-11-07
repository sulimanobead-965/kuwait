import { auditCost, holdingsOf, npcDef, npcWorth, type NpcId } from "@/game/npcs";
import { formatCityDate, type Sim } from "@/game/sim";
import { bigNum, dirOf, getLang, t } from "@/i18n";

const fmt = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1e9 ? bigNum(a, getLang()) : Math.round(a).toLocaleString("en-US");
  return n < 0 ? `-${s}` : s;
};

function Row({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  return (
    <div className="flex justify-between gap-2 border-t border-sc-ink/10 py-0.5">
      <span>{label}</span>
      <span className={`font-bold ${bad || value < 0 ? "text-coral" : ""}`} dir="ltr">
        {fmt(value)}
      </span>
    </div>
  );
}

/**
 * A virtual player's financial statement: wealth, companies and stakes, tenders won,
 * the year's profit and loss, their account statement and obligations — with an
 * audit, and holding them to account for what it proves.
 */
export function NpcFinance({
  snap,
  id,
  onAudit,
  onAccount,
}: {
  snap: Sim;
  id: NpcId;
  onAudit: (id: NpcId) => void;
  onAccount: (id: NpcId) => void;
}) {
  const n = snap.npcs.find((x) => x.id === id)!;
  const d = npcDef(id);
  const w = npcWorth(n);
  const net = n.year.income - n.year.expense;
  const lastNet = n.lastYear.income - n.lastYear.expense;
  const banned = n.bannedUntil > snap.day;
  return (
    <div className="space-y-2 text-xs text-sc-ink" dir={dirOf()} data-testid="npc-finance">
      <section className="rounded-md bg-sc-mint p-2">
        <p className="mb-1 text-sm font-extrabold">{t("الثروة")}</p>
        <Row label={t("النقد")} value={w.cash} />
        <Row label={t("الشركات والحصص")} value={w.companies} />
        <Row label={t("ديون للبنك")} value={-w.bankDebt} />
        {w.owesMe > 0 && <Row label={t("دين عليه للمحافظ")} value={-w.owesMe} />}
        {w.iOwe > 0 && <Row label={t("دين له على المحافظ")} value={w.iOwe} />}
        <div className="mt-1 flex justify-between border-t-2 border-sc-ink pt-1 text-sm font-extrabold">
          <span>{t("صافي الثروة")}</span>
          <span dir="ltr" className={w.net < 0 ? "text-coral" : ""}>
            {fmt(w.net)} {t("د.ك")}
          </span>
        </div>
      </section>

      <section className="rounded-md bg-sc-mint p-2">
        <p className="mb-1 text-sm font-extrabold">{t("الشركات والحصص")}</p>
        {holdingsOf(n).map((h) => (
          <div key={h.name} className="flex justify-between gap-2 border-t border-sc-ink/10 py-0.5">
            <span>
              {t(h.name)} · {t("{pct}٪", { pct: h.pct })}
            </span>
            <span className="font-bold" dir="ltr">
              {fmt(h.value)}
            </span>
          </div>
        ))}
      </section>

      <section className="rounded-md bg-sc-mint p-2">
        <p className="mb-1 text-sm font-extrabold">{t("الأرباح والخسائر")}</p>
        <Row label={t("دخل هذه السنة")} value={n.year.income} />
        <Row label={t("مصروف هذه السنة")} value={-n.year.expense} />
        <Row label={t("صافي هذه السنة")} value={net} />
        <Row label={t("صافي السنة الماضية")} value={lastNet} />
      </section>

      <section className="rounded-md bg-sc-mint p-2">
        <p className="mb-1 text-sm font-extrabold">
          {t("المناقصات من المدينة ({n})", { n: n.tenders.length })}
          {banned && <span className="ms-1 text-coral">{t("· موقوف حتى {date}", { date: formatCityDate(n.bannedUntil) })}</span>}
        </p>
        {n.tenders.length === 0 ? (
          <p className="opacity-70">{t("ما أخذ مناقصات بعد.")}</p>
        ) : (
          [...n.tenders].reverse().slice(0, 8).map((x, i) => (
            <div key={i} className="flex justify-between gap-2 border-t border-sc-ink/10 py-0.5">
              <span>
                {t(x.title)} · {formatCityDate(x.day)}
              </span>
              <span className="font-bold" dir="ltr">
                {fmt(x.amount)}
              </span>
            </div>
          ))
        )}
      </section>

      <section className="rounded-md bg-sc-mint p-2">
        <p className="mb-1 text-sm font-extrabold">{t("كشف الحساب")}</p>
        {n.statement.length === 0 ? (
          <p className="opacity-70">{t("ما في حركات بعد.")}</p>
        ) : (
          [...n.statement].reverse().slice(0, 12).map((x, i) => (
            <div key={i} className="flex justify-between gap-2 border-t border-sc-ink/10 py-0.5">
              <span>
                {formatCityDate(x.day)} · {x.text}
              </span>
              <span className={`font-bold ${x.amount < 0 ? "text-coral" : "text-sc-leaf"}`} dir="ltr">
                {x.amount > 0 ? "+" : ""}
                {fmt(x.amount)}
              </span>
            </div>
          ))
        )}
      </section>

      <section className="rounded-md border-2 border-sc-ink/40 bg-sc-gold/20 p-2">
        <p className="mb-1 text-sm font-extrabold">{t("التدقيق والمحاسبة")}</p>
        <p className="leading-relaxed">
          {t(
            "التدقيق يراجع مناقصاته مع المدينة ويكشف أي مبالغ مضخّمة. إذا ثبتت مخالفات تقدر تحاسبه: يرجّع المبلغ مع غرامة ٢٠٪ ويُوقف عن المناقصات ٥ سنوات. التدقيق على شخص نزيه يزعّله وينزّل ثقته.",
          )}
        </p>
        {n.audits.length > 0 && (
          <div className="mt-1">
            {[...n.audits].reverse().slice(0, 4).map((a, i) => (
              <p key={i}>
                {formatCityDate(a.day)} ·{" "}
                {a.found > 0
                  ? t("مخالفات {found} · مسترد {back}", { found: fmt(a.found), back: fmt(a.recovered) })
                  : t("حساباته نظيفة")}
              </p>
            ))}
          </div>
        )}
        <div className="mt-1 grid grid-cols-2 gap-1">
          <button
            type="button"
            data-testid="npc-audit"
            onClick={() => onAudit(id)}
            className="sc-menu h-9 text-xs"
          >
            {t("دقّق عليه ({amount})", { amount: fmt(auditCost(snap, id)) })}
          </button>
          <button
            type="button"
            data-testid="npc-account"
            disabled={n.flagged <= 0}
            onClick={() => onAccount(id)}
            className="sc-menu sc-on h-9 text-xs disabled:opacity-40"
          >
            {n.flagged > 0 ? t("حاسبه ({amount})", { amount: fmt(n.flagged * 1.2) }) : t("حاسبه")}
          </button>
        </div>
        <p className="mt-1 opacity-70">{t("نزاهة {name} تنكشف بالتدقيق فقط.", { name: t(d.name) })}</p>
      </section>
    </div>
  );
}
