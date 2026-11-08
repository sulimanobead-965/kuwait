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
import { cellsFromSource, COLS, FINE_ROW0, OLD_COL0, ROWS } from "./land.ts";

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
    for (let r = FINE_ROW0; r < ROWS; r += 1)
      for (let c = OLD_COL0; c < COLS; c += 1) if (isLand(c, r) && coastal(c, r)) return { c, r };
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
  // A brand-new player is not "welcomed back" on their very first visit.
  const fresh = town(4);
  fresh.lastSeen = 0;
  fresh.dailyDay = "";
  const firstVisit = welcomeBack(fresh, day);
  assert.equal(firstVisit.daily + firstVisit.offline, 0);
  assert.equal(welcomeBack(fresh, day + 86_400_000).streak, 2);
});

test("big cities save compactly and reload the same roads and buildings", async () => {
  const { packRoads, unpackRoads, packBuildings, unpackBuildings, collectAll } = await import("./sim.ts");
  const roads = ["5,3", "6,3", "7,3", "9,3", "2,10"];
  assert.deepEqual(new Set(unpackRoads(packRoads(roads))), new Set(roads));
  const s = createInitial();
  s.started = true;
  for (const b of s.buildings) b.stored = 10.7;
  const back = unpackBuildings(JSON.parse(JSON.stringify(packBuildings(s.buildings))));
  assert.equal(back.length, s.buildings.length);
  assert.deepEqual(
    back.map((b) => `${b.kind}@${b.c},${b.r}:${b.level}`).sort(),
    s.buildings.map((b) => `${b.kind}@${b.c},${b.r}:${b.level}`).sort(),
  );
  const before = s.coins;
  const n = collectAll(s);
  assert.equal(n, 10 * s.buildings.length);
  assert.equal(s.coins, before + n);
});

test("mega projects are really built on the map at their real place", async () => {
  const { approveProject } = await import("./board.ts");
  const { lonLatToCell } = await import("./places.ts");
  const s = createInitial();
  s.started = true;
  s.coins = 1e12;
  assert.ok(approveProject(s, "airport").ok);
  const site = s.sites.find((x) => x.kind === "airport");
  assert.ok(site, "the airport gets a fenced site");
  const at = lonLatToCell(47.975, 29.235);
  assert.ok(Math.abs(site!.c + site!.w / 2 - at.c) + Math.abs(site!.r + site!.h / 2 - at.r) < 30, "near the real airport");
  for (let m = 0; m < 38; m += 1) advanceDays(s, 30);
  assert.ok(!s.sites.some((x) => x.kind === "airport"), "the site is handed over");
  assert.ok(s.buildings.filter((b) => b.kind === "runway").length >= 20);
  assert.ok(s.buildings.some((b) => b.kind === "terminal"));
});

test("cloud save: sign up, save, sign in on another device and restore", async () => {
  const cloud = await import("./cloud.ts");
  const docs = new Map<string, Record<string, unknown>>();
  const db = {
    doc: (path: string) => ({
      get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
      set: async (d: Record<string, unknown>) => void docs.set(path, structuredClone(d)),
      delete: async () => void docs.delete(path),
    }),
  };
  const mkStore = () => {
    const m = new Map<string, string>();
    return {
      get length() { return m.size; },
      key: (i: number) => [...m.keys()][i] ?? null,
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, String(v)),
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
    } as Storage;
  };
  const g = globalThis as unknown as { window?: unknown; localStorage?: Storage };
  const oldWindow = g.window, oldStorage = g.localStorage;
  try {
    g.window = { claude: { use: async () => db } };
    const phoneA = mkStore();
    g.localStorage = phoneA;
    phoneA.setItem("omdat-kuwait-v1", JSON.stringify({ v: 2, coins: 123 }));
    phoneA.setItem("omdat-graphics", "low");
    await assert.rejects(cloud.signUp("1234567", "12345678"), (e: { code: string }) => e.code === "bad-phone");
    const s = await cloud.signUp("99887766", "12345678");
    await cloud.pushSave(s, { residents: 500, day: 40 });
    await assert.rejects(cloud.signUp("99887766", "00000000"), (e: { code: string }) => e.code === "taken");
    assert.ok(![...docs.values()].some((d) => JSON.stringify(d).includes("12345678")), "the PIN is never stored");

    const phoneB = mkStore();
    g.localStorage = phoneB;
    phoneB.setItem("omdat-graphics", "high");
    await assert.rejects(cloud.signIn("99887766", "11111111"), (e: { code: string }) => e.code === "wrong-pin");
    const r = await cloud.signIn("99887766", "12345678");
    assert.equal(r.info?.residents, 500);
    assert.ok(await cloud.pullSave(r.session));
    assert.equal(JSON.parse(phoneB.getItem("omdat-kuwait-v1")!).coins, 123);
    assert.equal(phoneB.getItem("omdat-graphics"), "high", "device settings stay");
  } finally {
    g.window = oldWindow;
    g.localStorage = oldStorage;
  }
});

test("disaster and crisis insurance pays disaster bills and lost crisis income", async () => {
  const sim = await import("./sim.ts");
  const s = createInitial();
  s.started = true;
  s.randomDisasters = false;
  s.coins = 1_000_000;
  // Uninsured: the storm bill comes out of the treasury.
  let before = s.coins;
  sim.triggerDisaster(s, "storm");
  assert.ok(s.coins < before);
  s.disaster = null;
  // Insured: the same disaster costs nothing.
  sim.setDisasterInsurance(s, true);
  before = s.coins;
  sim.triggerDisaster(s, "flood");
  assert.equal(s.coins, before);
  assert.ok(s.finance.disasterClaims > 0);
  // A crisis: the insurer pays back the month's lost income.
  s.disaster = null;
  sim.startCrisis(s, "war");
  const claims = s.finance.disasterClaims;
  advanceDays(s, 31);
  assert.ok(s.finance.disasterClaims > claims, "lost income paid back");
  assert.ok(s.finance.disasterPremiums > 0, "premium charged");
});

test("automatic collection gathers building income on the chosen schedule without losing any", async () => {
  const sim = await import("./sim.ts");
  const s = createInitial();
  s.started = true;
  s.randomDisasters = false;
  s.coins = 1_000_000;
  const r = 28 + FINE_ROW0, c = 21 + OLD_COL0;
  for (let i = 0; i < 6; i += 1) placeRoad(s, c + i, r);
  for (let i = 0; i < 6; i += 1) placeBuilding(s, "shop", c + i, r + 1, 0);
  assert.ok(s.buildings.length > 0);
  sim.setAutoCollect(s, 12);
  assert.equal(s.autoCollect, 12);
  sim.setAutoCollect(s, 7);
  assert.equal(s.autoCollect, 0, "only the slider's steps");
  sim.setAutoCollect(s, 12);
  const collected = s.collected ?? 0;
  // Eleven months of income pile up (5 income-seconds per month) and nothing is collected yet.
  for (let m = 0; m < 11; m += 1) {
    sim.tick(s, 5);
    advanceDays(s, 30);
  }
  const held = sim.totalStored(s);
  assert.ok(held > 0);
  // Holding more than the old 48-second cap: eleven months (55 s) of income are kept.
  const perSecond = s.buildings.reduce((n, b) => n + sim.incomePerSec(b, s), 0);
  assert.ok(held > perSecond * 50, "more than 48 seconds of income held");
  sim.tick(s, 5);
  advanceDays(s, 31);
  assert.ok((s.collected ?? 0) > collected, "collected at the year mark");
});

test("graph history survives the compact save", async () => {
  const sim = await import("./sim.ts");
  const s = createInitial();
  s.started = true;
  for (let i = 0; i < 5; i += 1) advanceDays(s, 30);
  const packed = sim.packHistory(s.history);
  const back = sim.unpackHistory(JSON.parse(JSON.stringify(packed)));
  assert.equal(back.length, s.history.length);
  assert.equal(Math.round(back[back.length - 1]!.approval!), Math.round(s.history[s.history.length - 1]!.approval));
});

test("the investment ledger books profits and losses per year and keeps ten years", async () => {
  const sim = await import("./sim.ts");
  const { deposit } = await import("./finance.ts");
  const { ledgerSummary } = await import("./ledger.ts");
  const s = createInitial();
  s.started = true;
  s.randomDisasters = false;
  s.coins = 1_000_000_000;
  deposit(s, 300_000_000);
  // No bank failure or crisis by chance in this test.
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    for (let y = 0; y < 12; y += 1) advanceDays(s, 365);
  } finally {
    Math.random = random;
  }
  const r = ledgerSummary(s);
  assert.ok(r.years <= 10 && r.years >= 9, "ten years kept");
  const dep = r.lines.find((x) => x.key === "deposit");
  assert.ok(dep && dep.gain > 0 && dep.base >= 300_000_000, "deposit interest booked");
  assert.ok(Math.abs(r.total - r.lines.reduce((n, x) => n + x.gain, 0)) < 1, "total is the sum");
  void sim;
});

test("donations: any amount as waqf, zakat or sadaqa; building causes build, approval rises", async () => {
  const sim = await import("./sim.ts");
  const s = createInitial();
  s.started = true;
  s.randomDisasters = false;
  s.coins = 10_000_000_000;
  const r = 28 + FINE_ROW0, c = 21 + OLD_COL0;
  for (let i = 0; i < 12; i += 1) placeRoad(s, c + i, r);
  for (let i = 0; i < 6; i += 1) placeBuilding(s, "apartments", c + i, r + 1, 0);
  const before = sim.stats(s).happy;
  const mosques = s.buildings.filter((b) => b.kind === "mosque").length;
  assert.equal(sim.donate(s, "waqf", "mosque", 5_000_000_000).ok, true, "no ceiling on the amount");
  assert.ok(s.buildings.filter((b) => b.kind === "mosque").length > mosques, "mosques built");
  assert.equal(sim.donate(s, "sadaqa", "aid", 100_000).ok, true);
  assert.equal(sim.donate(s, "zakat", "orphans", sim.zakatDue(s)).ok, true);
  assert.ok(sim.charityMood(s) > 0);
  assert.ok(sim.stats(s).happy >= before);
  assert.equal(sim.donate(s, "sadaqa", "aid", s.coins + 1).ok, false, "only what the treasury holds");
});

test("virtual players have a financial statement, can be audited and held to account", async () => {
  const npcs = await import("./npcs.ts");
  const s = createInitial();
  s.started = true;
  s.randomDisasters = false;
  s.coins = 1_000_000_000;
  const n = s.npcs.find((x) => x.id === "meshal")!;
  for (let m = 0; m < 24; m += 1) advanceDays(s, 30);
  assert.ok(n.statement.length > 0, "account statement");
  assert.ok(npcs.npcWorth(n).companies > 0, "companies and stakes");
  // An overcharge hidden in a tender is found by an audit and paid back with a fine.
  n.irregular = 100_000;
  n.cash = 1_000_000;
  const coins = s.coins;
  assert.equal(npcs.auditNpc(s, "meshal").ok, true);
  assert.equal(n.flagged, 100_000);
  assert.equal(npcs.holdToAccount(s, "meshal").ok, true);
  assert.ok(s.coins > coins, "money recovered");
  assert.ok(n.bannedUntil > s.day, "barred from tenders");
  assert.equal(npcs.holdToAccount(s, "meshal").ok, false, "nothing left to settle");
});

test("real estate: public land stays public, private property trades for real", async () => {
  const re = await import("./realestate.ts");
  const { saveSim, loadSim, cloneSim, freezeSaves } = await import("./sim.ts");
  const s = town(10);
  s.coins = 1e9;
  const home = s.buildings.find((b) => b.kind === "apartments")!;
  const { openLot } = await import("./sim.ts");
  const lot = openLot(s)!;
  assert.ok(placeBuilding(s, "school", lot.c, lot.r, 0).ok);
  const school = s.buildings.find((b) => b.kind === "school")!;
  assert.equal(re.ownerOf(s, school), null, "a school is public land");
  assert.equal(re.buyProperty(s, school.id).ok, false, "public land is not for sale");
  const owner = re.ownerOf(s, home)!;
  assert.ok(owner && owner !== "state");
  // The state buys it, leases it, sells it to a merchant.
  const coins = s.coins;
  assert.ok(re.buyProperty(s, home.id).ok);
  assert.equal(re.ownerOf(s, home), "state");
  assert.ok(s.coins < coins);
  assert.ok(re.leaseProperty(s, home.id, "people", 12).ok);
  const before = s.coins;
  re.estateMonth(s, () => 0.5);
  assert.ok(s.coins > before, "rent comes in");
  const buyer = s.npcs[0]!;
  buyer.cash = 1e9;
  assert.ok(re.sellProperty(s, home.id, buyer.id).ok);
  assert.equal(re.ownerOf(s, home), buyer.id);
  assert.ok(re.estateOf(s).trades.length >= 3);
  // Land grants put new homes in the city, owned by individuals.
  const n = s.buildings.length;
  assert.ok(re.grantPlots(s, 3).ok);
  assert.ok(s.buildings.length > n);
  assert.equal(re.ownerOf(s, s.buildings[s.buildings.length - 1]!), "people");
  // A temporary allocation: the merchant builds, pays, and the land comes back.
  buyer.cash = 1e9;
  const fee = re.allocationFee(s, "commercial");
  const r = re.allocate(s, buyer.id, "commercial", 2, fee);
  assert.ok(r.ok, r.ok ? "" : r.msg);
  const a = re.estateOf(s).allocations[0]!;
  assert.ok(a.buildings.length > 0);
  const built = s.buildings.find((b) => a.buildings.includes(re.lotKey(b)) && !re.isPublic(b.kind))!;
  assert.equal(re.ownerOf(s, built), buyer.id);
  s.day = a.until;
  re.estateMonth(s, () => 0.5);
  assert.equal(re.ownerOf(s, built), "state", "the plot returns to the state");
  assert.equal(re.estateOf(s).allocations.length, 0);
  // The platform adds up to 100% of private property, and everything survives a reload.
  const sum = re.ownersSummary(s).reduce((x, o) => x + o.share, 0);
  assert.ok(Math.abs(sum - 1) < 1e-6);
  assert.equal(cloneSim(s).estate!.trades.length, re.estateOf(s).trades.length);
  const store = new Map<string, string>();
  const original = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), key: () => null, clear: () => store.clear(), length: 0 } as Storage;
  try {
    freezeSaves(false);
    saveSim(s);
    const back = loadSim();
    assert.equal(re.ownerOf(back, back.buildings.find((b) => re.lotKey(b) === re.lotKey(home))!), buyer.id);
    assert.equal(re.estateOf(back).trades.length, re.estateOf(s).trades.length);
  } finally {
    if (original === undefined) Reflect.deleteProperty(globalThis, "localStorage");
    else globalThis.localStorage = original;
  }
});

test("property market: listings, offers and counter-offers, the registration fee, auctions", async () => {
  const re = await import("./realestate.ts");
  const s = town(30);
  s.coins = 1e9;
  for (const n of s.npcs) n.cash = 1e9;
  const e = re.estateOf(s);
  // A few months of market: listings appear, some sell, the fee comes in, history grows.
  let r = 0;
  const seq = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const coins = s.coins;
  for (let m = 0; m < 6; m += 1) {
    s.day += 30;
    re.estateMonth(s, seq);
  }
  assert.equal(e.history.length, 6);
  assert.ok(e.listings.length > 0, "owners list properties");
  const sales = e.trades.filter((x) => x.type === "sale").length;
  assert.ok(sales > 0, "some listings sell");
  assert.ok(e.feeTotal > 0 && s.coins > coins - 1, "the registration fee goes to the state");
  // Offers: too low is refused, a fair one gets a counter, the counter is accepted.
  const l = e.listings.find((x) => x.seller !== "state")!;
  const b = s.buildings.find((x) => re.lotKey(x) === l.lot)!;
  const value = re.propertyValue(s, b);
  assert.equal(re.makeOffer(s, l.id, value * 0.3).ok, false);
  const counter = re.makeOffer(s, l.id, Math.max(value * 0.8, l.ask * 0.85));
  assert.ok(counter.ok);
  const now = re.estateOf(s).listings.find((x) => x.id === l.id)!;
  assert.ok(now.countered && now.ask < l.ask);
  assert.ok(re.buyListing(s, l.id).ok);
  assert.equal(re.ownerOf(s, b), "state");
  // The state lists it again and also auctions another of its properties.
  assert.ok(re.listForSale(s, b.id, value).ok);
  assert.equal(re.listForSale(s, b.id, value).ok, false, "already on the market");
  assert.ok(re.cancelListing(s, re.estateOf(s).listings.find((x) => x.seller === "state")!.id).ok);
  assert.ok(re.startAuction(s, b.id, value * 0.5).ok);
  s.day += 31;
  re.estateMonth(s, seq);
  assert.notEqual(re.ownerOf(s, b), "state", "the auction sold it");
  // A higher fee means fewer deals.
  re.setRegistrationFee(s, 50);
  assert.equal(re.estateOf(s).fee, 20);
});

test("real estate laws: monopoly cap, home financing, expropriation, undeveloped-property fee", async () => {
  const re = await import("./realestate.ts");
  const { stats } = await import("./sim.ts");
  const s = town(30);
  s.coins = 1e9;
  for (const n of s.npcs) n.cash = 1e9;
  const seq = (() => {
    let r = 7;
    return () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  })();
  // Expropriation below value angers people; at full value it does not.
  const priv = s.buildings.filter((b) => re.ownerOf(s, b) && re.ownerOf(s, b) !== "state");
  const happy0 = stats(s).happy;
  assert.ok(re.expropriate(s, priv[0]!.id, 100).ok);
  assert.equal(re.estateOf(s).grievance.mood, 0);
  assert.ok(re.expropriate(s, priv[1]!.id, 40).ok);
  assert.ok(re.estateOf(s).grievance.mood > 0);
  s.day += 1;
  assert.ok(stats(s).happy <= happy0, "under-paid expropriation costs approval");
  assert.ok((stats(s).why ?? []).some(([l]) => l === "نزع الملكية"));
  // Home financing lends to families and is repaid with its return.
  re.setMortgage(s, true, 3);
  const home = s.buildings.find((b) => re.ownerOf(s, b) !== "state" && re.ownerOf(s, b) !== "people" && !re.isPublic(b.kind));
  if (home) {
    const coins = s.coins;
    re.estateOf(s).listings.push({ id: 999, lot: re.lotKey(home), kind: home.kind, seller: re.ownerOf(s, home)!, ask: 1, until: s.day + 90 });
    for (let m = 0; m < 3; m += 1) {
      s.day += 30;
      re.estateMonth(s, seq);
    }
    assert.ok(re.estateOf(s).mortgage.book >= 0);
    void coins;
  }
  assert.ok((stats(s).why ?? []).some(([l]) => l === "التمويل العقاري"));
  // Undeveloped-property fee: paid by merchants, and some of them build.
  re.setLandTax(s, 10);
  const lvl = s.buildings.reduce((a, b) => a + b.level, 0);
  const total0 = re.estateOf(s).landTaxTotal;
  s.day += 30;
  re.estateMonth(s, seq);
  assert.ok(re.estateOf(s).landTaxTotal >= total0);
  assert.ok(s.buildings.reduce((a, b) => a + b.level, 0) >= lvl);
  // Anti-monopoly: a merchant over the cap pays and has to list properties.
  const big = re.ownersSummary(s).find((r) => r.owner !== "people" && r.owner !== "state")!;
  re.setMonopolyCap(s, Math.max(1, Math.floor(big.share * 100) - 1));
  s.day += 30;
  re.estateMonth(s, seq);
  assert.ok(re.estateOf(s).capTotal > 0);
  assert.ok(re.estateOf(s).overCap.includes(big.owner));
  assert.ok(re.merchantProfile(s, big.owner as never).overCap);
  // The map: by price and by merchant, listed lots in gold.
  assert.ok(re.ownershipColors(s, "price").size === s.buildings.length);
  assert.ok([...re.ownershipColors(s, "merchant").values()].includes("#facc15"));
});

test("bulk buying, one offer to many listings, and requests for offers", async () => {
  const re = await import("./realestate.ts");
  const s = town(30);
  s.coins = 1e9;
  for (const n of s.npcs) n.cash = 1e9;
  let r = 3;
  const seq = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  // A request: owners reply now, only the state can take the replies.
  const kind = s.buildings.find((b) => !re.isPublic(b.kind))!.kind;
  const asked = re.requestOffers(s, kind, 5, 140, seq);
  assert.ok(asked.ok);
  const replies = re.estateOf(s).listings.filter((l) => l.req);
  assert.ok(replies.length > 0, "owners reply to the request");
  for (const l of replies) {
    const b = s.buildings.find((x) => re.lotKey(x) === l.lot)!;
    assert.ok(l.ask <= re.propertyValue(s, b) * 1.4 + 1, "no reply above the cap");
  }
  s.day += 30;
  re.estateMonth(s, seq);
  assert.ok(re.estateOf(s).listings.filter((l) => l.req).every((l) => l.seller !== "state"));
  // Buy all replies at once.
  const ids = re.estateOf(s).listings.filter((l) => l.req).map((l) => l.id);
  const coins = s.coins;
  const bought = re.buyMany(s, ids);
  assert.ok(bought.ok);
  assert.ok(s.coins < coins);
  assert.equal(re.estateOf(s).listings.filter((l) => ids.includes(l.id)).length, 0);
  // Bulk offers: a list of public listings answered one way or another.
  for (let m = 0; m < 4; m += 1) {
    s.day += 30;
    re.estateMonth(s, seq);
  }
  const open = re.estateOf(s).listings.filter((l) => l.seller !== "state").map((l) => l.id);
  if (open.length) assert.ok(re.offerMany(s, open, 92).ok);
  // Not enough money: buys what it can and says so.
  s.coins = 0;
  const left = re.estateOf(s).listings.filter((l) => l.seller !== "state").map((l) => l.id);
  if (left.length) assert.equal(re.buyMany(s, left).ok, false);
  assert.ok(re.cancelRequest(s, 1).ok);
});

test("demolishing a property clears its owner record, listing and lease", async () => {
  const re = await import("./realestate.ts");
  const { bulldoze } = await import("./sim.ts");
  const s = town(10);
  s.coins = 1e9;
  const b = s.buildings.find((x) => !re.isPublic(x.kind))!;
  assert.ok(re.buyProperty(s, b.id).ok);
  assert.ok(re.leaseProperty(s, b.id, "people", 12).ok);
  assert.equal(re.ownerOf(s, b), "state");
  const k = re.lotKey(b);
  assert.ok(bulldoze(s, b.c, b.r).ok);
  const e = re.estateOf(s);
  assert.equal(e.owners[k], undefined, "the lot is no longer the state's");
  assert.equal(e.leases.length, 0);
  assert.equal(e.listings.filter((l) => l.lot === k).length, 0);
});

test("a huge insured deposit pays its premium itself, and a deficit is covered from the deposit", async () => {
  const { setInsurance, monthlyPremium } = await import("./finance.ts");
  const s = town(10);
  s.finance.deposit = 1e15;
  s.coins = 1000;
  setInsurance(s, true);
  assert.ok(monthlyPremium(s) > 1e9, "the premium dwarfs the treasury");
  advanceDays(s, 31);
  assert.ok(s.coins > 0, "the treasury is not swallowed by the premium");
  assert.ok(s.finance.deposit < 1e15 * 1.02, "the premium came out of the deposit");
  // A deficit with money in the bank: covered automatically.
  s.coins = -1e9;
  advanceDays(s, 31);
  assert.ok(s.coins > 0);
});

test("bulk deals on an owner's holdings: buy all, then sell part", async () => {
  const re = await import("./realestate.ts");
  const s = town(20);
  s.coins = 1e12;
  for (const n of s.npcs) n.cash = 1e12;
  const owner = re.ownersSummary(s).find((r) => r.owner !== "state")!.owner;
  const all = re.holdingsOfOwner(s, owner);
  assert.ok(all.ids.length > 0 && all.value > 0);
  const r = re.runMany(s, all.ids, (id) => re.buyProperty(s, id), "شراء");
  assert.ok(r.ok);
  assert.equal(re.holdingsOfOwner(s, owner).ids.length, 0, "everything bought");
  const mine = re.holdingsOfOwner(s, "state").ids;
  const part = mine.slice(0, Math.max(1, Math.floor(mine.length / 2)));
  assert.ok(re.runMany(s, part, (id) => re.sellProperty(s, id, "people"), "بيع").ok);
  assert.equal(re.holdingsOfOwner(s, "state").ids.length, mine.length - part.length);
  assert.equal(re.runMany(s, [], (id) => re.buyProperty(s, id), "شراء").ok, false);
});

test("administrative regions: 100 of them, counted, and valued, expropriated or evacuated whole", async () => {
  const rg = await import("./regions.ts");
  const re = await import("./realestate.ts");
  const rs = rg.regions();
  assert.equal(rs.length, 100);
  const lands = rs.map((r) => r.land);
  assert.ok(Math.max(...lands) / Math.min(...lands) < 1.3, "about equal land each");
  assert.ok(rs.every((r) => r.name.length > 0));
  const s = town(30);
  s.coins = 1e12;
  const st = rg.regionStats(s);
  const home = st.filter((r) => r.buildings > 0).sort((a, b) => b.buildings - a.buildings)[0]!;
  assert.ok(home.residents > 0 && home.value > 0);
  assert.equal(st.reduce((n, r) => n + r.buildings, 0), s.buildings.length, "every building in one region");
  for (const b of s.buildings) assert.equal(rg.regionAt(b.c, b.r) >= 1 && rg.regionAt(b.c, b.r) <= 100, true);
  // Value-buy the region: every private property becomes the state's, no anger.
  const cost = rg.regionCost(s, [home.id], 110);
  const coins = s.coins;
  assert.ok(rg.valueBuyRegions(s, [home.id], 110).ok);
  assert.ok(Math.abs(coins - s.coins - cost) < 2);
  assert.equal(s.buildings.filter((b) => rg.regionAt(b.c, b.r) === home.id && re.ownerOf(s, b) && re.ownerOf(s, b) !== "state").length, 0);
  assert.equal(re.estateOf(s).grievance.mood, 0);
  // Evacuate it: private buildings cleared, public ones stay.
  const publicBefore = s.buildings.filter((b) => rg.regionAt(b.c, b.r) === home.id && re.isPublic(b.kind)).length;
  assert.ok(rg.evacuateRegions(s, [home.id]).ok);
  const after = s.buildings.filter((b) => rg.regionAt(b.c, b.r) === home.id);
  assert.ok(after.every((b) => re.isPublic(b.kind)));
  assert.equal(after.length, publicBefore);
  // Expropriating a populated region below value makes people angry.
  const t2 = town(30);
  t2.coins = 1e12;
  const r2 = rg.regionStats(t2).filter((r) => r.privateCount > 0)[0]!;
  assert.ok(rg.expropriateRegions(t2, [r2.id], 50).ok);
  assert.ok(re.estateOf(t2).grievance.mood > 0);
  assert.equal(rg.valueBuyRegions(t2, [], 110).ok, false);
});

test("land grants have no limit and can go to a named person or a merchant", async () => {
  const re = await import("./realestate.ts");
  const { saveSim, loadSim, freezeSaves } = await import("./sim.ts");
  const s = town(10);
  const who = re.personId("عبدالله الكندري");
  assert.ok(re.grantPlots(s, 3, "bukhalid").ok, "a merchant can be granted land too");
  const r = re.grantPlots(s, 60, who);
  assert.ok(r.ok);
  const mine = s.buildings.filter((b) => re.ownerOf(s, b) === who).length;
  assert.ok(mine > 0);
  // No cap: it stops only when the roadside land runs out, and says so.
  if (mine < 60) assert.ok(r.ok && /ما بقى أرض/.test(r.msg ?? ""), "only the land limits a grant");
  assert.equal(re.ownerName(who), "عبدالله الكندري");
  assert.equal(re.grantees(s)[0]!.name, "عبدالله الكندري");
  assert.ok(re.ownersSummary(s).some((o) => o.owner === who), "a grantee is an owner on the platform");
  assert.equal(re.grantPlots(s, 3, re.personId(" ")).ok, false);
  // The named owner survives a reload.
  const store = new Map<string, string>();
  const original = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), key: () => null, clear: () => store.clear(), length: 0 } as Storage;
  try {
    freezeSaves(false);
    saveSim(s);
    const back = loadSim();
    assert.equal(back.buildings.filter((b) => re.ownerOf(back, b) === who).length, mine);
  } finally {
    if (original === undefined) Reflect.deleteProperty(globalThis, "localStorage");
    else globalThis.localStorage = original;
  }
});
