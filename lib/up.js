
/**
 * Module dependencies.
 */

var fork = require('child_process').fork
  , qs = require('querystring')
  , eq = require('eq')
  , os = require('os')
  , ms = require('ms')
  , env = process.env.NODE_ENV
  , Distributor = require('distribute')
  , EventEmitter = require('events').EventEmitter
  , debug = require('debug')('up')

/**
 * Module exports.
 */

module.exports = exports = UpServer;

/**
 * Version.
 *
 * @api public
 */

exports.version = '0.2.1';

/**
 * Worker constructor.
 *
 * @api public
 */

exports.Worker = Worker;

/**
 * Number of CPUs available.
 */

var cpus = os.cpus().length;

/**
 * Default worker timeout.
 */

var workerTimeout = 'development' == env ? '500ms' : '10m';

/**
 * Default number of workers.
 */

var numWorkers = 'development' == env ? 1 : cpus;

/**
 * Default worker uptime threshold.
 */

var uptimeThreshold = '5s';

/**
 * UpServer factory/constructor.
 *
 * @param {String} module file
 * @param {Object} options
 * @api public
 */

function UpServer (server, file, opts) {
  if (this == global) return new UpServer(server, file, opts);

  Distributor.call(this, server);

  var self = this;
  opts = opts || {};

  this.file = file;
  this.numWorkers = eq(opts.numWorkers || numWorkers, { cpus: cpus });
  this.workerTimeout = ms(null != opts.workerTimeout
    ? opts.workerTimeout : workerTimeout);
  this.requires = opts.requires || [];
  this.assumeReady = opts.assumeReady === undefined ? true : !!opts.assumeReady;
  if (false !== opts.workerPingInterval) {
    this.workerPingInterval = ms(opts.workerPingInterval || '1m');
  }

  this.workers = [];
  this.spawning = [];
  this.lastIndex = -1;
  this.uptimeThreshold = ms(opts.uptimeThreshold || uptimeThreshold);

  if (opts.title) {
    this.title = opts.title;
    process.title = this.title + ' master';
  }

  // bind event handlers
  this.on('terminate', this.onTerminate);

  // setup workers
  this.spawnWorkers(this.numWorkers);
}

/**
 * Inherits from EventEmitter.
 */

UpServer.prototype.__proto__ = Distributor.prototype;

/**
 * Spawns a new worker when the worker has been terminated and
 * has lived longer that the minimum uptime.
 *
 * @param {Worker} worker
 * @api private
 */

UpServer.prototype.onTerminate = function(worker) {
  var uptime = new Date() - worker.startup;
  if (worker.exitCode === 1) {
    if (uptime > this.uptimeThreshold) {
      debug('spawning new worker to replace worker %d', worker.pid);
      this.spawnWorker();
    } else {
      debug('cyclic restart detected -- no more workers will be spawned.');
    }
  }
};

/**
 * Shutsdown either the workers being passed in or the
 * currently spawned workers.
 *
 * @param {Array} workers
 * @return {UpServer} for chaining
 * @api public
 */

UpServer.prototype.shutdownWorkers = function (workers) {
  workers = Array.isArray(workers) ? workers : this.workers;

  for (var i = 0, l = workers.length; i < l; i++) {
    workers[i].shutdown();
  }

  return this;
};

/**
 * Shutdown master.
 *
 * @param {Function} callback
 * @return {UpServer} for chaining
 */

UpServer.prototype.shutdown = function (fn) {
  if (this.shuttingdown) {
    debug('shutdown in process - ignoring shutdown');
    return this;
  }
  this.shutdownWorkers();
  fn && fn();
  return this;
};

/**
 * Hard shutdown, kills all worker processes and then exits.
 */

UpServer.prototype.exit = function(fn) {
  var all = [].concat(this.spawning).concat(this.workers);
  fn = fn || process.exit;
  all.forEach(function(worker) {
    debug('killing worker %d', worker.pid);
    worker.exit(0);
  });
  fn();
};


/**
 * Reloads the workers.
 *
 * @param {Function} callback
 * @return {UpServer} for chaining
 * @api public
 */

UpServer.prototype.reload = function (fn) {
  if (this.reloading) {
    debug('reloading in process - ignoring reload');
    return this;
  }

  var old = [].concat(this.workers)
    , self = this;

  debug('reloading - spawning %d new workers', this.numWorkers);
  this.spawnWorkers(this.numWorkers);

  this.once('spawn', function (worker) {
    debug('worker %s spawned - removing old workers', worker.pid);
    self.emit('reload');
    fn && fn();

    // shutdown old workers
    self.shutdownWorkers(old);
  });

  return this;
};

/**
 * Helper function to spawn multiple workers.
 *
 * @param {Number} number of workers to spawn
 * @api public
 */

UpServer.prototype.spawnWorkers = function (n) {
  debug('spawning %d workers from master %d', n, process.pid);
  for (var i = 0, l = n; i < l; i++) {
    this.spawnWorker();
  }
};

/**
 * Removes a worker for the round.
 *
 * @api public
 */

UpServer.prototype.removeWorker = function(fn) {
  debug('removing worker from master %d', process.pid);
  if (this.workers.length > 1) {
    for (var i = 0, l = this.workers.length; i < l; i++) {
      if (this.workers[i].readyState === 'spawned') {
        this.workers[i].shutdown();
        break;
      }
    }
  } else {
    debug('only 1 worker left -- ignoring remove');
  }
};

/**
 * Spawns a worker that binds to an available port.
 *
 * @api public
 */

UpServer.prototype.spawnWorker = function (fn) {
  var w = new Worker(this)
    , self = this

  // keep track that we're spawning
  this.spawning.push(w);

  w.on('stateChange', function () {
    switch (w.readyState) {
      case 'spawned':
        self.spawning.splice(self.spawning.indexOf(w), 1);
        self.workers.push(w);
        self.emit('spawn', w);
        break;

      case 'terminated':
        if (~self.spawning.indexOf(w)) {
          self.spawning.splice(self.spawning.indexOf(w), 1);
        }
        if (~self.workers.indexOf(w)) {
          self.workers.splice(self.workers.indexOf(w), 1);
          self.lastIndex = -1;
        }
        self.emit('terminate', w)
        break;
    }
  });
};

/**
 * Gets the next port in the round.
 *
 * @api private
 */

UpServer.prototype.nextWorker = function () {
  this.lastIndex++;
  if (!this.workers[this.lastIndex]) this.lastIndex = 0;
  return this.workers[this.lastIndex];
};

/**
 * Default HTTP/WS handler (overridden).
 * By default, `up` distributes based on a round robin.
 *
 * @api private
 */

UpServer.prototype.defaultHTTP =
UpServer.prototype.defaultWS = function (req, res, next) {

  var ioRegex = 
    /^\/socket\.io\/[^\/]*\/(xhr-polling|htmlfile|jsonp-polling)\/([^\?]+).*/;
  var matcher = req.url.match(ioRegex);

  if(this.workers.length && matcher && matcher.length > 2) {
    // transport = matcher[1], sid = matcher[2]
    var sid = matcher[2];
    var workerIndex = sid % this.workers.length;
    next(this.workers[workerIndex].port);
  } else if (this.workers.length) {
    next(this.nextWorker().port);
  } else {
    var self = this;
    this.once('spawn', function () {
      next(self.nextWorker().port);
    });
  }
};

/**
 * Worker constructor.
 *
 * @api private
 */

function Worker (server) {
  this.server = server;
  this.readyState = 'spawning';
  this.startup = new Date();

  var opts = JSON.stringify({
      file: server.file
    , requires: server.requires
    , assumeReady: server.assumeReady
    , pingInterval: server.workerPingInterval
    , title: server.title
  });

  this.proc = fork(__dirname + '/worker.js', [opts], { env: process.env });
  this.proc.on('message', this.onMessage.bind(this));
  this.proc.on('exit', this.onExit.bind(this));
  this.pid = this.proc.pid;
  debug('worker %s created', this.pid);
}

/**
 * Inherits from EventEmitter.
 */

Worker.prototype.__proto__ = EventEmitter.prototype;

/**
 * Called upon worker exit.
 * Sudden exits will mean the worker won't go through `terminating` state
 *
 * @api private
 */

Worker.prototype.onExit = function (code, signal) {
  debug('worker %s exited ' + (code === 1 ? 'unexpectedly': ''), this.pid);
  this.readyState = 'terminated';
  this.exitCode = code;
  this.emit('stateChange');
};

/**
 * Cross platform worker kill.
 *
 * @api private
 */

Worker.prototype.exit = function() {
  // set readyState so exit handlers do not attempt to spawn again
  this.readyState = 'terminated';
  switch (process.platform) {
      case 'win32':
        this.proc.kill();
        break;
      default:
        this.proc.kill('SIGHUP');
    }
};



/**
 * Handles an incoming message from the worker.
 *
 * @api private
 */

Worker.prototype.onMessage = function (msg) {
  switch (msg.type) {
    case 'addr':
      // avoid spawns after SIGHUP was sent
      if ('spawning' == this.readyState) {
        debug('worker %s listening on port %s', this.pid, msg.addr.port);
        this.port = msg.addr.port;
        this.readyState = 'spawned';
        this.emit('stateChange');
      }
      break;
  }
};

/**
 * Shuts down a worker.
 *
 * @api private
 */

Worker.prototype.shutdown = function () {
  if ('spawned' == this.readyState) {
    var timeout = this.server.workerTimeout;
    debug('telling worker %s to exit in %dms', this.proc.pid, timeout);
    this.proc.send({ type: 'die', time: timeout });
    this.readyState = 'terminating';
    this.emit('stateChange');
  } else if ('spawning' == this.readyState) {
    debug('killing spawning worker %s', this.pid);
    this.kill();
    this.readyState = 'terminating';
    this.emit('stateChange');
  }
};

/**
 * Send ready signal from within a worker
 *
 * @api public
 */

exports.ready = function () {
  process.emit('message', { type: 'ready' });
};
