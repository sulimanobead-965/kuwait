import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceDays,
  collectedShare,
  createInitialDistrict,
  feeRevenue,
  minLoanRate,
  stats,
  takeLoan,
} from "./sim.ts";
import { builderMonth, hireBuilder } from "./builder.ts";
import { borrowFrom, chat, greet, lendTo, npcMonth } from "./npcs.ts";
import {
  buyBond,
  buySukuk,
  deposit,
  depositMudaraba,
  financeMonth,
  startProject,
  takeMurabaha,
} from "./finance.ts";

/** A seeded starter town; independent of map coordinates. */
function town() {
  const s = createInitialDistrict("yarmouk");
  s.started = true;
  s.randomDisasters = false;
  return s;
}

test("the construction advisor spends the chosen share and adds many residents", () => {
  const s = town();
  s.coins = 100_000;
  assert.equal(hireBuilder(s).ok, true);
  s.builder.share = 70;
  const before = stats(s).capacity;
  const villas = s.buildings.filter((b) => b.kind === "villa").length;
  const coins = s.coins;
  const report = builderMonth(s);
  assert.ok(report);
  assert.ok(coins - s.coins <= coins * 0.7 + 5000, "stays within budget plus fee");
  assert.ok(s.buildings.filter((b) => b.kind === "villa").length < villas, "villas replaced");
  assert.ok(stats(s).capacity > before * 1.5, "homes grow clearly");

  const small = town();
  small.coins = 100_000;
  hireBuilder(small);
  small.builder.share = 10;
  const c0 = small.coins;
  builderMonth(small);
  assert.ok(c0 - small.coins < c0 * 0.1 + 5000, "a 10٪ share spends little");
});

test("living costs accept any percentage, but extreme prices stop paying", () => {
  const s = town();
  const base = feeRevenue(s);
  s.costs.housing = 400;
  assert.ok(feeRevenue(s) > base, "moderate raises pay");
  s.costs.housing = 10_000;
  assert.ok(feeRevenue(s) < base, "10,000٪ collects almost nothing");
  assert.ok(collectedShare(100) === 1 && collectedShare(10_000) < 0.01);
  const occ = s.occupancy;
  advanceDays(s, 360);
  assert.ok(s.occupancy < occ, "people leave");
});

test("custom rates: loans need the bank's minimum, high promises break companies", () => {
  const s = town();
  s.coins = 5_000_000;
  assert.equal(takeLoan(s, 5000, 0.01).ok, false);
  assert.equal(takeLoan(s, 5000, minLoanRate(s) + 0.01).ok, true);
  assert.equal(deposit(s, 100_000, 100).ok, true); // 10,000٪
  assert.equal(buyBond(s, { issuer: "bank", amount: 1_000_000, rate: 0.5, years: 2 }).ok, true);
  assert.equal(
    startProject(s, { name: "x", amount: 10_000, payback: 2, months: 12, handover: false }).ok,
    true,
  );
  financeMonth(s, {
    log: () => {},
    handover: () => 0,
    economicCrisis: false,
    war: false,
    random: () => 0.5,
  });
  assert.equal(s.finance.deposit, 0, "the bank failed before paying 10,000٪");
  assert.ok(s.finance.lost > 0);
});

test("virtual players chat, lend and borrow at any rate", () => {
  const s = town();
  s.coins = 1_000_000;
  greet(s, "abufahad");
  chat(s, "abufahad", "السلام عليكم، أبي قرض");
  const npc = s.npcs.find((n) => n.id === "abufahad")!;
  assert.ok(npc.chat.length >= 3);
  assert.equal(borrowFrom(s, "abufahad", 100_000, 0.2, 12, () => 0).ok, true);
  assert.ok(npc.iOwe.length === 1);
  assert.equal(lendTo(s, "sara", 20_000, 0.1, 12, () => 0).ok, true);
  assert.equal(
    lendTo(s, "sara", 20_000, 50, 12, () => 0.99).ok,
    false,
    "an insulting rate is refused",
  );
  const coins = s.coins;
  npcMonth(s, () => 0.99);
  assert.ok(s.coins !== coins, "installments flow");
  const sara = s.npcs.find((n) => n.id === "sara")!;
  npcMonth(s, () => 0);
  assert.equal(sara.owesMe.length, 0, "a default wipes the loan");
});

test("Islamic finance sits beside conventional finance and all can be held together", () => {
  const s = town();
  s.coins = 5_000_000;
  // Conventional loan and murabaha financing at the same time.
  assert.equal(takeLoan(s, 10_000, minLoanRate(s) + 0.02).ok, true);
  assert.equal(takeMurabaha(s, 50_000, 0.1, 12).ok, true);
  assert.equal(takeMurabaha(s, 50_000, 0.001, 24).ok, false, "a token markup is refused");
  const m = s.finance.murabaha[0]!;
  assert.ok(Math.abs(m.left - 55_000) < 1, "fixed markup, agreed upfront");
  // Interest deposit, mudaraba deposit, bonds and sukuk together.
  assert.equal(deposit(s, 100_000, 0.1).ok, true);
  assert.equal(depositMudaraba(s, 100_000, 0.08).ok, true);
  assert.equal(buyBond(s, 1).ok, true);
  assert.equal(buySukuk(s, "islamic", 1_000_000, 0.07, 3).ok, true);
  assert.equal(buySukuk(s, "developer", 2_000_000, 0.09, 2).ok, true);
  const ctx = {
    log: () => {},
    handover: () => 0,
    economicCrisis: false,
    war: false,
    random: () => 0.5,
  };
  financeMonth(s, ctx);
  assert.ok(s.finance.mudaraba > 100_000, "profit shared in a normal month");
  assert.ok(Math.abs(s.finance.murabaha[0]!.left - (55_000 - 55_000 / 12)) < 1);
  // Missing an installment never grows the murabaha debt.
  s.coins = 0;
  const left = s.finance.murabaha[0]!.left;
  financeMonth(s, ctx);
  assert.equal(s.finance.murabaha[0]!.left, left);
  // In a crisis mudaraba can lose; sukuk recover more than bonds on default.
  const c = town();
  c.coins = 3_000_000;
  depositMudaraba(c, 100_000, 0.08);
  financeMonth(c, { ...ctx, economicCrisis: true, random: () => 0.05 });
  assert.ok(c.finance.lost > 0);
});

test("qard hasan: an interest-free loan to or from a trusted virtual player", () => {
  const s = town();
  s.coins = 1_000_000;
  const npc = s.npcs.find((n) => n.id === "umsalem")!;
  const trust = npc.trust;
  assert.equal(lendTo(s, "umsalem", 10_000, 0, 10, () => 0).ok, true);
  assert.ok(npc.trust >= trust + 15);
  assert.equal(npc.owesMe[0]!.left, 10_000, "no interest");
  npc.trust = 90;
  assert.equal(borrowFrom(s, "umsalem", 5_000, 0, 5, () => 0.99).ok, true);
});
