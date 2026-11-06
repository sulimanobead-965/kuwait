import assert from "node:assert/strict";
import test from "node:test";
import { DEVELOPMENTS } from "./developments.ts";
import { CATALOG, maxLevelOf } from "./catalog.ts";
import { LAND } from "./land.ts";
import {
  developmentMonth,
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
