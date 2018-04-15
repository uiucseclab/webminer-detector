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
    await Page.navigate({url: url});
    await Page.loadEventFired();
    console.log('Page is loaded. Starting profiler...')

    // Handle tracing events
    const tracingOutput = [];
    const usageOutput = [];
    Tracing.dataCollected(data => data.value.forEach(x =>
      tracingOutput.push(x)
    ))
    await Tracing.start();
    let usageMonitorInterval = setInterval(() => pidusage(chrome.pid, (err, stats) => {
      if (err) {
        console.log('Error when fetching CPU usages: ', err)
      }
      usageOutput.push(stats);
    }), 200);

  	await sleep(profilingDuration);

    clearInterval(usageMonitorInterval);
    await Tracing.end();
    await Tracing.tracingComplete();
    return tracingOutput, usageOutput;
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
