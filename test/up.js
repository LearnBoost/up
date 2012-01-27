
/**
 * Test dependencies
 */

var up = require('../lib/up')
  , http = require('http')
  , expect = require('expect.js')
  , request = require('superagent')
  , Distributor = require('distribute')

/**
 * Add helper to kill all processes.
 */

up.prototype.destroy = function () {
  for (var i in this.procs) {
    this.procs[i].kill('SIGHUP');
  };

  if (!this.destroyed) {
    this.on('spawn', this.destroy.bind(this));
    this.destroyed = true;
  }
}

/**
 * Suite.
 */

describe('up', function () {

  it('should be a distributor', function () {
    var srv = up(http.Server(), __dirname + '/server')
    expect(srv).to.be.a(Distributor);
    srv.destroy();
  });

  it('should load the workers', function (done) {
    var httpServer = http.Server().listen(6000, onListen)
      , srv = up(httpServer, __dirname + '/server')

    function onListen (err) {
      if (err) return done(err);
      request.get('http://localhost:6000', function (res) {
        var pid = res.body.pid;
        expect(pid).to.be.a('number');
        srv.destroy();
        done();
      });
    }
  });

  it('should round-robin the workers', function (done) {
    var httpServer = http.Server().listen(6001, onListen)
      , srv = up(httpServer, __dirname + '/server', { numWorkers: 2 })

    function onListen (err) {
      if (err) return done(err);

      srv.on('spawn', function () {
        // count workers
        if (2 != srv.ports.length) return;

        request.get('http://localhost:6001', function (res) {
          var pid1 = res.body.pid;
          expect(pid1).to.be.a('number');

          request.get('http://localhost:6001', function (res) {
            var pid2 = res.body.pid;
            expect(pid2).to.be.a('number');
            expect(pid2).to.not.equal(pid1);

            request.get('http://localhost:6001', function (res) {
              expect(res.body.pid).to.equal(pid1);

              request.get('http://localhost:6001', function (res) {
                expect(res.body.pid).to.equal(pid2);
                srv.destroy();
                done();
              });
            });
          });
        });
      });
    }
  });

  it('should expose ports and procs as public api', function (done) {
    var httpServer = http.Server().listen()
      , srv = up(httpServer, __dirname + '/server', { numWorkers: 2 })

    srv.once('spawn', function () {
      expect(srv.ports).to.have.length(1);
      srv.destroy();
      done();
    });
  });

  it('should reload workers', function (done) {
    var httpServer = http.Server().listen(6002, onListen)
      , srv = up(httpServer, __dirname + '/server', { numWorkers: 2 })
      , reloadFired = false

    function onListen (err) {
      if (err) return done(err);

      srv.on('spawn', onSpawn);

      function onSpawn () {
        // count workers
        if (2 == srv.ports.length) {
          // prevent race conditions with reload spawn events
          srv.removeListener('spawn', onSpawn);
        } else {
          return;
        }

        request.get('http://localhost:6002', function (res) {
          var pid1 = res.body.pid;
          expect(pid1).to.be.a('number');

          request.get('http://localhost:6002', function (res) {
            var pid2 = res.body.pid;
            expect(pid2).to.be.a('number');
            expect(pid2).to.not.equal(pid1);

            srv.once('reload', function () {
              reloadFired = true;
            });

            srv.reload(function () {
              // callback fires upon 1 spawning, so we set up another
              // listener for the remaining worker

              srv.once('spawn', function () {
                request.get('http://localhost:6002', function (res) {
                  expect(res.body.pid).to.not.equal(pid1);
                  pid1 = res.body.pid;

                  request.get('http://localhost:6002', function (res) {
                    expect(res.body.pid).to.not.equal(pid1);
                    expect(res.body.pid).to.not.equal(pid2);
                    expect(reloadFired).to.be(true);
                    srv.destroy();
                    done();
                  });
                });
              });
            });
          });
        });
      }
    }
  });

});
