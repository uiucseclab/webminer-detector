// vim: set expandtab ts=2 sw=2:
'use strict';

const chromeLauncher = require('chrome-launcher');
const crp = require('chrome-remote-interface');
const fse = require('fs-extra');
const pidusage = require('pidusage');

async function sleep(t) {
  await new Promise(resolve => {
    setTimeout(resolve, t);
  });
}

async function withTimeout(promise, duration, timeoutMsg="TIMEOUT!") {
  return Promise.race([promise(), new Promise((resolve, reject) => {
    setTimeout(()=>reject(new Error(timeoutMsg)), duration);
  })]);
}

// These are the default tracing categories from Chrome
const TRACE_CATEGORIES = "cdp.perf,blink,cc,netlog,renderer.scheduler,toplevel,v8";

// Referenced code from: https://github.com/paulirish/automated-chrome-profiling
async function runChromeProfiler(url, profilingDuration, chromeFlags) {
  let chrome = null;
  let client = null;
  try {
    await fse.ensureDir("chromeUserData");
    chrome = await chromeLauncher.launch({
      chromeFlags: chromeFlags,
      userDataDir: "chromeUserData",
    });
    client = await crp({
      host: 'localhost',
      port: chrome.port
    });
    const {Page, Profiler, Tracing} = client;
  	await Page.enable();

    await withTimeout(async () => {
      await Page.navigate({url: url});
      await Page.loadEventFired();
    }, Math.max(30000, profilingDuration), "Timeout when loading webpage.");
    console.log('Page is loaded. Starting profiler...')

    // Handle tracing events
    const tracingOutput = [];
    const usageOutput = [];
    Tracing.dataCollected(data => data.value.forEach(x =>
      tracingOutput.push(x)
    ))
    await Tracing.start();
    let usageMonitorInterval = setInterval(() => chrome && pidusage(chrome.pid, (err, stats) => {
      if (err) {
        console.log('Error when fetching CPU usages: ', err)
      }
      usageOutput.push(stats);
    }), 200);

  	await sleep(profilingDuration);

    clearInterval(usageMonitorInterval);
    await Tracing.end();
    await Tracing.tracingComplete();
    return [tracingOutput, usageOutput];
  } catch (err) {
    console.error(err);
    return null;
  } finally {
    console.log("Terminating...")
    chrome && chrome.kill();
    client && (await client.close());
    console.log("Terminated")
  }
}

module.exports = {runChromeProfiler};
