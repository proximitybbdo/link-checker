request = require 'request'
jsdom = require 'jsdom'
fs = require 'fs'
p = require 'commander'
path = require 'path'

root = exports ? this

Link = require('./link').Link
LinkLogger = require('./link-logger').LinkLogger

ll = LinkLogger

root.LinkChecker = class LinkChecker
  @MAX_RETRIES = 2

  @JQUERY = 'http://code.jquery.com/jquery-1.7.1.min.js'
  
  constructor: (@base, @url = '') ->
    @processed = []
    @queued = []
    @errored = []
    @exclude_process = ['gif', 'jpg', 'pdf', 'mp3', 'swf', 'jpeg']

    @try = 0
    @finished = false

    @end_interval_interval = 2000
    @end_interval = null

  ###
  Set verbose state of process
  ###
  verbose: (verbose) ->
    ll.verbose = verbose

  ###
  Start process base on url given in constructor.
  Callback must be present
  ###
  start: (@callback) ->
    ll.log "Start (verbose: " + ll.verbose + ")"

    throw new Error("No callback function is given.") unless @callback? || typeof @callback == 'function'
    throw new Error("No valid base url given.") unless @base? && Link.REGEX_URL.test @base
    
    link = new Link('', @url, @base)

    @queue link

    @end_interval = setInterval =>
      @check_end()
    , @end_interval_interval

  ###
  Check for end of process. This function will be through interval function
  ###
  check_end: ->
    if @queued.length == 0 && !@finished
      @finish_up()
    else
      ll.log "Queued #{@queued.length} - Processed #{@processed.length}"
      # ll.log "Queued #{@queued}"

  ###
  Queue link and initiate request
  ###
  queue: (link) ->
    ll.log "Queue #{link.url}" #  (#{typeof link})"
    
    @add_to_queue link
    
    try
      request_o = {
        uri: link.url,
        timeout: 15 * 1000, # 15s
        maxRedirects: 0,
        maxSockets: 0,
        onResponse: (error, response, body) =>
          if !error && response.headers['connection'] != 'close'
            content_length = parseInt(parseInt(response.headers['content-length']) / 1024)

            if content_length > 500 || @exclude_process.indexOf(link.extension()) > -1
              ll.log "Too Large #{link.url} - #{content_length}Kb", LinkLogger.LOG_INFO
              
              @remove_from_queue link
      }

      link.request = request request_o, (error, response, body) =>
        if !error && response.statusCode == 200
          link.code = response.statusCode

          if link.valid_process_link(@base) # only process page when valid hostname
            @process_dom_page link, body
          else
            @remove_from_queue link
        else
          link.code = response.statusCode if !error
          link.error = error if error

          ll.log "#{link.code} at #{link.to_string()}", LinkLogger.LOG_CRITICAL
          ll.log error, LinkLogger.LOG_CRITICAL

          @errored.push link
          @remove_from_queue link

    catch error
      ll.log "****************************** (request)", LinkLogger.LOG_WARNING
      ll.log err, LinkLogger.LOG_WARNING
      ll.log "Request error for #{link.url}", LinkLogger.LOG_WARNING

  ###
  Process DOM of fetched page
  ###
  process_dom_page: (link, body) ->
    try
      jsdom.env {html: body, scripts: [LinkChecker.JQUERY]}, (error, window) =>
        @process_page link, window.jQuery
    catch err
      ll.log "****************************** (jsdom)", LinkLogger.LOG_WARNING
      ll.log err, LinkLogger.LOG_WARNING

      @remove_from_queue link
  
  ###
  Remove queued link URL from the queue
  ###
  remove_from_queue: (link) ->
    @queued.splice(@queued.indexOf(link.url), 1) if @queued.indexOf link.url > -1
   
    link.kill_request()

  ###
  Add link URL to the queue
  ###
  add_to_queue: (link) ->
    @queued.push link.url
  
  ###
  Process fetched page and look for links to process
  Accepts parent Link object and DOM
  ###
  process_page: (parent, $) ->
    @remove_from_queue parent

    links = []
    ref = @
    
    $('a').each (e) ->
      links.push(new Link(parent.url, $(this).attr('href'), ref.base))

    links = @clean_up_fetched_links links

    for link in links
      @process_link link if @processed.indexOf(link.url) < 0
  
  ###
  Process link and at to processed list
  ###
  process_link: (link) ->
    @processed.push link.url
    @queue link

  ###
  Make sure the links are unique in crawled list
  ###
  clean_up_fetched_links: (links) ->
    cleansed = []

    for link in links
      cleansed.push(link) if cleansed.indexOf(link) < 0 && link.valid_queue_link()

    cleansed

  ###
  Finish up the process. Check for errors 500 and retry them, otherwise trigger callback
  ###
  finish_up: ->
    ll.log "Error: #{@errored.length}, retry: #{@try}", LinkLogger.INFO
    ll.log "Processed: #{@processed.length}", LinkLogger.INFO

    clearInterval @end_interval
    @finished = true

    if @errored.length > 0 && @try <= LinkChecker.MAX_RETRIES
      retries = []

      for link in @errored
        retries.push(@queue link) if link.code >= 500

      if retries.length > 0
        ll.log "Retrying for #{@errored.length} links", LinkLogger.INFO

        @try++
        @finished = false
      else
        @callback(@errored)
    else
      @callback(@errored)

###
Run function for standalone use
###
root.run = ->
  package = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json')))

  p
    .version("#{package.name} #{package.version}")
    .option('-u, --url [url]', 'URL to check')
    .option('-f, --full', 'Full output, default is only http codes >= 400')
    .option('-p, --piped', 'Piped output, default is json')
    .option('-v, --verbose', 'Verbose')
    .parse(process.argv)

  process.title = package.name

  lc = new LinkChecker(p.url)
  lc.verbose p.verbose

  try
    lc.start (errors) ->
      for error in errors
        if p.full
          if p.piped
            console.log error.piped_output()
          else
            console.log error
        else if error.is_error()
          if p.piped
            console.log error.piped_output()
          else
            console.log error

      process.exit(1)
  catch error
    console.log error

# process.on 'uncaughtException', (err) ->
#   console.error('uncaughtexception:' + err.stack)
