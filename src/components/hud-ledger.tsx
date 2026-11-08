import { ledgerSummary } from "@/game/ledger";
import type { Sim } from "@/game/sim";
import { bigNum, dirOf, getLang, t } from "@/i18n";

const money = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1e9 ? bigNum(a, getLang()) : Math.round(a).toLocaleString("en-US");
  return n < 0 ? `-${s}` : s;
};
const pct = (p: number | null) => (p === null ? "—" : `${p >= 0 ? "+" : ""}${Math.round(p * 1000) / 10}%`);

/**
 * The ten-year investment report: each kind of investment with the money put in, its
 * profit or loss and the return, the yearly totals, and the grand total at the bottom.
 */
export function LedgerReport({ snap }: { snap: Sim }) {
  const r = ledgerSummary(snap);
  return (
    <div className="space-y-3 text-sc-ink" dir={dirOf()} data-testid="ledger">
      <p className="rounded-md bg-sc-mint p-2 text-xs leading-relaxed">
        {r.years > 0
          ? t("أرباح وخسائر استثماراتك في آخر {n} سنوات، مع السنة الحالية حتى الآن.", { n: r.years })
          : t("بدأ تسجيل الاستثمارات من هذه السنة. كل سنة تخلص تنضاف هنا، وتبقى آخر ١٠ سنوات.")}
      </p>
      {r.lines.length === 0 ? (
        <p className="text-sm font-bold">{t("ما في استثمارات مسجّلة بعد.")}</p>
      ) : (
        <div className="overflow-hidden rounded-md border-2 border-sc-ink bg-sc-mint">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-sc-ink text-sc-mint">
                <th className="p-1.5 text-start">{t("الاستثمار")}</th>
                <th className="p-1.5 text-end">{t("المبلغ المستثمر")}</th>
                <th className="p-1.5 text-end">{t("الربح / الخسارة")}</th>
                <th className="p-1.5 text-end">{t("النسبة")}</th>
              </tr>
            </thead>
            <tbody>
              {r.lines.map((x) => (
                <tr key={x.key} className="border-t border-sc-ink/20" data-testid={`ledger-${x.key}`}>
                  <td className="p-1.5 font-bold">{t(x.label)}</td>
                  <td className="p-1.5 text-end" dir="ltr">
                    {x.base > 0 ? money(x.base) : "—"}
                  </td>
                  <td className={`p-1.5 text-end font-extrabold ${x.gain < 0 ? "text-coral" : "text-sc-leaf"}`} dir="ltr">
                    {x.gain >= 0 ? "+" : ""}
                    {money(x.gain)}
                  </td>
                  <td className={`p-1.5 text-end ${x.gain < 0 ? "text-coral" : ""}`} dir="ltr">
                    {pct(x.pct)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-sc-ink bg-sc-gold/40" data-testid="ledger-total">
                <td className="p-1.5 font-extrabold">{t("المجموع")}</td>
                <td className="p-1.5 text-end font-extrabold" dir="ltr">
                  {r.capital > 0 ? money(r.capital) : "—"}
                </td>
                <td className={`p-1.5 text-end font-extrabold ${r.total < 0 ? "text-coral" : "text-sc-leaf"}`} dir="ltr">
                  {r.total >= 0 ? "+" : ""}
                  {money(r.total)}
                </td>
                <td className="p-1.5 text-end font-extrabold" dir="ltr">
                  {pct(r.capital > 0 ? r.total / r.capital : null)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {r.byYear.length > 0 && (
        <div className="rounded-md bg-sc-mint p-2">
          <p className="mb-1 text-sm font-extrabold">{t("صافي كل سنة")}</p>
          <ul className="space-y-0.5 text-xs">
            {[...r.byYear].reverse().map((y) => (
              <li key={y.year} className="flex justify-between">
                <span>{y.year}</span>
                <span className={`font-bold ${y.gain < 0 ? "text-coral" : ""}`} dir="ltr">
                  {y.gain >= 0 ? "+" : ""}
                  {money(y.gain)} {t("د.ك")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[11px] opacity-75">
        {t(
          "المبلغ المستثمر هو أكبر مبلغ كان في الاستثمار خلال الفترة، والنسبة = الربح أو الخسارة ÷ هذا المبلغ. مشاريع المجلس: العوائد ناقص التكاليف والمصاريف.",
        )}
      </p>
    </div>
  );
}
