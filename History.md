
0.2.1 / 2012-06-25
==================

  * Package: update commander to v0.6.1
  * Restrict the suicide test to only spawn 1 worker
  * Regain non-windows compatibility
  * Revert "pegged express devDependency version because of breaking change in 3.0.0alpha1"

0.2.0 / 2012-06-20
==================

  * Ensure all workers are gone before spawning if the timeout is zero.
  * Add support for watching json changes and use `file` instead of `filename`.
  * Merge pull request #27 from mugami-ast/connect2-fix
  * Use the preferred "raw mode" API depending on the node version.
  * Don't use the 'keypress' event.
  * Windows compatibility
  * worker: call address() on the callback context instead of the server for Connect 2.0 compatability
  * Add sticky worker routing for socket.io xhr-polling, jsonp-polling, htmlfile calls
  * Add --pidfile to the README.
  * Add an option to write a file with the pid.

0.1.7 / 2012-02-28
==================

  * Re-release 0.1.6.

0.1.6 / 2012-02-28
==================

  * Fixed preservation of DEBUG env.

0.1.5 / 2012-02-27
==================

  * Added reloading with ctrl+r
  * Bumped distribute

0.1.4 / 2012-02-17
==================

  * Removed ping instrumentation.

0.1.3 / 2012-02-03
==================

  * Bumped distribute to 0.1.3.

0.1.2 / 2012-01-31
==================

  * Added: commit suicide when master is down. [tj]
  * Fixed; pass along env to workers. Closes #6. [tj]

0.1.1 / 2012-01-30
==================

  * Avoid crash when `--timeout` flag is not supplied [marco]

0.1.0 / 2012-01-26
==================

  * Initial release
