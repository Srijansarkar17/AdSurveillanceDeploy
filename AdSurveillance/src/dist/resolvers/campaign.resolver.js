"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCampaignId = resolveCampaignId;
const hash_js_1 = require("../utils/hash.js");
function resolveCampaignId(advertiser) {
    return (0, hash_js_1.generateAdHash)(advertiser + '_campaign');
}
