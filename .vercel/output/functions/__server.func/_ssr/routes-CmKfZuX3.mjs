import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { _ as FastForward, a as Volume2, b as ChevronsRight, c as Route, d as Play, f as Pause, g as Flame, h as Landmark, i as VolumeX, l as RotateCcw, m as LayoutGrid, n as ZapOff, p as Minus, r as X, s as Trash2, t as Zap, u as Plus, v as Dices, x as Check, y as Cloud } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CmKfZuX3.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var CATALOG = {
	villa: {
		kind: "villa",
		name: "فيلا",
		blurb: "بيت كويتي بفناء",
		cost: 280,
		cat: "housing",
		pop: 12,
		income: 2.4,
		powerUse: 1,
		powerGive: 0,
		waterUse: 1,
		waterGive: 0,
		happy: 1,
		needsRoad: true,
		needsPop: 0,
		coastBoost: true,
		scale: 1.16
	},
	apartments: {
		kind: "apartments",
		name: "عمارة",
		blurb: "سكن أكثف للحي",
		cost: 760,
		cat: "housing",
		pop: 34,
		income: 4.2,
		powerUse: 3,
		powerGive: 0,
		waterUse: 2,
		waterGive: 0,
		happy: 0,
		needsRoad: true,
		needsPop: 0,
		coastBoost: true,
		scale: 1.2
	},
	shop: {
		kind: "shop",
		name: "محل السوق",
		blurb: "تجارة، وتبي سكان",
		cost: 460,
		cat: "commerce",
		pop: 0,
		income: 3.6,
		powerUse: 2,
		powerGive: 0,
		waterUse: 1,
		waterGive: 0,
		happy: 2,
		needsRoad: true,
		needsPop: 24,
		coastBoost: true,
		scale: 1.18
	},
	tower: {
		kind: "tower",
		name: "برج مكاتب",
		blurb: "إيراد عالٍ بعد ما تكبر",
		cost: 1500,
		cat: "commerce",
		pop: 0,
		income: 6.5,
		powerUse: 4,
		powerGive: 0,
		waterUse: 2,
		waterGive: 0,
		happy: 1,
		needsRoad: true,
		needsPop: 70,
		coastBoost: false,
		scale: .92
	},
	power: {
		kind: "power",
		name: "محطة كهرباء",
		blurb: "تغذي البيوت والمكاتب",
		cost: 900,
		cat: "services",
		pop: 0,
		income: 0,
		powerUse: 0,
		powerGive: 16,
		waterUse: 0,
		waterGive: 0,
		happy: -7,
		needsRoad: false,
		needsPop: 0,
		coastBoost: false,
		scale: 1.28
	},
	water: {
		kind: "water",
		name: "محطة تحلية",
		blurb: "ماء عذب للمدينة",
		cost: 820,
		cat: "services",
		pop: 0,
		income: 0,
		powerUse: 1,
		powerGive: 0,
		waterUse: 0,
		waterGive: 18,
		happy: -2,
		needsRoad: false,
		needsPop: 0,
		coastBoost: false,
		scale: 1.26
	},
	police: {
		kind: "police",
		name: "مركز شرطة",
		blurb: "أمان يرفع السعادة",
		cost: 540,
		cat: "services",
		pop: 0,
		income: 0,
		powerUse: 1,
		powerGive: 0,
		waterUse: 0,
		waterGive: 0,
		happy: 12,
		needsRoad: false,
		needsPop: 0,
		coastBoost: false,
		scale: 1.12
	},
	clinic: {
		kind: "clinic",
		name: "مستوصف",
		blurb: "صحة الحي",
		cost: 520,
		cat: "services",
		pop: 0,
		income: 0,
		powerUse: 1,
		powerGive: 0,
		waterUse: 1,
		waterGive: 0,
		happy: 12,
		needsRoad: false,
		needsPop: 0,
		coastBoost: false,
		scale: 1.12
	},
	park: {
		kind: "park",
		name: "حديقة",
		blurb: "نخيل وظل على الكورنيش",
		cost: 180,
		cat: "services",
		pop: 0,
		income: 0,
		powerUse: 0,
		powerGive: 0,
		waterUse: 1,
		waterGive: 0,
		happy: 9,
		needsRoad: false,
		needsPop: 0,
		coastBoost: false,
		scale: 1.18
	},
	kuwait: {
		kind: "kuwait",
		name: "أبراج الكويت",
		blurb: "معلم البلد والسياح",
		cost: 2800,
		cat: "landmarks",
		pop: 0,
		income: 4.8,
		powerUse: 2,
		powerGive: 0,
		waterUse: 1,
		waterGive: 0,
		happy: 18,
		needsRoad: false,
		needsPop: 0,
		coastBoost: true,
		scale: .95
	},
	mosque: {
		kind: "mosque",
		name: "المسجد الكبير",
		blurb: "قلب المدينة",
		cost: 2400,
		cat: "landmarks",
		pop: 0,
		income: 1.6,
		powerUse: 1,
		powerGive: 0,
		waterUse: 1,
		waterGive: 0,
		happy: 16,
		needsRoad: false,
		needsPop: 0,
		coastBoost: false,
		scale: 1.42
	},
	liberation: {
		kind: "liberation",
		name: "برج التحرير",
		blurb: "برج الاتصالات",
		cost: 2300,
		cat: "landmarks",
		pop: 0,
		income: 3.8,
		powerUse: 2,
		powerGive: 0,
		waterUse: 0,
		waterGive: 0,
		happy: 14,
		needsRoad: false,
		needsPop: 0,
		coastBoost: false,
		scale: .58
	},
	palace: {
		kind: "palace",
		name: "قصر السيف",
		blurb: "قصر الإمارة على الساحل",
		cost: 2100,
		cat: "landmarks",
		pop: 0,
		income: 3.1,
		powerUse: 2,
		powerGive: 0,
		waterUse: 1,
		waterGive: 0,
		happy: 14,
		needsRoad: false,
		needsPop: 0,
		coastBoost: true,
		scale: 1.48
	}
};
var KINDS = Object.keys(CATALOG);
function kindsIn(cat) {
	return KINDS.map((k) => CATALOG[k]).filter((d) => d.cat === cat);
}
var WORLD_W = 2400;
var WORLD_H = 1600;
var LAND = [
	[
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	],
	[
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	],
	[
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	],
	[
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	],
	[
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	],
	[
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	],
	[
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	],
	[
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	],
	[
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	],
	[
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	],
	[
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	],
	[
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	],
	[
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	],
	[
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	],
	[
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	],
	[
		1,
		1,
		1,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		0,
		0,
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	],
	[
		1,
		0,
		0,
		1,
		1,
		1,
		0,
		0,
		0,
		0,
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		1,
		1,
		1,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		1
	],
	[
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		0,
		0,
		0,
		1,
		1,
		0,
		1,
		1,
		0,
		1,
		1,
		1,
		1,
		0,
		0,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		0,
		1,
		0,
		1,
		1,
		0,
		1,
		0,
		1,
		0
	],
	[
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		1,
		0,
		1,
		0,
		0,
		0,
		0,
		1,
		0,
		0,
		0,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		0,
		1,
		1,
		1,
		1,
		1
	],
	[
		1,
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1
	],
	[
		1,
		1,
		1,
		1,
		1,
		1,
		0,
		1,
		1,
		0,
		0,
		0,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1
	],
	[
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		0,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1
	],
	[
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1
	],
	[
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1
	],
	[
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1
	],
	[
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1
	],
	[
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1
	],
	[
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1
	],
	[
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1
	],
	[
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1
	],
	[
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1
	],
	[
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1
	]
];
var SAVE_KEY = "omdat-kuwait-v1";
var DIRS = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1]
];
var EPOCH = Date.UTC(1961, 1, 13);
function cellKey(c, r) {
	return `${c},${r}`;
}
function clamp(n, a, b) {
	return Math.max(a, Math.min(b, n));
}
function formatCityDate(day) {
	const d = new Date(EPOCH + Math.floor(day) * 864e5);
	return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${d.getUTCFullYear()}`;
}
function emptyOrdinances() {
	return {
		education: false,
		recycling: false,
		carpool: false,
		clinicFund: false,
		smokeBan: false
	};
}
function priceOf(base, s) {
	if (s.difficulty === "easy") return 0;
	if (s.difficulty === "medium") return Math.max(0, Math.round(base * .55));
	return Math.max(0, Math.round(base));
}
function routeOnLand(c0, r0, c1, r1) {
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	const push = (c, r) => {
		if (!isLand(c, r) || seen.has(cellKey(c, r))) return;
		seen.add(cellKey(c, r));
		out.push({
			c,
			r
		});
	};
	if (!isLand(c0, r0)) {
		if (isLand(c1, r1)) push(c1, r1);
		return out;
	}
	let c = c0;
	let r = r0;
	push(c, r);
	let guard = 0;
	while ((c !== c1 || r !== r1) && guard < 120) {
		guard += 1;
		const dc = Math.sign(c1 - c);
		const dr = Math.sign(r1 - r);
		const options = [];
		if (dc !== 0 && dr !== 0) options.push([dc, 0], [0, dr], [dc, dr]);
		else if (dc !== 0) options.push([dc, 0], [dc, -1], [dc, 1], [0, -1], [0, 1]);
		else if (dr !== 0) options.push([0, dr], [-1, dr], [1, dr], [-1, 0], [1, 0]);
		let moved = false;
		for (const [sc, sr] of options) {
			const nc = c + sc;
			const nr = r + sr;
			if (!isLand(nc, nr) || seen.has(cellKey(nc, nr))) continue;
			c = nc;
			r = nr;
			push(c, r);
			moved = true;
			break;
		}
		if (!moved) break;
	}
	return out;
}
function isLand(c, r) {
	if (c < 0 || r < 0 || c >= 48 || r >= 32) return false;
	return LAND[r]?.[c] === 1;
}
function isWater(c, r) {
	if (c < 0 || r < 0 || c >= 48 || r >= 32) return false;
	return LAND[r]?.[c] === 0;
}
function coastal(c, r) {
	return DIRS.some(([dc, dr]) => isWater(c + dc, r + dr));
}
function createInitial() {
	const s = {
		coins: 3200,
		roads: [],
		buildings: [],
		quest: 0,
		mute: false,
		started: false,
		day: 0,
		speed: 1,
		tax: 7,
		ordinances: emptyOrdinances(),
		disaster: null,
		randomDisasters: false,
		log: [],
		history: [],
		difficulty: "medium",
		luckAt: 0
	};
	s.history.push(takeSample(s));
	return s;
}
function cloneSim(s) {
	return {
		...s,
		roads: [...s.roads],
		buildings: s.buildings.map((b) => ({ ...b })),
		ordinances: { ...s.ordinances },
		disaster: s.disaster ? { ...s.disaster } : null,
		log: [...s.log],
		history: s.history
	};
}
function countKind(s, kind) {
	return s.buildings.filter((b) => b.kind === kind).length;
}
var QUESTS = [
	{
		text: "ارصف ١٦ طرق",
		reward: 500,
		total: 16,
		progress: (s) => Math.min(16, s.roads.length),
		done: (s) => s.roads.length >= 16
	},
	{
		text: "ابنِ ٣ فلل",
		reward: 600,
		total: 3,
		progress: (s) => Math.min(3, countKind(s, "villa")),
		done: (s) => countKind(s, "villa") >= 3
	},
	{
		text: "وفّر كهرباء وماء",
		reward: 900,
		total: 2,
		progress: (s) => (countKind(s, "power") > 0 ? 1 : 0) + (countKind(s, "water") > 0 ? 1 : 0),
		done: (s) => countKind(s, "power") > 0 && countKind(s, "water") > 0
	},
	{
		text: "ارفع معلماً كويتياً",
		reward: 1200,
		total: 1,
		progress: (s) => s.buildings.some((b) => [
			"kuwait",
			"mosque",
			"liberation",
			"palace"
		].includes(b.kind)) ? 1 : 0,
		done: (s) => s.buildings.some((b) => [
			"kuwait",
			"mosque",
			"liberation",
			"palace"
		].includes(b.kind))
	},
	{
		text: "أوصل السكان إلى ٢٠٠",
		reward: 2e3,
		total: 200,
		progress: (s) => Math.min(200, stats(s).pop),
		done: (s) => stats(s).pop >= 200
	}
];
function stats(s) {
	let pop = 0;
	let happy = 52;
	let powerUse = 0;
	let powerGive = 0;
	let waterUse = 0;
	let waterGive = 0;
	let police = 0;
	for (const b of s.buildings) {
		const d = CATALOG[b.kind];
		const lv = b.level;
		pop += d.pop * lv;
		powerUse += d.powerUse * lv;
		waterUse += d.waterUse * lv;
		powerGive += Math.round(d.powerGive * (1 + (lv - 1) * .45));
		waterGive += Math.round(d.waterGive * (1 + (lv - 1) * .45));
		happy += d.happy + Math.sign(d.happy) * (lv - 1) * 2;
		if (b.kind === "police") police += 1;
	}
	if (s.disaster?.kind === "blackout" && s.day < s.disaster.until) powerGive = 0;
	const grace = pop < 20;
	const shortP = !grace && powerUse > powerGive;
	const shortW = !grace && waterUse > waterGive;
	if (shortP) happy -= 18;
	if (shortW) happy -= 14;
	if (pop >= 48 && police === 0) happy -= 10;
	if (s.tax > 8) happy -= (s.tax - 8) * 2.5;
	if (s.tax < 5) happy += 5;
	if (s.ordinances.education) happy += 3;
	if (s.ordinances.recycling) happy += 2;
	if (s.disaster?.kind === "storm" && s.day < s.disaster.until) happy -= 14;
	happy = clamp(Math.round(happy), 6, 100);
	const utilP = powerUse === 0 || grace ? 1 : Math.min(1, powerGive / powerUse);
	const utilW = waterUse === 0 || grace ? 1 : Math.min(1, waterGive / waterUse);
	const util = Math.min(utilP, utilW);
	const utilFactor = util >= .999 ? 1 : .22 + util * .78;
	const mult = (.64 + happy / 100 * .66) * utilFactor;
	return {
		pop,
		happy,
		powerUse,
		powerGive,
		waterUse,
		waterGive,
		mult,
		short: shortP || shortW
	};
}
function roadSet(s) {
	return new Set(s.roads);
}
function besideRoad(c, r, roads) {
	return DIRS.some(([dc, dr]) => roads.has(cellKey(c + dc, r + dr)));
}
function incomePerSec(b, s, st = stats(s)) {
	const d = CATALOG[b.kind];
	if (d.income <= 0) return 0;
	if (d.needsRoad && !besideRoad(b.c, b.r, roadSet(s))) return 0;
	let v = d.income * (1 + (b.level - 1) * .62);
	if (d.needsPop > 0 && st.pop < d.needsPop) v *= .35;
	if (d.coastBoost && coastal(b.c, b.r)) v *= 1.15;
	if (s.ordinances.smokeBan && (b.kind === "shop" || b.kind === "tower")) v *= .9;
	const tax = .62 + clamp(s.tax, 0, 20) / 20 * 1.1;
	return v * st.mult * tax;
}
function blockReason(b, s, st = stats(s)) {
	const d = CATALOG[b.kind];
	if (d.income <= 0) return null;
	if (d.needsRoad && !besideRoad(b.c, b.r, roadSet(s))) return "ارصف طريقاً بجانبه عشان ينتج";
	if (st.short) return "الكهرباء أو الماء ناقص";
	if (d.needsPop > 0 && st.pop < d.needsPop) return `يحتاج ${d.needsPop} ساكن`;
	return null;
}
function tick(s, dt) {
	if (!s.started || dt <= 0) return;
	const st = stats(s);
	for (const b of s.buildings) {
		const rate = incomePerSec(b, s, st);
		if (rate <= 0) continue;
		const cap = rate * 48;
		b.stored = Math.min(cap, b.stored + rate * dt);
	}
}
function totalStored(s) {
	return s.buildings.reduce((n, b) => n + Math.floor(b.stored), 0);
}
function collectOne(s, id) {
	const b = s.buildings.find((x) => x.id === id);
	if (!b) return 0;
	const n = Math.floor(b.stored);
	if (n <= 0) return 0;
	b.stored -= n;
	s.coins += n;
	return n;
}
function collectAll(s) {
	let n = 0;
	for (const b of s.buildings) n += collectOne(s, b.id);
	return n;
}
function upgradeCost(kind, level) {
	return Math.round(CATALOG[kind].cost * (.5 + level * .45));
}
function spent(b) {
	let n = CATALOG[b.kind].cost;
	for (let level = 1; level < b.level; level += 1) n += upgradeCost(b.kind, level);
	return n;
}
function placeRoad(s, c, r) {
	if (!isLand(c, r)) return {
		ok: false,
		msg: "ما ينفع الطريق في البحر"
	};
	if (s.buildings.some((b) => b.c === c && b.r === r)) return {
		ok: false,
		msg: "في مبنى هنا"
	};
	const k = cellKey(c, r);
	if (s.roads.includes(k)) return {
		ok: true,
		fresh: false
	};
	const cost = priceOf(40, s);
	if (cost > 0 && s.coins < cost) return {
		ok: false,
		msg: "الرصيد ما يكفي للطريق"
	};
	s.coins -= cost;
	s.roads.push(k);
	return {
		ok: true,
		fresh: true
	};
}
function placeBuilding(s, kind, c, r, now) {
	if (!isLand(c, r)) return {
		ok: false,
		msg: "ما ينفع البناء في البحر"
	};
	if (s.roads.includes(cellKey(c, r)) || s.buildings.some((b) => b.c === c && b.r === r)) return {
		ok: false,
		msg: "الأرض مشغولة"
	};
	const cost = priceOf(CATALOG[kind].cost, s);
	if (cost > 0 && s.coins < cost) return {
		ok: false,
		msg: "الرصيد ما يكفي"
	};
	s.coins -= cost;
	s.buildings.push({
		id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
		kind,
		c,
		r,
		level: 1,
		stored: 0,
		born: now
	});
	return { ok: true };
}
function bulldoze(s, c, r) {
	const i = s.buildings.findIndex((b) => b.c === c && b.r === r);
	if (i >= 0) {
		const b = s.buildings[i];
		s.coins += Math.round(priceOf(spent(b), s) * .5);
		s.buildings.splice(i, 1);
		return { ok: true };
	}
	const k = cellKey(c, r);
	const ri = s.roads.indexOf(k);
	if (ri >= 0) {
		s.roads.splice(ri, 1);
		s.coins += Math.round(priceOf(40, s) * .5);
		return { ok: true };
	}
	return {
		ok: false,
		msg: "ما في شيء تهدّه هنا"
	};
}
function upgrade(s, id, now) {
	const b = s.buildings.find((x) => x.id === id);
	if (!b) return {
		ok: false,
		msg: "المبنى مو موجود"
	};
	if (b.level >= 3) return {
		ok: false,
		msg: "وصل آخر مستوى"
	};
	const cost = priceOf(upgradeCost(b.kind, b.level), s);
	if (cost > 0 && s.coins < cost) return {
		ok: false,
		msg: "الرصيد ما يكفي للترقية"
	};
	s.coins -= cost;
	b.level += 1;
	b.born = now;
	return { ok: true };
}
function metrics(s, st = stats(s)) {
	const shops = countKind(s, "shop");
	const towers = countKind(s, "tower");
	const parks = countKind(s, "park");
	const police = countKind(s, "police");
	const clinics = countKind(s, "clinic");
	const industryN = countKind(s, "power") + countKind(s, "water");
	const power = st.powerUse <= 0 ? 100 : clamp(st.powerGive / st.powerUse * 100, 0, 100);
	const water = st.waterUse <= 0 ? 100 : clamp(st.waterGive / st.waterUse * 100, 0, 100);
	let coast = 0;
	for (const b of s.buildings) if (coastal(b.c, b.r)) coast += 1;
	const jobs = shops * 18 + towers * 26;
	const unemployment = st.pop <= 0 ? 0 : clamp((st.pop - jobs) / Math.max(st.pop, 1) * 100, 0, 100);
	let pollution = industryN * 18 + towers * 7 - parks * 8;
	if (s.ordinances.recycling) pollution -= 14;
	if (s.ordinances.smokeBan) pollution -= 12;
	pollution = clamp(pollution, 0, 100);
	let traffic = clamp(s.buildings.length * 70 / Math.max(3, s.roads.length) - 20, 0, 100);
	if (s.ordinances.carpool) traffic = clamp(traffic - 18, 0, 100);
	const crime = clamp(62 - police * 16 - parks * 4 + Math.max(0, st.pop - 60) / 10, 0, 100);
	const health = clamp(36 + clinics * 16 + water * .28 - pollution * .22 + (s.ordinances.clinicFund ? 12 : 0), 0, 100);
	const education = clamp(24 + (s.ordinances.education ? 42 : 0) + clinics * 5, 0, 100);
	const land = clamp(30 + parks * 8 + coast * 4 + st.happy * .2, 0, 100);
	return {
		day: s.day,
		water,
		power,
		crime,
		pop: clamp(st.pop / 4, 0, 100),
		funds: clamp(Math.max(0, s.coins) / 80, 0, 100),
		pollution,
		traffic,
		unemployment,
		industry: clamp(industryN * 18, 0, 100),
		approval: st.happy,
		size: clamp(s.buildings.length * 3, 0, 100),
		commerce: clamp(shops * 12 + towers * 8, 0, 100),
		land,
		health,
		education
	};
}
function takeSample(s) {
	return metrics(s);
}
function demand(s, st = stats(s)) {
	const houses = s.buildings.filter((b) => CATALOG[b.kind].pop > 0).length;
	const shops = countKind(s, "shop") + countKind(s, "tower");
	const plants = countKind(s, "power") + countKind(s, "water");
	return {
		r: clamp((shops * 28 - st.pop) * .7 + (st.happy - 55) + (st.short ? -35 : 18) + (houses < 2 ? 20 : 0), -100, 100),
		c: clamp((st.pop - shops * 32) * .85 + (st.happy > 60 ? 12 : -8), -100, 100),
		i: clamp(st.pop / 3 - plants * 22 - (st.short ? 10 : 0), -100, 100)
	};
}
function monthlyUpkeep(s) {
	let n = s.roads.length * 2 + s.buildings.length * 6;
	if (s.ordinances.education) n += 80;
	if (s.ordinances.recycling) n += 40;
	if (s.ordinances.carpool) n += 25;
	if (s.ordinances.clinicFund) n += 55;
	if (s.ordinances.smokeBan) n += 30;
	return priceOf(n, s);
}
function monthlyIncome(s) {
	const st = stats(s);
	return Math.round(s.buildings.reduce((n, b) => n + incomePerSec(b, s, st) * 30, 0));
}
function pushLog(s, text) {
	if (s.log[0] === text) return;
	s.log.unshift(text);
	s.log = s.log.slice(0, 8);
}
function advanceDays(s, days) {
	if (days <= 0) return;
	const before = Math.floor(s.day / 30);
	s.day += days;
	const after = Math.floor(s.day / 30);
	if (s.disaster && s.day >= s.disaster.until) {
		pushLog(s, "انتهت الكارثة. المدينة تلمّ جراحها");
		s.disaster = null;
	}
	if (after <= before) return;
	const brokeBefore = s.coins < 0;
	let rolled = false;
	for (let m = before + 1; m <= after; m += 1) {
		s.coins = Math.max(-8e3, s.coins - monthlyUpkeep(s));
		s.history.push(takeSample(s));
		if (!rolled && s.randomDisasters && s.buildings.length > 3 && Math.random() < .06) {
			rolled = true;
			const roll = Math.random();
			triggerDisaster(s, roll < .34 ? "fire" : roll < .67 ? "storm" : "blackout");
		}
	}
	if (s.history.length > 1200) s.history.splice(0, s.history.length - 1200);
	if (!brokeBefore && s.coins < 0) pushLog(s, "عجز: مصروف الشهر أكبر من الصندوق");
}
function triggerDisaster(s, kind) {
	if (s.disaster && s.day < s.disaster.until) return {
		ok: false,
		msg: "في كارثة جارية. استنى تخلص"
	};
	if (kind === "fire") {
		const targets = s.buildings.filter((b) => ![
			"kuwait",
			"mosque",
			"liberation",
			"palace"
		].includes(b.kind));
		if (!targets.length) return {
			ok: false,
			msg: "ما في مبنى يطاله الحريق"
		};
		const b = targets[Math.floor(Math.random() * targets.length)];
		const name = CATALOG[b.kind].name;
		if (b.level > 1) b.level -= 1;
		else {
			const i = s.buildings.findIndex((x) => x.id === b.id);
			if (i >= 0) s.buildings.splice(i, 1);
		}
		const msg = `حريق ضرب ${name}`;
		pushLog(s, msg);
		return {
			ok: true,
			msg
		};
	}
	if (kind === "storm") {
		s.disaster = {
			kind: "storm",
			until: s.day + 50
		};
		const msg = "عاصفة رملية تغطي الكويت";
		pushLog(s, msg);
		return {
			ok: true,
			msg
		};
	}
	s.disaster = {
		kind: "blackout",
		until: s.day + 36
	};
	const msg = "انقطاع كهرباء على الأحياء";
	pushLog(s, msg);
	return {
		ok: true,
		msg
	};
}
function bulletin(s, st = stats(s)) {
	const m = metrics(s, st);
	const lines = [...s.log];
	if (s.speed === 0 && s.started) lines.push("الزمن واقف. اضغط تشغيل");
	if (m.pollution >= 42) lines.push("شيء في الهواء: التلوث متوسط");
	else lines.push("الهواء على الكورنيش صافٍ");
	if (m.power < 85 && st.pop >= 20) lines.push("مستشار الكهرباء: الإنتاج ما يغطي");
	if (m.water < 85 && st.pop >= 20) lines.push("التحلية ناقصة والأحياء تعطش");
	if (m.crime > 48) lines.push("الجريمة ترتفع. ابنِ مركز شرطة");
	if (m.unemployment > 38) lines.push("البطالة عالية. افتح محلات وأبراج");
	if (m.approval >= 72) lines.push("الرضا عالٍ. أهل الكويت مبسوطين");
	if (s.tax >= 14) lines.push("الضريبة عالية والناس تتذمر");
	if (s.coins < 0) lines.push("صندوق البلدية في عجز");
	const q = QUESTS[s.quest];
	if (q) lines.push(`مهمة: ${q.text}`);
	if (!lines.length) lines.push("مدينة الكويت تنتظر قرارك");
	return lines.slice(0, 8);
}
function rollLuck(s, now) {
	const left = s.luckAt + 7e3 - now;
	if (left > 0) return {
		ok: false,
		amount: 0,
		msg: `الحظ يرجع بعد ${Math.ceil(left / 1e3)} ث`
	};
	const bag = [
		120,
		180,
		220,
		260,
		320,
		400,
		450,
		700,
		1100
	];
	const amount = bag[Math.floor(Math.random() * bag.length)] ?? 200;
	s.coins += amount;
	s.luckAt = now;
	return {
		ok: true,
		amount,
		msg: `حظك +${amount} د.ك`
	};
}
function advanceQuest(s) {
	const gained = [];
	while (QUESTS[s.quest]?.done(s)) {
		const q = QUESTS[s.quest];
		s.coins += q.reward;
		s.quest += 1;
		gained.push({
			text: q.text,
			reward: q.reward
		});
	}
	return gained;
}
function loadSim() {
	if (typeof localStorage === "undefined") return createInitial();
	try {
		const raw = localStorage.getItem(SAVE_KEY);
		if (!raw) return createInitial();
		const p = JSON.parse(raw);
		if (p.v !== 1 && p.v !== 2) return createInitial();
		const s = createInitial();
		s.history = [];
		s.coins = Math.max(-8e3, Math.floor(Number(p.coins) || 0));
		s.quest = clamp(Number(p.quest) || 0, 0, QUESTS.length);
		s.mute = Boolean(p.mute);
		s.started = Boolean(p.started);
		s.day = clamp(Number(p.day) || 0, 0, 146e3);
		s.speed = clamp(Number(p.speed ?? 1), 0, 3);
		s.tax = clamp(Number(p.tax ?? 7), 0, 20);
		s.randomDisasters = Boolean(p.randomDisasters);
		s.difficulty = p.difficulty === "easy" || p.difficulty === "medium" || p.difficulty === "hard" ? p.difficulty : "hard";
		s.luckAt = Math.max(0, Number(p.luckAt) || 0);
		const fine = p.grid === 1;
		const o = p.ordinances;
		if (o && typeof o === "object") s.ordinances = {
			education: Boolean(o.education),
			recycling: Boolean(o.recycling),
			carpool: Boolean(o.carpool),
			clinicFund: Boolean(o.clinicFund),
			smokeBan: Boolean(o.smokeBan)
		};
		const d = p.disaster;
		if (d && typeof d === "object" && (d.kind === "fire" || d.kind === "storm" || d.kind === "blackout")) s.disaster = {
			kind: d.kind,
			until: Number(d.until) || 0
		};
		if (Array.isArray(p.log)) s.log = p.log.filter((x) => typeof x === "string").slice(0, 8);
		const roads = Array.isArray(p.roads) ? p.roads : [];
		const roadCells = [];
		for (const k of roads) {
			if (typeof k !== "string") continue;
			const [c, r] = k.split(",").map(Number);
			if (fine) {
				if (isLand(c, r)) roadCells.push(cellKey(c, r));
				continue;
			}
			for (const dc of [0, 1]) for (const dr of [0, 1]) {
				const nc = c * 2 + dc;
				const nr = r * 2 + dr;
				if (isLand(nc, nr)) roadCells.push(cellKey(nc, nr));
			}
		}
		s.roads = [...new Set(roadCells)];
		const taken = new Set(s.roads);
		const buildings = Array.isArray(p.buildings) ? p.buildings : [];
		for (const rawB of buildings) {
			if (!rawB || typeof rawB !== "object") continue;
			const b = rawB;
			if (typeof b.kind !== "string" || !(b.kind in CATALOG)) continue;
			const c0 = Number(b.c);
			const r0 = Number(b.r);
			let c = c0;
			let r = r0;
			if (!fine) {
				const spots = [
					[c0 * 2, r0 * 2],
					[c0 * 2 + 1, r0 * 2],
					[c0 * 2, r0 * 2 + 1],
					[c0 * 2 + 1, r0 * 2 + 1]
				];
				const roadSet = new Set(s.roads);
				const hit = spots.find(([nc, nr]) => isLand(nc, nr) && !roadSet.has(cellKey(nc, nr)) && DIRS.some(([dc, dr]) => roadSet.has(cellKey(nc + dc, nr + dr))));
				const open = spots.find(([nc, nr]) => isLand(nc, nr) && !roadSet.has(cellKey(nc, nr)));
				const pick = hit ?? open;
				if (!pick) continue;
				c = pick[0];
				r = pick[1];
			}
			if (!isLand(c, r) || taken.has(cellKey(c, r))) continue;
			taken.add(cellKey(c, r));
			s.buildings.push({
				id: String(b.id ?? cellKey(c, r)),
				kind: b.kind,
				c,
				r,
				level: clamp(Number(b.level) || 1, 1, 3),
				stored: Math.max(0, Number(b.stored) || 0),
				born: 0
			});
		}
		if (Array.isArray(p.history)) for (const rawH of p.history.slice(-1200)) {
			if (!rawH || typeof rawH !== "object") continue;
			const h = rawH;
			s.history.push({
				day: Number(h.day) || 0,
				water: num(h.water),
				power: num(h.power),
				crime: num(h.crime),
				pop: num(h.pop),
				funds: num(h.funds),
				pollution: num(h.pollution),
				traffic: num(h.traffic),
				unemployment: num(h.unemployment),
				industry: num(h.industry),
				approval: num(h.approval),
				size: num(h.size),
				commerce: num(h.commerce),
				land: num(h.land),
				health: num(h.health),
				education: num(h.education)
			});
		}
		if (!s.history.length) s.history.push(takeSample(s));
		return s;
	} catch {
		return createInitial();
	}
}
function num(v) {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}
function saveSim(s) {
	if (typeof localStorage === "undefined") return;
	const data = {
		v: 2,
		coins: s.coins,
		roads: s.roads,
		buildings: s.buildings.map(({ born: _born, ...b }) => b),
		quest: s.quest,
		mute: s.mute,
		started: s.started,
		day: s.day,
		speed: s.speed,
		tax: s.tax,
		ordinances: s.ordinances,
		disaster: s.disaster,
		randomDisasters: s.randomDisasters,
		log: s.log.slice(0, 8),
		history: s.history.slice(-1200),
		difficulty: s.difficulty,
		luckAt: s.luckAt,
		grid: 1
	};
	localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}
var SERIES = [
	{
		key: "water",
		label: "ماء %",
		token: "--color-sc-sky"
	},
	{
		key: "power",
		label: "كهرباء %",
		token: "--color-sc-orange"
	},
	{
		key: "crime",
		label: "الجريمة",
		token: "--color-coral"
	},
	{
		key: "pop",
		label: "السكان",
		token: "--color-sc-leaf"
	},
	{
		key: "funds",
		label: "الأموال",
		token: "--color-sc-gold"
	},
	{
		key: "pollution",
		label: "التلوث",
		token: "--color-sc-pink"
	},
	{
		key: "traffic",
		label: "الزحمة",
		token: "--color-sand"
	},
	{
		key: "unemployment",
		label: "البطالة",
		token: "--color-ink"
	},
	{
		key: "industry",
		label: "الصناعة",
		token: "--color-gulf"
	},
	{
		key: "approval",
		label: "الرضا",
		token: "--color-sc-lime"
	},
	{
		key: "size",
		label: "حجم المدينة",
		token: "--color-sc-green"
	},
	{
		key: "commerce",
		label: "التجارة",
		token: "--color-sc-sky"
	},
	{
		key: "land",
		label: "قيمة الأرض",
		token: "--color-sand"
	},
	{
		key: "health",
		label: "الصحة",
		token: "--color-sc-leaf"
	},
	{
		key: "education",
		label: "التعليم",
		token: "--color-gulf"
	}
];
var LAWS = [
	{
		key: "education",
		title: "ميزانية التعليم",
		detail: "ترفع التعليم والرضا. ٨٠ د.ك كل شهر."
	},
	{
		key: "recycling",
		title: "إعادة التدوير",
		detail: "تقلل التلوث. ٤٠ د.ك كل شهر."
	},
	{
		key: "carpool",
		title: "مشاركة السيارات",
		detail: "تخفف الزحمة. ٢٥ د.ك كل شهر."
	},
	{
		key: "clinicFund",
		title: "دعم المستوصفات",
		detail: "ترفع الصحة. ٥٥ د.ك كل شهر."
	},
	{
		key: "smokeBan",
		title: "منع الدخان",
		detail: "هواء أنظف، وتجارة المحلات تهدأ شوي. ٣٠ د.ك."
	}
];
function fmt$1(n) {
	return Math.floor(n).toLocaleString("en-US");
}
function CityHud({ snap, tool, cat, selectedId, stored, confirmReset, toasts, onStart, onSpeed, onCategory, onRoad, onBulldoze, onBuild, onTax, onOrdinance, onDisaster, onRandom, onDifficulty, onLuck, onUpgrade, onCollect, onMute, onAskReset, onReset, onCancelReset, onZoom }) {
	const [panel, setPanel] = (0, import_react.useState)(null);
	const [tray, setTray] = (0, import_react.useState)(false);
	const [span, setSpan] = (0, import_react.useState)(10);
	const [onKeys, setOnKeys] = (0, import_react.useState)([
		"pop",
		"approval",
		"unemployment"
	]);
	const [ticker, setTicker] = (0, import_react.useState)(0);
	const st = stats(snap);
	const selected = snap.buildings.find((b) => b.id === selectedId) ?? null;
	const lines = bulletin(snap, st);
	const dem = demand(snap, st);
	const line = lines[ticker % lines.length] ?? "";
	(0, import_react.useEffect)(() => {
		const id = window.setInterval(() => setTicker((n) => n + 1), 3400);
		return () => window.clearInterval(id);
	}, []);
	function togglePanel(next) {
		setPanel((p) => p === next ? null : next);
	}
	function openCat(id) {
		if (tray && (cat === id || id === "housing" && cat === "commerce")) {
			setTray(false);
			return;
		}
		onCategory(id);
		setTray(true);
	}
	const cards = cat === "commerce" || cat === "housing" ? kindsIn(cat) : tray ? kindsIn(cat) : [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none absolute inset-0 z-10",
		children: [snap.started && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "safe-top pointer-events-auto absolute right-1 top-0 flex flex-col items-center gap-2 pt-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Round, {
					label: "سكن وتجارة",
					on: tray && (cat === "housing" || cat === "commerce"),
					onClick: () => openCat("housing"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayoutGrid, { size: 18 })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Round, {
					label: "طرق",
					on: tool?.kind === "road",
					onClick: onRoad,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Route, { size: 18 })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Round, {
					label: "كهرباء وماء وخدمات",
					on: tray && cat === "services",
					onClick: () => openCat("services"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { size: 18 })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Round, {
					label: "معالم",
					on: tray && cat === "landmarks",
					onClick: () => openCat("landmarks"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Landmark, { size: 18 })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Round, {
					label: "هدم",
					on: tool?.kind === "bulldoze",
					onClick: onBulldoze,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { size: 18 })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rci, {
					r: dem.r,
					c: dem.c,
					i: dem.i
				})
			]
		}), snap.started && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-auto absolute left-2 top-1/3 flex flex-col gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Round, {
				label: "تقريب",
				onClick: () => onZoom(1.15),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { size: 18 })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Round, {
				label: "تبعيد",
				onClick: () => onZoom(1 / 1.15),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minus, { size: 18 })
			})]
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none absolute inset-0 z-20 flex flex-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative min-h-0 flex-1",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute inset-x-0 top-2 flex flex-col items-center gap-1 px-16",
					children: toasts.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "sc-lcd text-sm",
						children: item.text
					}, item.id))
				}),
				panel && snap.started && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "sc-panel pointer-events-auto absolute bottom-2 left-2 right-16 top-2 flex flex-col overflow-hidden rounded-md",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sc-title m-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "sc-x",
							"aria-label": "إغلاق",
							onClick: () => setPanel(null),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { size: 18 })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
							className: "flex-1 text-center text-base",
							children: [
								panel === "graphs" && "الرسوم",
								panel === "budget" && "الميزانية",
								panel === "laws" && "القوانين",
								panel === "advisors" && "المستشارون",
								panel === "disasters" && "الكوارث"
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-h-0 flex-1 overflow-y-auto px-2 pb-3",
						children: [
							panel === "graphs" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Graphs, {
								snap,
								span,
								onKeys,
								onSpan: setSpan,
								onToggle: (key) => setOnKeys((list) => list.includes(key) ? list.filter((k) => k !== key) : [...list, key])
							}),
							panel === "budget" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Budget, {
								snap,
								onTax,
								onDifficulty
							}),
							panel === "laws" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "space-y-2",
								children: LAWS.map((law) => {
									const on = snap.ordinances[law.key];
									return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										"aria-pressed": on,
										onClick: () => onOrdinance(law.key, !on),
										className: `flex w-full items-center gap-2 rounded-md px-2 py-1 text-right ${on ? "sc-on sc-choice" : "sc-choice"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "grid h-6 w-6 place-items-center",
											children: on ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { size: 16 }) : null
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "min-w-0 flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "block text-sm",
												children: law.title
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "block text-xs font-medium opacity-80",
												children: law.detail
											})]
										})]
									}) }, law.key);
								})
							}),
							panel === "advisors" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Advisors, { snap }),
							panel === "disasters" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Disasters, {
								snap,
								onDisaster,
								onRandom
							})
						]
					})]
				}),
				!snap.started && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute inset-x-0 bottom-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sc-panel pointer-events-auto safe-bottom mx-2 rounded-t-xl px-4 pt-5",
						dir: "rtl",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-bold text-sc-leaf",
								children: "خريطة مدينة الكويت"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "mt-1 text-3xl font-extrabold leading-tight",
								children: "عمدة الكويت"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-base leading-relaxed",
								children: "المربعات أصغر، والطريق يلف مع الساحل. اختر الصعوبة: السهل بلا تكاليف، والمتوسط أرخص من المتقدم."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 grid grid-cols-3 gap-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiffButton, {
										testid: "diff-easy",
										on: snap.difficulty === "easy",
										onClick: () => onDifficulty("easy"),
										children: "سهل"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiffButton, {
										testid: "diff-medium",
										on: snap.difficulty === "medium",
										onClick: () => onDifficulty("medium"),
										children: "متوسط"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiffButton, {
										testid: "diff-hard",
										on: snap.difficulty === "hard",
										onClick: () => onDifficulty("hard"),
										children: "متقدم"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								"data-testid": "start-city",
								onClick: onStart,
								className: "sc-menu mt-4 w-full text-base",
								children: "ابدأ البناء"
							})
						]
					})
				})
			]
		}), snap.started && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
			className: "sc-status pointer-events-auto safe-bottom",
			dir: "rtl",
			children: [
				confirmReset && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 px-3 py-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "flex-1 text-sm text-sc-mint",
							children: "تمسح المدينة وترجع من الصفر؟"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: onReset,
							className: "sc-menu sc-on h-11 px-3 text-sm",
							children: "امسح"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: onCancelReset,
							className: "sc-textbtn text-sm",
							children: "لا"
						})
					]
				}),
				selected && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-2 mt-2 flex items-center gap-2 rounded-md bg-sc-mint px-2 py-1 text-sc-ink",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: `/game/${selected.kind}.png`,
							alt: "",
							className: "h-12 w-12 object-contain"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "truncate text-sm font-extrabold",
									children: [
										CATALOG[selected.kind].name,
										" · مستوى ",
										selected.level
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-xs",
									children: [
										incomePerSec(selected, snap).toFixed(1),
										" د.ك/ث",
										coastal(selected.c, selected.r) && CATALOG[selected.kind].coastBoost ? " · كورنيش" : ""
									]
								}),
								blockReason(selected, snap) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-coral",
									children: blockReason(selected, snap)
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							disabled: selected.level >= 3,
							onClick: onUpgrade,
							className: "sc-menu h-11 shrink-0 px-3 text-xs disabled:opacity-40",
							children: selected.level >= 3 ? "مكتمل" : priceOf(upgradeCost(selected.kind, selected.level), snap) === 0 ? "ترقّي مجاني" : `ترقّي ${fmt$1(priceOf(upgradeCost(selected.kind, selected.level), snap))}`
						})
					]
				}),
				tray && tool?.kind !== "road" && tool?.kind !== "bulldoze" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "pt-2",
					children: [(cat === "housing" || cat === "commerce") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-1 flex gap-1 px-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-pressed": cat === "housing",
							onClick: () => onCategory("housing"),
							className: `sc-menu px-3 text-sm ${cat === "housing" ? "sc-on" : ""}`,
							children: "سكن"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-pressed": cat === "commerce",
							onClick: () => onCategory("commerce"),
							className: `sc-menu px-3 text-sm ${cat === "commerce" ? "sc-on" : ""}`,
							children: "تجارة"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-2 overflow-x-auto px-2 pb-1",
						children: cards.map((def) => {
							const price = priceOf(def.cost, snap);
							const on = tool?.kind === "build" && tool.building === def.kind;
							const poor = price > 0 && snap.coins < price;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								"data-testid": `build-${def.kind}`,
								"aria-pressed": on,
								onClick: () => onBuild(def.kind),
								className: `flex w-24 shrink-0 flex-col items-center rounded-md border-2 px-1 py-1 ${on ? "sc-on border-sc-ink" : "border-sc-ink bg-sc-mint text-sc-ink"} ${poor ? "opacity-50" : ""}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: `/game/${def.kind}.png`,
										alt: "",
										className: "h-12 w-full object-contain"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "mt-1 w-full truncate text-center text-xs font-extrabold",
										children: def.name
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs",
										children: price === 0 ? "مجاني" : fmt$1(price)
									})
								]
							}, def.kind);
						})
					})]
				}),
				tool?.kind === "road" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "px-3 pt-2 text-xs font-bold text-sc-lime",
					children: ["اسحب والطريق يلف مع اليابسة.", priceOf(40, snap) === 0 ? " مجاني." : ` ${priceOf(40, snap)} د.ك.`]
				}),
				tool?.kind === "bulldoze" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-3 pt-2 text-xs font-bold text-sc-gold",
					children: "اضغط مبنى أو طريق. يرجع لك نصف التكلفة."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-1.5 overflow-x-auto px-2 py-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Round, {
							label: snap.mute ? "تشغيل الصوت" : "كتم الصوت",
							onClick: onMute,
							children: snap.mute ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { size: 16 }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { size: 16 })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Round, {
							label: "مدينة جديدة",
							onClick: onAskReset,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { size: 16 })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, {
							on: panel === "graphs",
							testid: "open-graphs",
							onClick: () => togglePanel("graphs"),
							children: "الرسوم"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, {
							on: panel === "budget",
							onClick: () => togglePanel("budget"),
							children: "الميزانية"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, {
							on: panel === "laws",
							onClick: () => togglePanel("laws"),
							children: "القوانين"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, {
							on: panel === "advisors",
							onClick: () => togglePanel("advisors"),
							children: "المستشارون"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, {
							on: panel === "disasters",
							onClick: () => togglePanel("disasters"),
							children: "الكوارث"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							"data-testid": "luck-btn",
							onClick: onLuck,
							className: "sc-menu sc-on inline-flex shrink-0 items-center gap-1 px-3 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dices, { size: 16 }), " حظ"]
						}),
						stored > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: onCollect,
							className: "sc-menu sc-on shrink-0 px-3 text-sm",
							children: ["اجمع ", fmt$1(stored)]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1 overflow-x-auto px-2 pb-2",
					dir: "ltr",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Round, {
							label: "إيقاف",
							on: snap.speed === 0,
							onClick: () => onSpeed(0),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { size: 16 })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Round, {
							label: "تشغيل",
							on: snap.speed === 1,
							onClick: () => onSpeed(1),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { size: 16 })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Round, {
							label: "سريع",
							on: snap.speed === 2,
							onClick: () => onSpeed(2),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FastForward, { size: 16 })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Round, {
							label: "أسرع",
							on: snap.speed === 3,
							onClick: () => onSpeed(3),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronsRight, { size: 16 })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "sc-lcd shrink-0 text-sm",
							dir: "ltr",
							children: formatCityDate(snap.day)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "sc-lcd shrink-0 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								dir: "ltr",
								children: fmt$1(snap.coins)
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs",
								children: "د.ك"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "sc-lcd shrink-0 text-sm",
							dir: "ltr",
							children: fmt$1(st.pop)
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "sc-ticker flex items-center px-3 text-sm",
					dir: "rtl",
					children: line
				})
			]
		})]
	})] });
}
function Graphs({ snap, span, onKeys, onSpan, onToggle }) {
	const months = span === 1 ? 12 : span === 10 ? 120 : 1200;
	const rows = (0, import_react.useMemo)(() => {
		return [...snap.history.slice(-months), metrics(snap)];
	}, [snap, months]);
	const active = SERIES.filter((s) => onKeys.includes(s.key));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		dir: "ltr",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GraphCanvas, {
				rows,
				active
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 flex gap-1",
				children: [
					1,
					10,
					100
				].map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-pressed": span === n,
					onClick: () => onSpan(n),
					className: `sc-menu flex-1 text-sm ${span === n ? "sc-on" : ""}`,
					children: n === 1 ? "سنة" : n === 10 ? "10 سنوات" : "100 سنة"
				}, n))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 grid grid-cols-2 gap-1",
				dir: "rtl",
				children: SERIES.map((item) => {
					const on = onKeys.includes(item.key);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						"aria-pressed": on,
						onClick: () => onToggle(item.key),
						className: `flex h-11 items-center gap-1 rounded-md px-2 text-xs font-extrabold ${on ? "sc-on" : "sc-menu"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "grid h-5 w-5 shrink-0 place-items-center",
							children: on ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { size: 14 }) : null
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "truncate",
							children: item.label
						})]
					}, item.key);
				})
			})
		]
	});
}
function GraphCanvas({ rows, active }) {
	const ref = (0, import_react.useRef)(null);
	const sig = `${rows.length}:${active.map((a) => a.key).join(",")}:${Math.round(rows.at(-1)?.approval ?? 0)}:${Math.round(rows.at(-1)?.pop ?? 0)}`;
	(0, import_react.useEffect)(() => {
		const canvas = ref.current;
		if (!canvas) return;
		const draw = () => {
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			const w = Math.max(1, canvas.clientWidth);
			const h = Math.max(1, canvas.clientHeight);
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(h * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, w, h);
			const css = getComputedStyle(document.documentElement);
			ctx.strokeStyle = css.getPropertyValue("--color-sc-ink").trim() || "black";
			ctx.globalAlpha = .35;
			ctx.beginPath();
			ctx.moveTo(8, h - 14);
			ctx.lineTo(w - 8, h - 14);
			ctx.stroke();
			ctx.globalAlpha = 1;
			if (rows.length < 2) return;
			for (const series of active) {
				ctx.beginPath();
				ctx.lineWidth = 2;
				ctx.strokeStyle = css.getPropertyValue(series.token).trim() || "black";
				rows.forEach((row, i) => {
					const x = 8 + i / (rows.length - 1) * (w - 16);
					const y = 8 + (1 - Math.max(0, Math.min(100, row[series.key])) / 100) * (h - 26);
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				});
				ctx.stroke();
			}
		};
		draw();
		const ro = new ResizeObserver(draw);
		ro.observe(canvas);
		return () => ro.disconnect();
	}, [
		sig,
		rows,
		active
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
		ref,
		className: "h-40 w-full rounded-md bg-sc-mint",
		"aria-label": "رسم المدينة"
	});
}
function Budget({ snap, onTax, onDifficulty }) {
	const income = monthlyIncome(snap);
	const cost = monthlyUpkeep(snap);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		dir: "rtl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm leading-relaxed",
				children: [
					"الضريبة الحالية ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: [snap.tax, "%"] }),
					". السهل بلا تكاليف على كل البنيان، والمتوسط أرخص من المتقدم."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-3 gap-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiffButton, {
						on: snap.difficulty === "easy",
						onClick: () => onDifficulty("easy"),
						children: "سهل"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiffButton, {
						on: snap.difficulty === "medium",
						onClick: () => onDifficulty("medium"),
						children: "متوسط"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiffButton, {
						on: snap.difficulty === "hard",
						onClick: () => onDifficulty("hard"),
						children: "متقدم"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block text-sm font-extrabold",
				children: ["نسبة الضريبة", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "range",
					min: 0,
					max: 20,
					step: 1,
					value: snap.tax,
					"aria-label": "نسبة الضريبة",
					onChange: (e) => onTax(Number(e.target.value)),
					className: "mt-1 h-11 w-full accent-sc-leaf"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-3 gap-1 text-center text-xs font-extrabold",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sc-lcd h-auto flex-col py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "دخل الشهر" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							dir: "ltr",
							children: fmt$1(income)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sc-lcd h-auto flex-col py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "المصروف" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							dir: "ltr",
							children: fmt$1(cost)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sc-lcd h-auto flex-col py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "الفرق" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							dir: "ltr",
							children: fmt$1(income - cost)
						})]
					})
				]
			})
		]
	});
}
function DiffButton({ on, onClick, children, testid }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		"data-testid": testid,
		"aria-pressed": on,
		onClick,
		className: `sc-menu w-full text-sm ${on ? "sc-on" : ""}`,
		children
	});
}
function Advisors({ snap }) {
	const st = stats(snap);
	const m = metrics(snap, st);
	const q = QUESTS[snap.quest];
	const rows = [
		["السكان", fmt$1(st.pop)],
		["الرضا", `${st.happy}%`],
		["الكهرباء", `${Math.round(m.power)}%`],
		["الماء", `${Math.round(m.water)}%`],
		["الجريمة", String(Math.round(m.crime))],
		["البطالة", String(Math.round(m.unemployment))],
		["التلوث", String(Math.round(m.pollution))],
		["الزحمة", String(Math.round(m.traffic))],
		["الصحة", String(Math.round(m.health))],
		["التعليم", String(Math.round(m.education))],
		["قيمة الأرض", String(Math.round(m.land))]
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-2",
		dir: "rtl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "space-y-1",
				children: bulletin(snap, st).map((text) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "rounded-md bg-sc-mint px-2 py-2 text-sm font-bold text-sc-ink",
					children: text
				}, text))
			}),
			q && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm font-extrabold",
				children: [
					"المهمة: ",
					q.text,
					" · ",
					Math.min(q.total, Math.round(q.progress(snap))),
					"/",
					q.total
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-2 gap-1",
				children: rows.map(([label, value]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "sc-lcd h-auto justify-between py-2 text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						dir: "ltr",
						children: value
					})]
				}, label))
			})
		]
	});
}
function Disasters({ snap, onDisaster, onRandom }) {
	const active = snap.disaster && snap.day < snap.disaster.until ? snap.disaster : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-2",
		dir: "rtl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm leading-relaxed",
				children: "الكوارث من عندك، مثل لوحة سيم سيتي. الحريق يضرب مبنى، العاصفة تنزل الرضا، وانقطاع الكهرباء يطفّي الإنتاج لين ما تعدّي."
			}),
			active && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "sc-lcd text-sm",
				children: ["جارية لين ", formatCityDate(active.until)]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "sc-menu inline-flex w-full items-center justify-center gap-2 text-sm",
						onClick: () => onDisaster("fire"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flame, { size: 16 }), " حريق"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "sc-menu inline-flex w-full items-center justify-center gap-2 text-sm",
						onClick: () => onDisaster("storm"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cloud, { size: 16 }), " عاصفة رملية"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "sc-menu inline-flex w-full items-center justify-center gap-2 text-sm",
						onClick: () => onDisaster("blackout"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ZapOff, { size: 16 }), " انقطاع كهرباء"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				"aria-pressed": snap.randomDisasters,
				onClick: () => onRandom(!snap.randomDisasters),
				className: `sc-menu w-full text-sm ${snap.randomDisasters ? "sc-on" : ""}`,
				children: snap.randomDisasters ? "الكوارث العشوائية شغّالة" : "تفعيل كوارث عشوائية نادرة"
			})
		]
	});
}
function Rci({ r, c, i }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-1 flex gap-1 rounded-md bg-sc-ink px-1 py-1",
		"aria-label": "طلب السكن والتجارة والصناعة",
		dir: "ltr",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Meter, {
				label: "R",
				value: r,
				tone: "bg-sc-green"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Meter, {
				label: "C",
				value: c,
				tone: "bg-sc-sky"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Meter, {
				label: "I",
				value: i,
				tone: "bg-sc-gold"
			})
		]
	});
}
function Meter({ label, value, tone }) {
	const up = value >= 0;
	const h = Math.round(Math.abs(value) / 100 * 50);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col items-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-xs font-extrabold text-sc-lime",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "relative h-16 w-3 overflow-hidden rounded-full bg-sc-bar",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `absolute inset-x-0 ${tone}`,
				style: {
					height: `${h}%`,
					top: up ? `${50 - h}%` : "50%"
				}
			})
		})]
	});
}
function Round({ label, on, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		"aria-label": label,
		"aria-pressed": on,
		onClick,
		className: `sc-round ${on ? "sc-on" : ""}`,
		children
	});
}
function Menu({ on, onClick, children, testid }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		"data-testid": testid,
		"aria-pressed": on,
		onClick,
		className: `sc-menu shrink-0 text-sm ${on ? "sc-on" : ""}`,
		children
	});
}
function createAudio() {
	let ctx = null;
	function ensure() {
		if (!ctx) ctx = new AudioContext();
		if (ctx.state === "suspended") ctx.resume();
		return ctx;
	}
	function tone(freq, dur, type, gain, delay = 0) {
		const c = ensure();
		const t = c.currentTime + delay;
		const o = c.createOscillator();
		const g = c.createGain();
		o.type = type;
		o.frequency.setValueAtTime(freq, t);
		g.gain.setValueAtTime(gain, t);
		g.gain.exponentialRampToValueAtTime(.001, t + dur);
		o.connect(g);
		g.connect(c.destination);
		o.start(t);
		o.stop(t + dur);
	}
	return {
		unlock() {
			try {
				ensure();
			} catch {}
		},
		play(kind, mute) {
			if (mute) return;
			try {
				if (kind === "place") {
					tone(523, .08, "triangle", .05);
					tone(784, .12, "triangle", .04, .07);
				} else if (kind === "road") tone(392, .05, "square", .025);
				else if (kind === "collect") {
					tone(880, .07, "sine", .05);
					tone(1175, .11, "sine", .04, .06);
				} else if (kind === "error") tone(180, .12, "square", .03);
				else {
					tone(523, .09, "triangle", .05);
					tone(659, .09, "triangle", .045, .09);
					tone(784, .16, "triangle", .05, .18);
				}
			} catch {}
		}
	};
}
function fmt(n) {
	return Math.floor(n).toLocaleString("en-US");
}
function CityGame() {
	const canvasRef = (0, import_react.useRef)(null);
	const simRef = (0, import_react.useRef)(createInitial());
	const toolRef = (0, import_react.useRef)(null);
	const syncRef = (0, import_react.useRef)(() => {});
	const toastRef = (0, import_react.useRef)(() => {});
	const selectRef = (0, import_react.useRef)(() => {});
	const clockRef = (0, import_react.useRef)(0);
	const timeRef = (0, import_react.useRef)(0);
	const [snap, setSnap] = (0, import_react.useState)(createInitial());
	const [tool, setTool] = (0, import_react.useState)(null);
	const [cat, setCat] = (0, import_react.useState)("housing");
	const [selected, setSelected] = (0, import_react.useState)(null);
	const [toasts, setToasts] = (0, import_react.useState)([]);
	const [confirmReset, setConfirmReset] = (0, import_react.useState)(false);
	const toastSeq = (0, import_react.useRef)(0);
	toolRef.current = tool;
	function pushToast(text) {
		const id = ++toastSeq.current;
		setToasts((q) => [...q, {
			id,
			text
		}].slice(-3));
		window.setTimeout(() => {
			setToasts((q) => q.filter((item) => item.id !== id));
		}, 2400);
	}
	function sync() {
		const next = cloneSim(simRef.current);
		setSnap(next);
		saveSim(simRef.current);
	}
	syncRef.current = sync;
	toastRef.current = pushToast;
	selectRef.current = setSelected;
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		simRef.current = loadSim();
		setSnap(cloneSim(simRef.current));
		const audio = createAudio();
		const cam = {
			x: WORLD_W * .56,
			y: WORLD_H * .65,
			z: .7
		};
		let cssW = 1;
		let cssH = 1;
		let dpr = 1;
		let t = 0;
		let acc = 0;
		let hudAcc = 0;
		let raf = 0;
		let running = true;
		let camReady = false;
		const sprites = /* @__PURE__ */ new Map();
		const map = new Image();
		map.src = "/game/map.jpg";
		for (const kind of KINDS) {
			const img = new Image();
			img.onload = () => sprites.set(kind, img);
			img.src = `/game/${kind}.png`;
			if (img.complete && img.naturalWidth) sprites.set(kind, img);
		}
		const floaters = [];
		const pointers = /* @__PURE__ */ new Map();
		let pinch = null;
		let drag = null;
		let hover = null;
		const coinHits = [];
		let hiddenAt = 0;
		function resize() {
			const rect = canvas.getBoundingClientRect();
			cssW = Math.max(1, rect.width);
			cssH = Math.max(1, rect.height);
			dpr = Math.min(2, window.devicePixelRatio || 1);
			canvas.width = Math.round(cssW * dpr);
			canvas.height = Math.round(cssH * dpr);
			if (!camReady) {
				const fit = Math.min(cssW / WORLD_W, cssH / WORLD_H) * .92;
				cam.z = Math.min(3.2, Math.max(fit, 34 / 50));
				camReady = true;
			}
			clampCam();
		}
		function clampCam() {
			const minZ = Math.min(cssW / WORLD_W, cssH / WORLD_H) * .92;
			cam.z = Math.max(minZ, Math.min(3.4, cam.z));
			const halfW = cssW / 2 / cam.z;
			const halfH = cssH / 2 / cam.z;
			const margin = 70;
			cam.x = halfW * 2 >= 2400 ? WORLD_W / 2 : Math.max(halfW - margin, Math.min(WORLD_W - halfW + margin, cam.x));
			cam.y = halfH * 2 >= 1600 ? WORLD_H / 2 : Math.max(halfH - margin, Math.min(WORLD_H - halfH + margin, cam.y));
		}
		function local(e) {
			const rect = canvas.getBoundingClientRect();
			return {
				x: e.clientX - rect.left,
				y: e.clientY - rect.top
			};
		}
		function cellAt(sx, sy) {
			const wx = cam.x + (sx - cssW / 2) / cam.z;
			const wy = cam.y + (sy - cssH / 2) / cam.z;
			return {
				c: Math.floor(wx / 50),
				r: Math.floor(wy / 50)
			};
		}
		function burst(c, r, text) {
			floaters.push({
				x: (c + .5) * 50,
				y: r * 50,
				text,
				life: .95
			});
			if (floaters.length > 24) floaters.shift();
		}
		function noteQuests() {
			const gained = advanceQuest(simRef.current);
			for (const g of gained) {
				audio.play("quest", simRef.current.mute);
				toastRef.current(`تمت المهمة +${fmt(g.reward)} د.ك`);
			}
		}
		function handleTap(sx, sy) {
			const sim = simRef.current;
			if (!sim.started) return;
			const current = toolRef.current;
			if (!current || current.kind !== "bulldoze") {
				let best = null;
				for (const hit of coinHits) {
					const d = Math.hypot(hit.x - sx, hit.y - sy);
					if (d < 28 && (!best || d < best.d)) best = {
						id: hit.id,
						d
					};
				}
				if (best) {
					const b = sim.buildings.find((x) => x.id === best.id);
					const n = collectOne(sim, best.id);
					if (n > 0 && b) {
						audio.play("collect", sim.mute);
						burst(b.c, b.r, `+${n}`);
						syncRef.current();
					}
					return;
				}
			}
			const { c, r } = cellAt(sx, sy);
			if (current?.kind === "bulldoze") {
				const act = bulldoze(sim, c, r);
				if (!act.ok) {
					audio.play("error", sim.mute);
					toastRef.current(act.msg);
				} else {
					audio.play("place", sim.mute);
					noteQuests();
					syncRef.current();
				}
				return;
			}
			if (current?.kind === "road") {
				const act = placeRoad(sim, c, r);
				if (!act.ok) {
					audio.play("error", sim.mute);
					toastRef.current(act.msg);
				} else if (act.fresh) {
					audio.play("road", sim.mute);
					noteQuests();
					syncRef.current();
				}
				return;
			}
			if (current?.kind === "build") {
				const act = placeBuilding(sim, current.building, c, r, t);
				if (!act.ok) {
					audio.play("error", sim.mute);
					toastRef.current(act.msg);
				} else {
					audio.play("place", sim.mute);
					if (coastal(c, r) && CATALOG[current.building].coastBoost) toastRef.current("على الكورنيش +١٥٪");
					noteQuests();
					syncRef.current();
				}
				return;
			}
			const found = sim.buildings.find((b) => b.c === c && b.r === r);
			selectRef.current(found ? found.id : null);
		}
		function onDown(e) {
			audio.unlock();
			canvas.setPointerCapture(e.pointerId);
			pointers.set(e.pointerId, {
				x: e.clientX,
				y: e.clientY
			});
			const p = local(e);
			if (pointers.size >= 2) {
				const pts = [...pointers.values()];
				const a = pts[0];
				const b = pts[1];
				pinch = {
					dist: Math.max(8, Math.hypot(a.x - b.x, a.y - b.y)),
					z: cam.z,
					cx: (a.x + b.x) / 2,
					cy: (a.y + b.y) / 2
				};
				drag = null;
				return;
			}
			const paint = Boolean(simRef.current.started && toolRef.current?.kind === "road");
			drag = {
				x: p.x,
				y: p.y,
				moved: 0,
				paint,
				fail: null
			};
			if (paint) paintRoad(p.x, p.y);
		}
		let lastCell = null;
		function paintRoad(sx, sy) {
			if (!drag) return;
			const here = cellAt(sx, sy);
			const from = lastCell ?? here;
			const path = routeOnLand(from.c, from.r, here.c, here.r);
			let sounded = false;
			for (const step of path) {
				const act = placeRoad(simRef.current, step.c, step.r);
				if (!act.ok) {
					if (act.msg.includes("رصيد") && !drag.fail?.startsWith("!")) {
						drag.fail = `!${act.msg}`;
						audio.play("error", simRef.current.mute);
						toastRef.current(act.msg);
					} else if (!act.msg.includes("رصيد")) drag.fail = act.msg;
					continue;
				}
				lastCell = step;
				if (act.fresh && !sounded) {
					sounded = true;
					audio.play("road", simRef.current.mute);
				}
			}
		}
		function onMove(e) {
			if (!pointers.has(e.pointerId)) return;
			pointers.set(e.pointerId, {
				x: e.clientX,
				y: e.clientY
			});
			const p = local(e);
			hover = cellAt(p.x, p.y);
			if (pointers.size >= 2 && pinch) {
				const pts = [...pointers.values()];
				const a = pts[0];
				const b = pts[1];
				const dist = Math.max(8, Math.hypot(a.x - b.x, a.y - b.y));
				const midX = (a.x + b.x) / 2 - canvas.getBoundingClientRect().left;
				const midY = (a.y + b.y) / 2 - canvas.getBoundingClientRect().top;
				const wx = cam.x + (midX - cssW / 2) / cam.z;
				const wy = cam.y + (midY - cssH / 2) / cam.z;
				cam.z = pinch.z * (dist / pinch.dist);
				clampCam();
				cam.x = wx - (midX - cssW / 2) / cam.z;
				cam.y = wy - (midY - cssH / 2) / cam.z;
				clampCam();
				return;
			}
			if (!drag) return;
			const dx = p.x - drag.x;
			const dy = p.y - drag.y;
			drag.moved += Math.hypot(dx, dy);
			drag.x = p.x;
			drag.y = p.y;
			if (drag.paint) {
				paintRoad(p.x, p.y);
				return;
			}
			if (drag.moved > 8) {
				cam.x -= dx / cam.z;
				cam.y -= dy / cam.z;
				clampCam();
			}
		}
		function onUp(e) {
			pointers.delete(e.pointerId);
			if (pointers.size < 2) pinch = null;
			if (pointers.size > 0) return;
			const p = local(e);
			if (drag && drag.moved < 14 && !drag.paint) handleTap(p.x, p.y);
			if (drag?.paint) {
				if (drag.moved < 14 && drag.fail && !drag.fail.startsWith("!")) {
					audio.play("error", simRef.current.mute);
					toastRef.current(drag.fail);
				}
				noteQuests();
				syncRef.current();
			}
			drag = null;
			lastCell = null;
		}
		function onWheel(e) {
			e.preventDefault();
			const rect = canvas.getBoundingClientRect();
			const sx = e.clientX - rect.left;
			const sy = e.clientY - rect.top;
			const wx = cam.x + (sx - cssW / 2) / cam.z;
			const wy = cam.y + (sy - cssH / 2) / cam.z;
			cam.z *= e.deltaY > 0 ? .92 : 1.08;
			clampCam();
			cam.x = wx - (sx - cssW / 2) / cam.z;
			cam.y = wy - (sy - cssH / 2) / cam.z;
			clampCam();
		}
		function draw() {
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.fillStyle = "#08343c";
			ctx.fillRect(0, 0, cssW, cssH);
			ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (cssW / 2 - cam.x * cam.z), dpr * (cssH / 2 - cam.y * cam.z));
			if (map.complete && map.naturalWidth) ctx.drawImage(map, 0, 0, WORLD_W, WORLD_H);
			else for (let r = 0; r < 32; r += 1) for (let c = 0; c < 48; c += 1) {
				ctx.fillStyle = LAND[r][c] ? "#e4d3ae" : "#1a7c8c";
				ctx.fillRect(c * 50, r * 50, 50, 50);
			}
			if (toolRef.current !== null) {
				ctx.strokeStyle = "rgba(72, 52, 24, 0.22)";
				ctx.lineWidth = 1.4 / cam.z;
				for (let r = 0; r < 32; r += 1) for (let c = 0; c < 48; c += 1) {
					if (!LAND[r][c]) continue;
					ctx.strokeRect(c * 50 + 1, r * 50 + 1, 48, 48);
				}
			}
			const roads = new Set(simRef.current.roads);
			ctx.lineCap = "round";
			ctx.lineJoin = "round";
			ctx.strokeStyle = "#3a4450";
			ctx.lineWidth = 23;
			ctx.beginPath();
			const drawn = /* @__PURE__ */ new Set();
			for (const k of roads) {
				const [c, r] = k.split(",").map(Number);
				const x = (c + .5) * 50;
				const y = (r + .5) * 50;
				let links = 0;
				for (const [dc, dr] of [
					[1, 0],
					[-1, 0],
					[0, 1],
					[0, -1],
					[1, 1],
					[1, -1],
					[-1, 1],
					[-1, -1]
				]) {
					const nk = cellKey(c + dc, r + dr);
					if (!roads.has(nk)) continue;
					if (dc !== 0 && dr !== 0) {
						if (roads.has(cellKey(c + dc, r)) && roads.has(cellKey(c, r + dr))) continue;
					}
					const edge = c < c + dc || dc === 0 && r <= r + dr ? `${k}>${nk}` : `${nk}>${k}`;
					if (drawn.has(edge)) continue;
					drawn.add(edge);
					links += 1;
					ctx.moveTo(x, y);
					ctx.lineTo((c + dc + .5) * 50, (r + dr + .5) * 50);
				}
				if (links === 0) {
					ctx.moveTo(x - 8, y);
					ctx.lineTo(x + 8, y);
				}
			}
			ctx.stroke();
			ctx.strokeStyle = "#6d7884";
			ctx.lineWidth = 8;
			ctx.stroke();
			if (hover && simRef.current.started) {
				const blocked = !isLand(hover.c, hover.r) || roads.has(cellKey(hover.c, hover.r)) || simRef.current.buildings.some((b) => b.c === hover.c && b.r === hover.r);
				const bad = toolRef.current?.kind === "bulldoze" ? !roads.has(cellKey(hover.c, hover.r)) && !simRef.current.buildings.some((b) => b.c === hover.c && b.r === hover.r) : blocked && toolRef.current !== null;
				ctx.fillStyle = bad ? "rgba(181, 82, 58, 0.32)" : "rgba(14, 110, 120, 0.28)";
				if (hover.c >= 0 && hover.r >= 0 && hover.c < 48 && hover.r < 32) ctx.fillRect(hover.c * 50, hover.r * 50, 50, 50);
				const build = toolRef.current?.kind === "build" ? toolRef.current.building : null;
				const ghost = build ? sprites.get(build) : void 0;
				if (ghost && isLand(hover.c, hover.r) && !blocked) {
					const dw = 50 * CATALOG[build].scale * 1.75;
					const dh = dw * (ghost.height / ghost.width);
					ctx.globalAlpha = .62;
					ctx.drawImage(ghost, (hover.c + .5) * 50 - dw / 2, (hover.r + 1) * 50 - dh, dw, dh);
					ctx.globalAlpha = 1;
				}
			}
			const ordered = [...simRef.current.buildings].sort((a, b) => a.r - b.r || a.c - b.c);
			for (const b of ordered) {
				const img = sprites.get(b.kind);
				const dw = 50 * CATALOG[b.kind].scale * 1.75;
				const dh = img ? dw * (img.height / img.width) : 50;
				const bx = (b.c + .5) * 50;
				const by = (b.r + 1) * 50;
				const age = b.born > 0 ? t - b.born : 10;
				const pop = age < .28 ? .78 + .22 * (age / .28) : 1;
				ctx.save();
				ctx.translate(bx, by);
				ctx.scale(pop, pop);
				ctx.fillStyle = "rgba(40, 28, 12, 0.16)";
				ctx.beginPath();
				ctx.ellipse(0, -2.5, dw * .28, 50 * .07, 0, 0, Math.PI * 2);
				ctx.fill();
				if (img) ctx.drawImage(img, -dw / 2, -dh, dw, dh);
				ctx.restore();
			}
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			coinHits.length = 0;
			ctx.font = "700 12px Tajawal, sans-serif";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			for (const b of simRef.current.buildings) {
				if (b.stored < 1) continue;
				const img = sprites.get(b.kind);
				const dw = 50 * CATALOG[b.kind].scale * 1.75 * cam.z;
				const dh = img ? dw * (img.height / img.width) : 50 * cam.z;
				const sx = (b.c + .5) * 50;
				const sy = (b.r + 1) * 50;
				const px = (sx - cam.x) * cam.z + cssW / 2;
				const py = (sy - cam.y) * cam.z + cssH / 2 - dh - 12 + Math.sin(t * 3 + b.c) * 3;
				coinHits.push({
					id: b.id,
					x: px,
					y: py
				});
				ctx.fillStyle = "#f3eee4";
				ctx.beginPath();
				ctx.arc(px, py, 15, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#b8893d";
				ctx.beginPath();
				ctx.arc(px, py, 12, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#1c1915";
				const label = Math.floor(b.stored) > 999 ? "999" : String(Math.floor(b.stored));
				ctx.fillText(label, px, py + .5);
			}
			for (const f of floaters) {
				const px = (f.x - cam.x) * cam.z + cssW / 2;
				const py = (f.y - cam.y) * cam.z + cssH / 2 - (1 - f.life / .95) * 36;
				ctx.globalAlpha = Math.max(0, f.life / .95);
				ctx.fillStyle = "#08343c";
				ctx.font = "800 16px Tajawal, sans-serif";
				ctx.fillText(f.text, px, py);
				ctx.globalAlpha = 1;
			}
		}
		function frame(now) {
			if (!running) return;
			const prev = clockRef.current || now;
			const dt = Math.min(.05, (now - prev) / 1e3);
			clockRef.current = now;
			timeRef.current = t;
			t += dt;
			if (simRef.current.started) {
				const sp = simRef.current.speed;
				const scale = sp === 1 ? 1 : sp === 2 ? 4 : sp === 3 ? 12 : 0;
				const daysPerSec = sp === 1 ? 6 : sp === 2 ? 24 : sp === 3 ? 72 : 0;
				if (scale > 0) {
					acc += dt * scale;
					while (acc >= .25) {
						tick(simRef.current, .25);
						acc -= .25;
					}
					advanceDays(simRef.current, dt * daysPerSec);
				}
				hudAcc += dt;
				if (hudAcc > .45) {
					hudAcc = 0;
					syncRef.current();
				}
			}
			for (const f of floaters) f.life -= dt;
			for (let i = floaters.length - 1; i >= 0; i -= 1) if (floaters[i].life <= 0) floaters.splice(i, 1);
			draw();
			raf = requestAnimationFrame(frame);
		}
		function onVis() {
			if (document.hidden) hiddenAt = performance.now();
			else if (hiddenAt && simRef.current.started) {
				const sec = Math.min(12, (performance.now() - hiddenAt) / 1e3);
				const sp = simRef.current.speed;
				const scale = sp === 1 ? 1 : sp === 2 ? 4 : sp === 3 ? 12 : 0;
				const daysPerSec = sp === 1 ? 6 : sp === 2 ? 24 : sp === 3 ? 72 : 0;
				if (scale > 0) {
					tick(simRef.current, sec * scale);
					advanceDays(simRef.current, Math.min(90, sec * daysPerSec));
				}
				syncRef.current();
			}
		}
		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(canvas);
		canvas.addEventListener("pointerdown", onDown);
		canvas.addEventListener("pointermove", onMove);
		canvas.addEventListener("pointerup", onUp);
		canvas.addEventListener("pointercancel", onUp);
		canvas.addEventListener("wheel", onWheel, { passive: false });
		document.addEventListener("visibilitychange", onVis);
		raf = requestAnimationFrame(frame);
		const zoom = (factor) => {
			const wx = cam.x;
			const wy = cam.y;
			cam.z *= factor;
			clampCam();
			cam.x = wx;
			cam.y = wy;
			clampCam();
		};
		canvas.dataset.ready = "1";
		canvas.__zoom = zoom;
		window.__city = {
			place(kind, c, r) {
				if (!(kind in CATALOG)) return "bad kind";
				simRef.current.started = true;
				const act = placeBuilding(simRef.current, kind, c, r, t);
				if (!act.ok) return act.msg;
				noteQuests();
				syncRef.current();
				return "ok";
			},
			road(c, r) {
				simRef.current.started = true;
				const act = placeRoad(simRef.current, c, r);
				if (!act.ok) return act.msg;
				noteQuests();
				syncRef.current();
				return act.fresh ? "ok" : "exists";
			},
			coins: () => simRef.current.coins,
			pop: () => stats(simRef.current).pop,
			started() {
				simRef.current.started = true;
				syncRef.current();
			}
		};
		return () => {
			running = false;
			cancelAnimationFrame(raf);
			ro.disconnect();
			canvas.removeEventListener("pointerdown", onDown);
			canvas.removeEventListener("pointermove", onMove);
			canvas.removeEventListener("pointerup", onUp);
			canvas.removeEventListener("pointercancel", onUp);
			canvas.removeEventListener("wheel", onWheel);
			document.removeEventListener("visibilitychange", onVis);
			delete window.__city;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const shell = document.querySelector("main.game-shell");
		const apply = () => {
			const legacy = typeof window.orientation === "number" ? window.orientation : 0;
			const angle = screen.orientation?.angle ?? legacy;
			const portraitViewport = window.innerHeight >= window.innerWidth;
			const mode = portraitViewport && (angle === 90 || angle === -90 || angle === 270) ? angle === 90 ? "right" : "left" : "";
			document.documentElement.dataset.orient = mode;
			shell?.classList.toggle("city-wide", !portraitViewport || mode !== "");
		};
		apply();
		window.addEventListener("resize", apply);
		window.addEventListener("orientationchange", apply);
		screen.orientation?.addEventListener("change", apply);
		return () => {
			window.removeEventListener("resize", apply);
			window.removeEventListener("orientationchange", apply);
			screen.orientation?.removeEventListener("change", apply);
			document.documentElement.dataset.orient = "";
			shell?.classList.remove("city-wide");
		};
	}, []);
	const stored = totalStored(snap);
	const selectedB = snap.buildings.find((b) => b.id === selected) ?? null;
	function start() {
		simRef.current.started = true;
		simRef.current.speed = 1;
		sync();
	}
	function reset() {
		simRef.current = createInitial();
		simRef.current.started = true;
		simRef.current.speed = 1;
		setTool(null);
		setSelected(null);
		setConfirmReset(false);
		sync();
		pushToast("مدينة جديدة على خريطة الكويت");
	}
	function onUpgrade() {
		if (!selectedB) return;
		const act = upgrade(simRef.current, selectedB.id, timeRef.current);
		if (!act.ok) {
			pushToast(act.msg);
			return;
		}
		advanceQuest(simRef.current);
		sync();
	}
	function onCollectAll() {
		const n = collectAll(simRef.current);
		if (n <= 0) return;
		sync();
		pushToast(`+${fmt(n)} د.ك`);
	}
	function onSpeed(n) {
		simRef.current.speed = n;
		sync();
	}
	function onTax(n) {
		simRef.current.tax = Math.max(0, Math.min(20, n));
		sync();
	}
	function onOrdinance(key, value) {
		simRef.current.ordinances = {
			...simRef.current.ordinances,
			[key]: value
		};
		sync();
	}
	function onDisaster(kind) {
		const act = triggerDisaster(simRef.current, kind);
		if (selected && !simRef.current.buildings.some((b) => b.id === selected)) setSelected(null);
		pushToast(act.msg);
		sync();
	}
	function onRandom(value) {
		simRef.current.randomDisasters = value;
		sync();
	}
	function onCategory(id) {
		setCat(id);
		setSelected(null);
		setTool((t) => t?.kind === "road" || t?.kind === "bulldoze" ? null : t);
	}
	function onRoad() {
		setSelected(null);
		setTool((t) => t?.kind === "road" ? null : { kind: "road" });
	}
	function onBulldoze() {
		setSelected(null);
		setTool((t) => t?.kind === "bulldoze" ? null : { kind: "bulldoze" });
	}
	function onBuild(kind) {
		setSelected(null);
		setTool((t) => t?.kind === "build" && t.building === kind ? null : {
			kind: "build",
			building: kind
		});
	}
	function onDifficulty(d) {
		simRef.current.difficulty = d;
		sync();
	}
	function onLuck() {
		pushToast(rollLuck(simRef.current, Date.now()).msg);
		sync();
	}
	function onZoom(factor) {
		canvasRef.current?.__zoom?.(factor);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "game-shell relative bg-sc-bar text-sc-mint",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "sr-only",
				children: "عمدة الكويت"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
				ref: canvasRef,
				"data-testid": "city-canvas",
				"aria-label": "خريطة مدينة الكويت",
				className: "absolute inset-0 h-full w-full touch-none"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CityHud, {
				snap,
				tool,
				cat,
				selectedId: selected,
				stored,
				confirmReset,
				toasts,
				onStart: start,
				onSpeed,
				onCategory,
				onRoad,
				onBulldoze,
				onBuild,
				onTax,
				onOrdinance,
				onDisaster,
				onRandom,
				onDifficulty,
				onLuck,
				onUpgrade,
				onCollect: onCollectAll,
				onMute: () => {
					simRef.current.mute = !simRef.current.mute;
					sync();
				},
				onAskReset: () => setConfirmReset(true),
				onReset: reset,
				onCancelReset: () => setConfirmReset(false),
				onZoom
			})
		]
	});
}
var SplitComponent = CityGame;
//#endregion
export { SplitComponent as component };
