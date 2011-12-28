(function() {
  var LinkChecker, fs, jsdom, l, p, path, request, root, u;

  request = require('request');

  jsdom = require('jsdom');

  fs = require('fs');

  u = require('url');

  l = require('logme');

  p = require('commander');

  path = require('path');

  root = typeof exports !== "undefined" && exports !== null ? exports : this;

  root.LinkChecker = LinkChecker = (function() {

    LinkChecker.LOG_CRITICAL = 'critical';

    LinkChecker.LOG_INFO = 'info';

    LinkChecker.REGEX_EMAIL = /(http|https):\/\/([a-zA-Z0-9.]|%[0-9A-Za-z]|\/|:[0-9]?)*/;

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
      this.retries = 1;
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
        this.queue(this.create_link(this.url));
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

    LinkChecker.prototype.queue = function(url) {
      var r, ref;
      ref = this;
      if (typeof url === 'string') {
        url = {
          current: '',
          link: url
        };
      }
      this.log("Queue " + url.link);
      this.queued.push(url.link);
      return r = request({
        uri: url.link,
        onResponse: function(error, response, body) {
          var content_length, ext;
          if (!error && response.headers['connection'] !== 'close') {
            content_length = parseInt(response.headers['content-length']) / 1024;
            ext = url.link.split('.')[url.link.split('.').length - 1];
            if (content_length > 500 || ref.exclude_process.indexOf(ext) > -1) {
              ref.log("Too Large " + url.link + " - " + content_length + "Kb", LinkChecker.LOG_INFO);
              ref.remove_from_queue(url.link);
              return r.end();
            }
          }
        }
      }, function(error, response, body) {
        var ref_ref;
        if (!error && response.statusCode === 200) {
          if (ref.valid_process_link(url.link)) {
            try {
              ref_ref = ref;
              return jsdom.env({
                html: body,
                scripts: ['http://code.jquery.com/jquery-1.7.1.min.js']
              }, function(error, window) {
                return ref_ref.process_page(url.link, window.jQuery);
              });
            } catch (err) {
              ref.log("****************************** (jsdom)", LinkChecker.LOG_CRITICAL);
              ref.log(err, LinkChecker.LOG_CRITICAL);
              return ref.remove_from_queue(url.link);
            }
          } else {
            return ref.remove_from_queue(url.link);
          }
        } else {
          ref.remove_from_queue(url.link);
          if (!error) {
            ref.log("" + response.statusCode + " at page " + url.current + " for " + url.link, LinkChecker.LOG_CRITICAL);
            return ref.errored.push({
              current: url.current,
              link: url.link,
              code: response.statusCode
            });
          } else {
            ref.log(error, LinkChecker.LOG_CRITICAL);
            return ref.errored.push({
              current: url.current,
              link: url.link,
              code: -1
            });
          }
        }
      });
    };

    LinkChecker.prototype.remove_from_queue = function(url) {
      if (this.queued.indexOf(url > -1)) {
        return this.queued.splice(this.queued.indexOf(url), 1);
      }
    };

    LinkChecker.prototype.process_page = function(url, $) {
      var link, links, _i, _len, _results;
      this.remove_from_queue(url);
      links = [];
      $('a').each(function(e) {
        return links.push($(this).attr('href'));
      });
      links = this.clean_up_links(url, links);
      _results = [];
      for (_i = 0, _len = links.length; _i < _len; _i++) {
        link = links[_i];
        if (this.processed.indexOf(link.link) < 0) {
          _results.push(this.process_link(link));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    LinkChecker.prototype.process_link = function(link) {
      this.processed.push(link.link);
      return this.queue(link);
    };

    LinkChecker.prototype.clean_up_links = function(url, links) {
      var cleansed, link, _i, _len;
      cleansed = [];
      for (_i = 0, _len = links.length; _i < _len; _i++) {
        link = links[_i];
        link = this.create_link(link);
        if (cleansed.indexOf(link) < 0 && this.valid_queue_link(link)) {
          cleansed.push({
            current: url,
            link: link
          });
        }
      }
      return cleansed;
    };

    LinkChecker.prototype.create_link = function(link) {
      if (link.indexOf('http') < 0) {
        return u.resolve(this.base, link);
      } else {
        return link;
      }
    };

    LinkChecker.prototype.valid_process_link = function(link) {
      var valid;
      link = u.parse(link);
      valid = true;
      if (link.hostname !== u.parse(this.base).hostname) valid = false;
      return valid;
    };

    LinkChecker.prototype.valid_queue_link = function(link) {
      var valid;
      link = u.parse(link);
      valid = true;
      switch (link.protocol) {
        case 'mailto:':
        case 'javascript:':
        case 'skype:':
          valid = false;
      }
      return valid;
    };

    LinkChecker.prototype.finish_up = function() {
      var link, ref, retries, _i, _len, _ref;
      this.finished = true;
      this.log("Finish up", LinkChecker.INFO);
      this.log("Error: " + this.errored.length + ", retry: " + this["try"], LinkChecker.INFO);
      this.log("Processed: " + this.processed.length, LinkChecker.INFO);
      clearInterval(this.end_interval);
      if (this.errored.length > 0 && this["try"] <= this.retries) {
        ref = this;
        retries = [];
        _ref = this.errored;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          link = _ref[_i];
          if (("" + link.code).substr(0, 1) === "5") retries.push(ref.queue(link));
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
