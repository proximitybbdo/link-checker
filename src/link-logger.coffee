l = require 'logme'

root = exports ? this

root.LinkLogger = class LinkLogger
  @LOG_CRITICAL = 'critical'
  @LOG_WARNING = 'warning'
  @LOG_INFO = 'info'

  @verbose = false

  @log: (log, state = 'debug') ->
    msg = "[LinkChecker] #{log}"
   
    if state == LinkLogger.LOG_CRITICAL || @verbose
      l.log(state, msg)

