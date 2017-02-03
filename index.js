"use strict";

const assert = require("assert");
const webdriver = require('selenium-webdriver');
const By = webdriver.By;
const until = webdriver.until;
const Capture = require('./scripts/capture.js');
const SauceLabs = require("saucelabs");
const options = require('./scripts/options.js');
const urlListPath = options.source || './capture-list.json';
const captureList = require(urlListPath);
const browsers = options.browser || ['chrome/windows'];
const Capium = function (browser, os) {
	this.browser = browser;
	this.os = os;
	this.isMobile = this.os === 'android' || this.os === 'ios';
};

Capium.prototype = {
	init: function() {
		this.start();
		this.setParameters();
		this.setBrowserCaps();
		this.buildBrowser();
		return this.initialConfig();
	},
	setParameters: function() {

		this.basicAuth = {
			id: options.basicAuthId,
			pass: options.basicAuthPass
		};

		this.sauceLabs = new SauceLabs({
			username: options.sauceLabsId,
			password: options.sauceLabsPass
		});
		this.sauceLabsServer = "http://" + options.sauceLabsId + ":" + options.sauceLabsPass + "@ondemand.saucelabs.com:80/wd/hub";
		this.browserStackServer = 'http://hub-cloud.browserstack.com/wd/hub';

		this.chromeOptions = {

			//Android Mobile
			//args: ['user-agent=Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2725.0 Mobile Safari/537.36'],

			//Android Tablet
			//args: ['user-agent=Mozilla/5.0 (Linux; Android 4.3; Nexus 7 Build/JSS15Q) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2725.0 Safari/537.36'],

			//iPhone
			//args: ['user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B137 Safari/601.1'],

			//iPad
			//args: ['user-agent=Mozilla/5.0 (iPad; CPU OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B137 Safari/601.1'],

			//args: ["incognito"],

			"excludeSwitches": [
				"disable-component-update",
				"disable-popup-blocking"
			]
		};

		this.firefoxProfile = null;

		this.testName = "Get Screenshots";
		this.projectName = "Test Project";
		this.buildVersion = 'version1.0.0';

		this.PATH = {
			DEST_DIR: './output/'
		};

		this.isBrowserStack = options.browserStackId && options.browserStackPass;
		this.isSauceLabs = options.sauceLabsId && options.sauceLabsPass;

	},
	setBrowserCaps: function () {

		this.commonCap = {
			"unexpectedAlertBehaviour": "ignore",
			"locationContextEnabled": false,
			"webStorageEnabled": true
		};

		if(this.isBrowserStack) {

			let capsBrowserStack = require('./scripts/caps-browserstack.js').bind(this);
			let capsBrowserStackCommon = capsBrowserStack(options).common;
			let capsBrowserStackBrowsers = capsBrowserStack(options).browsers[this.os];

			Object.assign(this.commonCap, capsBrowserStackCommon);

			this.browserCaps = capsBrowserStackBrowsers;

		} else if(this.isSauceLabs) {

			let capsSauceLabs = require('./scripts/caps-saucelabs.js').bind(this);
			let capsSauceLabsCommon = capsSauceLabs(options).common;
			let capsSauceLabsBrowsers = capsSauceLabs(options).browsers[this.os];

			Object.assign(this.commonCap, capsSauceLabsCommon);

			this.browserCaps = capsSauceLabsBrowsers;

			Object.assign(this.commonCap, capsSauceLabsCommon);

			this.browserCaps = capsSauceLabsBrowsers;

		} else {
			const os = /^win/.test(process.platform) ? 'win' : 'mac';
			const capsLocal = require(`./scripts/caps-${os}.js`).bind(this);
			this.browserCaps = capsLocal(options).browsers;
		}

		for(let browser in this.browserCaps) {
			if(this.browserCaps.hasOwnProperty(browser)) {
				let cap = this.browserCaps[browser];
				Object.assign(cap, this.commonCap);
			}
		}
	},
	buildBrowser: function () {
		
		if(!this.browserCaps[this.browser]) {
			assert(false, 'Your specified browser could not found. Please specify from the following list.\n\n' + Object.keys(this.browserCaps).join('\n'));
		}

		this.browserCap = this.browserCaps[this.browser] || this.browserCaps['chrome'];
		this.browserName = this.browserCap.browserName;

		if(this.isSauceLabs) {
			this.remoteTesingServer = this.sauceLabsServer;
		} else if(this.isBrowserStack) {
			this.remoteTesingServer = this.browserStackServer;
		}


		if(this.remoteTesingServer) {
			this.driver = new webdriver.Builder()
				.withCapabilities(this.browserCap)
				.usingServer(this.remoteTesingServer)
				.build();
		} else {
			this.driver = new webdriver.Builder()
				.withCapabilities(this.browserCap)
				.build();
		}
	},

	initialConfig: function() {
		let timeouts = this.driver.manage().timeouts();
		return Promise.resolve()
			.then(timeouts.implicitlyWait.bind(timeouts, 60/*m*/*60/*s*/*1000/*ms*/))
			.then(timeouts.setScriptTimeout.bind(timeouts, 60/*m*/*60/*s*/*1000/*ms*/))
			.then(timeouts.pageLoadTimeout.bind(timeouts, 60/*m*/*60/*s*/*1000/*ms*/))
			.then(function () {
				if(!this.isMobile) {
					return this.driver.manage().window().setSize(+options.width || 1200, +options.height || 800);
				}
			}.bind(this))
			.then(function () {
				return this.driver.getSession().then(function (sessionid){
					this.driver.sessionID = sessionid.id_;
				}.bind(this));
			}.bind(this));

	},
	executeCapture: function(url) {

		var capture = new Capture(this);

		var captureUrl = this.getDestPath(this.getImageFileName(url));

		if (this.basicAuth.id && this.basicAuth.pass) {
			//Override
			url = this.getUrlForBasicAuth(url, this.basicAuth.id, this.basicAuth.pass)
		}

		return this.driver.get(url)
			.then(function () {
				if (!this.isBrowserStack && this.basicAuth.id && this.basicAuth.pass && /safari/.test(this.browserName)) {
					return this.driver.wait(until.elementLocated(By.id('ignoreWarning')), 10/*s*/*1000/*ms*/, 'The button could not found.')
						.then(function (button) {
							return button.click();
						}.bind(this))
						.then(this.driver.sleep.bind(this.driver, 1/*s*/*1000/*ms*/));
				}
			}.bind(this))
			.then(function () {
				var timeout = 60/*s*/ * 1000/*ms*/;
				return this.driver.wait(this.executeScript(this.waitForUnbindingBeforeLoad), timeout, 'unbinding could not be completed.');
			}.bind(this))
			.then(function () {
				return this.executeScript(this.unbindBeforeUnload);
			}.bind(this))
			.then(function () {
				if(this.isMobile) {
					if (/chrome|safari/.test(this.browser)) {
						return capture.saveFullScreenShot(captureUrl);
					} else {
						return capture.saveScreenShot(captureUrl);
					}
				} else {
					if (/chrome|firefox/.test(this.browser)) {
						return capture.saveFullScreenShot(captureUrl);
					} else {
						return capture.saveScreenShot(captureUrl);
					}
				}
			}.bind(this))
			.catch(function (error) {
				assert(false, error);
			});
	},
	unbindBeforeUnload: function() {
		window.onbeforeunload = null;
		try {
			if(jQuery || $) {
				$(window).off('beforeunload');
			}
		} catch(e) {}
	},
	waitForUnbindingBeforeLoad: function() {
		var iaPageLoaded = document.readyState === 'complete' &&
			performance.timing.loadEventEnd &&
			performance.timing.loadEventEnd > 0;

		if(iaPageLoaded) {
			var jQueryScript = document.querySelector('script[src*="jquery"]');
			if(jQueryScript && jQueryScript.length > 0) {
				var __jquery__ = jQuery || $;
				if(__jquery__) {
					try{
						var beforeunload = __jquery__._data(__jquery__(window)[0], 'events').beforeunload;
						return beforeunload && beforeunload instanceof Array && beforeunload.length > 0;
					} catch(e) {
						return false;
					}
				} else {
					return false;
				}
			} else {
				return true;
			}
		} else {
			return false;
		}

	},
	func2str: function (func) {
		return func.toString();
	},
	executeScript: function (func) {
		return this.driver.executeScript('return (' + this.func2str(func) + '());');
	},
	getUrlForBasicAuth: function(url, id, pass) {
		let separator = '://';
		let splitURL = url.split(separator);
		let protocol = splitURL[0] + separator;
		let urlBody = splitURL[1];
		url = `${protocol}${id}:${pass}@${urlBody}`;
		return url;
	},
	getImageFileName: function(url) {
		return url.split('://')[1].replace(/\//g, '_') + '.png';
	},
	getDestPath: function(fileName) {
		return `${this.PATH.DEST_DIR}${this.browser}/${fileName}`;
	},
	start: function() {
		// console.time('\tProcessing Time');
		
		return Promise.resolve();
	},
	end: function() {
		return this.driver.quit().then(function () {
			if(this.isSauceLabs) {
				return this.sauceLabs.updateJob(this.driver.sessionID, {
					name: this.testName,
					passed: true
				});
			}
		}.bind(this));
		// console.log('\t---- COMPLETE ----');
		// console.timeEnd('\tProcessing Time');
	}
};



const isMocha = process.argv[1].match(/mocha$/);
if(isMocha) {

	browsers.forEach(function (browser) {

		let osAndBrowser = browser.split('/');
		let isOSIncluded = osAndBrowser.length > 0;
		let os = isOSIncluded ? osAndBrowser[1] : 'windows';
		browser = isOSIncluded ? osAndBrowser[0] : browser;

		let capium = new Capium(browser, os);

		describe('get screenshots / ' + browser, function () {
			this.timeout(60/*m*/*60/*s*/*1000/*ms*/);

			//Before
			before(function () {
				return capium.init();
			});

			//After
			after(function () {
				return capium.end();
			});

			//Main
			captureList.forEach(function (url) {
				it(url, function () {
					return capium.executeCapture(url);
				});
			});
		});
	});

} else {

	browsers.forEach(function (browser) {

		let capium = new Capium(browser);
		let promises = [];

		//Before
		capium.init().then(function () {

			//Main
			captureList.forEach(function (url) {
				let promise = capium.executeCapture(url).then(function () {
					console.log(url);
				});
				promises.push(promise);
			});

			//After
			return Promise.all(promises).then(capium.end.bind(Capium));
		});


	});
}