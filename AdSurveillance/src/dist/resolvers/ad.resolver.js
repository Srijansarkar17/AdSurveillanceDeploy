"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAdId = resolveAdId;
const hash_js_1 = require("../utils/hash.js");
function resolveAdId(ad) {
    return (0, hash_js_1.generateAdHash)(ad.advertiser + ad.creative);
}
