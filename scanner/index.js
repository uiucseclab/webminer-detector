// vim: set expandtab ts=2 sw=2:
'use strict';

const fse = require('fs-extra');
const process = require('process');
const {runChromeProfiler} = require('./profiler');

const url = process.argv[2];
const outputName = process.argv[3];
const profilingDuration = process.argv[4] || 5000; // By default, 5s

(async function () {
  let profilerResult = await runChromeProfiler(url, profilingDuration, [
    '--headless'
  ]);
  if (!profilerResult) {
    console.log("Profiling failed.");
    return;
  }
  let [tracingOutput, usageOutput] = profilerResult;
	await fse.writeJson(outputName + '-tracing.json', tracingOutput);
	await fse.writeJson(outputName + '-usage.json', usageOutput);
})();
