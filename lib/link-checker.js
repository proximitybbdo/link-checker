(function() {
  var Link, LinkChecker, fs, jsdom, l, p, path, request, root, u;

  request = require('request');

  jsdom = require('jsdom');

  fs = require('fs');

  u = require('url');

  l = require('logme');

  p = require('commander');

  path = require('path');

  root = typeof exports !== "undefined" && exports !== null ? exports : this;

  Link = (function() {

    function Link(parent, url, base, code) {
      this.parent = parent;
      this.url = url;
      this.base = base;
      this.code = code != null ? code : -1;
      if (this.url.indexOf('http') < 0) this.url = u.resolve(this.base, this.url);
      this.u = u.parse(this.url);
    }

    Link.prototype.valid_process_link = function(base) {
      var valid;
      valid = true;
      if (this.u.hostname !== u.parse(base).hostname) valid = false;
      return valid;
    };

    Link.prototype.valid_queue_link = function() {
      var valid;
      valid = true;
      switch (this.u.protocol) {
        case 'mailto:':
        case 'javascript:':
        case 'skype:':
          valid = false;
      }
      return valid;
    };

    Link.prototype.extension = function() {
      return this.url.split('.')[this.url.split('.').length - 1];
    };

    Link.prototype.to_string = function() {
      return "" + this.parent + " with " + this.url;
    };

    return Link;

  })();

  root.LinkChecker = LinkChecker = (function() {

    LinkChecker.LOG_CRITICAL = 'critical';

    LinkChecker.LOG_INFO = 'info';

    LinkChecker.REGEX_EMAIL = /(http|https):\/\/([a-zA-Z0-9.]|%[0-9A-Za-z]|\/|:[0-9]?)*/;

    LinkChecker.MAX_RETRIES = 2;

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
      var ref;
      this.callback = callback;
      this.log("Start (verbose: " + this.verbose + ")");
      if (this.base.length > 0 && LinkChecker.REGEX_EMAIL.test(this.base)) {
        ref = this;
        this.queue(new Link('', this.url, this.base));
        return this.end_interval = setInterval(function() {
          return ref.check_end();
        }, this.end_interval_interval);
      } else {
        return this.log("Invalid url (" + this.base + ") given", LinkChecker.LOG_CRITICAL);
      }
    };

    LinkChecker.prototype.check_end = function() {
      this.log("Check end, processing queue " + this.queued.length);
      this.log("Queued " + this.queued);
      if (this.processed.length % 20 === 0 && !this.finished) {
        this.log("Processed " + this.processed.length);
      }
      if (this.queued.length === 0 && !this.finished) return this.finish_up();
    };

    LinkChecker.prototype.queue = function(link) {
      var r, ref;
      ref = this;
      this.log("Queue " + link.url);
      this.add_to_queue(link);
      return r = request({
        uri: link.url,
        onResponse: function(error, response, body) {
          var content_length;
          if (!error && response.headers['connection'] !== 'close') {
            content_length = parseInt(response.headers['content-length']) / 1024;
            if (content_length > 500 || ref.exclude_process.indexOf(link.extension()) > -1) {
              ref.log("Too Large " + link.url + " - " + content_length + "Kb", LinkChecker.LOG_INFO);
              ref.remove_from_queue(link);
              return r.end();
            }
          }
        }
      }, function(error, response, body) {
        var ref_ref;
        if (!error && response.statusCode === 200) {
          if (link.valid_process_link(ref.base)) {
            try {
              ref_ref = ref;
              return jsdom.env({
                html: body,
                scripts: ['http://code.jquery.com/jquery-1.7.1.min.js']
              }, function(error, window) {
                return ref_ref.process_page(link, window.jQuery);
              });
            } catch (err) {
              ref.log("****************************** (jsdom)", LinkChecker.LOG_CRITICAL);
              ref.log(err, LinkChecker.LOG_CRITICAL);
              return ref.remove_from_queue(link);
            }
          } else {
            return ref.remove_from_queue(link);
          }
        } else {
          ref.remove_from_queue(link);
          if (!error) {
            ref.log("" + response.statusCode + " at " + (link.to_string()), LinkChecker.LOG_CRITICAL);
            link.code = response.statusCode;
          } else {
            ref.log(error, LinkChecker.LOG_CRITICAL);
          }
          return ref.errored.push(link);
        }
      });
    };

    LinkChecker.prototype.remove_from_queue = function(link) {
      if (this.queued.indexOf(link.url > -1)) {
        return this.queued.splice(this.queued.indexOf(link.url), 1);
      }
    };

    LinkChecker.prototype.add_to_queue = function(link) {
      return this.queued.push(link.url);
    };

    LinkChecker.prototype.process_page = function(parent, $) {
      var link, links, ref, _i, _len, _results;
      this.remove_from_queue(parent.url);
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
      this.finished = true;
      this.log("Error: " + this.errored.length + ", retry: " + this["try"], LinkChecker.INFO);
      this.log("Processed: " + this.processed.length, LinkChecker.INFO);
      clearInterval(this.end_interval);
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
    var lc;
    p.version(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'))).version).option('-u, --url [url]', 'URL to check').option('-v, --verbose', 'Verbose').parse(process.argv);
    console.log("LinkChecker CLI (" + p._version + ")");
    lc = new LinkChecker(p.url);
    lc.verbose = p.verbose;
    return lc.start(function(errors) {
      return console.log(errors);
    });
  };

}).call(this);
