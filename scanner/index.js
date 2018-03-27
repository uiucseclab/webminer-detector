// vim: set expandtab ts=2 sw=2:
'use strict';

const chromeLauncher = require('chrome-launcher');
const crp = require('chrome-remote-interface');
const fse = require('fs-extra');

async function sleep(t) {
  await new Promise(resolve => {
    setTimeout(resolve, t);
  });
}

async function entryFunction(profilingDuration) {
  try {
    var chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless']
    });
    var client = await crp({
      host: 'localhost',
      port: chrome.port
    });
    const {Page, Profiler, Performance} = client;
    // setup handlers
		await Profiler.setSamplingInterval({"interval": 100});
		await Profiler.enable();
		await Performance.enable();
		await Page.enable();

    // enable events then start!
    await Page.navigate({url: 'https://www.cryptonoter.me/demo.php'});
		await Profiler.start();

		let metrics = [];
		const metricsInterval = setInterval(async () => {
			let m = await client.send('Performance.getMetrics');
			metrics.push({"metrics": m, "time": Date.now()});
		}, 100);
		await Profiler.startPreciseCoverage(true, true);
    await Page.loadEventFired();
		await sleep(profilingDuration);
		
		
		clearInterval(metricsInterval);
		const preciseProfilerOutput = await Profiler.takePreciseCoverage();
		await Profiler.stopPreciseCoverage();
		const profilerOutput = await Profiler.stop();
		await fse.writeJson('preciseProfilerOutput.json', preciseProfilerOutput);
		await fse.writeJson('profilerOutput.json', profilerOutput);
		await fse.writeJson('performanceOutput.json', metrics);
  } catch (err) {
    console.error(err);
  } finally {
    chrome && chrome.kill();
    client && (await client.close());
  }
}

entryFunction(10000);
