
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
  res.send({ pid: process.pid });
});

/**
 * Exports.
 */

module.exports = app;
