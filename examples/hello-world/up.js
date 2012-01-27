
var server = require('http').Server().listen(3000)

require('../../up')(server, __dirname + '/server')
