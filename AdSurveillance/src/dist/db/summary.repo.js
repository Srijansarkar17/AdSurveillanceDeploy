"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSummaryJob = runSummaryJob;
const supabase_1 = require("../config/supabase");
async function runSummaryJob() {
    const { error } = await supabase_1.supabase.rpc('run_summary_metrics');
    if (error) {
        console.error('❌ Summary job failed', error);
        throw error;
    }
    console.log('✅ Summary metrics generated');
}
