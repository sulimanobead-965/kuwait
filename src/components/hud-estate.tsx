import { useState } from "react";
import { Building2, FileSignature, Gavel, Gift, Landmark, MapPinned, Repeat, Scale, Store } from "lucide-react";
import { CATALOG } from "@/game/catalog";
import { NPCS, type NpcId } from "@/game/npcs";
import {
  ALLOCATION_USES,
  MERCHANT_COLORS,
  OWNER_COLORS,
  expropriate,
  merchantProfile,
  setLandTax,
  setMonopolyCap,
  setMortgage,
  type OwnershipMode,
  allocate,
  allocationFee,
  REQUEST_KINDS,
  lotOf,
  buyListing,
  buyMany,
  buyProperty,
  cancelRequest,
  offerMany,
  requestOffers,
  cancelListing,
  listForSale,
  makeOffer,
  propertyValue,
  renewAllocation,
  setRegistrationFee,
  startAuction,
  typicalPrices,
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

type View = "trades" | "platform" | "market" | "allocate" | "grants" | "laws";

const TYPE_NAMES: Record<Trade["type"], string> = {
  sale: "بيع",
  grant: "منحة",
  lease: "تأجير",
  allocation: "تخصيص",
  return: "رجوع للدولة",
};

/** The colours of the ownership map, as a legend for the chosen mode. */
export function OwnershipLegend({ mode = "owner" }: { mode?: OwnershipMode | null }) {
  const rows: [string, string][] =
    mode === "price"
      ? [
          [OWNER_COLORS.public!, "أرض عامة (لا تُتداول)"],
          ["#3cc846", "أرخص"],
          ["#fac846", "متوسط"],
          ["#fa1e46", "أغلى"],
        ]
      : mode === "merchant"
        ? [
            [OWNER_COLORS.public!, "أرض عامة (لا تُتداول)"],
            [OWNER_COLORS.state!, "أملاك الدولة الخاصة"],
            [OWNER_COLORS.people!, "ملك الأفراد"],
            ...NPCS.map((n) => [MERCHANT_COLORS[n.id], n.name] as [string, string]),
            [OWNER_COLORS.allocation!, "تخصيص مؤقت"],
          ]
        : [
            [OWNER_COLORS.public!, "أرض عامة (لا تُتداول)"],
            [OWNER_COLORS.state!, "أملاك الدولة الخاصة"],
            [OWNER_COLORS.people!, "ملك الأفراد"],
            [OWNER_COLORS.merchant!, "ملك التجار"],
            [OWNER_COLORS.allocation!, "تخصيص مؤقت"],
          ];
  rows.push(["#facc15", "معروض للبيع أو في مزاد"]);
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
  ownership: OwnershipMode | null;
  onOwnership: (mode: OwnershipMode | null) => void;
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
        <p className="mt-2 text-[11px] font-bold">{t("الملكية على الخريطة")}</p>
        <div className="mt-1 grid grid-cols-4 gap-1">
          {(
            [
              [null, "إخفاء"],
              ["owner", "حسب المالك"],
              ["merchant", "حسب التاجر"],
              ["price", "حسب السعر"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={label}
              type="button"
              data-testid={m ? `ownership-${m}` : "ownership-off"}
              aria-pressed={ownership === m}
              onClick={() => onOwnership(m)}
              className={`sc-menu h-auto min-h-9 px-0.5 py-1 text-[11px] leading-tight ${ownership === m ? "sc-on" : ""}`}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <div className="mt-2">
          <OwnershipLegend mode={ownership ?? "owner"} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {(
          [
            ["platform", "المنصة", <Building2 key="p" size={14} />],
            ["market", "السوق", <Store key="m" size={14} />],
            ["trades", "التداولات", <Repeat key="t" size={14} />],
            ["allocate", "التخصيص", <FileSignature key="a" size={14} />],
            ["grants", "المنح", <Gift key="g" size={14} />],
            ["laws", "القوانين", <Scale key="l" size={14} />],
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
      {view === "market" && <Market snap={snap} onEstate={onEstate} />}
      {view === "trades" && <Trades snap={snap} />}
      {view === "allocate" && <Allocations snap={snap} onEstate={onEstate} />}
      {view === "grants" && <Grants onEstate={onEstate} />}
      {view === "laws" && <Laws snap={snap} onEstate={onEstate} />}
    </div>
  );
}

const TYPES: Trade["type"][] = ["sale", "grant", "lease", "allocation", "return"];

/** Price index (line) and monthly volume (bars) over the kept months. */
function PriceChart({ snap }: { snap: Sim }) {
  const h = estateOf(snap).history;
  if (h.length < 2) return <p className="opacity-70">{t("الرسم يظهر بعد شهرين من التداول.")}</p>;
  const W = 300;
  const H = 90;
  const maxV = Math.max(1, ...h.map((x) => x.volume));
  const minI = Math.min(...h.map((x) => x.index));
  const maxI = Math.max(...h.map((x) => x.index));
  const span = Math.max(0.01, maxI - minI);
  const step = W / h.length;
  const line = h
    .map((x, i) => `${(i + 0.5) * step},${(H - 6 - ((x.index - minI) / span) * (H - 16)).toFixed(1)}`)
    .join(" ");
  const first = h[0]!;
  const last = h[h.length - 1]!;
  return (
    <div data-testid="price-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" role="img" aria-label={t("مؤشر الأسعار وحجم التداول")}>
        {h.map((x, i) => (
          <rect
            key={i}
            x={i * step + step * 0.15}
            width={step * 0.7}
            y={H - (x.volume / maxV) * (H - 10)}
            height={(x.volume / maxV) * (H - 10)}
            fill="#a855f7"
            opacity={0.35}
          />
        ))}
        <polyline points={line} fill="none" stroke="#0f766e" strokeWidth={2} />
      </svg>
      <div className="flex justify-between text-[11px]" dir="ltr">
        <span>{formatCityDate(first.day)}</span>
        <span>
          {t("المؤشر {from} ← {to}", { from: Math.round(first.index * 100), to: Math.round(last.index * 100) })}
        </span>
        <span>{formatCityDate(last.day)}</span>
      </div>
      <p className="text-[11px] opacity-75">{t("الخط: مؤشر الأسعار · الأعمدة: قيمة التداول كل شهر")}</p>
    </div>
  );
}

function Trades({ snap }: { snap: Sim }) {
  const [type, setType] = useState<Trade["type"] | "all">("all");
  const [who, setWho] = useState<OwnerId | "all">("all");
  const [big, setBig] = useState(false);
  let list = [...estateOf(snap).trades].reverse();
  if (type !== "all") list = list.filter((x) => x.type === type);
  if (who !== "all") list = list.filter((x) => x.from === who || x.to === who);
  if (big) list = [...list].sort((a, b) => b.price - a.price);
  list = list.slice(0, 40);
  return (
    <div className="space-y-2">
      <div className="rounded-md bg-sc-mint p-2 text-xs">
        <p className="mb-1 text-sm font-extrabold">{t("حركة السوق")}</p>
        <PriceChart snap={snap} />
      </div>
      <div className="rounded-md bg-sc-mint p-2 text-xs" data-testid="estate-trades">
        <p className="mb-1 text-sm font-extrabold">{t("التداولات العقارية")}</p>
        <div className="mb-2 flex flex-wrap gap-1">
          {(["all", ...TYPES] as const).map((x) => (
            <button
              key={x}
              type="button"
              aria-pressed={type === x}
              onClick={() => setType(x)}
              className={`rounded-full border px-2 py-0.5 text-[11px] ${type === x ? "border-sc-ink bg-sc-gold/60 font-bold" : "border-sc-ink/30"}`}
            >
              {x === "all" ? t("الكل") : t(TYPE_NAMES[x])}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={big}
            onClick={() => setBig(!big)}
            className={`rounded-full border px-2 py-0.5 text-[11px] ${big ? "border-sc-ink bg-sc-gold/60 font-bold" : "border-sc-ink/30"}`}
          >
            {t("الأكبر أولاً")}
          </button>
        </div>
        <select
          value={who}
          onChange={(ev) => setWho(ev.target.value as OwnerId | "all")}
          className="mb-2 h-8 w-full rounded border-2 border-sc-ink/30 bg-white px-1 text-xs"
          aria-label={t("المالك")}
        >
          <option value="all">{t("كل الملاك")}</option>
          {(["state", ...BUYERS] as OwnerId[]).map((o) => (
            <option key={o} value={o}>
              {t(ownerName(o))}
            </option>
          ))}
        </select>
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
    </div>
  );
}

/** The market: what owners have up for sale, offers and counter-offers, auctions, the fee. */
function Market({ snap, onEstate }: { snap: Sim; onEstate: (deal: (s: Sim) => EstateAct) => void }) {
  const e = estateOf(snap);
  const [pct, setPct] = useState(90);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [onlyMine, setOnlyMine] = useState(false);
  const [reqKind, setReqKind] = useState<string>("any");
  const [reqCount, setReqCount] = useState(5);
  const [reqPct, setReqPct] = useState(105);
  const all = [...e.listings].reverse().filter((l) => (onlyMine ? l.req : true));
  const listings = all.slice(0, 40);
  const buyable = all.filter((l) => l.seller !== "state");
  const chosen = buyable.filter((l) => picked.has(l.id));
  const sum = (xs: typeof buyable) => xs.reduce((a, l) => a + l.ask, 0);
  const toggle = (id: number) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const requests = e.requests ?? [];
  return (
    <div className="space-y-2" data-testid="estate-market">
      <div className="rounded-md bg-sc-mint p-2 text-xs">
        <p className="text-sm font-extrabold">{t("رسوم تسجيل الصفقات {n}٪", { n: e.fee })}</p>
        <p className="mt-0.5 leading-relaxed">
          {t("نسبة من كل صفقة بيع تدخل خزينة الدولة. كل ما ارتفعت قلّ التداول. جُمع منها {amount} د.ك.", { amount: fmt(e.feeTotal) })}
        </p>
        <input
          type="range"
          min={0}
          max={20}
          step={0.5}
          value={e.fee}
          aria-label={t("رسوم التسجيل")}
          data-testid="estate-fee"
          onChange={(ev) => {
            const v = Number(ev.target.value);
            onEstate((s) => {
              setRegistrationFee(s, v);
              return { ok: true, msg: "" };
            });
          }}
          className="mt-1 h-9 w-full accent-sc-leaf"
        />
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
          {typicalPrices(snap).map((p) => (
            <div key={p.kind} className="flex justify-between">
              <span>{t(CATALOG[p.kind].name)}</span>
              <span dir="ltr" className="font-bold">
                {fmt(p.price)}
              </span>
            </div>
          ))}
        </div>
      </div>
      {e.auctions.length > 0 && (
        <div className="rounded-md bg-sc-mint p-2 text-xs" data-testid="estate-auctions">
          <p className="flex items-center gap-1 text-sm font-extrabold">
            <Gavel size={14} /> {t("المزادات الجارية ({n})", { n: e.auctions.length })}
          </p>
          {e.auctions.map((a) => (
            <p key={a.id} className="border-t border-sc-ink/10 py-1">
              {t(CATALOG[a.kind].name)} · {t("حد أدنى {amount}", { amount: fmt(a.min) })} · {t("ينتهي {date}", { date: formatCityDate(a.until) })}
            </p>
          ))}
        </div>
      )}
      <div className="rounded-md bg-sc-mint p-2 text-xs" data-testid="estate-request">
        <p className="text-sm font-extrabold">{t("طلب عروض من الملاك")}</p>
        <p className="mt-0.5 leading-relaxed opacity-80">
          {t("حدد نوع العقار والعدد وأعلى سعر تقبله (٪ من قيمة السوق). الملاك يردون بعروضهم الحين وخلال شهرين، وتشتري اللي يعجبك أو كلها مرة وحدة.")}
        </p>
        <select
          value={reqKind}
          onChange={(ev) => setReqKind(ev.target.value)}
          className="mt-1 h-9 w-full rounded border-2 border-sc-ink/30 bg-white px-1 text-sm"
          data-testid="request-kind"
          aria-label={t("نوع العقار")}
        >
          <option value="any">{t("أي عقار")}</option>
          {REQUEST_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(CATALOG[k].name)}
            </option>
          ))}
        </select>
        <div className="mt-1 grid grid-cols-2 gap-1">
          <NumberField label={t("العدد (حتى ٥٠)")} value={reqCount} onChange={setReqCount} />
          <NumberField label={t("أعلى سعر (٪ من القيمة)")} value={reqPct} onChange={setReqPct} />
        </div>
        <button
          type="button"
          data-testid="request-go"
          className="sc-menu sc-on mt-1 h-9 w-full text-xs"
          onClick={() => {
            onEstate((s) => requestOffers(s, reqKind as Parameters<typeof requestOffers>[1], reqCount, reqPct));
            setOnlyMine(true);
          }}
        >
          {t("أرسل طلب العروض")}
        </button>
        {requests.length > 0 &&
          requests.map((r) => (
            <div key={r.id} className="mt-1 flex items-center justify-between gap-2 border-t border-sc-ink/10 pt-1">
              <span>
                {t("{kind} · {got}/{n} رد · حد {pct}٪ · حتى {date}", {
                  kind: r.kind === "any" ? "أي عقار" : CATALOG[r.kind].name,
                  got: r.got,
                  n: r.count,
                  pct: r.maxPct,
                  date: formatCityDate(r.until),
                })}
              </span>
              <button type="button" className="underline" onClick={() => onEstate((s) => cancelRequest(s, r.id))}>
                {t("إلغاء")}
              </button>
            </div>
          ))}
      </div>
      <div className="rounded-md bg-sc-mint p-2 text-xs" data-testid="estate-listings">
        <p className="text-sm font-extrabold">{t("معروض للبيع ({n})", { n: all.length })}</p>
        <p className="mt-0.5 leading-relaxed opacity-80">
          {t("اشترِ بالسعر المطلوب، أو قدّم عرضاً أقل: الأفراد يقبلون ٩٠٪ من السعر والتجار ٩٥٪، والعرض المعقول يجيك عليه رد بسعر وسط.")}
        </p>
        <div className="mt-1 w-40">
          <NumberField label={t("عرضك (٪ من السعر)")} value={pct} onChange={setPct} testid="offer-pct" />
        </div>
        <label className="mt-1 flex items-center gap-1">
          <input type="checkbox" checked={onlyMine} onChange={(ev) => setOnlyMine(ev.target.checked)} />
          {t("ردود طلباتي فقط")}
        </label>
        {buyable.length > 0 && (
          <div className="mt-2 space-y-1 rounded border-2 border-sc-ink/20 p-1.5" data-testid="bulk-bar">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">{t("محدد {n} من {all}", { n: chosen.length, all: buyable.length })}</span>
              <button
                type="button"
                className="underline"
                data-testid="pick-all"
                onClick={() => setPicked(chosen.length === buyable.length ? new Set() : new Set(buyable.map((l) => l.id)))}
              >
                {chosen.length === buyable.length ? t("إلغاء التحديد") : t("حدد الكل")}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                data-testid="buy-picked"
                disabled={!chosen.length}
                className="sc-menu sc-on h-9 text-[11px] disabled:opacity-40"
                onClick={() => {
                  const ids = chosen.map((l) => l.id);
                  onEstate((s) => buyMany(s, ids));
                  setPicked(new Set());
                }}
              >
                {t("اشترِ المحدد بـ {amount}", { amount: fmt(sum(chosen)) })}
              </button>
              <button
                type="button"
                data-testid="offer-picked"
                disabled={!chosen.length}
                className="sc-menu h-9 text-[11px] disabled:opacity-40"
                onClick={() => {
                  const ids = chosen.map((l) => l.id);
                  onEstate((s) => offerMany(s, ids, pct));
                  setPicked(new Set());
                }}
              >
                {t("اعرض {pct}٪ على المحدد", { pct })}
              </button>
            </div>
            <button
              type="button"
              data-testid="buy-all"
              className="sc-menu h-9 w-full text-[11px]"
              onClick={() => {
                const ids = buyable.map((l) => l.id);
                onEstate((s) => buyMany(s, ids));
                setPicked(new Set());
              }}
            >
              {t("اشترِ كل المعروض ({n}) بـ {amount}", { n: buyable.length, amount: fmt(sum(buyable)) })}
            </button>
          </div>
        )}
        {listings.length === 0 ? (
          <p className="mt-1 opacity-70">{t("ما في عروض الحين. الملاك يعرضون كل شهر.")}</p>
        ) : (
          listings.map((l) => {
            const b = lotOf(snap, l.lot);
            const value = b ? propertyValue(snap, b) : 0;
            return (
              <div
                key={l.id}
                className={`mt-1 rounded p-1.5 ${picked.has(l.id) ? "bg-sc-gold/40" : "bg-white/60"}`}
                data-testid="listing"
              >
                <div className="flex justify-between gap-2">
                  <label className="flex items-center gap-1 font-bold">
                    {l.seller !== "state" && (
                      <input type="checkbox" checked={picked.has(l.id)} onChange={() => toggle(l.id)} data-testid="listing-pick" />
                    )}
                    {t(CATALOG[l.kind].name)} · {t(ownerName(l.seller))}
                    {l.countered ? ` · ${t("عرض مقابل")}` : ""}
                    {l.req ? ` · ${t("رد على طلبك")}` : ""}
                  </label>
                  <span dir="ltr" className="font-extrabold">
                    {fmt(l.ask)}
                  </span>
                </div>
                <div className="opacity-75">
                  {t("قيمة السوق {value} · حتى {date}", { value: fmt(value), date: formatCityDate(l.until) })}
                </div>
                {l.seller === "state" ? (
                  <button type="button" className="sc-menu mt-1 h-8 w-full text-[11px]" onClick={() => onEstate((s) => cancelListing(s, l.id))}>
                    {t("اسحب العرض")}
                  </button>
                ) : (
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      data-testid="listing-buy"
                      className="sc-menu sc-on h-8 text-[11px]"
                      onClick={() => onEstate((s) => buyListing(s, l.id))}
                    >
                      {t("اشترِ بـ {amount}", { amount: fmt(l.ask) })}
                    </button>
                    <button
                      type="button"
                      data-testid="listing-offer"
                      className="sc-menu h-8 text-[11px]"
                      onClick={() => onEstate((s) => makeOffer(s, l.id, (l.ask * pct) / 100))}
                    >
                      {t("اعرض {amount}", { amount: fmt((l.ask * pct) / 100) })}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const BUYERS: OwnerId[] = ["people", ...NPCS.map((n) => n.id)];

function Platform({ snap, onEstate }: { snap: Sim; onEstate: (deal: (s: Sim) => EstateAct) => void }) {
  const rows = ownersSummary(snap);
  const [open, setOpen] = useState<OwnerId | null>(null);
  const [to, setTo] = useState<OwnerId>("people");
  const [months, setMonths] = useState(12);
  const [comp, setComp] = useState(100);
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
              {r.owner !== "state" && r.owner !== "people" && <Profile snap={snap} id={r.owner} />}
              {r.owner !== "state" && (
                <div className="w-48">
                  <NumberField label={t("تعويض نزع الملكية (٪ من القيمة)")} value={comp} onChange={setComp} />
                </div>
              )}
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
                      <button type="button" className="sc-menu h-8 text-[11px]" onClick={() => onEstate((s) => listForSale(s, b.id, value))}>
                        {t("اعرض للبيع")}
                      </button>
                      <button type="button" className="sc-menu h-8 text-[11px]" onClick={() => onEstate((s) => startAuction(s, b.id, value * 0.8))}>
                        {t("مزاد")}
                      </button>
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
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        data-testid="estate-buy"
                        className="sc-menu sc-on h-8 text-[11px]"
                        onClick={() => onEstate((s) => buyProperty(s, b.id))}
                      >
                        {t("اشترِ للدولة بـ {amount}", { amount: fmt(value * 1.05) })}
                      </button>
                      <button
                        type="button"
                        data-testid="estate-expropriate"
                        className="sc-menu h-8 text-[11px]"
                        onClick={() => onEstate((s) => expropriate(s, b.id, comp))}
                      >
                        {t("نزع ملكية ({pct}٪)", { pct: comp })}
                      </button>
                    </div>
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
              <div className="flex shrink-0 flex-col gap-1">
                <button type="button" className="sc-menu h-8 px-2 text-[11px]" onClick={() => onEstate((s) => renewAllocation(s, a.id, 10))}>
                  {t("جدّد ١٠ سنوات")}
                </button>
                <button type="button" className="sc-menu h-8 px-2 text-[11px]" onClick={() => onEstate((s) => endAllocation(s, a.id))}>
                  {t("أنهِ العقد")}
                </button>
              </div>
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

/** A merchant's record: holdings, deals, cash and standing under the monopoly law. */
function Profile({ snap, id }: { snap: Sim; id: NpcId }) {
  const p = merchantProfile(snap, id);
  const rows: [string, string][] = [
    ["السيولة", fmt(p.cash)],
    ["قيمة العقارات", fmt(p.value)],
    ["الحصة من العقار الخاص", `${(p.share * 100).toFixed(1)}%`],
    ["إيجار شهري تقريبي", fmt(p.rent)],
    ["اشترى", `${p.bought} · ${fmt(p.spent)}`],
    ["باع", `${p.sold} · ${fmt(p.earned)}`],
    ["معروض له الآن", String(p.listed)],
    ["عقود تخصيص", String(p.allocations)],
  ];
  return (
    <div className="rounded bg-white/70 p-1.5" data-testid="merchant-profile">
      <p className="font-extrabold">
        {t("ملف {name}", { name: t(ownerName(id)) })} ·{" "}
        {p.bought > p.sold ? t("مشترٍ") : p.sold > p.bought ? t("بائع") : t("متوازن")}
      </p>
      {p.overCap && <p className="font-bold text-coral">{t("فوق حد منع الاحتكار: يدفع رسوماً ويبيع الزيادة")}</p>}
      <div className="mt-1 grid grid-cols-2 gap-x-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-1">
            <span className="opacity-80">{t(k)}</span>
            <span dir="ltr" className="font-bold">
              {v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The real estate laws: anti-monopoly cap, home financing, undeveloped-property fee. */
function Laws({ snap, onEstate }: { snap: Sim; onEstate: (deal: (s: Sim) => EstateAct) => void }) {
  const e = estateOf(snap);
  const m = e.mortgage;
  const quiet = (fn: (s: Sim) => void) => onEstate((s) => (fn(s), { ok: true, msg: "" }));
  return (
    <div className="space-y-2 text-xs" data-testid="estate-laws">
      <div className="rounded-md bg-sc-mint p-2">
        <p className="text-sm font-extrabold">
          {e.cap > 0 ? t("قانون منع الاحتكار: حد {n}٪", { n: e.cap }) : t("قانون منع الاحتكار: متوقف")}
        </p>
        <p className="mt-0.5 leading-relaxed">
          {t("أعلى نسبة يملكها تاجر واحد من العقار الخاص. اللي يتعداها يدفع رسوماً على الزيادة كل شهر، ويعرض عقاراته للبيع لين ينزل تحت الحد. صفر يوقف القانون.")}
        </p>
        <input
          type="range"
          min={0}
          max={60}
          step={1}
          value={e.cap}
          aria-label={t("حد الاحتكار")}
          data-testid="law-cap"
          onChange={(ev) => {
            const v = Number(ev.target.value);
            quiet((s) => setMonopolyCap(s, v));
          }}
          className="mt-1 h-9 w-full accent-sc-leaf"
        />
        <p>
          {t("جُمع من رسوم الاحتكار {amount} د.ك", { amount: fmt(e.capTotal) })}
          {e.overCap.length > 0 ? " · " : ""}
          {e.overCap.length > 0 ? t("فوق الحد: {names}", { names: e.overCap.map((x) => ownerName(x as OwnerId)) }) : ""}
        </p>
      </div>
      <div className="rounded-md bg-sc-mint p-2">
        <p className="text-sm font-extrabold">{t("التمويل العقاري للمواطنين")}</p>
        <p className="mt-0.5 leading-relaxed">
          {t("الدولة تموّل ٧٠٪ من سعر أي بيت تشتريه أسرة، وتسترده على ٢٠ سنة بعائد تحدده. يزيد تملك المواطنين ويرفع الرضا، وفي الأزمات الاقتصادية تتعثر بعض الأسر.")}
        </p>
        <button
          type="button"
          data-testid="law-mortgage"
          aria-pressed={m.on}
          onClick={() => quiet((s) => setMortgage(s, !m.on))}
          className={`sc-menu mt-1 h-9 w-full text-xs ${m.on ? "sc-on" : ""}`}
        >
          {m.on ? t("البرنامج مفعّل · إيقاف") : t("فعّل البرنامج")}
        </button>
        <label className="mt-1 block font-bold">
          {t("العائد السنوي {n}٪", { n: m.rate })}
          <input
            type="range"
            min={0}
            max={15}
            step={0.5}
            value={m.rate}
            aria-label={t("العائد السنوي للتمويل العقاري")}
            onChange={(ev) => {
              const v = Number(ev.target.value);
              quiet((s) => setMortgage(s, m.on, v));
            }}
            className="mt-1 h-9 w-full accent-sc-leaf"
          />
        </label>
        <p>
          {t("رصيد التمويل {book} · مسترد {paid} · متعثر {lost} د.ك", { book: fmt(m.book), paid: fmt(m.paid), lost: fmt(m.lost) })}
        </p>
      </div>
      <div className="rounded-md bg-sc-mint p-2">
        <p className="text-sm font-extrabold">
          {e.landTax > 0 ? t("رسوم العقار غير المطوّر {n}٪ سنوياً", { n: e.landTax }) : t("رسوم العقار غير المطوّر: متوقفة")}
        </p>
        <p className="mt-0.5 leading-relaxed">
          {t("رسوم سنوية على عقارات التجار اللي ما طوّروها لأعلى مستوى. كل ما ارتفعت الرسوم طوّر التجار عقارات أكثر كل شهر.")}
        </p>
        <input
          type="range"
          min={0}
          max={20}
          step={0.5}
          value={e.landTax}
          aria-label={t("رسوم العقار غير المطوّر")}
          data-testid="law-landtax"
          onChange={(ev) => {
            const v = Number(ev.target.value);
            quiet((s) => setLandTax(s, v));
          }}
          className="mt-1 h-9 w-full accent-sc-leaf"
        />
        <p>{t("جُمع منها {amount} د.ك", { amount: fmt(e.landTaxTotal) })}</p>
      </div>
    </div>
  );
}
