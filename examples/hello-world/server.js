
/*!
 * This file exports a server that will get run by multiple workers
 * that can seamlessly reload.
 *
 * This example can be run in two ways:
 *
 *  a. Through the JavaScript API
 *
 *      node up.js
 *
 *  b. With the up CLI:
 *
 *      up server.js
 */

/**
 * Module dependencies.
 */

var http = require('http')

/**
 * Module exports.
 */

module.exports = http.Server(function (req, res) {
  res.writeHead(200);
  res.end('Hello world from process ' + process.pid);
});
