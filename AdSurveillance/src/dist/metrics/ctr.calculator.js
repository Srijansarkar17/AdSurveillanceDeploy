"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCTR = calculateCTR;
function calculateCTR(impressions, ctr) {
    const clicks = Math.round(impressions * ctr);
    return { clicks, ctr };
}
