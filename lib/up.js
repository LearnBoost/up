
/**
 * Module dependencies.
 */

var fork = require('child_process').fork
  , qs = require('querystring')
  , eq = require('eq')
  , os = require('os')
  , ms = require('ms')
  , Distributor = require('distribute')
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
  this.requires = opts.requires;

  this.ports = [];
  this.portsMap = {};
  this.procs = {};
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
 * @return {UpServer} for chaining
 * @api public
 */

UpServer.prototype.reload = function () {
  if (this.reloading) {
    debug('reloading in process - ignoring reload');
    return this;
  }

  // we keep track of how many workers will exit
  var num = this.ports.length
    , self = this

  debug('reloading - spawning %d new workers', this.numWorkers);

  this.spawnWorkers(this.numWorkers);
  this.reloading = true;

  this.once('spawn', function () {
    debug('worker spawned - removing old workers');
    self.reloading = false;
    self.emit('reload');

    var reload = this.ports.splice(0, num)
      , proc, port

    for (var i = 0, l = reload.length; i < l; i++) {
      port = reload[i];
      proc = self.procs[port];
      debug('telling worker %s to exit in %dms', proc.pid, self.workerTimeout);
      proc.send({ cmd: 'die', time: self.workerTimeout });
      proc.on('exit', function () {
        debug('worker %s terminated', proc.pid);
      });
      delete self.procs[port];
      delete self.portsMap[port];
    }

    this.lastIndex = -1;
  });

  return this;
};

/**
 * Spawns multiple workers.
 *
 * @param {Number} number of workers to spawn
 * @param {Function} callback upon all are added
 * @api public
 */

UpServer.prototype.spawnWorkers = function (n, fn) {
  debug('spawning %d workers from master %d', n, process.pid);
  for (var i = 0, l = n; i < l; i++) {
    this.spawnWorker(function () {
      --n || fn && fn();
    });
  }
};

/**
 * Spawns a worker that binds to an available port.
 *
 * @param {Function} fn that gets called with the bound port
 * @api private
 */

UpServer.prototype.spawnWorker = function (fn) {
  var args = [this.file, JSON.stringify(this.requires)]
    , proc = fork(__dirname + '/worker.js', args)
    , self = this

  proc.on('message', function (addr) {
    debug('worker spawned on port %d with pid %d', addr.port, proc.pid);
    var port = addr.port;
    self.ports.push(port);
    self.portsMap[port] = true;
    self.procs[port] = proc;
    self.emit('spawn', port);

    proc.on('exit', function () {
      // we check for a premature death
      if (self.portsMap[port]) {
        debug('sudden death of worker on port %d with pid %d', port, proc.pid);
        self.ports.splice(self.ports.indexOf(port), 1);
        delete self.portsMap[port];
        delete self.procs[port];

        // we reset the round
        self.lastIndex = -1;
      }
    });

    fn();
  });
};

/**
 * Gets the next port in the round.
 *
 * @api private
 */

UpServer.prototype.nextWorker = function () {
  this.lastIndex++;
  if (!this.ports[this.lastIndex]) this.lastIndex = 0;
  return this.ports[this.lastIndex];
};

/**
 * Default HTTP/WS handler (overridden).
 * By default, `up` distributes based on a round robin.
 *
 * @api private
 */

UpServer.prototype.defaultHTTP =
UpServer.prototype.defaultWS = function (req, res, next) {
  next(this.nextWorker());
};
