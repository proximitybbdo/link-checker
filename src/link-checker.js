(function() {
  var LinkChecker, fs, jsdom, l, p, path, request;

  request = require('request');

  jsdom = require('jsdom');

  fs = require('fs');

  l = require('logme');

  p = require('commander');

  path = require('path');

  require('./link').Link;

  root.LinkChecker = LinkChecker = (function() {

    LinkChecker.LOG_CRITICAL = 'critical';

    LinkChecker.LOG_WARNING = 'warning';

    LinkChecker.LOG_INFO = 'info';

    LinkChecker.MAX_RETRIES = 2;

    LinkChecker.JQUERY = 'http://code.jquery.com/jquery-1.7.1.min.js';

    function LinkChecker(base, url) {
      this.base = base;
      this.url = url != null ? url : '';
      this.log("Init");
      this.verbose = false;
      this.processed = [];
      this.queued = [];
      this.errored = [];
      this.exclude_process = ['gif', 'jpg', 'pdf', 'mp3', 'swf', 'jpeg'];
      this["try"] = 0;
      this.finished = false;
      this.end_interval_interval = 2000;
      this.end_interval = null;
    }

    LinkChecker.prototype.start = function(callback) {
      var link,
        _this = this;
      this.callback = callback;
      this.log("Start (verbose: " + this.verbose + ")");
      if ((this.base != null) && Link.REGEX_URL.test(this.base)) {
        link = new Link('', this.url, this.base);
        this.queue(link);
        return this.end_interval = setInterval(function() {
          return _this.check_end();
        }, this.end_interval_interval);
      } else {
        throw new Error("No valid base url given");
      }
    };

    LinkChecker.prototype.check_end = function() {
      if (this.queued.length === 0 && !this.finished) {
        return this.finish_up();
      } else {
        return this.log("Queued " + this.queued.length + " - Processed " + this.processed.length);
      }
    };

    LinkChecker.prototype.queue = function(link) {
      var _this = this;
      this.log("Queue " + link.url + " (" + (typeof link) + ")");
      this.add_to_queue(link);
      try {
        return link.request = request({
          uri: link.url,
          timeout: 20 * 1000,
          onResponse: function(error, response, body) {
            var content_length;
            if (!error && response.headers['connection'] !== 'close') {
              content_length = parseInt(response.headers['content-length']) / 1024;
              if (content_length > 500 || _this.exclude_process.indexOf(link.extension()) > -1) {
                _this.log("Too Large " + link.url + " - " + content_length + "Kb", LinkChecker.LOG_INFO);
                return _this.remove_from_queue(link);
              }
            }
          }
        }, function(error, response, body) {
          _this.log("Result (" + link.url + ")");
          if (!error && response.statusCode === 200) {
            link.code = response.statusCode;
            if (link.valid_process_link(_this.base)) {
              try {
                return jsdom.env({
                  html: body,
                  scripts: [LinkChecker.JQUERY]
                }, function(error, window) {
                  return _this.process_page(link, window.jQuery);
                });
              } catch (err) {
                _this.log("****************************** (jsdom)", LinkChecker.LOG_WARNING);
                _this.log(err, LinkChecker.LOG_WARNING);
                return _this.remove_from_queue(link);
              }
            } else {
              return _this.remove_from_queue(link);
            }
          } else {
            if (!error) {
              link.code = response.statusCode;
            } else {
              _this.log(error, LinkChecker.LOG_CRITICAL);
            }
            _this.log("" + link.code + " at " + (link.to_string()), LinkChecker.LOG_CRITICAL);
            _this.errored.push(link);
            return _this.remove_from_queue(link);
          }
        });
      } catch (error) {
        this.log("****************************** (request)", LinkChecker.LOG_WARNING);
        this.log(err, LinkChecker.LOG_WARNING);
        return this.log("Request error for " + link.url, LinkChecker.LOG_WARNING);
      }
    };

    LinkChecker.prototype.remove_from_queue = function(link) {
      if (this.queued.indexOf(link.url > -1)) {
        this.queued.splice(this.queued.indexOf(link.url), 1);
      }
      return link.kill_request();
    };

    LinkChecker.prototype.add_to_queue = function(link) {
      return this.queued.push(link.url);
    };

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

    LinkChecker.prototype.process_link = function(link) {
      this.processed.push(link.url);
      return this.queue(link);
    };

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

    LinkChecker.prototype.finish_up = function() {
      var link, retries, _i, _len, _ref;
      this.log("Error: " + this.errored.length + ", retry: " + this["try"], LinkChecker.INFO);
      this.log("Processed: " + this.processed.length, LinkChecker.INFO);
      clearInterval(this.end_interval);
      this.finished = true;
      if (this.errored.length > 0 && this["try"] <= LinkChecker.MAX_RETRIES) {
        retries = [];
        _ref = this.errored;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          link = _ref[_i];
          if (("" + link.code).substr(0, 1) === "5") {
            retries.push(this.queue(link));
          }
        }
        if (retries.length > 0) {
          this.log("Retrying for " + this.errored.length + " links", LinkChecker.INFO);
          this["try"]++;
          return this.finished = false;
        } else {
          return this.callback(this.errored);
        }
      } else {
        return this.callback(this.errored);
      }
    };

    LinkChecker.prototype.log = function(log, state) {
      var msg;
      if (state == null) state = 'debug';
      msg = "[LinkChecker] " + log;
      if (state === LinkChecker.LOG_CRITICAL || this.verbose) {
        return l.log(state, msg);
      }
    };

    return LinkChecker;

  })();

  root.run = function() {
    var lc, package;
    package = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json')));
    p.version("" + package.name + " " + package.version).option('-u, --url [url]', 'URL to check').option('-v, --verbose', 'Verbose').parse(process.argv);
    process.title = package.name;
    lc = new LinkChecker(p.url);
    lc.verbose = p.verbose;
    try {
      return lc.start(function(errors) {
        console.log(errors);
        return process.exit(1);
      });
    } catch (error) {
      return console.log(error);
    }
  };

}).call(this);
