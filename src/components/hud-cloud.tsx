import { useEffect, useState } from "react";
import { Cloud, CloudDownload, CloudUpload, LogOut } from "lucide-react";
import {
  CloudFail,
  cloudDb,
  cloudInfo,
  loadSession,
  pullSave,
  pushSave,
  signIn,
  signOut,
  signUp,
  validPhone,
  validPin,
  type CloudError,
  type CloudInfo,
  type CloudSession,
} from "@/game/cloud";
import { stats, type Sim } from "@/game/sim";
import { bigNum, dirOf, getLang, t } from "@/i18n";

/** Ask the game to write its latest state to browser storage now. */
export function flushGame() {
  window.dispatchEvent(new Event("city-save-now"));
}

export function aboutGame(snap: Sim) {
  return { residents: stats(snap).residents, day: Math.floor(snap.day) };
}

export function errorText(code: CloudError) {
  switch (code) {
    case "unavailable":
      return t("الحفظ السحابي يعمل فقط داخل رابط اللعبة على Claude");
    case "bad-phone":
      return t("رقم التلفون لازم يكون ٨ أرقام");
    case "bad-pin":
      return t("الرقم السري لازم يكون ٨ أرقام");
    case "no-account":
      return t("ما في حساب بهذا الرقم. اضغط «حساب جديد»");
    case "taken":
      return t("هذا الرقم مسجّل من قبل. اضغط «دخول»");
    case "wrong-pin":
      return t("الرقم السري غلط");
    case "no-write":
      return t("ما عندك صلاحية الحفظ في هذا الرابط");
    case "full":
      return t("مساحة السحابة ممتلئة");
    default:
      return t("ما قدرت أوصل للسحابة. جرّب بعد شوي");
  }
}

const digits = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "").slice(0, 8);

export function CloudPanel({ snap }: { snap: Sim }) {
  const [ready, setReady] = useState<boolean | null>(null);
  const [session, setSession] = useState<CloudSession | null>(() => loadSession());
  const [info, setInfo] = useState<CloudInfo | null>(null);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [confirmPull, setConfirmPull] = useState(false);

  useEffect(() => {
    let live = true;
    void cloudDb().then((db) => live && setReady(Boolean(db)));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!session || !ready) return;
    let live = true;
    void cloudInfo(session).then((i) => live && setInfo(i));
    return () => {
      live = false;
    };
  }, [session, ready]);

  async function run(job: () => Promise<void>) {
    setBusy(true);
    setNote(null);
    try {
      await job();
    } catch (e) {
      setNote({ text: errorText(e instanceof CloudFail ? e.code : "network"), bad: true });
    } finally {
      setBusy(false);
    }
  }

  const [confirmPush, setConfirmPush] = useState(false);
  const upload = (s: CloudSession) => {
    // A cloud city further along than this one is not replaced without a second tap.
    if (info && info.day > snap.day + 30 && !confirmPush) {
      setConfirmPush(true);
      setNote({ text: t("مدينة السحابة أكبر وأحدث من هذي. اضغط «احفظ الآن» مرة ثانية إذا تبي تستبدلها"), bad: true });
      return;
    }
    setConfirmPush(false);
    return run(async () => {
      flushGame();
      setInfo(await pushSave(s, aboutGame(snap)));
      setNote({ text: t("تم حفظ مدينتك في السحابة") });
    });
  };

  const download = (s: CloudSession) =>
    run(async () => {
      const ok = await pullSave(s);
      if (!ok) {
        setNote({ text: t("ما في مدينة محفوظة في هذا الحساب بعد"), bad: true });
        return;
      }
      // The game loads the restored city in place (a page reload let the old city
      // save over it while the page closed).
      window.dispatchEvent(new Event("city-load-saved"));
      setNote({ text: t("تم استرجاع مدينتك من السحابة") });
    });

  const when = (ms: number) =>
    new Date(ms).toLocaleString(getLang() === "ar" ? "ar-KW" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="space-y-3" dir={dirOf()} data-testid="cloud">
      <div className="rounded-md bg-sc-mint p-2 text-xs leading-relaxed text-sc-ink">
        {t(
          "احفظ مدينتك في السحابة برقم تلفونك ورقم سري من ٨ أرقام، واسترجعها من أي جهاز. اللعبة تحفظ تلقائياً كل ٣ دقائق وأنت مسجّل.",
        )}
      </div>
      {ready === null && <p className="text-sm font-bold">{t("جاري الاتصال…")}</p>}
      {ready === false && <p className="text-sm font-bold text-coral">{errorText("unavailable")}</p>}
      {ready && !session && (
        <div className="space-y-2 rounded-md bg-sc-mint p-2 text-sc-ink">
          <label className="block text-xs font-bold">
            {t("رقم التلفون")}
            <input
              data-testid="cloud-phone"
              inputMode="numeric"
              autoComplete="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(digits(e.target.value))}
              placeholder="9xxxxxxx"
              className="mt-1 h-10 w-full rounded-md border-2 border-sc-ink/30 bg-white px-2 text-base tracking-widest"
            />
          </label>
          <label className="block text-xs font-bold">
            {t("الرقم السري (٨ أرقام)")}
            <input
              data-testid="cloud-pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              dir="ltr"
              value={pin}
              onChange={(e) => setPin(digits(e.target.value))}
              className="mt-1 h-10 w-full rounded-md border-2 border-sc-ink/30 bg-white px-2 text-base tracking-widest"
            />
          </label>
          <div className="flex gap-1">
            <button
              type="button"
              data-testid="cloud-signin"
              disabled={busy || !validPhone(phone) || !validPin(pin)}
              className="sc-menu sc-on h-10 flex-1 text-sm disabled:opacity-40"
              onClick={() =>
                run(async () => {
                  const r = await signIn(phone, pin);
                  setSession(r.session);
                  setInfo(r.info);
                  setPin("");
                  setNote({ text: t("أهلاً! سجّلت دخولك") });
                  if (r.info) setConfirmPull(true);
                })
              }
            >
              {t("دخول")}
            </button>
            <button
              type="button"
              data-testid="cloud-signup"
              disabled={busy || !validPhone(phone) || !validPin(pin)}
              className="sc-menu h-10 flex-1 text-sm disabled:opacity-40"
              onClick={() =>
                run(async () => {
                  const s = await signUp(phone, pin);
                  setSession(s);
                  setPin("");
                  flushGame();
                  setInfo(await pushSave(s, aboutGame(snap)));
                  setNote({ text: t("تم إنشاء حسابك وحفظ مدينتك في السحابة") });
                })
              }
            >
              {t("حساب جديد")}
            </button>
          </div>
          <p className="text-[11px] opacity-75">{t("لا تستخدم رقماً سرياً تستخدمه في البنك أو أي مكان مهم.")}</p>
        </div>
      )}
      {ready && session && (
        <div className="space-y-2 rounded-md bg-sc-mint p-2 text-sc-ink">
          <p className="flex items-center gap-1 text-sm font-extrabold">
            <Cloud size={16} /> {t("مسجّل برقم")} <span dir="ltr">{session.phone}</span>
          </p>
          <p className="text-xs">
            {info
              ? t("آخر حفظ: {when} · {n} ساكن", { when: when(info.savedAt), n: bigNum(info.residents, getLang()) })
              : t("ما في مدينة محفوظة في السحابة بعد")}
          </p>
          {confirmPull ? (
            <div className="space-y-1 rounded-md border-2 border-sc-gold p-2">
              <p className="text-xs font-bold">
                {t("تبي تسترجع المدينة المحفوظة في السحابة؟ المدينة الحالية على هذا الجهاز راح تُستبدل.")}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  data-testid="cloud-pull-yes"
                  disabled={busy}
                  className="sc-menu sc-on h-9 flex-1 text-xs disabled:opacity-40"
                  onClick={() => {
                    setConfirmPull(false);
                    void download(session);
                  }}
                >
                  {t("نعم، استرجعها")}
                </button>
                <button
                  type="button"
                  className="sc-menu h-9 flex-1 text-xs"
                  onClick={() => setConfirmPull(false)}
                >
                  {t("لا، خلّ مدينتي الحالية")}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                data-testid="cloud-push"
                disabled={busy}
                className="sc-menu sc-on flex h-10 items-center justify-center gap-1 text-xs disabled:opacity-40"
                onClick={() => void upload(session)}
              >
                <CloudUpload size={15} /> {t("احفظ الآن")}
              </button>
              <button
                type="button"
                data-testid="cloud-pull"
                disabled={busy || !info}
                className="sc-menu flex h-10 items-center justify-center gap-1 text-xs disabled:opacity-40"
                onClick={() => setConfirmPull(true)}
              >
                <CloudDownload size={15} /> {t("استرجع من السحابة")}
              </button>
            </div>
          )}
          <button
            type="button"
            data-testid="cloud-signout"
            className="flex items-center gap-1 text-xs font-bold underline underline-offset-4"
            onClick={() => {
              signOut();
              setSession(null);
              setInfo(null);
              setConfirmPull(false);
              setNote(null);
            }}
          >
            <LogOut size={13} /> {t("تسجيل خروج")}
          </button>
        </div>
      )}
      {busy && <p className="text-xs font-bold">{t("لحظة…")}</p>}
      {note && (
        <p className={`text-sm font-extrabold ${note.bad ? "text-coral" : "text-sc-lime"}`} role="status">
          {note.text}
        </p>
      )}
    </div>
  );
}
