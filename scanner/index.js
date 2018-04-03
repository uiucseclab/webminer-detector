// vim: set expandtab ts=2 sw=2:
'use strict';

// Referenced code from: https://github.com/paulirish/automated-chrome-profiling

const chromeLauncher = require('chrome-launcher');
const crp = require('chrome-remote-interface');
const fse = require('fs-extra');
const process = require('process');

async function sleep(t) {
  await new Promise(resolve => {
    setTimeout(resolve, t);
  });
}

var TRACE_CATEGORIES = [
  "blink",
  "cc",
  "toplevel",
  "v8",
];

async function entryFunction(url, profilingDuration) {
  try {
    var chrome = await chromeLauncher.launch({
      chromeFlags: []//'--headless', '--disable-gpu']
    });
    var client = await crp({
      host: 'localhost',
      port: chrome.port
    });
    const {Page, Profiler, Tracing} = client;
		await Page.enable();
    await Page.navigate({url: url});
    await Page.loadEventFired();
    console.log('Page is loaded. Starting profiler...')
    await Tracing.start({
      "categories": TRACE_CATEGORIES.join(',')
    });

    // Handle tracing events
    const tracingOutput = [];
    Tracing.dataCollected(data => data.value.forEach(x =>
      tracingOutput.push(x)
    ))

		await sleep(profilingDuration);
    console.log("Terminating...")
    await Tracing.end();
    console.log("Terminating...")
    await sleep(3000)
		await fse.writeJson('tracingOutput.json', tracingOutput);
    console.log("Terminating...")
  } catch (err) {
    console.error(err);
  } finally {
    chrome && chrome.kill();
    client && (await client.close());
  }
}

// await Page.navigate({url: 'https://www.cryptonoter.me/demo.php'});
// await Page.navigate({url: 'https://www.buzzfeed.com/zoetillman/a-lawyer-who-admitted-lying-to-the-special-counsels-office?utm_term=.mh4gdNa8kp#.slbbXwyprN'});
// await Page.navigate({url: 'https://krakenbenchmark.mozilla.org/kraken-1.1/driver.html'});
// await Page.navigate({url: 'https://www.google.com/'});
const url = process.argv[2];
const duration = process.argv[3];
const output = process.argv[4];
entryFunction(url, duration, output);
