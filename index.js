var Linter = require('./lib/linter')
var standardOpts = require('standard/options')
var extend = require('extend')
var path = require('path')
var chalk = require('chalk')
var Filter = require('broccoli-persistent-filter')
var crypto = require('crypto')
var stringify = require('json-stable-stringify')

Standard.prototype = Object.create(Filter.prototype)
Standard.prototype.constructor = Standard
function Standard (inputNode, options) {
  if (!(this instanceof Standard)) return new Standard(inputNode, options)

  options = options || {}
  if (!options.hasOwnProperty('persist')) {
    options.persist = true
  }

  Filter.call(this, inputNode, {
    annotation: options.annotation,
    persist: options.persist
  })
  this.log = true
  this.options = options
  this.console = console

  for (var key in options) {
    if (options.hasOwnProperty(key)) {
      this[key] = options[key]
    }
  }
}

Standard.prototype.extensions = ['js']
Standard.prototype.targetExtension = 'standard.js'

Standard.prototype.baseDir = function () {
  return __dirname
}

Standard.prototype.build = function () {
  this._errors = []

  this.standardLinter = new Linter(extend(true, standardOpts, this.options))

  return Filter.prototype.build.call(this)
    .finally(() => {
      var ec = this._errors.length
      if (ec > 0) {
        var label = 'Standard Style Error' + (ec > 1 ? 's' : '')
        this.console.log(`
 ${this._errors.join('\n')}`)
        this.console.log(chalk.yellow(`===== ${ec} ${label}
`))
      }
    })
}

Standard.prototype.processString = function (content, relativePath) {
  var info = this.standardLinter.lintTextSync(content)
  var passed = info.errorCount === 0
  var messages = info.results.reduce((a, r) => {
    return a.concat(r.messages)
  }, [])
  var errors = this.processErrors(relativePath, messages)

  var output = ''
  if (!this.disableTestGenerator) {
    output = this.testGenerator(relativePath, passed, errors)
  }

  return {
    output: output,
    passed: passed,
    errors: errors
  }
}

Standard.prototype.postProcess = function (results) {
  var errors = results.errors
  var passed = results.passed

  if (this.failOnAnyError && errors.length > 0) {
    var generalError = new Error('Standard failed')
    generalError.jshintErrors = errors
    throw generalError
  }

  if (!passed && this.log) {
    this.logError(errors)
  }

  return results
}

Standard.prototype.processErrors = function (file, errors) {
  if (!errors || !errors.length) return ''
  var errStrings = errors.map(function (e) {
    return `${file}: [${e.line}:${e.column}] ${e.message}`
  })
  var len = errStrings.length
  var label = `${len} error${len > 1 ? 's' : ''}`
  return errStrings.join('\n') + '\n' + label
}

Standard.prototype.testGenerator = function (relativePath, passed, errors) {
  if (errors) {
    errors = '\\n' + this.escapeErrorString(errors)
  } else {
    errors = ''
  }

  return '' +
  "QUnit.module('Standard - " + path.dirname(relativePath) + "');\n" +
  "QUnit.test('" + relativePath + " should pass standard', function(assert) { \n" +
  '  assert.expect(1);\n' +
  '  assert.ok(' + !!passed + ", '" + relativePath + ' should pass standard.' + errors + "'); \n" +
  '});\n'
}

Standard.prototype.logError = function (message, color) {
  color = color || 'red'

  this._errors.push(chalk[color](message) + '\n')
}

Standard.prototype.escapeErrorString = function (string) {
  string = string.replace(/\n/gi, '\\n')
  string = string.replace(/'/gi, "\\'")

  return string
}

Standard.prototype.optionsHash = function () {
  if (!this._optionsHash) {
    this._optionsHash = crypto.createHash('md5')
      .update(stringify(this.options), 'utf8')
      .update(stringify(this.jshintrc) || '', 'utf8')
      .update(this.testGenerator.toString(), 'utf8')
      .update(this.logError.toString(), 'utf8')
      .update(this.escapeErrorString.toString(), 'utf8')
      .digest('hex')
  }

  return this._optionsHash
}

Standard.prototype.cacheKeyProcessString = function (string, relativePath) {
  return this.optionsHash() + Filter.prototype.cacheKeyProcessString.call(this, string, relativePath)
}

module.exports = Standard
