(function() {
  var Link, root, u;

  u = require('url');

  root = typeof exports !== "undefined" && exports !== null ? exports : this;

  root.Link = Link = (function() {

    Link.REGEX_URL = /(http|https):\/\/([a-zA-Z0-9.]|%[0-9A-Za-z]|\/|:[0-9]?)*/;

    function Link(parent, url, base, code) {
      this.parent = parent;
      this.url = url;
      this.base = base;
      this.code = code != null ? code : -1;
      if (this.url.indexOf('http') < 0) this.url = u.resolve(this.base, this.url);
      this.request = null;
      this.error = null;
      this.u = null;
    }

    Link.prototype.init_url_parser = function() {
      if (!(this.u != null)) return this.u = u.parse(this.url);
    };

    Link.prototype.valid_process_link = function(base) {
      var valid;
      valid = true;
      this.init_url_parser();
      if (this.u.hostname !== u.parse(base).hostname) valid = false;
      return valid;
    };

    Link.prototype.valid_queue_link = function() {
      var valid;
      valid = true;
      this.init_url_parser();
      switch (this.u.protocol) {
        case 'mailto:':
        case 'javascript:':
        case 'skype:':
          valid = false;
      }
      if (!Link.REGEX_URL.test(this.url)) valid = false;
      if (this.url.split('#')[0] === this.parent) valid = false;
      return valid;
    };

    Link.prototype.kill_request = function() {
      if (this.request != null) {
        this.request.end();
        this.request = null;
      }
      if (this.u != null) return this.u = null;
    };

    Link.prototype.extension = function() {
      return this.url.split('.')[this.url.split('.').length - 1];
    };

    Link.prototype.to_string = function() {
      return "" + this.parent + " with " + this.url;
    };

    Link.prototype.piped_output = function() {
      return "" + this.code + "|" + this.url;
    };

    return Link;

  })();

}).call(this);
