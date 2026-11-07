import { useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { portfolio, stakeValue, STOCK_IDS, STOCKS, stockDown, type StockId } from "@/game/stocks";
import type { Sim } from "@/game/sim";
import { NumberField } from "@/components/hud-social";
import { currency, dirOf, percentSign, t, bigNum, getLang } from "@/i18n";

const fmt = (n: number) => bigNum(n, getLang());
const pct = (n: number) => `${Math.round(n * 1000) / 10}`;

/** A tiny price line for the last two years of a share. */
function Spark({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return <span className="inline-block h-6 w-20" />;
  const lo = Math.min(...values),
    hi = Math.max(...values);
  const span = hi - lo || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 80},${22 - ((v - lo) / span) * 20}`)
    .join(" ");
  return (
    <svg width="80" height="24" viewBox="0 0 80 24" aria-hidden="true" className="shrink-0">
      <polyline points={points} fill="none" stroke={up ? "#2f8f4e" : "#c4473a"} strokeWidth="2" />
    </svg>
  );
}

/**
 * The stock market: every company in the game, its price and trend, dividend yield,
 * and the governor's stake, bought and sold by percentage of the company.
 */
export function StockMarket({
  snap,
  onBuy,
  onSell,
}: {
  snap: Sim;
  onBuy: (id: StockId, pct: number) => void;
  onSell: (id: StockId, pct: number) => void;
}) {
  const [stake, setStake] = useState<Record<string, number>>({});
  const book = portfolio(snap);
  return (
    <div className="space-y-3" dir={dirOf()} data-testid="stocks">
      <div className="rounded-md bg-sc-mint p-2 text-sc-ink">
        <p className="text-xs leading-relaxed">
          {t(
            "أسهم الشركات العاملة في المدينة. اشترِ حصة بنسبة من الشركة (مثلاً ٥٪) وبعها متى شئت. الأسعار تتحرك كل شهر مع الاقتصاد والأزمات، وإفلاس الشركة يهوي بسهمها، والأرباح توزَّع نهاية كل سنة.",
          )}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1 text-center text-xs font-extrabold">
          <div className="sc-lcd h-auto flex-col py-1.5">
            <span>{t("قيمة محفظتك")}</span>
            <span dir="ltr">{fmt(book.value)}</span>
          </div>
          <div className="sc-lcd h-auto flex-col py-1.5">
            <span>{t("الربح أو الخسارة")}</span>
            <span dir="ltr" className={book.gain < 0 ? "text-coral" : ""}>
              {fmt(book.gain)}
            </span>
          </div>
          <div className="sc-lcd h-auto flex-col py-1.5">
            <span>{t("أرباح موزعة")}</span>
            <span dir="ltr">{fmt(snap.stocks.dividends)}</span>
          </div>
        </div>
      </div>
      <ul className="space-y-2">
        {STOCK_IDS.map((id) => {
          const def = STOCKS[id];
          const hist = snap.stocks.history[id];
          const price = snap.stocks.price[id];
          const prev = hist.length > 1 ? hist[hist.length - 2]! : price;
          const change = prev > 0 ? price / prev - 1 : 0;
          const own = snap.stocks.own[id];
          const value = stakeValue(snap, id, own);
          const paid = snap.stocks.paid[id];
          const down = stockDown(snap, id);
          const want = stake[id] ?? 5;
          const cost = stakeValue(snap, id, want / 100);
          return (
            <li key={id} className="rounded-md bg-sc-mint p-2 text-sc-ink" data-testid={`stock-${id}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold">{t(def.name)}</p>
                  <p className="text-xs opacity-80">
                    {t(def.sector)} · {t("أرباح سنوية {n}٪", { n: pct(def.yield) })}
                  </p>
                </div>
                <Spark values={hist} up={change >= 0} />
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
                <span>
                  {t("سعر ١٪ من الشركة: {amount} {cur}", {
                    amount: fmt(stakeValue(snap, id, 0.01)),
                    cur: currency(),
                  })}
                </span>
                <span className={`flex items-center gap-0.5 font-extrabold ${change < 0 ? "text-coral" : "text-sc-green"}`} dir="ltr">
                  {change < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                  {change >= 0 ? "+" : ""}
                  {pct(change)}
                  {percentSign()}
                </span>
                {down && <span className="font-extrabold text-coral">{t("مفلسة: التداول موقوف")}</span>}
              </p>
              {own > 0 && (
                <p className="mt-1 text-xs font-bold">
                  {t("حصتك {pct}٪ · قيمتها {value} {cur} · {gain}", {
                    pct: pct(own),
                    value: fmt(value),
                    cur: currency(),
                    gain:
                      value >= paid
                        ? t("ربح {n}", { n: fmt(value - paid) })
                        : t("خسارة {n}", { n: fmt(paid - value) }),
                  })}
                </p>
              )}
              <div className="mt-1 flex items-end gap-1">
                <div className="w-24">
                  <NumberField
                    label={t("النسبة")}
                    value={want}
                    onChange={(v) => setStake((m) => ({ ...m, [id]: v }))}
                    suffix={percentSign()}
                    testid={`stake-${id}`}
                  />
                </div>
                <button
                  type="button"
                  data-testid={`buy-${id}`}
                  disabled={down || snap.coins < cost || !(want > 0)}
                  onClick={() => onBuy(id, want)}
                  className="sc-menu sc-on h-9 flex-1 text-xs disabled:opacity-40"
                >
                  {t("شراء ({amount})", { amount: fmt(cost) })}
                </button>
                <button
                  type="button"
                  data-testid={`sell-${id}`}
                  disabled={down || own <= 0}
                  onClick={() => onSell(id, Math.min(want, own * 100))}
                  className="sc-menu h-9 flex-1 text-xs disabled:opacity-40"
                >
                  {t("بيع")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
