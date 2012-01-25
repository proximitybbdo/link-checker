request = require 'request'

Link = require('../src/link').Link

describe 'link-model', ->
  
  beforeEach ->
    @base = "http://noort.be"
    @parent = "http://noort.be"
    
    @l = new Link("", "", @base)

    @request = request 'http://www.google.com', (error, response, body) ->
      # blah

  it 'throws error when not giving parent, url and base', ->
    expect(() -> new Link()).toThrow("Invalid or insufficient arguments given.")

  it 'validates a valid process url as true', ->
    expect(@l.valid_process_link()).toBeTruthy()

  it 'validates a valid queue link as true', ->
    expect(@l.valid_queue_link()).toBeTruthy()

  it 'rejects an invalid queue link (javascript)', ->
    invalid = new Link("", "javascript:alert('test')", @base)

    expect(invalid.valid_queue_link()).toBeFalsy()

  it 'rejects an invalid queue link (gopher protocol)', ->
    invalid = new Link("", "gopher://test.com", @base)

    expect(invalid.valid_queue_link()).toBeFalsy()

  it 'rejects an invalid queue link (anchor)', ->
    @l = new Link(@parent, "#{@parent}/#home", @base)

    @after ->
      @l = new Link("", "", @base)

    expect(@l.valid_queue_link()).toBeFalsy()

  it 'delets all references to request and url object', ->
    @l.request = @request
    @l.kill_request()

    expect(@l.request).toBeNull()
    expect(@l.u).toBeNull()

  it 'gives me the extension of a link', ->
    @l.url = 'http://noort.be/assets/img/favico.png'

    expect(@l.extension()).toEqual('png')

  it 'says it erroneous when error code is more or equal than 400', ->
    @l.code = 500

    expect(@l.is_error()).toBeTruthy()

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
