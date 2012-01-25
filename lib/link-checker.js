(function() {
  var Link, LinkChecker, LinkLogger, fs, jsdom, ll, p, path, request, root;

  request = require('request');

  jsdom = require('jsdom');

  fs = require('fs');

  p = require('commander');

  path = require('path');

  root = typeof exports !== "undefined" && exports !== null ? exports : this;

  Link = require('./link').Link;

  LinkLogger = require('./link-logger').LinkLogger;

  ll = LinkLogger;

  /*
  Link Checker
  */

  root.LinkChecker = LinkChecker = (function() {

    LinkChecker.MAX_RETRIES = 2;

    LinkChecker.JQUERY = 'http://code.jquery.com/jquery-1.7.1.min.js';

    function LinkChecker(base, url) {
      this.base = base;
      this.url = url != null ? url : '';
      this.processed = [];
      this.queued = [];
      this.errored = [];
      this.exclude_process = ['gif', 'jpg', 'pdf', 'mp3', 'swf', 'jpeg'];
      this["try"] = 0;
      this.finished = false;
      this.end_interval_interval = 2000;
      this.end_interval = null;
    }

    /*
      Set verbose state of process
    */

    LinkChecker.prototype.verbose = function(verbose) {
      return ll.verbose = verbose;
    };

    /*
      Start process base on url given in constructor.
      Callback must be present
    */

    LinkChecker.prototype.start = function(callback) {
      var link,
        _this = this;
      this.callback = callback;
      ll.log("Start (verbose: " + ll.verbose + ")");
      if (!((this.callback != null) || typeof this.callback === 'function')) {
        throw new Error("No callback function is given.");
      }
      if (!((this.base != null) && Link.REGEX_URL.test(this.base))) {
        throw new Error("No valid base url given.");
      }
      link = new Link('', this.url, this.base);
      this.queue(link);
      return this.end_interval = setInterval(function() {
        return _this.check_end();
      }, this.end_interval_interval);
    };

    /*
      Check for end of process. This function will be through interval function
    */

    LinkChecker.prototype.check_end = function() {
      if (this.queued.length === 0 && !this.finished) {
        return this.finish_up();
      } else {
        return ll.log("Queued " + this.queued.length + " - Processed " + this.processed.length);
      }
    };

    /*
      Queue link and initiate request
    */

    LinkChecker.prototype.queue = function(link) {
      var request_o,
        _this = this;
      ll.log("Queue " + link.url);
      this.add_to_queue(link);
      try {
        request_o = {
          uri: link.url,
          timeout: 15 * 1000,
          maxRedirects: 0,
          maxSockets: 0,
          onResponse: function(error, response, body) {
            return _this.handle_page_response(link, error, response, body);
          }
        };
        return link.request = request(request_o, function(error, response, body) {
          return _this.handle_page_requested(link, error, response, body);
        });
      } catch (error) {
        ll.log("****************************** (request)", LinkLogger.LOG_WARNING);
        ll.log(err, LinkLogger.LOG_WARNING);
        return ll.log("Request error for " + link.url, LinkLogger.LOG_WARNING);
      }
    };

    /*
      Handle the first response of a requested page
    */

    LinkChecker.prototype.handle_page_response = function(link, error, response, body) {
      var content_length;
      if (!error && response.headers['connection'] !== 'close') {
        content_length = parseInt(parseInt(response.headers['content-length']) / 1024);
        if (content_length > 500 || this.exclude_process.indexOf(link.extension()) > -1) {
          ll.log("Too Large " + link.url + " - " + content_length + "Kb", LinkLogger.LOG_INFO);
          return this.remove_from_queue(link);
        }
      }
    };

    /*
      Handle the requested page when downloaded
    */

    LinkChecker.prototype.handle_page_requested = function(link, error, response, body) {
      if (!error && response.statusCode === 200) {
        link.code = response.statusCode;
        if (link.valid_process_link()) {
          return this.process_dom_page(link, body);
        } else {
          return this.remove_from_queue(link);
        }
      } else {
        if (!error) link.code = response.statusCode;
        if (error) link.error = error;
        ll.log("" + link.code + " at " + (link.to_string()), LinkLogger.LOG_CRITICAL);
        ll.log(error, LinkLogger.LOG_CRITICAL);
        this.errored.push(link);
        return this.remove_from_queue(link);
      }
    };

    /*
      Process DOM of fetched page
    */

    LinkChecker.prototype.process_dom_page = function(link, body) {
      var _this = this;
      try {
        return jsdom.env({
          html: body,
          scripts: [LinkChecker.JQUERY]
        }, function(error, window) {
          return _this.process_page(link, window.jQuery);
        });
      } catch (err) {
        ll.log("****************************** (jsdom)", LinkLogger.LOG_WARNING);
        ll.log(err, LinkLogger.LOG_WARNING);
        return this.remove_from_queue(link);
      }
    };

    /*
      Remove queued link URL from the queue
    */

    LinkChecker.prototype.remove_from_queue = function(link) {
      if (this.queued.indexOf(link.url > -1)) {
        this.queued.splice(this.queued.indexOf(link.url), 1);
      }
      return link.kill_request();
    };

    /*
      Add link URL to the queue
    */

    LinkChecker.prototype.add_to_queue = function(link) {
      return this.queued.push(link.url);
    };

    /*
      Process fetched page and look for links to process
      Accepts parent Link object and DOM
    */

    LinkChecker.prototype.process_page = function(parent, $) {
      var link, links, ref, _i, _len, _results;
      this.remove_from_queue(parent);
      links = [];
      ref = this;
      $('a').each(function(e) {
        return links.push(new Link(parent.url, $(this).attr('href'), ref.base));
      });
      links = this.clean_up_fetched_links(links);
      _results = [];
      for (_i = 0, _len = links.length; _i < _len; _i++) {
        link = links[_i];
        if (this.processed.indexOf(link.url) < 0) {
          _results.push(this.process_link(link));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    /*
      Process link and at to processed list
    */

    LinkChecker.prototype.process_link = function(link) {
      this.processed.push(link.url);
      return this.queue(link);
    };

    /*
      Make sure the links are unique in crawled list
    */

    LinkChecker.prototype.clean_up_fetched_links = function(links) {
      var cleansed, link, _i, _len;
      cleansed = [];
      for (_i = 0, _len = links.length; _i < _len; _i++) {
        link = links[_i];
        if (cleansed.indexOf(link) < 0 && link.valid_queue_link()) {
          cleansed.push(link);
        }
      }
      return cleansed;
    };

    /*
      Finish up the process. Check for errors 500 and retry them, otherwise trigger callback
    */

    LinkChecker.prototype.finish_up = function() {
      var link, retries, _i, _len, _ref;
      ll.log("Error: " + this.errored.length + ", retry: " + this["try"], LinkLogger.INFO);
      ll.log("Processed: " + this.processed.length, LinkLogger.INFO);
      clearInterval(this.end_interval);
      this.finished = true;
      retries = [];
      _ref = this.errored;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        link = _ref[_i];
        if (link.code >= 500) retries.push(this.queue(link));
      }
      if (retries.length > 0 && this["try"] <= LinkChecker.MAX_RETRIES) {
        ll.log("Retrying for " + this.errored.length + " links", LinkLogger.INFO);
        this["try"]++;
        return this.finished = false;
      } else {
        return this.callback(this.errored);
      }
    };

    return LinkChecker;

  })();

  /*
  Run function for standalone use
  */

  root.run = function() {
    var lc, package, time_start;
    package = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json')));
    time_start = null;
    p.version("" + package.name + " " + package.version).option('-u, --url [url]', 'URL to check').option('-f, --full', 'Full output, default is only http codes >= 400').option('-p, --piped', 'Piped output, default is json').option('-t, --timed', 'Time the duration of the process').option('-v, --verbose', 'Verbose').parse(process.argv);
    process.title = package.name;
    process.on('uncaughtException', function(err) {
      return console.error('uncaughtexception:' + err.stack);
    });
    process.on('exit', function(err) {
      return console.error('exit:' + err.stack);
    });
    lc = new LinkChecker(p.url);
    lc.verbose(p.verbose);
    if (p.timed) time_start = new Date().getTime();
    try {
      return lc.start(function(errors) {
        var error, _i, _len;
        for (_i = 0, _len = errors.length; _i < _len; _i++) {
          error = errors[_i];
          if (p.full) {
            if (p.piped) {
              console.log(error.piped_output());
            } else {
              console.log(error);
            }
          } else if (error.is_error()) {
            if (p.piped) {
              console.log(error.piped_output());
            } else {
              console.log(error);
            }
          }
        }
        if (p.timed) {
          console.log("\nDuration: " + ((new Date().getTime() - time_start) / 1000).toFixed() + "s");
        }
        return process.exit(1);
      });
    } catch (error) {
      return console.log(error);
    }
  };

}).call(this);
