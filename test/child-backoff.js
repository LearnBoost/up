
var httpServer = require('http').Server()
  , up = require('../lib/up')(httpServer, __dirname + '/child-server-backoff'
      , { workerPingInterval: '15ms', numWorkers: 1, keepAlive:true, minExpectedLifetime:0, backoffRespawns:-1, backoffInitDelay:10, backoffMaxDelay:1000 })
