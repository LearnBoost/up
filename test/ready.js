var up = require('..');

setTimeout(function(){
  process.send({type:'test, im ready'});
  up.ready();
}, 0);

module.exports = require('http').Server();
