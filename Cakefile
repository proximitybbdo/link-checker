fs = require 'fs'
{exec} = require 'child_process'

task 'build', 'build', (options) ->
  console.log '$ Task Build'

  exec 'coffee -c -o lib src', (err, stdout, stderr) ->
    throw err if err
    console.log stdout + stderr

task 'viewjs', 'view compiled js file', (options) ->
  console.log '$ Task View'

  invoke 'build'

  cat = exec 'cat lib/link-checker.js'
  cat.stdout.pipe process.stdout
  cat.stderr.pipe process.stderr

option '-u', '--url [url]', 'custom url for task `test`'
task 'test', 'build and test', (options) ->
  invoke 'build'
  
  console.log '$ Task Test'

  options.url or= 'http://www.whatsnextmagazine.net'

  lc = exec "./bin/link-checker -u #{options.url} -v"
  lc.stdout.pipe process.stdout
  lc.stderr.pipe process.stderr
