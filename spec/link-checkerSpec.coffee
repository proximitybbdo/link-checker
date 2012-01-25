request = require 'request'

Link = require('../src/link').Link
LinkChecker = require('../src/link-checker').LinkChecker

describe 'link-checkermodel', ->
  
  beforeEach ->
    @base = "http://noort.be"
    @parent = "http://noort.be"
    
    @l = new Link("", "", @base)
    @lc = new LinkChecker(@base)

    @request = request 'http://www.google.com', (error, response, body) ->
      # blah
    
  it 'throws an error when giving invalid base', ->
    @lc.base = null

    expect(() => @lc.start(() ->)).toThrow(new Error("No valid base url given."))
    
  it 'throws an error when giving invalid callback function', ->
    expect(() => @lc.start()).toThrow(new Error("No callback function is given."))
  
  it 'adds links to a queue', ->
    @lc.add_to_queue(@l)

    expect(@lc.queued.length).toEqual(1)
  
  it 'remove links to a queue', ->
    @lc.add_to_queue(@l)
    @lc.remove_from_queue(@l)

    expect(@lc.queued.length).toEqual(0)

  it 'adds a link to the queue when queueing a link', ->
    @lc.queue(@l)

    expect(@lc.queued.length).toEqual(1)

  it 'queues the base link when starting', ->
    @lc.start(() -> )

    expect(@lc.queued.length).toEqual(1)

  it 'starts the interval when starting', ->
    @lc.start(() -> )

    expect(@lc.end_interval).not.toBeNull()

  it 'adds link to processed list and queues it', ->
    @lc.process_link @l

    expect(@lc.queued.length).toEqual(1)
    expect(@lc.processed.length).toEqual(1)

  it 'cleans non-queueable-links from a list', ->
    l1 = new Link("", "#{@base}/test.html", @base)
    l2 = new Link("", "javascript:alert('test')", @base)

    list = [l1, l2]

    new_list = @lc.clean_up_fetched_links(list)

    expect(new_list.length).toEqual(1)
    expect(new_list[0]).toBe(l1)

# toEqual
# toBe
# toMatch (pattern)
# toBeDefined
# toBeUndefined
# toBeNull
# toBeTruthy
# toBeFalsy
# toContain (array|string)
# toBeLessThan
# toBeGreaterThan
# toThrow(e)
#
# .not
#
# @after ->
#   afterthisfunction
