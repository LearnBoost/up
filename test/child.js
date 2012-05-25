
var httpServer = require('http').Server()
  , up = require('../lib/up')(httpServer, __dirname + '/child-server'
      , { workerPingInterval: '15ms', numWorkers: 1 })
