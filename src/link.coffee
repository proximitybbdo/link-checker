u = require 'url'

root = exports ? this

root.Link = class Link
  @REGEX_URL = /(http|https):\/\/([a-zA-Z0-9.]|%[0-9A-Za-z]|\/|:[0-9]?)*/

  constructor: (@parent, @url, @base, @code = -1) ->
    @url = u.resolve(@base, @url) if @url.indexOf('http') < 0

    @request = null
    @error = null
    @u = null

  init_url_parser: () ->
    @u = u.parse @url if !@u?

  valid_process_link: (base) ->
    valid = true

    @init_url_parser()

    if @u.hostname != u.parse(base).hostname # only links on same host
      valid = false

    valid

  valid_queue_link: () ->
    valid = true

    @init_url_parser()

    # valid protocol
    switch @u.protocol
      when 'mailto:', 'javascript:', 'skype:'
        valid = false

    # valid http / https link
    valid = false if !Link.REGEX_URL.test @url

    # url is anchor of parent page?
    valid = false if @url.split('#')[0] == @parent

    valid

  kill_request: () ->
    if @request?
      @request.end()
      @request = null

    if @u?
      @u = null

  extension: () ->
    @url.split('.')[@url.split('.').length - 1]

  to_string: () ->
    "#{@parent} with #{@url}"

  piped_output: () ->
    "#{@code}|#{@url}"
