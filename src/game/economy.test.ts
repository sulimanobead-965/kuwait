import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceDays,
  buyModelArea,
  checkPromotion,
  createInitial,
  createInitialDistrict,
  disasterBill,
  feeRevenue,
  loanInstallment,
  LOAN_LIMIT,
  placeBuilding,
  placeRoad,
  rankOf,
  RANKS,
  repayLoan,
  startEvent,
  stats,
  takeLoan,
  triggerDisaster,
  startCrisis,
  checkAchievements,
  welcomeBack,
  QUESTS,
  isLand,
  coastal,
} from "./sim.ts";
import { buyBond, deposit, financeMonth, startProject } from "./finance.ts";
import { cellsFromSource } from "./land.ts";

const SERVICES = [
  "school",
  "clinic",
  "police",
  "fire",
  "park",
  "park",
  "power",
  "water",
  "power",
  "water",
];

function town(houses = 12, served = true) {
  const s = createInitial();
  s.started = true;
  s.coins = 1e6;
  s.randomDisasters = false;
  s.occupancy = 1;
  let placed = 0;
  for (let c = 51; c < 77 && placed < houses; c += 1) {
    const road = cellsFromSource(c, 30)[0]!;
    const lot = cellsFromSource(c, 31)[0]!;
    placeRoad(s, road.c, road.r);
    if (placeBuilding(s, "apartments", lot.c, lot.r, 0).ok) placed += 1;
  }
  const kinds = served ? SERVICES : ["power", "water", "power", "water"];
  kinds.forEach((kind, i) => {
    const at = cellsFromSource(51 + i, 29)[0]!;
    placeBuilding(s, kind as never, at.c, at.r, 0);
  });
  return s;
}

test("titles climb from assistant to mukhtar to governor", () => {
  assert.deepEqual(
    RANKS.map((r) => r.title),
    ["مساعد المختار", "مختار المنطقة", "المحافظ"],
  );
  assert.equal(rankOf(0), 0);
  assert.equal(rankOf(15_000), 1);
  assert.equal(rankOf(100_000), 2);
  const s = town(16);
  const before = s.coins;
  const up = checkPromotion(s);
  assert.equal(up?.title, "مختار المنطقة");
  assert.ok(s.coins > before);
  assert.equal(checkPromotion(s), null, "a promotion is paid once");
});

test("missing services and high prices lower satisfaction, people, and income", () => {
  const served = town(4);
  const bare = town(4, false);
  assert.ok(stats(served).happy > stats(bare).happy + 15, "services matter");
  const cheap = town(4);
  const pricey = town(4);
  for (const k of Object.keys(pricey.costs) as (keyof typeof pricey.costs)[]) pricey.costs[k] = 200;
  assert.ok(stats(pricey).happy < stats(cheap).happy, "fees matter");
  assert.ok(feeRevenue(pricey) > feeRevenue(cheap), "fees still pay");
  advanceDays(pricey, 360);
  advanceDays(cheap, 360);
  assert.ok(pricey.occupancy < cheap.occupancy, "unhappy residents leave");
  assert.ok(stats(pricey).pop < stats(cheap).pop);
  assert.ok(stats(pricey).mult < stats(cheap).mult, "unhappy cities earn less");
});

test("disasters cost money and loans cover a negative balance", () => {
  const s = town(4);
  s.coins = 500;
  const bill = disasterBill(s, "storm");
  assert.ok(bill > 0);
  assert.equal(triggerDisaster(s, "storm").ok, true);
  assert.equal(s.coins, 500 - bill);
  s.disaster = null;
  assert.equal(triggerDisaster(s, "flood").ok, true);
  assert.ok(s.coins < 0);
  assert.equal(takeLoan(s, 5000).ok, true);
  assert.ok(s.coins > 0);
  assert.ok(s.loan > 5000, "interest is added");
  const debt = s.loan;
  const due = loanInstallment(s);
  advanceDays(s, 31);
  assert.ok(s.loan <= debt - due + 1);
  assert.equal(takeLoan(s, LOAN_LIMIT * 10_000).ok, true, "the bank has no ceiling");
  s.coins = 1e12;
  assert.equal(repayLoan(s, s.loan).ok, true);
  assert.equal(s.loan, 0);
  assert.equal(createInitial().randomDisasters, true, "disasters are on by default");
});

test("model areas and events spend the balance and grow the city", () => {
  const s = createInitialDistrict("yarmouk");
  s.started = true;
  s.coins = 30000;
  const before = s.buildings.length;
  const act = buyModelArea(s, "homes", 0);
  assert.equal(act.ok, true);
  assert.ok(s.buildings.length - before > 10);
  assert.equal(s.coins, 21000);
  const poor = createInitial();
  poor.coins = 10;
  assert.equal(buyModelArea(poor, "market", 0).ok, false);

  const a = town(4);
  const b = town(4);
  const cost = a.coins;
  assert.equal(startEvent(a, "football").ok, true);
  assert.ok(a.coins < cost);
  assert.equal(startEvent(a, "concert").ok, false, "one event at a time");
  assert.ok(stats(a).happy > stats(b).happy);
  assert.ok(stats(a).mult > stats(b).mult);
  advanceDays(a, 60);
  assert.equal(a.event, null);
  assert.ok(a.fame > 0, "events leave a lasting reputation");
});

test("living costs pay the treasury but cost happiness, and are measured yearly", () => {
  const a = town(4);
  const b = town(4);
  b.costs.housing = 200;
  b.costs.education = 200;
  assert.ok(feeRevenue(b) > feeRevenue(a));
  assert.ok(stats(b).happy < stats(a).happy);
  b.autoRaise = 5;
  const housing = b.costs.housing;
  advanceDays(b, 361);
  assert.equal(b.years.length, 1, "one year closed");
  assert.ok(b.years[0]!.residents > 0);
  assert.ok(b.costs.housing > housing, "the yearly raise applies");
});

test("global crises hurt and end; companies pay interest and can go bankrupt", () => {
  const s = town(4);
  const calm = stats(s).mult;
  assert.equal(startCrisis(s, "economic").ok, true);
  assert.ok(stats(s).mult < calm);
  assert.equal(startCrisis(s, "war").ok, false, "one crisis at a time");
  advanceDays(s, 30 * 30);
  assert.equal(s.crisis, null);
  assert.ok(s.flags.includes("crisis-survived"));

  const f = town(4);
  f.coins = 3_000_000;
  assert.equal(deposit(f, 100_000).ok, true);
  assert.equal(buyBond(f, 1).ok, true); // 1,000,000 bank bond
  const coins = f.coins;
  financeMonth(f, {
    log: () => {},
    handover: () => 0,
    economicCrisis: false,
    war: false,
    random: () => 0.99,
  });
  assert.ok(f.finance.deposit > 100_000, "deposit interest");
  assert.ok(f.coins > coins, "bond coupon");
  financeMonth(f, {
    log: () => {},
    handover: () => 0,
    economicCrisis: true,
    war: false,
    random: () => 0,
  });
  assert.equal(f.finance.deposit, 0, "bank failed");
  assert.equal(f.finance.bonds.length, 0);
  assert.ok(f.finance.lost > 0);
  assert.equal(deposit(f, 1000).ok, false, "a bankrupt bank is closed");
  assert.equal(startProject(f, 0).ok, false, "the developer failed in the same crisis month");
});

test("chalets need the sea, landmarks unlock by era, starter towns are seeded", () => {
  const s = createInitial();
  s.coins = 1e6;
  const inland = cellsFromSource(57, 33)[0]!;
  assert.equal(placeBuilding(s, "chalet", inland.c, inland.r, 0).ok, false);
  const shore = (() => {
    for (let r = 0; r < 203; r += 1)
      for (let c = 0; c < 210; c += 1) if (isLand(c, r) && coastal(c, r)) return { c, r };
    return null;
  })()!;
  assert.equal(placeBuilding(s, "chalet", shore.c, shore.r, 0).ok, true);
  const lot = cellsFromSource(67, 33)[0]!;
  assert.equal(placeBuilding(s, "hamra", lot.c, lot.r, 0).ok, false, "era-locked");
  s.quest = QUESTS.length;
  assert.equal(placeBuilding(s, "hamra", lot.c, lot.r, 0).ok, true);
  assert.ok(createInitialDistrict("surra").buildings.length >= 8);
  assert.ok(createInitialDistrict("free").buildings.length >= 8);
  assert.ok(stats(createInitialDistrict("yarmouk")).residents > 1000);
});

test("achievements, daily streaks and offline earnings", () => {
  const s = town(4);
  const got = checkAchievements(s).map((a) => a.name);
  assert.ok(got.includes("أول حجر"));
  assert.equal(checkAchievements(s).length, 0, "each achievement once");
  const day = Date.UTC(2026, 0, 10, 12);
  s.lastSeen = day - 60 * 60_000;
  const first = welcomeBack(s, day);
  assert.ok(first.daily > 0);
  assert.ok(first.offline > 0 && first.months === 6);
  const again = welcomeBack(s, day + 60_000);
  assert.equal(again.daily, 0, "once a day");
  const next = welcomeBack(s, day + 86_400_000);
  assert.equal(next.streak, 2);
});
