
/**
 * Start server.
 */

var options = JSON.parse(process.argv[2])
  , server = require(options.file)
  , requires = options.requires

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
      type: 'addr'
    , addr: this.address()
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

if (options.pingInterval) {
  setInterval(function(){
    try {
      process.send({ type: 'ping' });
    } catch (err) {
      console.error('master killed, committing suicide');
      process.exit(1);
    }
  }, options.pingInterval);
}
