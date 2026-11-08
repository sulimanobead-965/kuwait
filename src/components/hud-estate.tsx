import { useState } from "react";
import { Building2, FileSignature, Gift, Landmark, MapPinned, Repeat } from "lucide-react";
import { CATALOG } from "@/game/catalog";
import { NPCS, type NpcId } from "@/game/npcs";
import {
  ALLOCATION_USES,
  OWNER_COLORS,
  allocate,
  allocationFee,
  buyProperty,
  endAllocation,
  estateOf,
  grantPlots,
  grantProperty,
  landSplit,
  leaseProperty,
  ownerName,
  ownersSummary,
  propertiesOf,
  sellProperty,
  type AllocationUse,
  type EstateAct,
  type OwnerId,
  type Trade,
} from "@/game/realestate";
import { formatCityDate, type Sim } from "@/game/sim";
import { NumberField } from "@/components/hud-social";
import { bigNum, dirOf, getLang, t } from "@/i18n";

const fmt = (n: number) => (Math.abs(n) >= 1e9 ? bigNum(n, getLang()) : Math.round(n).toLocaleString("en-US"));

type View = "trades" | "platform" | "allocate" | "grants";

const TYPE_NAMES: Record<Trade["type"], string> = {
  sale: "بيع",
  grant: "منحة",
  lease: "تأجير",
  allocation: "تخصيص",
  return: "رجوع للدولة",
};

/** The colours of the ownership map, as a legend. */
export function OwnershipLegend() {
  const rows: [string, string][] = [
    [OWNER_COLORS.public!, "أرض عامة (لا تُتداول)"],
    [OWNER_COLORS.state!, "أملاك الدولة الخاصة"],
    [OWNER_COLORS.people!, "ملك الأفراد"],
    [OWNER_COLORS.merchant!, "ملك التجار"],
    [OWNER_COLORS.allocation!, "تخصيص مؤقت"],
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]" data-testid="ownership-legend">
      {rows.map(([c, label]) => (
        <span key={label} className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: c }} />
          {t(label)}
        </span>
      ))}
    </div>
  );
}

/**
 * Real estate: the trades list, the owners' platform (holdings, shares, values and
 * every kind of deal), temporary allocation contracts and land grants.
 */
export function EstatePanel({
  snap,
  ownership,
  onOwnership,
  onEstate,
}: {
  snap: Sim;
  ownership: boolean;
  onOwnership: (on: boolean) => void;
  onEstate: (deal: (s: Sim) => EstateAct) => void;
}) {
  const [view, setView] = useState<View>("platform");
  const e = estateOf(snap);
  const split = landSplit(snap);
  return (
    <div className="space-y-3 text-sc-ink" dir={dirOf()} data-testid="estate">
      <div className="rounded-md bg-sc-mint p-2 text-xs">
        <p className="flex items-center gap-1 text-sm font-extrabold">
          <MapPinned size={16} /> {t("الأراضي والعقار")}
        </p>
        <p className="mt-1 leading-relaxed">
          {t(
            "الأراضي العامة (الطرق والخدمات والمعالم الحكومية) ما تُباع ولا تُتداول. العقار الخاص (البيوت والمحلات والأبراج والمصانع) يُشترى ويُباع ويُؤجَّر ويُمنح.",
          )}
        </p>
        <p className="mt-1">
          {t("عامة {pub} · خاصة {priv} · مؤشر أسعار العقار {index}", {
            pub: split.pub,
            priv: split.priv,
            index: Math.round(e.index * 100),
          })}
        </p>
        <button
          type="button"
          data-testid="ownership-toggle"
          aria-pressed={ownership}
          onClick={() => onOwnership(!ownership)}
          className={`sc-menu mt-2 h-9 w-full text-xs ${ownership ? "sc-on" : ""}`}
        >
          {ownership ? t("إخفاء الملكية من الخريطة") : t("عرض الملكية على الخريطة")}
        </button>
        <div className="mt-2">
          <OwnershipLegend />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {(
          [
            ["platform", "المنصة", <Building2 key="p" size={14} />],
            ["trades", "التداولات", <Repeat key="t" size={14} />],
            ["allocate", "التخصيص", <FileSignature key="a" size={14} />],
            ["grants", "المنح", <Gift key="g" size={14} />],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            data-testid={`estate-tab-${id}`}
            aria-pressed={view === id}
            onClick={() => setView(id)}
            className={`sc-menu flex h-9 items-center justify-center gap-1 text-[11px] ${view === id ? "sc-on" : ""}`}
          >
            {icon}
            {t(label)}
          </button>
        ))}
      </div>
      {view === "platform" && <Platform snap={snap} onEstate={onEstate} />}
      {view === "trades" && <Trades snap={snap} />}
      {view === "allocate" && <Allocations snap={snap} onEstate={onEstate} />}
      {view === "grants" && <Grants onEstate={onEstate} />}
    </div>
  );
}

function Trades({ snap }: { snap: Sim }) {
  const list = [...estateOf(snap).trades].reverse().slice(0, 40);
  return (
    <div className="rounded-md bg-sc-mint p-2 text-xs" data-testid="estate-trades">
      <p className="mb-1 text-sm font-extrabold">{t("التداولات العقارية")}</p>
      {list.length === 0 ? (
        <p className="opacity-70">{t("ما في تداولات بعد. السوق يتحرك كل شهر.")}</p>
      ) : (
        list.map((x, i) => (
          <div key={i} className="border-t border-sc-ink/10 py-1">
            <div className="flex justify-between gap-2">
              <span className="font-bold">
                {t(TYPE_NAMES[x.type])} · {t(CATALOG[x.kind].name)}
              </span>
              <span dir="ltr" className="font-extrabold">
                {x.price > 0 ? fmt(x.price) : "—"}
              </span>
            </div>
            <div className="opacity-80">
              {formatCityDate(x.day)} · {t(ownerName(x.from))} ← {t(ownerName(x.to))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const BUYERS: OwnerId[] = ["people", ...NPCS.map((n) => n.id)];

function Platform({ snap, onEstate }: { snap: Sim; onEstate: (deal: (s: Sim) => EstateAct) => void }) {
  const rows = ownersSummary(snap);
  const [open, setOpen] = useState<OwnerId | null>(null);
  const [to, setTo] = useState<OwnerId>("people");
  const [months, setMonths] = useState(12);
  return (
    <div className="space-y-2" data-testid="estate-platform">
      <p className="text-xs leading-relaxed">
        {t("منصة الملاك: كل مالك وعدد عقاراته وقيمتها ونسبته من العقار الخاص. اضغط على أي مالك لترى أملاكه وتتداول معه.")}
      </p>
      {rows.map((r) => (
        <div key={r.owner} className="rounded-md bg-sc-mint p-2 text-xs">
          <button
            type="button"
            data-testid={`owner-${r.owner}`}
            onClick={() => setOpen(open === r.owner ? null : r.owner)}
            className="flex w-full items-center justify-between gap-2 text-start"
          >
            <span className="font-extrabold">
              {r.owner === "state" ? <Landmark size={13} className="me-1 inline" /> : null}
              {t(ownerName(r.owner))}
            </span>
            <span className="font-extrabold" dir="ltr">
              {(r.share * 100).toFixed(1)}%
            </span>
          </button>
          <div className="mt-0.5 flex justify-between opacity-80">
            <span>{t("{n} عقار · إيجار شهري تقريبي {rent}", { n: r.count, rent: fmt(r.rent) })}</span>
            <span dir="ltr">{fmt(r.value)}</span>
          </div>
          {open === r.owner && (
            <div className="mt-2 space-y-1 border-t border-sc-ink/20 pt-2">
              {r.owner === "state" && (
                <div className="grid grid-cols-2 gap-1">
                  <label className="col-span-2 text-[11px] font-bold">
                    {t("المشتري أو الممنوح أو المستأجر")}
                    <select
                      value={to}
                      onChange={(ev) => setTo(ev.target.value as OwnerId)}
                      className="mt-0.5 h-9 w-full rounded border-2 border-sc-ink/30 bg-white px-1 text-sm"
                      data-testid="estate-to"
                    >
                      {BUYERS.map((b) => (
                        <option key={b} value={b}>
                          {t(ownerName(b))}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="col-span-2">
                    <NumberField label={t("مدة الإيجار (أشهر)")} value={months} onChange={setMonths} />
                  </div>
                </div>
              )}
              {propertiesOf(snap, r.owner, 25).map(({ b, value, leased }) => (
                <div key={b.id} className="rounded bg-white/60 p-1.5">
                  <div className="flex justify-between gap-2">
                    <span className="font-bold">
                      {t(CATALOG[b.kind].name)} · {t("مستوى {level}", { level: b.level })}
                      {leased ? ` · ${t("مؤجَّر")}` : ""}
                    </span>
                    <span dir="ltr">{fmt(value)}</span>
                  </div>
                  {r.owner === "state" ? (
                    <div className="mt-1 grid grid-cols-3 gap-1">
                      <button type="button" className="sc-menu h-8 text-[11px]" onClick={() => onEstate((s) => sellProperty(s, b.id, to))}>
                        {t("بيع")}
                      </button>
                      <button type="button" className="sc-menu h-8 text-[11px]" onClick={() => onEstate((s) => grantProperty(s, b.id, to))}>
                        {t("منح")}
                      </button>
                      <button
                        type="button"
                        disabled={leased}
                        className="sc-menu h-8 text-[11px] disabled:opacity-40"
                        onClick={() => onEstate((s) => leaseProperty(s, b.id, to, months))}
                      >
                        {t("تأجير")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      data-testid="estate-buy"
                      className="sc-menu sc-on mt-1 h-8 w-full text-[11px]"
                      onClick={() => onEstate((s) => buyProperty(s, b.id))}
                    >
                      {t("اشترِ للدولة بـ {amount}", { amount: fmt(value * 1.05) })}
                    </button>
                  )}
                </div>
              ))}
              {r.count > 25 && <p className="opacity-70">{t("تظهر أغلى ٢٥ عقاراً.")}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Allocations({ snap, onEstate }: { snap: Sim; onEstate: (deal: (s: Sim) => EstateAct) => void }) {
  const [holder, setHolder] = useState<NpcId>(NPCS[0]!.id);
  const [use, setUse] = useState<AllocationUse>("commercial");
  const [years, setYears] = useState(10);
  const fair = allocationFee(snap, use);
  const [fee, setFee] = useState<number | null>(null);
  const list = estateOf(snap).allocations;
  return (
    <div className="space-y-2" data-testid="estate-allocate">
      <div className="rounded-md bg-sc-mint p-2 text-xs">
        <p className="text-sm font-extrabold">{t("عقد تخصيص مؤقت من الدولة")}</p>
        <p className="mt-1 leading-relaxed">
          {t("تخصص أرض دولة لتاجر يقيم عليها مشروعه ويدفع رسوماً سنوية. لما تنتهي المدة ترجع الأرض وكل ما بُني عليها لأملاك الدولة.")}
        </p>
        <label className="mt-2 block text-[11px] font-bold">
          {t("التاجر")}
          <select
            value={holder}
            onChange={(ev) => setHolder(ev.target.value as NpcId)}
            className="mt-0.5 h-9 w-full rounded border-2 border-sc-ink/30 bg-white px-1 text-sm"
          >
            {NPCS.map((n) => (
              <option key={n.id} value={n.id}>
                {t(n.name)}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {ALLOCATION_USES.map((u) => (
            <button
              key={u.id}
              type="button"
              aria-pressed={use === u.id}
              onClick={() => {
                setUse(u.id);
                setFee(null);
              }}
              className={`rounded-md border-2 p-1 text-start text-[11px] ${use === u.id ? "border-sc-ink bg-sc-gold/50" : "border-sc-ink/25 bg-white/60"}`}
            >
              <span className="block font-extrabold">{t(u.name)}</span>
              <span className="block opacity-75">{t(u.blurb)}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1">
          <NumberField label={t("المدة (سنوات)")} value={years} onChange={setYears} />
          <NumberField label={t("الرسوم السنوية")} value={fee ?? fair} onChange={setFee} />
        </div>
        <p className="mt-1 opacity-75">{t("الرسوم العادلة تقريباً {amount} سنوياً. التاجر يرفض أكثر من مرة ونص منها.", { amount: fmt(fair) })}</p>
        <button
          type="button"
          data-testid="estate-allocate-go"
          onClick={() => onEstate((s) => allocate(s, holder, use, years, fee ?? fair))}
          className="sc-menu sc-on mt-2 h-10 w-full text-sm"
        >
          {t("وقّع العقد")}
        </button>
      </div>
      <div className="rounded-md bg-sc-mint p-2 text-xs">
        <p className="font-extrabold">{t("العقود السارية ({n})", { n: list.length })}</p>
        {list.length === 0 ? (
          <p className="opacity-70">{t("ما في عقود تخصيص الآن.")}</p>
        ) : (
          list.map((a) => (
            <div key={a.id} className="mt-1 flex items-center justify-between gap-2 border-t border-sc-ink/10 pt-1">
              <span>
                {t(ownerName(a.holder))} · {t(ALLOCATION_USES.find((u) => u.id === a.use)!.name)} · {fmt(a.fee)}/{t("سنة")} ·{" "}
                {t("حتى {date}", { date: formatCityDate(a.until) })}
              </span>
              <button type="button" className="sc-menu h-8 shrink-0 px-2 text-[11px]" onClick={() => onEstate((s) => endAllocation(s, a.id))}>
                {t("أنهِ العقد")}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Grants({ onEstate }: { onEstate: (deal: (s: Sim) => EstateAct) => void }) {
  const [n, setN] = useState(5);
  return (
    <div className="rounded-md bg-sc-mint p-2 text-xs" data-testid="estate-grants">
      <p className="text-sm font-extrabold">{t("منح القسائم السكنية")}</p>
      <p className="mt-1 leading-relaxed">
        {t("تمنح المواطنين قسائم من أراضي الدولة بجانب الطرق، ويبنون عليها بيوتهم على حسابهم. ترفع شهرتك ورضا الناس، والأرض تصير ملكاً خاصاً لهم.")}
      </p>
      <div className="mt-2">
        <NumberField label={t("عدد القسائم (حتى ٥٠)")} value={n} onChange={setN} />
      </div>
      <button
        type="button"
        data-testid="estate-grant-go"
        onClick={() => onEstate((s) => grantPlots(s, n))}
        className="sc-menu sc-on mt-2 h-10 w-full text-sm"
      >
        {t("امنح {n} قسيمة", { n: Math.max(1, Math.min(50, Math.round(n))) })}
      </button>
    </div>
  );
}
