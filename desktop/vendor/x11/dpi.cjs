"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// desktop/vendor/x11/dpi.ts
var dpi_exports = {};
__export(dpi_exports, {
  convertBytesToDpi: () => convertBytesToDpi,
  convertDpiToBytes: () => convertDpiToBytes
});
module.exports = __toCommonJS(dpi_exports);

// desktop/vendor/x11/dpi-map.ts
var DPI_3311 = [
  1,
  2,
  3,
  4,
  5,
  6,
  8,
  9,
  10,
  11,
  12,
  14,
  15,
  16,
  17,
  18,
  19,
  21,
  22,
  23,
  24,
  25,
  27,
  28,
  29,
  30,
  31,
  32,
  34,
  35,
  36,
  37,
  38,
  39,
  41,
  42,
  43,
  44,
  45,
  47,
  48,
  49,
  50,
  51,
  52,
  54,
  55,
  56,
  57,
  58,
  59,
  61,
  62,
  63,
  64,
  65,
  67,
  68,
  69,
  70,
  71,
  72,
  74,
  75,
  76,
  77,
  78,
  79,
  81,
  82,
  83,
  84,
  85,
  87,
  88,
  89,
  90,
  91,
  92,
  94,
  95,
  96,
  97,
  98,
  99,
  101,
  102,
  103,
  104,
  105,
  107,
  108,
  109,
  110,
  111,
  112,
  114,
  115,
  116,
  117,
  118,
  119,
  121,
  122,
  123,
  124,
  125,
  127,
  128,
  129,
  130,
  131,
  132,
  134,
  135,
  136,
  137,
  138,
  139,
  141,
  142,
  143,
  144,
  145,
  147,
  148,
  149,
  150,
  151,
  152,
  154,
  155,
  156,
  157,
  158,
  159,
  161,
  162,
  163,
  164,
  165,
  167,
  168,
  169,
  170,
  171,
  172,
  174,
  175,
  176,
  177,
  178,
  179,
  181,
  182,
  183,
  184,
  185,
  187,
  188,
  189,
  190,
  191,
  192,
  194,
  195,
  196,
  197,
  198,
  199,
  201,
  202,
  203,
  204,
  205,
  207,
  208,
  209,
  210,
  211,
  212,
  214,
  215,
  216,
  217,
  218,
  219,
  221,
  222,
  223,
  224,
  225,
  227,
  228,
  229,
  230,
  231,
  232,
  234,
  235,
  118,
  119,
  121,
  122,
  123,
  124,
  125,
  127,
  128,
  129,
  130,
  131,
  132,
  134,
  135,
  136,
  137,
  138,
  139,
  141
];

// desktop/vendor/x11/dpi.ts
module.exports.DPI_3311 = DPI_3311;
function convertDpiToBytes(dpi) {
  const clampedDpi = Math.max(50, Math.min(dpi, 26e3));
  if (clampedDpi === 20100) {
    return { xByte: 235, yByte: 1, isDouble: true, isTriple: false };
  }
  let isDouble = false;
  const isTriple = false;
  let targetDpi = clampedDpi;
  if (clampedDpi > 1e4) {
    targetDpi = Math.round(clampedDpi / 2);
    isDouble = true;
  }
  let xByte = 0;
  let yByte = 0;
  if (targetDpi > 1e4) {
    const extraIndex = Math.floor((targetDpi - 10100) / 100);
    const combinedIndex = 199 + extraIndex;
    xByte = combinedIndex & 255;
    yByte = combinedIndex >> 8 & 255;
  } else if (targetDpi > 5e3 && targetDpi % 100 === 0) {
    const index = Math.floor(targetDpi / 100) - 1;
    xByte = DPI_3311[index] ?? 0;
    yByte = 1;
  } else {
    const index = Math.floor((targetDpi - 50) / 50);
    xByte = DPI_3311[index] ?? 0;
    yByte = 0;
  }
  return { xByte, yByte, isDouble, isTriple };
}
function convertBytesToDpi(xByte, yByte, isDouble, _isTriple) {
  if (xByte === 0 && yByte === 0) return 0;
  let dpiValue;
  if (yByte === 0) {
    const index = DPI_3311.indexOf(xByte);
    dpiValue = index !== -1 ? index * 50 + 50 : 50;
  } else if (yByte === 1) {
    const index = DPI_3311.indexOf(xByte);
    dpiValue = index !== -1 ? index * 100 + 100 : 100;
  } else {
    const combinedIndex = yByte << 8 | xByte;
    const baseIndex = 199;
    const extraIndex = combinedIndex - baseIndex;
    dpiValue = 10100 + extraIndex * 100;
  }
  if (isDouble) {
    if (xByte === 235) {
      return 20100;
    }
    dpiValue *= 2;
  }
  return Math.min(dpiValue, 26e3);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  convertBytesToDpi,
  convertDpiToBytes
});
