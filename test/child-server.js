
var client = require('net').connect(6003, function () {
  client.write(String(process.pid));
});

module.exports = require('http').Server()
