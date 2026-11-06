import assert from "node:assert/strict";
import test from "node:test";
import { DEVELOPMENTS } from "./developments.ts";
import { CATALOG, maxLevelOf } from "./catalog.ts";
import { LAND } from "./land.ts";
import { LAW_KEYS } from "./laws.ts";
import {
  developmentMonth,
  COST_KEYS,
  costIndex,
  incomePerSec,
  metrics,
  lawPayment,
  lawStrength,
  monthlyUpkeep,
  giveAid,
  housingAidCost,
  upgradeDeveloper,
  upgrade,
  upgradeCost,
  homesPerLevel,
  RESIDENTS_PER_UNIT,
  findModelSite,
  placeBuilding,
  placeRoad,
  startDevelopment,
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
  monthlyPremium,
  premiumRate,
  setInsurance,
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

test("custom rates: banks accept any loan and rate; very high promises still break companies", () => {
  const s = town();
  s.coins = 5_000_000;
  assert.equal(takeLoan(s, 5000, 0).ok, true, "0٪ is accepted");
  assert.equal(takeLoan(s, 600_000_000, 5).ok, true, "600 million at 500٪ is accepted");
  assert.equal(takeMurabaha(s, 50_000_000, 0, 24).ok, true, "any financing, any markup");
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
    random: () => 0.1,
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
  assert.equal(takeMurabaha(s, 50_000, 0.001, 24).ok, true, "any markup is accepted");
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

test("developer projects fence a site, protect it, and hand over a finished neighbourhood", () => {
  const s = town();
  s.coins = 10_000_000;
  const act = startDevelopment(s, "towers");
  assert.equal(act.ok, true);
  if (!act.ok) return;
  const site = act.site;
  assert.equal(s.sites.length, 1);
  assert.equal(s.coins, 10_000_000 - DEVELOPMENTS.towers.cost);
  // Nobody else may build, pave or demolish inside the fence.
  assert.equal(placeBuilding(s, "villa", site.c + 1, site.r + 1, 0).ok, false);
  assert.equal(placeRoad(s, site.c, site.r).ok, false);
  assert.ok(findModelSite(s, 1, 1));
  const before = stats(s).capacity;
  advanceDays(s, DEVELOPMENTS.towers.months * 30 + 31);
  assert.equal(s.sites.length, 0, "handed over");
  assert.ok(stats(s).capacity > before + 2000, "the towers are lived in");
  assert.ok(
    s.buildings.some(
      (b) => b.kind === "apartments" && b.level === 5 && b.c >= site.c && b.c < site.c + site.w,
    ),
  );
  // A bankrupt developer abandons its sites.
  const b = town();
  b.coins = 10_000_000;
  assert.equal(startDevelopment(b, "compound").ok, true);
  b.finance.down.developer = b.day + 999;
  developmentMonth(b);
  assert.equal(b.sites.length, 0);
  assert.ok(b.finance.lost > 0);
});

test("the map can hold more than 50 million residents", () => {
  let land = 0;
  for (const row of LAND) for (const bit of row) land += bit;
  const perTower =
    CATALOG.apartments.pop * homesPerLevel(maxLevelOf("apartments")) * 2 * RESIDENTS_PER_UNIT;
  // Even with 40٪ of the land left for roads, services and parks.
  const capacity = land * 0.6 * perTower;
  assert.ok(perTower >= 10_000, String(perTower));
  assert.ok(capacity > 50_000_000, `capacity ${Math.round(capacity).toLocaleString()}`);
});

test("upgrades are run by the developer and paid by residents: 99% to the governor, 1% to the developer", () => {
  const s = town();
  s.coins = 1000;
  const b = s.buildings.find((x) => x.kind === "villa")!;
  const price = upgradeCost(b.kind, b.level);
  assert.equal(upgrade(s, b.id, 0).ok, true);
  assert.equal(b.level, 2);
  assert.ok(Math.abs(s.coins - (1000 + price * 0.99)) < 1e-6, "the governor earns 99%");
  assert.ok(Math.abs(s.finance.developerFees - price * 0.01) < 1e-6, "the developer keeps 1%");
  // With every private developer bankrupt, the national authority takes over: the
  // governor still never pays.
  s.finance.down.developer = s.day + 999;
  for (const id of ["khaleej", "jazeera", "dar"]) s.finance.devDown[id] = s.day + 999;
  assert.equal(upgradeDeveloper(s), "national");
  const coins = s.coins;
  const next = upgradeCost(b.kind, b.level);
  assert.equal(upgrade(s, b.id, 0).ok, true);
  assert.ok(Math.abs(s.coins - (coins + next * 0.99)) < 1e-6);
  assert.ok((s.finance.devFees.national ?? 0) > 0);
  // The construction advisor's upgrades also bring money in.
  const a = town();
  a.coins = 100_000;
  hireBuilder(a);
  a.builder.share = 50;
  const income = a.finance.upgradeIncome;
  builderMonth(a);
  assert.ok(a.finance.upgradeIncome > income);
});

test("several developers: each builds its own projects and fails on its own", () => {
  const s = town();
  s.coins = 20_000_000;
  const a = startDevelopment(s, "towers", undefined, "jazeera");
  const b = startDevelopment(s, "towers", undefined, "khaleej");
  assert.equal(a.ok && b.ok, true);
  if (!a.ok || !b.ok) return;
  assert.equal(a.site.developer, "jazeera");
  assert.ok(
    b.site.completes - b.site.started < a.site.completes - a.site.started,
    "Gulf builds faster",
  );
  // Gulf fails; Al Jazeera's site keeps going.
  s.finance.devDown.khaleej = s.day + 999;
  developmentMonth(s, () => 0.99);
  assert.equal(s.sites.length, 1);
  assert.equal(s.sites[0]!.developer, "jazeera");
  assert.equal(startDevelopment(s, "compound", undefined, "khaleej").ok, false);
  assert.equal(startDevelopment(s, "compound", undefined, "national").ok, true);
});

test("housing support: the city pays part of the rent, people are happier and stay", () => {
  const a = town();
  const b = town();
  a.costs.housing = 200;
  b.costs.housing = 200;
  b.housingAid = 100; // rent-free
  assert.ok(housingAidCost(b) > 0);
  assert.equal(housingAidCost(a), 0);
  assert.ok(stats(b).happy > stats(a).happy, "support lifts approval");
  const coinsA = a.coins;
  const coinsB = b.coins;
  advanceDays(a, 361);
  advanceDays(b, 361);
  assert.ok(b.occupancy >= a.occupancy, "fewer people leave");
  assert.ok(coinsB - b.coins > coinsA - a.coins - 1, "and it is paid from the budget");
  // One-off emergency aid.
  const c = town();
  c.coins = 100_000;
  const before = stats(c).happy;
  assert.equal(giveAid(c, 50_000).ok, true);
  assert.equal(c.coins, 50_000);
  assert.ok(stats(c).happy > before);
  assert.equal(giveAid(c, 1e9).ok, false);
});

test("insurance: premiums rise with the rate and every loss is repaid in full", () => {
  assert.ok(Math.abs(premiumRate(0.1) - 0.002) < 1e-9, "0.2٪ at normal rates");
  assert.ok(Math.abs(premiumRate(0.7) - 0.03) < 0.001, "about 3٪ at 70٪");
  assert.ok(premiumRate(5) > premiumRate(0.7));
  const s = town();
  s.coins = 5_000_000;
  deposit(s, 1_000_000, 0.7);
  buySukuk(s, "islamic", 1_000_000, 0.07, 3);
  assert.equal(setInsurance(s, true).ok, true);
  const premium = monthlyPremium(s);
  assert.ok(premium > 0);
  const before = s.coins;
  // Every company fails this month.
  financeMonth(s, {
    log: () => {},
    handover: () => 0,
    economicCrisis: true,
    war: false,
    random: () => 0,
  });
  assert.equal(s.finance.deposit, 0);
  assert.ok(s.finance.claims > 0, "the insurer paid what the failed companies couldn't");
  assert.ok(s.coins >= before - premium + 2_000_000 - 1);
  // Missed installments are paid by the insurer.
  const l = town();
  takeLoan(l, 1_000_000, 0.2);
  setInsurance(l, true);
  l.coins = 0;
  const debt = l.loan;
  advanceDays(l, 31);
  assert.ok(l.loan < debt, "the installment was paid");
  assert.ok(l.finance.claims > 0);
});

test("laws: funded by amount or share of income, monthly or yearly, with stronger effects", () => {
  const a = town();
  const b = town();
  a.ordinances.education = true;
  b.ordinances.education = true;
  b.lawBudget.education = { mode: "amount", value: 2000, period: "month" };
  assert.ok(lawStrength(b, "education") > lawStrength(a, "education"), "more money, more effect");
  assert.ok(lawStrength(b, "education") <= 3, "capped at 3×");
  assert.ok(stats(b).happy >= stats(a).happy);
  assert.ok(monthlyUpkeep(b) > monthlyUpkeep(a), "monthly funding is charged monthly");
  // Percent of income.
  const p = town();
  p.ordinances.recycling = true;
  p.lawBudget.recycling = { mode: "percent", value: 10, period: "month" };
  assert.ok(lawPayment(p, "recycling") > 0);
  // Yearly: nothing monthly, one payment at year end.
  const y = town();
  y.ordinances.clinicFund = true;
  y.lawBudget.clinicFund = { mode: "amount", value: 12_000, period: "year" };
  const upkeepMonthly = monthlyUpkeep(y);
  const base = town();
  assert.equal(upkeepMonthly, monthlyUpkeep(base), "yearly laws add nothing to the monthly bill");
  assert.ok(lawStrength(y, "clinicFund") > 0);
});

test("25 laws and 25 cost-of-living items, all wired into the city", () => {
  assert.equal(LAW_KEYS.length, 25);
  assert.equal(COST_KEYS.length, 25);
  const s = town();
  assert.equal(costIndex(s), 100, "all items at 100٪ keep the index at 100");
  const crimeBefore = metrics(s).crime;
  s.ordinances.communityWatch = true;
  assert.ok(metrics(s).crime < crimeBefore, "community safety lowers crime");
  const rich = town();
  rich.ordinances.integrity = true;
  const b = rich.buildings.find((x) => CATALOG[x.kind].income > 0)!;
  assert.ok(incomePerSec(b, rich) > incomePerSec(b, town()), "integrity raises all income");
  const fees = feeRevenue(s);
  s.costs.internet = 300;
  assert.ok(feeRevenue(s) > fees, "a new cost item brings in money");
});

test("obligations can be paid one by one or all together, in full or in part", async () => {
  const { obligations, payObligations, totalObligations } = await import("./obligations.ts");
  const { repayMurabaha, takeMurabaha } = await import("./finance.ts");
  const { repayNpc } = await import("./npcs.ts");
  const s = town();
  s.coins = 0;
  assert.equal(takeLoan(s, 100_000, 0.1).ok, true);
  assert.equal(takeMurabaha(s, 50_000, 0.1, 12).ok, true);
  assert.equal(borrowFrom(s, "abufahad", 20_000, 0, 12, () => 0).ok, true);
  assert.equal(obligations(s).length, 3);
  const all = totalObligations(s);
  // Partial payment on one murabaha.
  const m = s.finance.murabaha[0]!;
  const before = m.left;
  assert.equal(repayMurabaha(s, m.id, 5_000).ok, true);
  assert.equal(Math.round(before - s.finance.murabaha[0]!.left), 5_000);
  // Partial payment on a personal debt, then the rest in full.
  assert.equal(repayNpc(s, "abufahad", 4_000).ok, true);
  const owed = s.npcs.find((n) => n.id === "abufahad")!.iOwe.reduce((a, l) => a + l.left, 0);
  assert.equal(Math.round(owed), 16_000);
  // Pay part of everything: the bank loan goes first.
  const loan = s.loan;
  assert.equal(payObligations(s, 30_000).ok, true);
  assert.equal(Math.round(loan - s.loan), 30_000);
  assert.ok(totalObligations(s) < all - 38_000);
  // Pay everything that is left.
  s.coins = 10_000_000;
  assert.equal(payObligations(s).ok, true);
  assert.equal(totalObligations(s), 0);
  assert.equal(payObligations(s).ok, false, "nothing left to pay");
});

test("a selected area is demolished in one go, protected cells stay", async () => {
  const { bulldozeArea, demolishPreview } = await import("./sim.ts");
  const s = town();
  s.coins = 10_000_000;
  const start = s.buildings.length;
  const p = demolishPreview(s, 0, 0, 999, 999);
  assert.ok(p.buildings > 0);
  const coins = s.coins;
  const act = bulldozeArea(s, 0, 0, 999, 999);
  assert.equal(act.ok, true);
  assert.equal(s.buildings.length, start - p.buildings);
  assert.equal(s.coins, coins + p.refund);
  assert.equal(bulldozeArea(s, 0, 0, 999, 999).ok, false, "nothing left to demolish");
});

test("islands are locked until a bridge links them, then they can be built on", async () => {
  const sim = await import("./sim.ts");
  const { ISLANDS, islandAt, ROWS, COLS, FINE_ROW0 } = await import("./land.ts");
  const s = town();
  s.coins = 10_000_000;
  const names = ISLANDS.map((i) => i.name);
  assert.ok(names.includes("جزيرة بوبيان") && names.includes("جزيرة فيلكا"));
  const bubiyan = ISLANDS.find((i) => i.name === "جزيرة بوبيان")!.id;
  // The shortest straight crossing west from Bubiyan's shore to the mainland.
  let best: { r: number; from: number; to: number } | null = null;
  for (let r = 0; r < ROWS; r += 1)
    for (let c = 1; c < COLS; c += 1) {
      if (islandAt(c, r) !== bubiyan || sim.isLand(c - 1, r)) continue;
      let x = c - 1;
      while (x >= 0 && !sim.isLand(x, r)) x -= 1;
      if (x >= 0 && islandAt(x, r) === -1 && (!best || c - x < best.from - best.to))
        best = { r, from: c, to: x };
    }
  assert.ok(best, "Bubiyan has a crossing to the mainland");
  const { r, from, to } = best!;
  assert.equal(sim.islandOpen(s, from, r), false);
  assert.equal(sim.placeBuilding(s, "villa", from, r, 0).ok, false, "locked before the bridge");
  for (let c = to + 1; c < from; c += 1) assert.equal(sim.placeRoad(s, c, r).ok, true, `bridge ${c}`);
  assert.ok(sim.linkedIslands(s).has(bubiyan));
  assert.ok(s.roads.some((k) => sim.isBridge(k)));
  assert.equal(sim.placeRoad(s, from, r).ok, true, "island roads open");
  assert.equal(sim.islandOpen(s, from + 1, r), true, "island lots open");
  // Failaka is still cut off, and a bridge cannot start in open sea.
  const failaka = ISLANDS.find((i) => i.name === "جزيرة فيلكا")!;
  assert.equal(sim.islandOpen(s, Math.round(failaka.c), Math.round(failaka.r)), false);
  assert.equal(sim.placeRoad(s, COLS - 3, FINE_ROW0 + 100).ok, false);
  // Land across the border is never built on.
  assert.equal(sim.placeRoad(s, 5, ROWS - 5).ok, false);
});

test("port, refinery and factories earn money for the treasury", async () => {
  const sim = await import("./sim.ts");
  const { FINE_ROW0, OLD_COL0, ROWS, COLS } = await import("./land.ts");
  const s = town();
  s.coins = 10_000_000;
  const before = sim.monthlyIncome(s);
  // A free lot (on the shore for the port) with a road laid beside it.
  const lot = (needsCoast: boolean) => {
    for (let r = FINE_ROW0; r < ROWS - 1; r += 1)
      for (let c = OLD_COL0; c < COLS; c += 1) {
        if (!sim.isLand(c, r) || !sim.isLand(c, r + 1)) continue;
        if (sim.cellTaken(s, c, r) || sim.cellTaken(s, c, r + 1)) continue;
        if (needsCoast !== sim.coastal(c, r)) continue;
        if (sim.placeRoad(s, c, r + 1).ok) return { c, r };
      }
    throw new Error("no lot");
  };
  for (const [kind, coast] of [
    ["factory", false],
    ["refinery", false],
    ["port", true],
  ] as const) {
    const at = lot(coast);
    const act = sim.placeBuilding(s, kind, at.c, at.r, 0);
    assert.equal(act.ok, true, kind);
  }
  assert.ok(sim.monthlyIncome(s) > before + 40, "industry adds income");
  assert.ok(sim.metrics(s).pollution > 0);
});

test("residents speak up about real problems every month", async () => {
  const sim = await import("./sim.ts");
  const s = town();
  s.tax = 200;
  const said = sim.residentsSpeak(s, () => 0);
  assert.ok(said.length >= 2);
  assert.ok(s.voices.length >= 2);
  assert.ok(s.voices.every((v) => v.name && v.text));
  // The ticker shows the latest voices.
  assert.ok(sim.bulletin(s).some((line) => line.startsWith("💬")));
  for (let i = 0; i < 60; i += 1) sim.residentsSpeak(s);
  assert.ok(s.voices.length <= 80);
});

test("the board of directors runs projects, and in automatic play runs the city and is paid", async () => {
  const sim = await import("./sim.ts");
  const board = await import("./board.ts");
  const s = town();
  s.coins = 2_000_000;
  // A department project, approved by hand: paid now, earns once finished.
  const before = s.coins;
  assert.equal(board.approveProject(s, "eTax").ok, true);
  assert.ok(s.coins < before);
  assert.equal(board.projectMoney(s).income, 0, "nothing until it is finished");
  sim.advanceDays(s, board.PROJECTS.eTax!.months * 30 + 31);
  assert.ok(s.board.projects[0]!.open);
  assert.ok(board.projectMoney(s).income > 0);
  // A project with buildings places them when finished.
  const homes = s.buildings.filter((b) => b.kind === "apartments").length;
  assert.equal(board.approveProject(s, "housing").ok, true);
  sim.advanceDays(s, board.PROJECTS.housing!.months * 30 + 31);
  assert.ok(s.buildings.filter((b) => b.kind === "apartments").length > homes);
  // Automatic play: the board builds and decides, and takes its pay.
  const count = s.buildings.length;
  s.board.auto = true;
  sim.advanceDays(s, 90);
  assert.ok(s.board.log.length > 0, "the board decided things");
  assert.ok(s.board.paid > 0, "the board was paid");
  assert.ok(s.buildings.length >= count);
  // A deficit is covered by the finance director.
  s.coins = -50_000;
  sim.advanceDays(s, 31);
  assert.ok(s.coins >= 0 || s.loan > 0);
  // The governor keeps every power while the board is in charge.
  assert.equal(sim.takeLoan(s, 10_000, 0.05).ok, true);
  // Turning automatic play off stops the pay.
  s.board.auto = false;
  const paid = s.board.paid;
  sim.advanceDays(s, 62);
  assert.equal(s.board.paid, paid);
});
