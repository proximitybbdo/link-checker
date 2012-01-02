u = require 'url'

root = exports ? this

###
Link model
###
root.Link = class Link
  @REGEX_URL = /(http|https):\/\/([a-zA-Z0-9.]|%[0-9A-Za-z]|\/|:[0-9]?)*/

  constructor: (@parent, @url, @base, @code = -1) ->
    @url = u.resolve(@base, @url) if @url.indexOf('http') < 0

    @request = null
    @error = null
    @u = null

  ###
  Make url parse ready
  ###
  init_url_parser: () ->
    @u = u.parse @url if !@u?
  
  ###
  Is it a valid process link
  Base on hostname, we don't want to go outside given domain
  We don't want to check the internetz
  ###
  valid_process_link: (base) ->
    valid = true

    @init_url_parser()

    if @u.hostname != u.parse(base).hostname # only links on same host
      valid = false

    valid
  
  ###
  It is a url?
  Is it the right protocol
  We don't want the anchor link of the parent page to be fetched
  ###
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

  ###
  Kill request instance of this link
  And kill the parser while we're at it
  ###
  kill_request: () ->
    if @request?
      @request.end()
      @request = null

    if @u?
      @u = null

  ###
  Link extension
  ###
  extension: () ->
    @url.split('.')[@url.split('.').length - 1]

  ###
  Output
  ###
  to_string: () ->
    "#{@parent} with #{@url}"

  ###
  Erroneous code
  ###
  is_error: () ->
    @code >= 400

  ###
  Piped output for cli usage
  ###
  piped_output: () ->
    "#{@code}|#{@url}"
