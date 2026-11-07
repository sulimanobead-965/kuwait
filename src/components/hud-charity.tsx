import { useState } from "react";
import { HeartHandshake } from "lucide-react";
import { CHARITY_CAUSES, CHARITY_KINDS, type CharityCause, type CharityKind } from "@/game/charity";
import { charityMood, zakatDue, type Sim } from "@/game/sim";
import { NumberField } from "@/components/hud-social";
import { bigNum, currency, dirOf, getLang, t } from "@/i18n";

const fmt = (n: number) => (Math.abs(n) >= 1e9 ? bigNum(n, getLang()) : Math.round(n).toLocaleString("en-US"));

/** Waqf, zakat and sadaqa to any cause, with no ceiling on the amount. */
export function CharityPanel({
  snap,
  onDonate,
}: {
  snap: Sim;
  onDonate: (kind: CharityKind, cause: CharityCause, amount: number) => void;
}) {
  const [kind, setKind] = useState<CharityKind>("sadaqa");
  const [cause, setCause] = useState<CharityCause>("aid");
  const [amount, setAmount] = useState(100_000);
  const c = snap.charity;
  const zakat = zakatDue(snap);
  const mood = charityMood(snap);
  return (
    <div className="space-y-3 text-sc-ink" dir={dirOf()} data-testid="charity">
      <div className="rounded-md bg-sc-mint p-2">
        <p className="flex items-center gap-1 text-sm font-extrabold">
          <HeartHandshake size={16} /> {t("التبرعات والأعمال الخيرية")}
        </p>
        <p className="mt-1 text-xs leading-relaxed">
          {t(
            "تبرّع من خزينة المدينة بأي مبلغ بلا حد أعلى. مشاريع البناء تبني مباني حقيقية في المدينة، والمساعدات ترفع رضا الناس.",
          )}
        </p>
      </div>
      <div>
        <p className="mb-1 text-xs font-extrabold">{t("نوع التبرع")}</p>
        <div className="grid grid-cols-3 gap-1">
          {CHARITY_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              data-testid={`charity-kind-${k.id}`}
              aria-pressed={kind === k.id}
              onClick={() => setKind(k.id)}
              className={`sc-menu h-9 text-sm ${kind === k.id ? "sc-on" : ""}`}
            >
              {t(k.name)}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] opacity-80">{t(CHARITY_KINDS.find((k) => k.id === kind)!.blurb)}</p>
      </div>
      <div>
        <p className="mb-1 text-xs font-extrabold">{t("المشروع")}</p>
        <div className="grid grid-cols-2 gap-1">
          {CHARITY_CAUSES.map((x) => (
            <button
              key={x.id}
              type="button"
              data-testid={`charity-cause-${x.id}`}
              aria-pressed={cause === x.id}
              onClick={() => setCause(x.id)}
              className={`rounded-md border-2 p-1.5 text-start text-xs ${cause === x.id ? "border-sc-ink bg-sc-gold/50" : "border-sc-ink/25 bg-sc-mint"}`}
            >
              <span className="block font-extrabold">{t(x.name)}</span>
              <span className="block opacity-75">{t(x.blurb)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-md bg-sc-mint p-2">
        <NumberField label={t("المبلغ (بلا حد أعلى)")} value={amount} onChange={setAmount} suffix={currency()} testid="charity-amount" />
        <div className="mt-1 flex flex-wrap gap-1">
          {kind === "zakat" && zakat > 0 && (
            <button type="button" className="sc-menu h-8 px-2 text-[11px]" onClick={() => setAmount(zakat)} data-testid="charity-zakat">
              {t("زكاة الأموال ٢٫٥٪: {amount}", { amount: fmt(zakat) })}
            </button>
          )}
          {[0.01, 0.1, 0.5].map((share) => (
            <button
              key={share}
              type="button"
              className="sc-menu h-8 px-2 text-[11px]"
              onClick={() => setAmount(Math.max(1, Math.floor(Math.max(0, snap.coins) * share)))}
            >
              {t("{pct}٪ من الخزينة", { pct: share * 100 })}
            </button>
          ))}
        </div>
        <button
          type="button"
          data-testid="charity-give"
          disabled={!(amount > 0) || snap.coins < amount}
          onClick={() => onDonate(kind, cause, amount)}
          className="sc-menu sc-on mt-2 h-10 w-full text-sm disabled:opacity-40"
        >
          {t("تبرّع بـ {amount} د.ك", { amount: fmt(amount) })}
        </button>
      </div>
      <div className="rounded-md bg-sc-mint p-2 text-xs">
        <p className="font-extrabold">{t("سجل العطاء")}</p>
        <p className="mt-1">
          {t("وقف {w} · زكاة {z} · صدقة {s} د.ك", { w: fmt(c.given.waqf), z: fmt(c.given.zakat), s: fmt(c.given.sadaqa) })}
        </p>
        <p>{t("مبانٍ بُنيت من التبرعات: {n} · أثرها على الرضا الآن: +{m}", { n: c.buildings, m: mood })}</p>
      </div>
    </div>
  );
}
