// vim: set expandtab ts=2 sw=2:
'use strict';

const _ = require('lodash');
const fse = require('fs-extra');
const process = require('process');
const {runChromeProfiler} = require('./profiler');

const SAFE_CPU_LIMIT1 = 5;
const SAFE_CPU_LIMIT2 = 1;
const SAFE_CPU_LIMIT3 = 0.8;
const TRACING_NCPU_LIMIT = 0.5;
const TIME_WINDOW_SIZE = 10 * 1000; // 10ms
const TIMELINE_THRESHOLD = 0.01; // 1% of chrome's cpu usage

const whitelist = [
  /^http(s)?:\/\/[a-zA-Z0-9\-_]+\.googleapis.com\//i,
  /^http(s)?:\/\/[a-zA-Z0-9\-_]+\.googlesyndication.com\//i,
];
function isUrlWhitelisted(url) {
  url = new String(url);
  for(let x of whitelist) {
    if (url.match(x)) {
      console.log("URL is whitelisted:", url);
      return true;
    }
  }
  return false;
}

// Returns true/false (or null if error)
// false: Maybe malicious, need more investigation.
// true: Definitely safe
function getCpuUsages(usageOutput) {
  return usageOutput.filter(x=>'cpu' in x).map(x => x['cpu']);
}
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

function getFCallsByIds(tracingOutput) {
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
  return fcallsByIds;
}

function getFCallTimeRange(tracingOutput) {
  let tslist = tracingOutput.map(x => x.ts).filter(x => x);
  let min = _.min(tslist)
  let max = _.max(tslist)
  if (min === undefined)
    return null;
  if (max === undefined)
    return null;
  return [min, max];
}

function newArr(size, elemBuilder) {
  return Array.apply(null, Array(size)).map(elemBuilder);
}

function readTracingOutput(tracingOutput) {
  const fcallsByIds = getFCallsByIds(tracingOutput);
  const timeRange = getFCallTimeRange(tracingOutput);
  if (!timeRange)
    return null;
  const [startTime, endTime] = timeRange;
  const nTimeWindow = 1 + Math.floor((endTime - startTime) / TIME_WINDOW_SIZE);
  let callByFrames = newArr(nTimeWindow, ()=>({}));
  let callByNames = newArr(nTimeWindow, ()=>({}));
  let callByURLs = newArr(nTimeWindow, ()=>({}));
  let allFrames = new Set(), allNames = new Set(), allURLs = new Set();

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
      const info = Object.assign({}, info1, info2);
      const bts = bcall.ts, ets = ecall.ts;
      // sanity check
      if (info1.functionName != info2.functionName)
        if (info2.functionName)
          return null;
      if (bts === undefined || bts === null ||
          ets === undefined || ets === null)
        return null;

      // store results
      allFrames.add(info.frame);
      allNames.add(info.functionName);
      allURLs.add(info.url);
      let ts = bts;
      while (ts < ets) {
        let slice_id = Math.floor((ts - startTime) / TIME_WINDOW_SIZE)
        let nextTs = startTime + (slice_id + 1) * TIME_WINDOW_SIZE
        let duration = Math.min(ets, nextTs - 1) - ts

        incrementCount(callByFrames[slice_id], info.frame, duration);
        incrementCount(callByNames[slice_id], info.functionName, duration);
        incrementCount(callByURLs[slice_id], info.url, duration);
        ts = nextTs;
      }
    }
  }

  let profilingDuration = (endTime - startTime) / tracingOutputTimestampScale;

  return [
    [[callByFrames, allFrames], [callByNames, allNames], [callByURLs, allURLs]],
    profilingDuration
  ];
}

function getTimeline(counters, key, cpuUsages) {
  let data = [];
  let tlen = counters.length;
  let cpuLen = cpuUsages.length;
  let avg_cpu = _.mean(cpuUsages);
  counters.forEach((c, tid) => {
    //let curr_cpu = cpuUsages[Math.floor(cpuLen * tid / tlen)];
    let curr_cpu = avg_cpu;
    data.push((c[key] || 0) / TIME_WINDOW_SIZE / curr_cpu);
  });
  return data;
}

// Returns 1,2,3 (or null if error)
// 1: Definitely malicious
// 2: Suspicious
// 3: Definitely safe
function analyze(tracingOutput, usageOutput) {
  tracingOutput = readTracingOutput(tracingOutput);
  let cpuUsages = getCpuUsages(usageOutput);
  if (tracingOutput === null) return null;
  let [countersAndKeys, profilingDuration] = tracingOutput;

  console.log('----------------------');
  console.log('--------START---------');
  console.log('----------------------');
  console.log('AVERAGE Process CPU usage: ', _.mean(cpuUsages));
  console.log('Profiling duration: ', profilingDuration);
  console.log('----------------------');

  // JS scripts running in non-window frames to gain multithread advantage
  let none_frame = getTimeline(countersAndKeys[0][0], undefined, cpuUsages);
  none_frame = _.sum(none_frame.map(x=>x > 0.02)) / none_frame.length;
  console.log('None frame score:', none_frame);
  console.log('----------------------');
  if (none_frame >= 0.2)
    return 1;
  if (none_frame >= 0.01)
    return 2;

  // The JS scripts simply used too much CPU.
  // NOTE: GPU operations won't be counted in `totalRuntime`
  //        only if profiler was ran on users' local desktop
  let [urlCounters, allURLs] = countersAndKeys[2];
  let badUrlsToScores = {};
  allURLs.forEach(key => {
    let timeline = getTimeline(urlCounters, key, cpuUsages);
    let sum = 0;
    let prev_high = false;
    timeline.forEach(x => {
      if (prev_high && x > TIMELINE_THRESHOLD)
        sum += x;
      prev_high = x > TIMELINE_THRESHOLD
    });
    let score = sum / timeline.length;
    if (score > 0.05 && !isUrlWhitelisted(key))
      badUrlsToScores[key] = score;
  });
  console.log("Bad urls and their scores:")
  console.log(badUrlsToScores)
  console.log('----------------------');
  if (_.keys(badUrlsToScores).length > 0)
    return 2;

  return 3;
}

module.exports = {analyze};

require.main === module && (async function () {
  const url = process.argv[2];
  const profilingDuration = process.argv[3] || 5000; // By default, 5s

  try {
    let profilerResult = await runChromeProfiler(url, profilingDuration, [
      '--headless'
    ]);
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
