"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logExecution = logExecution;
const supabase_1 = require("../config/supabase");
async function logExecution(log) {
    await supabase_1.supabase.from('data_source_logs').insert(log);
}
