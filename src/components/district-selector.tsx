import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Map, X, Play, RotateCcw } from "lucide-react";
import {
  DISTRICTS,
  districtById,
  districtRoads,
  type District,
  type DistrictId,
} from "@/game/districts";

const arabicNumber = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
const point = (c: number, r: number) => `${(c - 27) * 6},${(r - 17) * 6}`;

export function DistrictDiagram({
  district,
  labeled = true,
}: {
  district: District;
  labeled?: boolean;
}) {
  const roads = useMemo(() => new Set(districtRoads(district)), [district]);
  return (
    <svg
      viewBox="-1 -1 110 92"
      className="district-preview"
      role="img"
      aria-label={`مخطط ${district.name} التخطيطي`}
    >
      <rect width="108" height="90" rx="9" fill="#e1d2b1" />
      {district.sectors.map((sector) => (
        <g key={sector.number}>
          {sector.cells.map(({ c, r }) => (
            <path
              key={sector.number + ":" + c + ":" + r}
              d={`M ${point(c, r)} h 6 v 6 h -6 Z`}
              fill={sector.number % 2 ? "#b2bd8e" : "#c0c699"}
            />
          ))}
        </g>
      ))}
      {[...roads].map((key) => {
        const [c, r] = key.split(",").map(Number);
        return <path key={key} d={`M ${point(c!, r!)} h 6 v 6 h -6 Z`} fill="#3c494b" />;
      })}
      {district.sectors.map((sector) => (
        <text
          key={sector.number}
          x={(sector.x - 27) * 6 + 3}
          y={(sector.y - 17) * 6 + 4}
          textAnchor="middle"
          fontSize={labeled ? 12 : 16}
          fontWeight="800"
          fill="#173f41"
          stroke="#e1d2b1"
          strokeWidth="1.1"
          paintOrder="stroke"
        >
          {arabicNumber(sector.number)}
        </text>
      ))}
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
          ?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق اختيار الحي"]')
          ?.click();
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const index = DISTRICTS.findIndex((item) => item.id === selectedRef.current);
        const next = DISTRICTS[(index + (event.key === "ArrowLeft" ? 1 : 2)) % 3]!.id;
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
      dir="rtl"
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
              <Map size={15} /> عمدة الكويت
            </span>
            <h2 id="district-title">اختر الحي قبل بناء مدينة جديدة</h2>
          </div>
          <button type="button" className="sc-x" onClick={onClose} aria-label="إغلاق اختيار الحي">
            <X size={18} />
          </button>
        </header>
        <p className="district-intro">
          اختيارات مبنية على لوحات الأحياء المصوّرة، وليست خرائط مساحة أو مسحًا جغرافيًا. استعراضك
          هنا لا يغيّر مدينتك.
        </p>
        <div className="district-options" role="radiogroup" aria-label="الأحياء المتاحة">
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
              <DistrictDiagram district={item} />
              <span className="district-option-title">
                <MapPin size={16} />
                {item.name}
              </span>
              <span>{arabicNumber(item.sectors.length)} قطع · مخطط لعب</span>
            </button>
          ))}
        </div>
        <div className="district-choice">
          <div>
            <h3>{district.name}</h3>
            <p>{district.description}</p>
            <p className="district-save-note">
              يُحفظ كل حي على حدة. لا يترحّل أي مبنى ولا يُستبدل الحفظ القديم.
            </p>
          </div>
          <button
            type="button"
            data-testid={`choose-district-${district.id}`}
            className="sc-menu sc-on district-choose"
            onClick={() => onChoose(district.id)}
          >
            <Play size={18} />
            {current === district.id ? `استئناف ${district.name}` : `دخول ${district.name}`}
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
            عودة آمنة إلى مدينة الكويت القديمة
          </button>
        )}
        <button type="button" className="district-return" onClick={onClose}>
          <RotateCcw size={15} />
          {active ? `العودة إلى ${active.name} دون تغيير` : "العودة إلى مدينة الكويت دون تغيير"}
        </button>
      </div>
    </div>
  );
}
