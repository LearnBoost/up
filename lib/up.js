
/**
 * Module dependencies.
 */

var fork = require('child_process').fork
  , qs = require('querystring')
  , eq = require('eq')
  , os = require('os')
  , ms = require('ms')
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

exports.version = '0.1.0';

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

  var defaultWorkers = 'development' == process.env.NODE_ENV ? 1 : cpus;

  this.file = file;
  this.numWorkers = eq(opts.numWorkers || defaultWorkers, { cpus: cpus });
  this.workerTimeout = ms(null != opts.workerTimeout ? opts.workerTimeout : '10m');
  this.requires = opts.requires || [];

  this.workers = [];
  this.spawning = [];
  this.lastIndex = -1;

  // setup workers
  this.spawnWorkers(this.numWorkers);
};

/**
 * Inherits from EventEmitter.
 */

UpServer.prototype.__proto__ = Distributor.prototype;

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

  // remove all workers in the spawning state
  for (var i = 0, l = this.spawning.length; i < l; i++) {
    this.spawning[i].shutdown();
  }

  // snapshot what workers we'll shut down
  var reload = [].concat(this.workers)
    , self = this

  debug('reloading - spawning %d new workers', this.numWorkers);
  this.spawnWorkers(this.numWorkers);

  this.once('spawn', function () {
    debug('worker spawned - removing old workers');
    self.emit('reload');
    fn && fn();

    // shut down old workers
    for (var i = 0, l = reload.length; i < l; i++) {
      reload[i].shutdown();
    }
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

      case 'terminating':
      case 'terminated':
        if (~self.spawning.indexOf(self.spawning.indexOf(w))) {
          self.spawning.splice(self.spawning.indexOf(w), 1);
        }
        if (~self.workers.indexOf(w)) {
          self.workers.splice(self.workers.indexOf(w), 1);
          self.lastIndex = -1;
          // @TODO: auto-add workers ?
        }
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
  if (this.workers.length) {
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
  this.proc = fork(__dirname + '/worker.js'
    , [server.file, JSON.stringify(server.requires)]);
  this.proc.on('message', this.onMessage.bind(this));
  this.proc.on('exit', this.onExit.bind(this));
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

Worker.prototype.onExit = function () {
  this.readyState = 'terminated';
  this.emit('stateChange');
};

/**
 * Handles an incoming message from the worker.
 *
 * @api private
 */

Worker.prototype.onMessage = function (addr) {
  // avoid spawns after SIGHUP was sent
  if ('spawning' == this.readyState) {
    this.port = addr.port;
    this.readyState = 'spawned';
    this.emit('stateChange');
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
    this.proc.send({ cmd: 'die', time: timeout });
    this.readyState = 'terminating';
    this.emit('stateChange');
  } else if ('spawning' == this.readyState) {
    debug('killing spawning worker');
    this.proc.kill('SIGHUP');
    this.readyState = 'terminating';
    this.emit('stateChange');
  }
};
