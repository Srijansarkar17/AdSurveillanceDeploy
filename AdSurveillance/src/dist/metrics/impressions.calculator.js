"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateImpressions = calculateImpressions;
function calculateImpressions(spend, cpm) {
    const impressions = Math.round((spend / cpm) * 1000);
    return {
        impressions,
        lower: Math.round(impressions * 0.85),
        upper: Math.round(impressions * 1.15)
    };
}
