"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSpend = calculateSpend;
function calculateSpend(impressions, cpm) {
    const spend = (impressions / 1000) * cpm;
    return {
        spend,
        lower: spend * 0.8,
        upper: spend * 1.2
    };
}
