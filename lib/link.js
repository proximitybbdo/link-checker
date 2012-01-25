(function() {
  var Link, root, u;

  u = require('url');

  root = typeof exports !== "undefined" && exports !== null ? exports : this;

  /*
  Link model
  */

  root.Link = Link = (function() {

    Link.REGEX_URL = /(http|https):\/\/([a-zA-Z0-9.]|%[0-9A-Za-z]|\/|:[0-9]?)*/;

    function Link(parent, url, base, code) {
      this.parent = parent;
      this.url = url;
      this.base = base;
      this.code = code != null ? code : -1;
      if (!((this.parent != null) || (this.url != null) || (this.base != null))) {
        throw new Error("Invalid or insufficient arguments given.");
      }
      if (this.url.indexOf('http') < 0) this.url = u.resolve(this.base, this.url);
      if (this.parent[this.parent.length - 1] !== '/') {
        this.parent = "" + this.parent + "/";
      }
      this.request = null;
      this.error = null;
      this.u = null;
    }

    /*
      Make url parse ready
    */

    Link.prototype.init_url_parser = function() {
      if (!(this.u != null)) return this.u = u.parse(this.url);
    };

    /*
      Is it a valid process link
      Base on hostname, we don't want to go outside given domain
      We don't want to check the internetz
    */

    Link.prototype.valid_process_link = function() {
      var valid;
      valid = true;
      this.init_url_parser();
      if (this.u.hostname !== u.parse(this.base).hostname) valid = false;
      return valid;
    };

    /*
      It is a url?
      Is it the right protocol
      We don't want the anchor link of the parent page to be fetched
    */

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

    /*
      Kill request instance of this link
      And kill the parser while we're at it
    */

    Link.prototype.kill_request = function() {
      if (this.request != null) {
        this.request.end();
        this.request = null;
      }
      if (this.u != null) return this.u = null;
    };

    /*
      Link extension
    */

    Link.prototype.extension = function() {
      return this.url.split('.')[this.url.split('.').length - 1];
    };

    /*
      Output
    */

    Link.prototype.to_string = function() {
      return "" + this.parent + " with " + this.url;
    };

    /*
      Erroneous code
    */

    Link.prototype.is_error = function() {
      return this.code >= 400;
    };

    /*
      Piped output for cli usage
    */

    Link.prototype.piped_output = function() {
      return "" + this.code + "|" + this.url;
    };

    return Link;

  })();

}).call(this);
