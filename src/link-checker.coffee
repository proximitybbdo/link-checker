request = require 'request'
jsdom   = require 'jsdom'
fs      = require 'fs'
u       = require 'url'
l       = require 'logme'
p       = require 'commander'
path    = require 'path'

root = exports ? this

class Link
  constructor: (@parent, @url, @base, @code = -1) ->
    @url = u.resolve(@base, @url) if @url.indexOf('http') < 0
    @u = u.parse @url
    @request = null

  valid_process_link: (base) ->
    valid = true

    if @u.hostname != u.parse(base).hostname # only links on same host
      valid = false

    valid

  valid_queue_link: () ->
    valid = true

    switch @u.protocol
      when 'mailto:', 'javascript:', 'skype:'
        valid = false
   
    valid

  kill_request: () ->
    if @request
      @request.end()
      @request = null

  extension: () ->
    @url.split('.')[@url.split('.').length - 1]

  to_string: () ->
    "#{@parent} with #{@url}"

root.LinkChecker = class LinkChecker
  @LOG_CRITICAL = 'critical'
  @LOG_INFO = 'info'

  @REGEX_EMAIL = /(http|https):\/\/([a-zA-Z0-9.]|%[0-9A-Za-z]|\/|:[0-9]?)*/

  @MAX_RETRIES = 2

  @JQUERY = 'http://code.jquery.com/jquery-1.7.1.min.js'
  
  constructor: (@base, @url = '') ->
    @log "Init"

    @verbose = false

    @processed = []
    @queued = []
    @errored = []
    @exclude_process = ['gif', 'jpg', 'pdf', 'mp3', 'swf', 'jpeg']

    @try = 0
    @finished = false

    @end_interval_interval = 2000
    @end_interval = null

  start: (@callback) ->
    @log "Start (verbose: " + @verbose + ")"
    
    if @base != undefined && @base.length > 0 && LinkChecker.REGEX_EMAIL.test @base
      link = new Link('', @url, @base)

      @queue link

      @end_interval = setInterval =>
        @check_end()
      , @end_interval_interval
    else
      throw new Error("No valid base url given")
 
  check_end: ->
    if @queued.length == 0 && !@finished
      @finish_up()
    else
      @log "Queued #{@queued.length} - Processed #{@processed.length}"
      @log "Queued #{@queued}"

  queue: (link) ->
    @log "Queue #{link.url} (#{typeof link})"
    
    @add_to_queue link
    
    link.request = request { uri: link.url, timeout: 20 * 1000,
    onResponse: (error, response, body) =>
      if !error && response.headers['connection'] != 'close'
        content_length = parseInt(response.headers['content-length']) / 1024

        if content_length > 500 || @exclude_process.indexOf(link.extension()) > -1
          @log "Too Large #{link.url} - #{content_length}Kb", LinkChecker.LOG_INFO
          @remove_from_queue link
    }, (error, response, body) =>
      if !error && response.statusCode == 200
        link.code = response.statusCode

        if link.valid_process_link(@base) # only process page when valid hostname
          try
            jsdom.env {html: body, scripts: [LinkChecker.JQUERY]}, (error, window) =>
              @process_page link, window.jQuery
          catch err
            @log "****************************** (jsdom)", LinkChecker.LOG_CRITICAL
            @log err, LinkChecker.LOG_CRITICAL

            @remove_from_queue link
        else
          @remove_from_queue link
      else
        if !error
          @log "#{response.statusCode} at #{link.to_string()}", LinkChecker.LOG_CRITICAL

          link.code = response.statusCode
        else
          @log error, LinkChecker.LOG_CRITICAL

        @errored.push link

        @remove_from_queue link

  remove_from_queue: (link) ->
    @queued.splice(@queued.indexOf(link.url), 1) if @queued.indexOf link.url > -1
   
    link.kill_request()

  add_to_queue: (link) ->
    @queued.push link.url

  process_page: (parent, $) ->
    @remove_from_queue parent

    links = []
    ref = this
    
    $('a').each (e) ->
      links.push(new Link(parent.url, $(this).attr('href'), ref.base))

    links = @clean_up_fetched_links links

    for link in links
      @process_link link if @processed.indexOf(link.url) < 0

  process_link: (link) ->
    @processed.push link.url
    @queue link

  clean_up_fetched_links: (links) ->
    cleansed = []

    for link in links
      cleansed.push(link) if cleansed.indexOf(link) < 0 && link.valid_queue_link()

    cleansed

  finish_up: ->
    @log "Error: #{@errored.length}, retry: #{@try}", LinkChecker.INFO
    @log "Processed: #{@processed.length}", LinkChecker.INFO

    clearInterval @end_interval
    @finished = true

    if @errored.length > 0 && @try <= LinkChecker.MAX_RETRIES
      retries = []

      for link in @errored
        retries.push(@queue link) if "#{link.code}".substr(0, 1) == "5"

      if retries.length > 0
        @log "Retrying for #{@errored.length} links", LinkChecker.INFO

        @try++
        @finished = false
      else
        @callback(@errored)
    else
      @callback(@errored)

  log: (log, state = 'debug') ->
    msg = "[LinkChecker] #{log}"
   
    if state == LinkChecker.LOG_CRITICAL || @verbose
      l.log(state, msg)

root.run = ->
  package = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json')))

  p
    .version("#{package.name} #{package.version}")
    .option('-u, --url [url]', 'URL to check')
    .option('-v, --verbose', 'Verbose')
    .parse(process.argv)

  process.title = package.name

  lc = new LinkChecker(p.url)
  lc.verbose = p.verbose

  try
    lc.start (errors) ->
      console.log errors

      process.exit(1)
  catch error
    console.log error

# process.on 'uncaughtException', (err) ->
#   console.error('uncaughtexception:' + err.stack)
