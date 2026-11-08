import { useEffect, useRef, useState } from "react";
import { NpcFinance } from "@/components/hud-npc";
import { HardHat, MessageCircle, Send } from "lucide-react";
import { stats, type Sim } from "@/game/sim";
import { BUILDER_NAME, BUILDER_SIGN_ON, builderFee } from "@/game/builder";
import { askRate, npcDef, NPCS, type NpcId } from "@/game/npcs";
import { LangPicker } from "@/components/hud-panels";
import { currency, dirOf, percentSign, t, tx, useLang, bigNum, getLang } from "@/i18n";

const fmt = (n: number) => bigNum(n, getLang());

// ------------------------------------------------------------------ player profile

export type Player = { name: string; avatar: string };

export const AVATARS = ["🧔🏽", "👨🏻", "👳🏽‍♂️", "👨🏽‍💼", "👩🏽‍💼", "🧕🏽", "👩🏻", "👨🏾‍🦱", "🧑🏻‍💻", "🦅", "🐪", "⛵"];

export function loadPlayer(): Player | null {
  try {
    const raw = localStorage.getItem("omdat-player");
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Player>;
    if (typeof p.name !== "string" || typeof p.avatar !== "string") return null;
    return { name: p.name.slice(0, 24), avatar: p.avatar };
  } catch {
    return null;
  }
}

export function savePlayer(p: Player) {
  try {
    localStorage.setItem("omdat-player", JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

export function PlayerSetup({
  initial,
  onSave,
}: {
  initial: Player | null;
  onSave: (p: Player) => void;
}) {
  const lang = useLang();
  const [name, setName] = useState(initial?.name ?? "");
  const [avatar, setAvatar] = useState(initial?.avatar ?? AVATARS[0]!);
  return (
    <div className="celebrate pointer-events-auto" dir={dirOf(lang)}>
      <form
        className="celebrate-card sc-panel text-start"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ name: name.trim() || t("المحافظ"), avatar });
        }}
      >
        <LangPicker className="mb-3" />
        <p className="text-xl font-extrabold">{t("من أنت يا مساعد المختار؟")}</p>
        <label className="mt-3 block text-sm font-extrabold">
          {t("اسمك")}
          <input
            data-testid="player-name"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("مثلاً: سليمان")}
            className="mt-1 h-11 w-full rounded-md border-2 border-sc-ink bg-white px-2 text-base"
          />
        </label>
        <p className="mt-3 text-sm font-extrabold">{t("صورتك")}</p>
        <div className="mt-1 grid grid-cols-6 gap-1">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={avatar === a}
              onClick={() => setAvatar(a)}
              className={`grid h-11 place-items-center rounded-md border-2 text-2xl ${
                avatar === a ? "border-sc-ink bg-sc-lime" : "border-transparent bg-white"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        <button
          type="submit"
          data-testid="player-save"
          className="sc-menu sc-on mt-3 w-full text-sm"
        >
          {t("احفظ وابدأ")}
        </button>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------ number field

/** A free number input for amounts and percentages, with no upper limit. */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  testid,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  testid?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  return (
    <label className="block text-xs font-extrabold">
      {label}
      <span className="mt-0.5 flex items-center gap-1">
        <input
          inputMode="decimal"
          data-testid={testid}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const v = Number(e.target.value.replace(/[,٬]/g, ""));
            if (Number.isFinite(v) && v >= 0) onChange(v);
          }}
          className="h-9 w-full min-w-0 rounded-md border-2 border-sc-ink bg-white px-2 text-sm"
          dir="ltr"
        />
        {suffix && <span className="shrink-0">{suffix}</span>}
      </span>
    </label>
  );
}

// ------------------------------------------------------------------ construction advisor

export function BuilderCard({
  snap,
  onHire,
  onFire,
  onShare,
}: {
  snap: Sim;
  onHire: () => void;
  onFire: () => void;
  onShare: (pct: number) => void;
}) {
  const b = snap.builder;
  const budget = Math.max(0, snap.coins) * (b.share / 100);
  return (
    <section className="rounded-md bg-sc-mint p-2 text-sc-ink" data-testid="builder-card">
      <p className="flex items-center gap-1 text-sm font-extrabold">
        <HardHat size={16} /> {t("مستشار البناء")} · {t(BUILDER_NAME)}
      </p>
      <p className="mt-1 text-xs leading-relaxed">
        {t(
          "يبني ويرقّي كل شهر: يوفّر الخدمات الناقصة، ويبدّل الفلل بعمارات ويرفعها حتى ناطحات سحاب، ويزرع الحدائق، ويرقّي المحلات والأبراج. الترقيات ينفذها المطور العقاري ويدفعها السكان: ٩٩٪ لصندوقك و١٪ للمطور. أنت تدفع المباني الجديدة وأتعابه الشهرية (حوالي {fee} د.ك + ٥٪ من الأعمال).",
          { fee: fmt(builderFee(snap)) },
        )}
      </p>
      {b.hired ? (
        <>
          <label className="mt-2 block text-xs font-extrabold">
            {t("نسبة الميزانية الشهرية له: {share}٪ (≈ {amount} د.ك هذا الشهر)", {
              share: b.share,
              amount: fmt(budget),
            })}
            <input
              type="range"
              min={1}
              max={100}
              value={b.share}
              data-testid="builder-share"
              onChange={(e) => onShare(Number(e.target.value))}
              className="h-9 w-full accent-sc-leaf"
            />
          </label>
          <div className="flex gap-1">
            {[10, 30, 50, 70, 100].map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={b.share === p}
                onClick={() => onShare(p)}
                className={`sc-menu flex-1 px-1 text-xs ${b.share === p ? "sc-on" : ""}`}
              >
                {p}
                {percentSign()}
              </button>
            ))}
          </div>
          {b.last && (
            <p className="mt-2 rounded bg-white/70 p-1 text-xs">
              {t("آخر شهر: {report}", { report: b.last })}
            </p>
          )}
          <p className="mt-1 text-xs font-extrabold">
            {t("ترقيات يدفعها السكان: {amount} لك · {fee} للمطور", {
              amount: fmt(snap.finance.upgradeIncome),
              fee: fmt(snap.finance.developerFees),
            })}
          </p>
          <p className="mt-1 text-xs">
            {t("المجموع: {works} عمل بقيمة {amount} د.ك", {
              works: fmt(b.works),
              amount: fmt(b.spent),
            })}
          </p>
          <button type="button" onClick={onFire} className="sc-textbtn mt-2 h-9 w-full text-xs">
            {t("أنهِ العقد")}
          </button>
        </>
      ) : (
        <button
          type="button"
          data-testid="builder-hire"
          onClick={onHire}
          disabled={snap.coins < BUILDER_SIGN_ON}
          className="sc-menu sc-on mt-2 w-full text-sm disabled:opacity-40"
        >
          {t("عيّنه (توقيع {amount} د.ك)", { amount: fmt(BUILDER_SIGN_ON) })}
        </button>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ virtual players

export function People({
  snap,
  player,
  onOpen,
  onChat,
  onLend,
  onBorrow,
  onRepay,
  onAudit,
  onAccount,
}: {
  snap: Sim;
  player: { name: string; avatar: string };
  onOpen: (id: NpcId) => void;
  onChat: (id: NpcId, text: string) => void;
  onLend: (id: NpcId, amount: number, rate: number, months: number) => void;
  onBorrow: (id: NpcId, amount: number, rate: number, months: number) => void;
  onRepay: (id: NpcId) => void;
  onAudit: (id: NpcId) => void;
  onAccount: (id: NpcId) => void;
}) {
  const [open, setOpen] = useState<NpcId | null>(null);
  const [view, setView] = useState<"chat" | "money">("chat");
  const [text, setText] = useState("");
  const [amount, setAmount] = useState(50_000);
  const [rate, setRate] = useState(10);
  const [months, setMonths] = useState(12);
  const end = useRef<HTMLDivElement>(null);
  const npc = open ? snap.npcs.find((n) => n.id === open) : null;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [npc?.chat.length]);

  if (!open || !npc) {
    return (
      <ul className="space-y-1.5" dir={dirOf()}>
        {NPCS.map((d) => {
          const n = snap.npcs.find((x) => x.id === d.id)!;
          const owesMe = n.owesMe.reduce((t, l) => t + l.left, 0);
          const iOwe = n.iOwe.reduce((t, l) => t + l.left, 0);
          return (
            <li key={d.id}>
              <button
                type="button"
                data-testid={`npc-${d.id}`}
                onClick={() => {
                  setOpen(d.id);
                  setRate(Math.round(askRate(snap, d.id) * 1000) / 10);
                  onOpen(d.id);
                }}
                className="sc-choice flex w-full items-center gap-2 rounded-md px-2 py-2 text-start"
              >
                <span className="text-3xl">{d.avatar}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between text-sm font-extrabold">
                    <span>{t(d.name)}</span>
                    {n.unread > 0 && (
                      <span className="rounded-full bg-coral px-2 text-xs text-sc-mint">
                        {n.unread}
                      </span>
                    )}
                  </span>
                  <span className="block text-xs opacity-80">{t(d.role)}</span>
                  <span className="block text-xs">
                    {t("ثقة {n}٪", { n: Math.round(n.trust) })}
                    {owesMe > 0 ? ` · ${t("عليه لك {amount}", { amount: fmt(owesMe) })}` : ""}
                    {iOwe > 0 ? ` · ${t("عليك له {amount}", { amount: fmt(iOwe) })}` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  const d = npcDef(open);
  const asked = askRate(snap, open);
  return (
    <div className="flex h-full flex-col gap-2" dir={dirOf()}>
      <div className="flex items-center gap-2">
        <button type="button" className="sc-textbtn h-9 text-xs" onClick={() => setOpen(null)}>
          {t("رجوع")}
        </button>
        <span className="text-2xl">{d.avatar}</span>
        <span className="text-sm font-extrabold">
          {t(d.name)} · <span className="font-medium">{t(d.role)}</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1" role="tablist">
        {(["chat", "money"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            data-testid={`npc-view-${v}`}
            onClick={() => setView(v)}
            className={`sc-menu h-9 text-xs ${view === v ? "sc-on" : ""}`}
          >
            {v === "chat" ? t("المحادثة والقروض") : t("الوضع المالي")}
          </button>
        ))}
      </div>
      {view === "money" ? (
        <NpcFinance snap={snap} id={open} onAudit={onAudit} onAccount={onAccount} />
      ) : (
      <>
      <div className="max-h-56 min-h-32 space-y-1 overflow-y-auto rounded-md bg-white/70 p-2 text-sm">
        {npc.chat.map((m, i) => (
          <p
            key={i}
            className={`flex items-end gap-1 ${m.from === "me" ? "flex-row" : "flex-row-reverse"}`}
          >
            <span className="text-lg">{m.from === "me" ? player.avatar : d.avatar}</span>
            <span
              className={`max-w-[80%] rounded-lg px-2 py-1 ${
                m.from === "me" ? "bg-sc-lime/60" : "bg-sc-mint"
              }`}
            >
              <bdi>{tx(m.text)}</bdi>
            </span>
          </p>
        ))}
        <div ref={end} />
      </div>
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onChat(open, text);
          setText("");
        }}
      >
        <input
          value={text}
          data-testid="chat-input"
          onChange={(e) => setText(e.target.value)}
          placeholder={t("اكتب رسالة… (قرض، فائدة، أزمة، بناء)")}
          className="h-10 min-w-0 flex-1 rounded-md border-2 border-sc-ink bg-white px-2 text-sm"
        />
        <button type="submit" className="sc-menu sc-on px-3" aria-label={t("إرسال")}>
          <Send size={16} />
        </button>
      </form>
      <div className="rounded-md bg-sc-mint p-2 text-sc-ink">
        <p className="text-xs">
          {t(
            "يطلب منك فائدة {rate}٪ سنوياً إذا اقترضت. الفائدة حرة: أي نسبة، لكن الفوائد العالية تُرفض أو تنتهي بعجز عن السداد. اكتب ٠٪ لطلب قرض حسن، ويقبله إذا كانت ثقته بك ٧٥٪ أو أكثر.",
            { rate: Math.round(asked * 1000) / 10 },
          )}
        </p>
        <div className="mt-1 grid grid-cols-3 gap-1">
          <NumberField
            label={t("المبلغ")}
            value={amount}
            onChange={setAmount}
            suffix={currency()}
            testid="npc-amount"
          />
          <NumberField
            label={t("الفائدة السنوية")}
            value={rate}
            onChange={setRate}
            suffix={percentSign()}
            testid="npc-rate"
          />
          <NumberField
            label={t("المدة")}
            value={months}
            onChange={(v) => setMonths(Math.max(1, Math.round(v)))}
            suffix={t("شهر")}
          />
        </div>
        <div className="mt-1 grid grid-cols-3 gap-1">
          <button
            type="button"
            data-testid="npc-lend"
            onClick={() => onLend(open, amount, rate / 100, months)}
            className="sc-menu text-xs"
          >
            {t("أقرضه")}
          </button>
          <button
            type="button"
            data-testid="npc-borrow"
            onClick={() => onBorrow(open, amount, rate / 100, months)}
            className="sc-menu text-xs"
          >
            {t("اقترض منه")}
          </button>
          <button type="button" onClick={() => onRepay(open)} className="sc-menu text-xs">
            {t("سدّد دينه")}
          </button>
        </div>
        <button
          type="button"
          data-testid="npc-qard"
          onClick={() => onLend(open, amount, 0, months)}
          className="sc-menu sc-on mt-1 w-full text-xs"
        >
          {t("قرض حسن بلا فائدة ({amount} د.ك) · يرفع الثقة كثيراً", { amount: fmt(amount) })}
        </button>
      </div>
      </>
      )}
    </div>
  );
}

export function PeopleButton({ unread, onClick }: { unread: number; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid="people-btn"
      aria-label={t("اللاعبون والمحادثات")}
      onClick={onClick}
      className="sc-round relative"
    >
      <MessageCircle size={18} />
      {unread > 0 && (
        <span className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-extrabold text-sc-mint">
          {unread}
        </span>
      )}
    </button>
  );
}

export function residentsOf(s: Sim) {
  return stats(s).residents;
}
