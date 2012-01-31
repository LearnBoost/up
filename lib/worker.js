
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
  process.send({
    type: 'addr',
    addr: server.address()
  });
});

/**
 * RPC channel with master.
 */

process.on('message', function (msg) {
  switch (msg.type) {
    case 'die':
      setTimeout(function () {
        process.exit(0);
      }, msg.time);
      break;
  } 
});

/**
 * Ping master, on failure commit suicide
 * as we're lost in limbo.
 * 
 * TODO: ideally we just use process.ppid (which doesn't exist)
 * and nul-signal the parent.
 */

setInterval(function(){
  try {
    process.send({ type: 'ping' });
  } catch (err) {
    console.error('master killed, committing suicide');
    process.exit(1);
  }
}, 60 * 1000);