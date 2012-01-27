
/**
 * Start server.
 */

var server = require(process.argv[2])
  , requires = JSON.parse(process.argv[3])

/**
 * Run requires.
 */

for (var i = 0, l = requires.length; i < l; i++) {
  require(requires[i]);
}

/**
 * Listen.
 */

server.listen(function () {
  process.send(server.address());
});

/**
 * RPC channel with master.
 */

process.on('message', function (obj) {
  if ('die' == obj.cmd) {
    setTimeout(function () {
      process.exit(0);
    }, obj.time);
  }
});
