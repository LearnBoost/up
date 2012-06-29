
/**
 * Module dependencies.
 */

var express = require('express')

/**
 * Initialize server
 */

var app = express.createServer();

/**
 * Default route.
 */

app.get('/', function (req, res) {
  res.send({ pid: process.pid, title: process.title });
});

/**
 * Socket.io mock route.
 */

app.get('/socket.io/*', function (req, res) {
  res.send({ pid: process.pid });
});

/**
 * Simulate an error that does not breach uptime threshold.
 */

app.get('/throw', function (req, res) {
	setTimeout(function () {
		throw new Error('ahhhh');
	}, 10);
	res.send({ ok: 'ok' });
});


/**
 * Exports.
 */

module.exports = app;
