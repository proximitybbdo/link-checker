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

  extension: () ->
    @url.split('.')[@url.split('.').length - 1]

  to_string: () ->
    "#{@parent} with #{@url}"

root.LinkChecker = class LinkChecker
  @LOG_CRITICAL = 'critical'
  @LOG_INFO = 'info'

  @REGEX_EMAIL = /(http|https):\/\/([a-zA-Z0-9.]|%[0-9A-Za-z]|\/|:[0-9]?)*/

  @MAX_RETRIES = 2
  
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
      ref = this
      
      @queue new Link('', @url, @base)

      @end_interval = setInterval ->
        ref.check_end()
      , @end_interval_interval
    else
      throw new Error("No valid base url given")
 
  check_end: ->
    if @queued.length == 0 && !@finished
      @finish_up()
    else
      @log "Queued #{@queued.length} - Processed #{@processed.length}"

  queue: (link) ->
    @log "Queue #{link.url}"

    @add_to_queue link
    
    ref = this
    r = request { uri: link.url,
    onResponse: (error, response, body) ->
      if !error && response.headers['connection'] != 'close'
        content_length = parseInt(response.headers['content-length']) / 1024

        if content_length > 500 || ref.exclude_process.indexOf(link.extension()) > -1
          ref.log "Too Large #{link.url} - #{content_length}Kb", LinkChecker.LOG_INFO
          ref.remove_from_queue link

          r.end()
    }, (error, response, body) ->
      if !error && response.statusCode == 200
        if link.valid_process_link(ref.base) # only process page when valid hostname
          try
            ref_ref = ref
         
            jsdom.env {html: body, scripts: ['http://code.jquery.com/jquery-1.7.1.min.js']}, (error, window) ->
              ref_ref.process_page link, window.jQuery
          catch err
            ref.log "****************************** (jsdom)", LinkChecker.LOG_CRITICAL
            ref.log err, LinkChecker.LOG_CRITICAL

            ref.remove_from_queue link
        else
          ref.remove_from_queue link
      else
        ref.remove_from_queue link

        if !error
          ref.log "#{response.statusCode} at #{link.to_string()}", LinkChecker.LOG_CRITICAL

          link.code = response.statusCode
        else
          ref.log error, LinkChecker.LOG_CRITICAL

        ref.errored.push link

  remove_from_queue: (link) ->
    @queued.splice(@queued.indexOf(link.url), 1) if @queued.indexOf link.url > -1

  add_to_queue: (link) ->
    @queued.push link.url

  process_page: (parent, $) ->
    @remove_from_queue parent.url

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
