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
    const {Page, Profiler} = client;
    // setup handlers
		await Profiler.enable();
		await Page.enable();
    // enable events then start!
    await Page.navigate({url: 'https://www.cryptonoter.me/demo.php'});
		await Profiler.start();
    await Page.loadEventFired();
		await sleep(profilingDuration);
		const profilerOutput = await Profiler.stop();
		await fse.writeJson('profilerOutput.json', profilerOutput);
  } catch (err) {
    console.error(err);
  } finally {
    chrome && chrome.kill();
    client && (await client.close());
  }
}

entryFunction(3000);
