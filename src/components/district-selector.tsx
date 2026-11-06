import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Map, X, Play, RotateCcw } from "lucide-react";
import {
  DISTRICTS,
  districtById,
  districtRoads,
  type District,
  type DistrictId,
} from "@/game/districts";
import { LAND, COLS, ROWS } from "@/game/land";
import { roadMarkingsAt } from "@/game/three/road-markings";
import { dirOf, getLang, t, useLang } from "@/i18n";

/** Arabic-Indic digits in Arabic, Western digits in English. */
const localNumber = (n: number) =>
  getLang() === "ar" ? String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!) : String(n);
export function DistrictDiagram({
  district,
  labeled = true,
}: {
  district: District;
  labeled?: boolean;
}) {
  const roads = useMemo(() => new Set(districtRoads(district)), [district]);
  // Frame the parcels and their streets wherever the district sits on the real map.
  const box = useMemo(() => {
    let c0 = Infinity,
      r0 = Infinity,
      c1 = -Infinity,
      r1 = -Infinity;
    const grow = (c: number, r: number) => {
      c0 = Math.min(c0, c);
      r0 = Math.min(r0, r);
      c1 = Math.max(c1, c);
      r1 = Math.max(r1, r);
    };
    for (const sector of district.sectors) for (const { c, r } of sector.cells) grow(c, r);
    for (const key of roads) {
      const [c, r] = key.split(",").map(Number);
      grow(c!, r!);
    }
    if (!Number.isFinite(c0)) return { c0: 0, r0: 0, w: 1, h: 1 };
    return { c0, r0, w: c1 - c0 + 1, h: r1 - r0 + 1 };
  }, [district, roads]);
  const font = Math.max(box.w, box.h) / (labeled ? 7 : 5.5);
  return (
    <svg
      viewBox={`${box.c0 - 0.5} ${box.r0 - 0.5} ${box.w + 1} ${box.h + 1}`}
      className="district-preview"
      role="img"
      aria-label={t("مخطط {name} التخطيطي", { name: district.name })}
    >
      <rect
        x={box.c0 - 0.5}
        y={box.r0 - 0.5}
        width={box.w + 1}
        height={box.h + 1}
        rx={box.w / 12}
        fill="#e1d2b1"
      />
      {district.sectors.map((sector) => (
        <g key={sector.number}>
          {sector.cells.map(({ c, r }) => (
            <rect
              key={sector.number + ":" + c + ":" + r}
              x={c}
              y={r}
              width={1.02}
              height={1.02}
              fill={sector.number % 2 ? "#b2bd8e" : "#c0c699"}
            />
          ))}
        </g>
      ))}
      {[...roads].map((key) => {
        const [c, r] = key.split(",").map(Number);
        return <rect key={key} x={c} y={r} width={1.02} height={1.02} fill="#3c494b" />;
      })}
      {labeled &&
        [...roads].flatMap((key) => {
          const [c, r] = key.split(",").map(Number);
          return roadMarkingsAt(roads, c!, r!).map((mark, index) => {
            const x = c! + 0.5,
              y = r! + 0.5;
            const length = mark.type === "dash" ? 0.27 : 0.31;
            const dx = mark.axis === "x" ? length / 2 : 0.03,
              dy = mark.axis === "z" ? length / 2 : 0.03;
            const ox = mark.type === "stop" ? mark.dc * 0.35 : 0,
              oy = mark.type === "stop" ? mark.dr * 0.35 : 0;
            return (
              <line
                key={`mark:${key}:${index}`}
                x1={x + ox - dx}
                y1={y + oy - dy}
                x2={x + ox + dx}
                y2={y + oy + dy}
                stroke="#e3d8ba"
                strokeWidth={0.07}
              />
            );
          });
        })}
      {district.sectors.map((sector) => {
        const mid = sector.cells.reduce((a, cell) => ({ c: a.c + cell.c, r: a.r + cell.r }), {
          c: 0,
          r: 0,
        });
        const n = Math.max(1, sector.cells.length);
        return (
          <text
            key={sector.number}
            x={mid.c / n + 0.5}
            y={mid.r / n + 0.5 + font / 3}
            textAnchor="middle"
            fontSize={font}
            fontWeight="800"
            fill="#173f41"
            stroke="#e1d2b1"
            strokeWidth={font / 10}
            paintOrder="stroke"
          >
            {localNumber(sector.number)}
          </text>
        );
      })}
    </svg>
  );
}

function FreeDiagram() {
  const land = useMemo(() => {
    const parts: string[] = [];
    for (let r = 0; r < ROWS; r += 1) {
      let c = 0;
      const row = LAND[r] ?? [];
      while (c < COLS) {
        if (!row[c]) {
          c += 1;
          continue;
        }
        const start = c;
        while (c < COLS && row[c]) c += 1;
        parts.push(`M${start} ${r}h${c - start}v1H${start}Z`);
      }
    }
    return parts.join("");
  }, []);
  return (
    <svg
      viewBox={`0 0 ${COLS} ${ROWS}`}
      className="district-preview"
      role="img"
      aria-label={t("مخطط المنطقة الحرة")}
    >
      <rect width={COLS} height={ROWS} fill="#7eb8c4" />
      <path d={land} fill="#cbb98a" />
    </svg>
  );
}

interface Props {
  open: boolean;
  current: DistrictId | null;
  onClose: () => void;
  onChoose: (id: DistrictId) => void;
  onResumeLegacy: () => void;
  onHasLegacy: () => boolean;
}
export function DistrictSelector({
  open,
  current,
  onClose,
  onChoose,
  onResumeLegacy,
  onHasLegacy,
}: Props) {
  const lang = useLang();
  const active = districtById(current);
  const [selected, setSelected] = useState<DistrictId>(current ?? "yarmouk");
  const dialogRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selected);
  const closeRef = useRef(onClose);
  selectedRef.current = selected;
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    setSelected(current ?? "yarmouk");
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>("button[data-district]")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dialogRef.current
          ?.querySelector<HTMLButtonElement>("button[data-close-districts]")
          ?.click();
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const index = DISTRICTS.findIndex((item) => item.id === selectedRef.current);
        // The list reads right-to-left in Arabic and left-to-right in English.
        const forward = event.key === (getLang() === "ar" ? "ArrowLeft" : "ArrowRight");
        const next =
          DISTRICTS[(index + (forward ? 1 : DISTRICTS.length - 1)) % DISTRICTS.length]!.id;
        setSelected(next);
        dialogRef.current?.querySelector<HTMLButtonElement>(`[data-district="${next}"]`)?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const items = [
        ...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []),
      ];
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, current]);
  const district = useMemo(() => districtById(selected)!, [selected]);
  if (!open) return null;
  return (
    <div
      className="district-backdrop"
      dir={dirOf(lang)}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="district-dialog sc-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="district-title"
      >
        <header className="district-header">
          <div>
            <span className="district-eyebrow">
              <Map size={15} /> {t("المحافظ")}
            </span>
            <h2 id="district-title">{t("اختر الحي أو المنطقة الحرة")}</h2>
          </div>
          <button
            type="button"
            className="sc-x"
            onClick={onClose}
            aria-label={t("إغلاق اختيار الحي")}
            data-close-districts
          >
            <X size={18} />
          </button>
        </header>
        <p className="district-intro">
          {t(
            "المدينة صارت بخمسة أضعاف المساحة. داخل الحي تقدر تبني خارج القطع المرقّمة، والمنطقة الحرة هي كل اليابسة بلا أرقام. الاستعراض هنا لا يغيّر مدينتك.",
          )}
        </p>
        <div className="district-options" role="radiogroup" aria-label={t("الأحياء المتاحة")}>
          {DISTRICTS.map((item) => (
            <button
              key={item.id}
              type="button"
              data-district={item.id}
              role="radio"
              aria-checked={selected === item.id}
              className={`district-option ${selected === item.id ? "selected" : ""}`}
              onClick={() => setSelected(item.id)}
            >
              {item.id === "free" ? <FreeDiagram /> : <DistrictDiagram district={item} />}
              <span className="district-option-title">
                <MapPin size={16} />
                {t(item.name)}
              </span>
              <span>
                {item.id === "free"
                  ? t("كل المدينة · خمسة أضعاف")
                  : t("{n} قطع · والبناء خارجها مسموح", { n: localNumber(item.sectors.length) })}
              </span>
            </button>
          ))}
        </div>
        <div className="district-choice">
          <div>
            <h3>{t(district.name)}</h3>
            <p>{t(district.description)}</p>
            <p className="district-save-note">
              {t("يُحفظ كل حي على حدة. لا يترحّل أي مبنى ولا يُستبدل الحفظ القديم.")}
            </p>
          </div>
          <button
            type="button"
            data-testid={`choose-district-${district.id}`}
            className="sc-menu sc-on district-choose"
            onClick={() => onChoose(district.id)}
          >
            <Play size={18} />
            {t(current === district.id ? "استئناف {name}" : "دخول {name}", { name: district.name })}
          </button>
        </div>
        {onHasLegacy() && (
          <button
            type="button"
            data-testid="resume-legacy-city"
            className="district-return"
            onClick={onResumeLegacy}
          >
            <RotateCcw size={15} />
            {t("عودة آمنة إلى مدينة الكويت القديمة")}
          </button>
        )}
        <button type="button" className="district-return" onClick={onClose}>
          <RotateCcw size={15} />
          {active
            ? t("العودة إلى {name} دون تغيير", { name: active.name })
            : t("العودة إلى مدينة الكويت دون تغيير")}
        </button>
      </div>
    </div>
  );
}
