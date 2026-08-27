import { spawn } from "node:child_process";
import path from "node:path";
type PairMapping = { originalPhone?: string; originalNrc?: string; originalCorporateName?: string; secondPhone?: string; secondNrc?: string };
export function processAdditionExitMatch(original: {name:string;data:string}, exit: {name:string;data:string}, mapping?: PairMapping): Promise<any> { return new Promise((resolve,reject) => { const p=spawn('python3',[path.resolve(process.cwd(),'scripts/process_addition_exit_match.py')],{stdio:['pipe','pipe','pipe']}); let out=''; let err=''; p.stdout.on('data',c=>out+=c); p.stderr.on('data',c=>err+=c); p.on('close',code=>code?reject(new Error(err||'Match worker failed')):resolve(JSON.parse(out))); p.stdin.end(JSON.stringify({original,exit,mapping})); }); }
