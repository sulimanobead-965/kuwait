import { useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import {
  addCompany,
  answerIpo,
  delistCompany,
  portfolio,
  stakeValue,
  STOCK_SECTORS,
  stockDef,
  stockDown,
  stockIds,
  type StockId,
} from "@/game/stocks";
import { ownerName } from "@/game/realestate";
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
  onAct,
}: {
  snap: Sim;
  onBuy: (id: StockId, pct: number) => void;
  onSell: (id: StockId, pct: number) => void;
  /** Listing requests, adding and delisting companies. */
  onAct?: (deal: (s: Sim) => { ok: boolean; msg?: string }) => void;
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
      {onAct && <Listings snap={snap} onAct={onAct} />}
      <ul className="space-y-2">
        {stockIds(snap).map((id) => {
          const def = stockDef(snap, id);
          const listed = snap.stocks.listed?.[id];
          const hist = snap.stocks.history[id] ?? [1];
          const price = snap.stocks.price[id] ?? 1;
          const prev = hist.length > 1 ? hist[hist.length - 2]! : price;
          const change = prev > 0 ? price / prev - 1 : 0;
          const own = snap.stocks.own[id] ?? 0;
          const value = stakeValue(snap, id, own);
          const paid = snap.stocks.paid[id] ?? 0;
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
                  {listed && (
                    <p className="text-[11px] opacity-80">
                      {t("رأس المال {capital} · أُدرجت {by}", {
                        capital: fmt(listed.capital),
                        by: listed.founder === "manual" ? t("يدوياً") : t(ownerName(listed.founder)),
                      })}
                    </p>
                  )}
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
              {listed && onAct && (
                <button type="button" className="mt-1 text-[11px] underline" onClick={() => onAct((s) => delistCompany(s, id))}>
                  {t("شطب الشركة من السوق")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Merchants' requests to list a company, and adding one by hand. */
function Listings({ snap, onAct }: { snap: Sim; onAct: (deal: (s: Sim) => { ok: boolean; msg?: string }) => void }) {
  const ipos = (snap.stocks.ipos ?? []).filter((x) => x.until > snap.day);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sector, setSector] = useState(STOCK_SECTORS[0]!);
  const [capital, setCapital] = useState(1_000_000);
  const [cap, setCap] = useState(2_000_000);
  return (
    <div className="space-y-2" data-testid="listings">
      {ipos.length > 0 && (
        <div className="rounded-md border-2 border-sc-gold bg-sc-mint p-2 text-xs text-sc-ink" data-testid="ipos">
          <p className="text-sm font-extrabold">{t("طلبات إدراج شركات ({n})", { n: ipos.length })}</p>
          {ipos.map((r) => (
            <div key={r.id} className="mt-1 rounded bg-white/70 p-1.5" data-testid="ipo">
              <p className="font-bold">{r.name}</p>
              <p>
                {t("{sector} · رأس المال {capital} · القيمة {cap} د.ك · من {owner}", {
                  sector: t(r.sector),
                  capital: fmt(r.capital),
                  cap: fmt(r.cap),
                  owner: t(ownerName(r.founder)),
                })}
              </p>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <button type="button" data-testid="ipo-yes" className="sc-menu sc-on text-[11px]" onClick={() => onAct((s) => answerIpo(s, r.id, true))}>
                  {t("وافق على الإدراج")}
                </button>
                <button type="button" className="sc-menu text-[11px]" onClick={() => onAct((s) => answerIpo(s, r.id, false))}>
                  {t("ارفض")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="rounded-md bg-sc-mint p-2 text-xs text-sc-ink">
        <button type="button" data-testid="company-add-open" className="sc-menu w-full text-xs" onClick={() => setOpen(!open)}>
          {open ? t("إخفاء") : t("أضف شركة جديدة للسوق")}
        </button>
        {open && (
          <div className="mt-2 space-y-1">
            <label className="block font-bold">
              {t("اسم الشركة")}
              <input
                type="text"
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                data-testid="company-name"
                className="mt-0.5 h-10 w-full rounded border-2 border-sc-ink/30 bg-white px-2 text-sm"
              />
            </label>
            <label className="block font-bold">
              {t("القطاع")}
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="mt-0.5 h-10 w-full rounded border-2 border-sc-ink/30 bg-white px-1 text-sm"
              >
                {STOCK_SECTORS.map((x) => (
                  <option key={x} value={x}>
                    {t(x)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-1">
              <NumberField label={t("رأس المال")} value={capital} onChange={setCapital} testid="company-capital" />
              <NumberField label={t("القيمة السوقية")} value={cap} onChange={setCap} testid="company-cap" />
            </div>
            <button
              type="button"
              data-testid="company-add"
              className="sc-menu sc-on w-full text-xs"
              onClick={() => {
                onAct((s) => addCompany(s, name, sector, capital, cap));
                setName("");
              }}
            >
              {t("أدرج الشركة")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
