(function() {
  var LinkLogger, l, root;

  l = require('logme');

  root = typeof exports !== "undefined" && exports !== null ? exports : this;

  root.LinkLogger = LinkLogger = (function() {

    function LinkLogger() {}

    LinkLogger.LOG_CRITICAL = 'critical';

    LinkLogger.LOG_WARNING = 'warning';

    LinkLogger.LOG_INFO = 'info';

    LinkLogger.verbose = false;

    LinkLogger.log = function(log, state) {
      var msg;
      if (state == null) state = 'debug';
      msg = "[LinkChecker] " + log;
      if (state === LinkLogger.LOG_CRITICAL || this.verbose) {
        return l.log(state, msg);
      }
    };

    return LinkLogger;

  })();

}).call(this);
