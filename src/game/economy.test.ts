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
} from "./sim.ts";
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
  for (let c = 14; c < 40 && placed < houses; c += 1) {
    const road = cellsFromSource(c, 23)[0]!;
    const lot = cellsFromSource(c, 24)[0]!;
    placeRoad(s, road.c, road.r);
    if (placeBuilding(s, "apartments", lot.c, lot.r, 0).ok) placed += 1;
  }
  const kinds = served ? SERVICES : ["power", "water", "power", "water"];
  kinds.forEach((kind, i) => {
    const at = cellsFromSource(14 + i, 22)[0]!;
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
  assert.equal(rankOf(800), 1);
  assert.equal(rankOf(4000), 2);
  const s = town(12);
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
  pricey.fees = 200;
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
  assert.equal(takeLoan(s, LOAN_LIMIT).ok, false, "the bank has a limit");
  s.coins = 1e6;
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
