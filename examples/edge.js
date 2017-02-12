const Capium = require('./../lib/capium.js');

const capium = new Capium({
	pages: [
		"http://www.google.com",
		"http://www.apple.com"
	],
	caps: {
		"_browserName": "MicrosoftEdge"
	}
});

module.exports = capium.run();


