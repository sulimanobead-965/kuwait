import { useState } from "react";
import type { EstateAct, OwnerId } from "@/game/realestate";
import { ownerName } from "@/game/realestate";
import {
  evacuateRegions,
  expropriateRegions,
  ownerColor,
  regionCost,
  regionLeaders,
  regionStats,
  valueBuyRegions,
} from "@/game/regions";
import type { Sim } from "@/game/sim";
import { NumberField } from "@/components/hud-social";
import { appointMukhtar, BANNABLE, dismissMukhtar, mukhtarNote, mukhtarPay, regionServices, toggleBan } from "@/game/civic";
import { CATALOG } from "@/game/catalog";
import { bigNum, getLang, t } from "@/i18n";

const fmt = (n: number) => (Math.abs(n) >= 1e9 ? bigNum(n, getLang()) : Math.round(n).toLocaleString("en-US"));

/**
 * The 100 administrative regions: residents, buildings, property value, the strongest
 * merchant (the region's colour) and individuals' share; select one or many and
 * value-buy («تثمين»), expropriate or evacuate them.
 */
export function RegionsPanel({
  snap,
  onEstate,
  onShowMap,
}: {
  snap: Sim;
  onEstate: (deal: (s: Sim) => EstateAct) => void;
  onShowMap: () => void;
}) {
  const rows = regionStats(snap);
  const svc = regionServices(snap);
  const mukhtars = snap.estate?.mukhtars ?? {};
  const [sort, setSort] = useState<"residents" | "id" | "value">("residents");
  const [onlyLived, setOnlyLived] = useState(true);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [premium, setPremium] = useState(110);
  const [comp, setComp] = useState(100);
  const [confirm, setConfirm] = useState(false);
  let list = onlyLived ? rows.filter((r) => r.buildings > 0) : rows;
  list = [...list].sort((a, b) => (sort === "id" ? a.id - b.id : sort === "value" ? b.value - a.value : b.residents - a.residents));
  const ids = [...picked];
  const toggle = (id: number) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const total = rows.reduce((n, r) => n + r.residents, 0);
  const done = (deal: (s: Sim) => EstateAct) => {
    onEstate(deal);
    setPicked(new Set());
    setConfirm(false);
  };
  const buyCost = ids.length ? regionCost(snap, ids, premium) : 0;
  const expCost = ids.length ? regionCost(snap, ids, comp) : 0;
  return (
    <div className="space-y-2 text-xs" data-testid="regions">
      <div className="rounded-md bg-sc-mint p-2">
        <p className="text-sm font-extrabold">{t("المناطق الإدارية (١٠٠)")}</p>
        <p className="mt-0.5 leading-relaxed">
          {t("الأرض مقسّمة إلى ١٠٠ منطقة متساوية المساحة. لون كل منطقة على الخريطة لون التاجر صاحب النفوذ الأعلى فيها.")}
        </p>
        <p className="mt-1">
          {t("السكان {n} في {k} منطقة مأهولة", { n: fmt(total), k: rows.filter((r) => r.buildings > 0).length })}
        </p>
        <p className="mt-0.5">
          {regionLeaders(snap)
            .map((l) => t("{name} يتصدر {n}", { name: t(l.name), n: l.n }))
            .join(" · ")}
        </p>
        <button type="button" data-testid="regions-map" onClick={onShowMap} className="sc-menu mt-1 h-9 w-full text-xs">
          {t("اعرض المناطق على الخريطة")}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {(
          [
            ["residents", "الأكثر سكاناً"],
            ["value", "الأعلى قيمة"],
            ["id", "بالرقم"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={sort === k}
            onClick={() => setSort(k)}
            className={`rounded-full border px-2 py-0.5 text-[11px] ${sort === k ? "border-sc-ink bg-sc-gold/60 font-bold" : "border-sc-ink/30"}`}
          >
            {t(label)}
          </button>
        ))}
        <label className="ms-auto flex items-center gap-1">
          <input type="checkbox" checked={onlyLived} onChange={(e) => setOnlyLived(e.target.checked)} />
          {t("المأهولة فقط")}
        </label>
      </div>
      <div className="space-y-1 rounded border-2 border-sc-ink/20 bg-sc-mint p-1.5" data-testid="regions-bar">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold">{t("محدد {n} منطقة", { n: ids.length })}</span>
          <button
            type="button"
            className="underline"
            onClick={() => setPicked(ids.length === list.length ? new Set() : new Set(list.map((r) => r.id)))}
          >
            {ids.length === list.length && list.length ? t("إلغاء التحديد") : t("حدد الكل ({n})", { n: list.length })}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <NumberField label={t("التثمين (٪ من القيمة)")} value={premium} onChange={setPremium} />
          <NumberField label={t("تعويض نزع الملكية (٪ من القيمة)")} value={comp} onChange={setComp} />
        </div>
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            data-testid="regions-value"
            disabled={!ids.length}
            className="sc-menu sc-on h-auto min-h-9 py-1 text-[11px] leading-tight disabled:opacity-40"
            onClick={() => done((s) => valueBuyRegions(s, ids, premium))}
          >
            {t("ثمّن المحدد")}
            {ids.length ? <span className="block" dir="ltr">{fmt(buyCost)}</span> : null}
          </button>
          <button
            type="button"
            data-testid="regions-expropriate"
            disabled={!ids.length}
            className="sc-menu h-auto min-h-9 py-1 text-[11px] leading-tight disabled:opacity-40"
            onClick={() => done((s) => expropriateRegions(s, ids, comp))}
          >
            {t("انزع ملكية المحدد")}
            {ids.length ? <span className="block" dir="ltr">{fmt(expCost)}</span> : null}
          </button>
          <button
            type="button"
            data-testid="regions-evacuate"
            disabled={!ids.length}
            className={`sc-menu h-auto min-h-9 py-1 text-[11px] leading-tight disabled:opacity-40 ${confirm ? "bg-coral" : ""}`}
            onClick={() => (confirm ? done((s) => evacuateRegions(s, ids)) : setConfirm(true))}
          >
            {confirm ? t("تأكيد الإخلاء؟") : t("أخلِ المحدد")}
          </button>
        </div>
        <p className="opacity-75">
          {t("التثمين: الدولة تشتري كل العقار الخاص بسعر أعلى من السوق ويرضى الناس. نزع الملكية: بالتعويض اللي تحدده، وأقل من ١٠٠٪ يزعّل الناس. الإخلاء: يثمّن الباقي ويزيل المباني الخاصة وتبقى الطرق والخدمات.")}
        </p>
      </div>
      {ids.length === 1 && <RegionCard snap={snap} id={ids[0]!} onEstate={onEstate} />}
      {list.map((r) => (
        <label
          key={r.id}
          className={`flex items-start gap-2 rounded p-1.5 ${picked.has(r.id) ? "bg-sc-gold/40" : "bg-sc-mint"}`}
          data-testid="region-row"
        >
          <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="mt-1" />
          <span className="mt-1 inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: ownerColor(r.top as OwnerId | null) }} />
          <span className="min-w-0 flex-1">
            <span className="flex justify-between gap-2 font-bold">
              <span>
                {r.id} · {t(r.name.replace(/ \d+$/, ""))}
                {/ \d+$/.test(r.name) ? ` ${r.name.match(/\d+$/)![0]}` : ""}
              </span>
              <span dir="ltr">{fmt(r.residents)}</span>
            </span>
            <span className="block opacity-80">
              {r.buildings > 0
                ? t("{b} مبنى · قيمة {v} · {top} {share}٪ · الأفراد {p}٪ · الدولة {st}٪", {
                    b: r.buildings,
                    v: fmt(r.value),
                    top: r.top ? ownerName(r.top) : "—",
                    share: Math.round(r.topShare * 100),
                    p: Math.round(r.peopleShare * 100),
                    st: Math.round(r.stateShare * 100),
                  })
                : t("أرض فاضية")}
            </span>
            {r.buildings > 0 && (
              <span className="block opacity-80">
                {t("الخدمات {n}٪", { n: Math.round((svc[r.id - 1]?.services ?? 0) * 100) })}
                {mukhtars[String(r.id)] ? ` · ${t("المختار {name}", { name: mukhtars[String(r.id)]! })}` : ""}
              </span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}

/** One region picked: its mukhtar, their note, and what may not be built there. */
function RegionCard({ snap, id, onEstate }: { snap: Sim; id: number; onEstate: (deal: (s: Sim) => EstateAct) => void }) {
  const current = snap.estate?.mukhtars?.[String(id)] ?? "";
  const bans = snap.estate?.bans?.[String(id)] ?? [];
  const [name, setName] = useState("");
  return (
    <div className="space-y-1 rounded border-2 border-sc-ink/20 bg-white/80 p-1.5" data-testid="region-card">
      <p className="font-extrabold">{t("المنطقة {n}", { n: id })}</p>
      {current ? (
        <>
          <p>
            {t("المختار {name}", { name: current })}: «{mukhtarNote(snap, id)}»
          </p>
          <button type="button" className="underline" onClick={() => onEstate((s) => dismissMukhtar(s, id))}>
            {t("إعفاء المختار")}
          </button>
        </>
      ) : (
        <div className="flex gap-1">
          <input
            type="text"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("اسم المختار")}
            data-testid="mukhtar-name"
            className="h-9 min-w-0 flex-1 rounded border-2 border-sc-ink/30 bg-white px-2 text-sm"
          />
          <button
            type="button"
            data-testid="mukhtar-appoint"
            disabled={name.trim().length < 2}
            className="sc-menu sc-on h-9 px-2 text-[11px] disabled:opacity-40"
            onClick={() => onEstate((s) => appointMukhtar(s, id, name))}
          >
            {t("عيّن ({amount} د.ك شهرياً)", { amount: fmt(mukhtarPay(snap)) })}
          </button>
        </div>
      )}
      <p className="font-bold">{t("ممنوع البناء هنا")}</p>
      <div className="grid grid-cols-4 gap-1">
        {BANNABLE.map((k) => (
          <button
            key={k}
            type="button"
            data-testid={`ban-${k}`}
            aria-pressed={bans.includes(k)}
            onClick={() => onEstate((s) => toggleBan(s, id, k))}
            className={`sc-menu h-auto min-h-9 py-1 text-[11px] leading-tight ${bans.includes(k) ? "bg-coral" : ""}`}
          >
            {bans.includes(k) ? "⛔ " : ""}
            {t(CATALOG[k].name)}
          </button>
        ))}
      </div>
    </div>
  );
}
