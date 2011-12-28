request = require 'request'
jsdom   = require 'jsdom'
u       = require 'url'
l       = require 'logme'
p       = require 'commander'

root = exports ? this

root.LinkChecker = class LinkChecker
  @LOG_CRITICAL = 'critical'
  @LOG_INFO = 'info'
  @REGEX_EMAIL = /(http|https):\/\/([a-zA-Z0-9.]|%[0-9A-Za-z]|\/|:[0-9]?)*/
  
  constructor: (@base, @url = '') ->
    @log "Init"

    @verbose = false

    @processed = []
    @queued = []
    @errored = []
    @exclude_process = ['gif', 'jpg', 'pdf', 'mp3', 'swf', 'jpeg']

    @try = 0
    @retries = 1
    @finished = false

    @end_interval_interval = 2000
    @end_interval = null

  start: (@callback) ->
    @log "Start (verbose: " + @verbose + ")"

    if @base.length > 0 && LinkChecker.REGEX_EMAIL.test @base
      ref = this
      
      @queue @create_link @url

      @end_interval = setInterval ->
        ref.check_end()
      , @end_interval_interval
    else
      @log "Invalid url (#{@base}) given", LinkChecker.LOG_CRITICAL
  
  check_end: ->
    @log "Check end, processing queue #{@queued.length}"
    @log "Queued #{@queued}"

    if @processed.length % 20 == 0 && !@finished
      @log "Processed #{@processed.length}"

    if @queued.length == 0 && !@finished
      @finish_up()

  queue: (url) ->
    ref = this
    url = {current: '', link: url} if typeof url == 'string'

    @log "Queue #{url.link}"

    @queued.push url.link
    
    r = request {uri: url.link, onResponse: (error, response, body) ->
      if !error && response.headers['connection'] != 'close'
        content_length = parseInt(response.headers['content-length']) / 1024
        ext = url.link.split('.')[url.link.split('.').length - 1]

        if content_length > 500 || ref.exclude_process.indexOf(ext) > -1
          ref.log "Too Large #{url.link} - #{content_length}Kb", LinkChecker.LOG_INFO
          ref.remove_from_queue url.link

          r.end()
    }, (error, response, body) ->
      if !error && response.statusCode == 200
        if ref.valid_process_link(url.link) # only process page when valid hostname
          try
            ref_ref = ref
         
            jsdom.env {html: body, scripts: ['http://code.jquery.com/jquery-1.7.1.min.js']}, (error, window) ->
              ref_ref.process_page url.link, window.jQuery
          catch err
            ref.log "****************************** (jsdom)", LinkChecker.LOG_CRITICAL
            ref.log err, LinkChecker.LOG_CRITICAL

            ref.remove_from_queue url.link
        else
          ref.remove_from_queue url.link
      else
        ref.remove_from_queue url.link

        if !error
          ref.log "#{response.statusCode} at page #{url.current} for #{url.link}", LinkChecker.LOG_CRITICAL

          ref.errored.push({current: url.current, link: url.link, code: response.statusCode})
        else
          ref.log error, LinkChecker.LOG_CRITICAL

          ref.errored.push({current: url.current, link: url.link, code: -1})

  remove_from_queue: (url) ->
    @queued.splice(@queued.indexOf(url), 1) if @queued.indexOf url > -1

  process_page: (url, $) ->
    @remove_from_queue url

    links = []
  
    $('a').each (e) -> links.push($(this).attr('href'))

    links = @clean_up_links url, links

    for link in links
      @process_link link if @processed.indexOf(link.link) < 0

  process_link: (link) ->
    @processed.push link.link
    @queue link

  clean_up_links: (url, links) ->
    cleansed = []

    for link in links
      link = @create_link link

      if cleansed.indexOf(link) < 0 && @valid_queue_link(link)
        cleansed.push {current: url, link: link}

    cleansed

  create_link: (link) ->
    if link.indexOf('http') < 0
      u.resolve(@base, link)
    else
      link

  valid_process_link: (link) ->
    link = u.parse link
    valid = true

    if link.hostname != u.parse(@base).hostname # only links on same host
      valid = false

    valid

  valid_queue_link: (link) ->
    link = u.parse link
    valid = true

    switch link.protocol
      when 'mailto:', 'javascript:', 'skype:'
        valid = false
   
    valid

  finish_up: ->
    @finished = true

    @log "Finish up", LinkChecker.INFO
    @log "Error: #{@errored.length}, retry: #{@try}", LinkChecker.INFO
    @log "Processed: #{@processed.length}", LinkChecker.INFO

    clearInterval @end_interval

    if @errored.length > 0 && @try <= @retries
      ref = this
      retries = []

      for link in @errored
        retries.push(ref.queue(link)) if "#{link.code}".substr(0, 1) == "5"

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
  p
    .version('0.0.1')
    .option('-u, --url [url]', 'URL to check')
    .option('-v, --verbose', 'Verbose')
    .parse(process.argv)

  console.log "LinkChecker CLI (#{p._version})"

  lc = new LinkChecker(p.url)
  lc.verbose = p.verbose

  lc.start (errors) ->
    console.log errors


