var options = JSON.parse(process.argv[2])
  , requires = options.requires;

/**
 * Run requires before loading the server file.
 * This ensures that any requires module that
 * changes the behavior of the process or
 * require() function (such as coffeescript)
 * are present.
 */

for (var i = 0, l = requires.length; i < l; i++) {
  require(requires[i]);
}


/**
 * Start server.
 */

var server = require(options.file)
  , assumeReady = options.assumeReady
  , addr = null;

/**
 * Set our process title.
 */

if (options.title) {
  process.title = options.title + ' worker';
}

/**
 * Tell master, that we are and that we are ready
 */

function ready() {
  if (addr === null) return assumeReady = true;
  process.send({
    type: 'addr',
    addr: addr
  });
}


/**
 * Listen.
 */

server.listen(function () {
  addr = this.address();
  if (assumeReady) {
    ready();
  }
});

/**
 * RPC channel with master.
 */

process.on('message', function (msg) {
  switch (msg.type) {
    case 'die':
      setTimeout(function () {
        process.kill(process.pid);
      }, msg.time);
      break;
    case 'ready':
      ready();
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
