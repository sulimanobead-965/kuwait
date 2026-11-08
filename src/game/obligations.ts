/**
 * Everything the city owes, in one place: the bank loan, Islamic murabaha
 * contracts and personal loans from other players. The governor can settle any of
 * them early, in full or in part, or pay toward all of them at once.
 */
import { bigNum, t } from "../i18n/index.ts";
import { repayMurabaha } from "./finance";
import { NPCS, repayNpc, type NpcId } from "./npcs";
import { repayLoan, type Sim } from "./sim";

export type Obligation =
  | { kind: "loan"; left: number }
  | { kind: "murabaha"; id: string; left: number; installment: number }
  | { kind: "npc"; id: NpcId; name: string; left: number };

export function obligations(s: Sim): Obligation[] {
  const out: Obligation[] = [];
  if (s.loan > 0.5) out.push({ kind: "loan", left: s.loan });
  for (const m of s.finance?.murabaha ?? [])
    if (m.left > 0.5) out.push({ kind: "murabaha", id: m.id, left: m.left, installment: m.installment });
  for (const n of s.npcs ?? []) {
    const left = n.iOwe.reduce((a, l) => a + l.left, 0);
    const def = NPCS.find((d) => d.id === n.id);
    if (left > 0.5 && def) out.push({ kind: "npc", id: n.id, name: def.name, left });
  }
  return out;
}

export function totalObligations(s: Sim) {
  return obligations(s).reduce((a, o) => a + o.left, 0);
}

type Result = { ok: true; msg: string } | { ok: false; msg: string };

/**
 * Pay toward every obligation: the whole lot (no amount) or up to `amount`. The
 * money goes to the bank loan first (it charges interest), then personal debts,
 * then murabaha. Pays what the treasury can afford.
 */
export function payObligations(s: Sim, amount?: number): Result {
  const total = totalObligations(s);
  if (total <= 0.5) return { ok: false, msg: t("ما عليك أي التزامات") };
  if (amount !== undefined && !(amount > 0)) return { ok: false, msg: t("مبلغ غير صحيح") };
  let budget = Math.min(amount ?? total, total, Math.max(0, s.coins));
  if (budget <= 0) return { ok: false, msg: t("الرصيد ما يكفي للسداد") };
  const start = s.coins;
  const order = obligations(s).sort((a, b) => rank(a) - rank(b));
  for (const o of order) {
    if (budget <= 0.5) break;
    const part = Math.min(o.left, budget);
    if (o.kind === "loan") repayLoan(s, part);
    else if (o.kind === "murabaha") repayMurabaha(s, o.id, part);
    else repayNpc(s, o.id, part);
    budget = Math.min(amount ?? total, total, start) - (start - s.coins);
  }
  const paid = start - s.coins;
  if (paid <= 0) return { ok: false, msg: t("الرصيد ما يكفي للسداد") };
  const left = totalObligations(s);
  return {
    ok: true,
    msg:
      left <= 0.5
        ? t("سدّدت كل الالتزامات")
        : t("سدّدت {amount} د.ك، والباقي {left} د.ك", {
            amount: bigNum(paid),
            left: bigNum(left),
          }),
  };
}

function rank(o: Obligation) {
  return o.kind === "loan" ? 0 : o.kind === "npc" ? 1 : 2;
}
