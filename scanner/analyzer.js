// vim: set expandtab ts=2 sw=2:
'use strict';

const _ = require('lodash');
const fse = require('fs-extra');
const process = require('process');
const {runChromeProfiler} = require('./profiler');

const url = process.argv[2];
const profilingDuration = process.argv[3] || 30000; // By default, 30s

const SAFE_CPU_LIMIT1 = 5;
const SAFE_CPU_LIMIT2 = 1;
const SAFE_CPU_LIMIT3 = 0.8;
const TRACING_NCPU_LIMIT = 1.5;

// Returns true/false (or null if error)
// false: Maybe malicious, need more investigation.
// true: Definitely safe
function analyzeCpuUsages(usageOutput) {
  const cpuUsages = usageOutput.filter(x=>'cpu' in x).map(x => x['cpu']);
  if (!cpuUsages || !cpuUsages.length)
    return false;
  if (cpuUsages.filter(x=>x > SAFE_CPU_LIMIT2).length / cpuUsages.length > SAFE_CPU_LIMIT3)
    if (_.max(cpuUsages) <= SAFE_CPU_LIMIT1)
      return true;
  return false;
}

function incrementCount(dict, key, amount) {
  if (!(key in dict)) dict[key] = 0;
  dict[key] += amount;
}

const tracingOutputTimestampScale = 1e6;

function readTracingOutput(tracingOutput) {
  let fcalls = tracingOutput.filter(x=>x['name'] == 'FunctionCall');
  let fcallsByIds = {};
  fcalls.forEach(x => {
    let key = x.pid + '-' + x.tid;
    if(!(key in fcallsByIds)) fcallsByIds[key] = [];
    fcallsByIds[key].push(x)
  });

  // Make sure threads start in 'B' phase
  _.forIn(fcallsByIds, (val, key) => {
    val.length && val[0].ph == 'E' && val.shift();
  });

  let callByFrames = {};
  let callByNames = {};
  let callByURLs = {};

  for(let key in fcallsByIds) {
    let calls = fcallsByIds[key];
    // sanity check
    if(!calls.map(x=>x.ph).join('').match(/^(BE)*(B)?$/)) return null;

    let bcalls = calls.filter((_, i) => i % 2 == 0);
    let ecalls = calls.filter((_, i) => i % 2 == 1);
    let zipped = _.zip(bcalls, ecalls).filter(([a, b]) => a && b);
    for (let [bcall, ecall] of zipped) {
      let info1 = (bcall.args || {}).data || {};
      let info2 = (ecall.args || {}).data || {};
      let info = Object.assign({}, info1, info2);
      let duration = ecall.tts - bcall.tts;
      // sanity check
      if (info1.functionName != info2.functionName)
        if (info2.functionName)
          return null;
      if (!duration && duration !== 0)
        return null;

      // store results
      duration = duration / tracingOutputTimestampScale;
      incrementCount(callByFrames, info.frame, duration);
      incrementCount(callByNames, info.functionName, duration);
      incrementCount(callByURLs, info.url, duration);
    }
  }

  let tslist = tracingOutput.map(x => x.ts).filter(x => x);
  let from = _.min(tslist);
  let to = _.max(tslist);
  let profilingDuration = (to - from) / tracingOutputTimestampScale;

  return {callByFrames, callByNames, callByURLs, profilingDuration};
}

// Returns 1,2,3 (or null if error)
// 1: Definitely malicious
// 2: Suspicious
// 3: Definitely safe
function analyze(tracingOutput, usageOutput) {
  let cpuResult = analyzeCpuUsages(usageOutput);
  if (cpuResult === true) return 3;

  tracingOutput = readTracingOutput(tracingOutput);
  if (tracingOutput === null) return null;
  let {callByFrames, callByNames, callByURLs, profilingDuration} = tracingOutput;

  // JS scripts running in non-window frames to gain multithread advantage
  if (undefined in callByFrames)
    if (callByFrames[undefined] > profilingDuration * TRACING_NCPU_LIMIT)
      return 1;

  // TODO: REMOVE THIS
  return 4;
}

module.exports = {analyze};

(async function () {
  try {
    let profilerResult = await runChromeProfiler(url, profilingDuration, []);
    if (!profilerResult) {
      console.log("Profiling failed.");
      return;
    }
    let [tracingOutput, usageOutput] = profilerResult;
    console.log("Analysis result: Label =", analyze(tracingOutput, usageOutput));
  } catch (err) {
    console.log(err);
  }
})();
