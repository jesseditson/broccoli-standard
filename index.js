var Filter = require('broccoli-persistent-filter')
var path = require('path')
var eslint = require('eslint')
var defaults = require('defaults')
var minimatch = require('minimatch')
var stringify = require('json-stable-stringify')
var crypto = require('crypto')
var Linter = require('./lib/linter')

var jsStringEscape = require('js-string-escape')

function _makeDictionary () {
  var cache = Object.create(null)
  cache['_dict'] = null
  delete cache['_dict']
  return cache
}

var StandardFilter = function (inputTree, _options) {
  if (!(this instanceof StandardFilter)) { return new StandardFilter(inputTree, _options) }

  var options = _options || {}
  if (!options.hasOwnProperty('persist')) {
    options.persist = true
  }

  this.name = "TEST"

  Filter.call(this, inputTree, options)

  this.options = options
  this.inputTree = inputTree
  this.enabled = true

  this._excludeFileCache = _makeDictionary()

  for (var key in options) {
    if (options.hasOwnProperty(key)) {
      this[key] = options[key]
    }
  }
}

StandardFilter.prototype = Object.create(Filter.prototype)
StandardFilter.prototype.constructor = StandardFilter
StandardFilter.prototype.extensions = ['js']
StandardFilter.prototype.targetExtension = 'js'

StandardFilter.prototype.baseDir = function () {
  return __dirname
}

StandardFilter.prototype.build = function () {
  this.configure()
  return Filter.prototype.build.call(this)
}

StandardFilter.prototype.configure = function () {
  if (this.enabled) {
    var options = defaults(this.options, {
      eslint: eslint
    })
    options.eslintConfig = defaults(options.eslintConfig, {
      "extends": [ "standard" ]
    })
    this.standardLinter = new Linter(options)

  // this.bypass = Object.keys(this.rules).length === 0
  // if (!this.bypass) {
  //
  //   var checker = new jscs()
  //   checker.registerDefaultRules()
  //   checker.configure(this.rules)
  //   this.checker = checker
  //
  //   if (!this.disableTestGenerator) {
  //     this.targetExtension = 'standard-test.js'
  //   }
  // }
  }
}

StandardFilter.prototype.processString = function (content, relativePath) {
  if (this.enabled && !this.bypass) {
    if (this.shouldExcludeFile(relativePath)) {
      return this.disableTestGenerator ? content : ''
    }

    var results = this.standardLinter.lintTextSync(content)

    var errorText = this.processErrors(results, relativePath)
    if (errorText) {
      this.logError(errorText)
    }

    if (!this.disableTestGenerator) {
      errorText = this.processErrors(results, false)
      return this.testGenerator(relativePath, errorText)
    }
  }

  return content
}

StandardFilter.prototype.processErrors = function (results, relativePath) {
  return results.results
    .reduce((a, file) => {
      var m = file.messages.map((e) => `${relativePath} [${e.line}:${e.column}]: ${e.message}`)
      return a.concat(m)
    }, [])
    .join('\n')
}

StandardFilter.prototype.testGenerator = function (relativePath, errors) {
  if (errors) {
    errors = this.escapeErrorString('\n' + errors)
  }

  return "module('Standard - " + path.dirname(relativePath) + "');\n" +
  "test('" + relativePath + " should pass standard', function() {\n" +
  '  ok(' + !errors + ", '" + relativePath + ' should pass standard.' + errors + "');\n" +
  '});\n'
}

StandardFilter.prototype.logError = function (message) {
  console.error(message)
}

StandardFilter.prototype.escapeErrorString = jsStringEscape

StandardFilter.prototype.shouldExcludeFile = function (relativePath) {
  if (this.excludeFiles) {
    // The user specified an "excludeFiles" list.
    // Must pattern match or find a cache hit to determine if this relativePath is an actual JSCS exclusion.
    var excludeFileCache = this._excludeFileCache

    if (excludeFileCache[relativePath] !== undefined) {
      // This relativePath is in the cache, so we've already run minimatch.
      return excludeFileCache[relativePath]
    }

    var i, l, pattern

    // This relativePath is NOT in the cache. Execute _matchesPattern().
    for (i = 0, l = this.excludeFiles.length; i < l; i++) {
      pattern = this.excludeFiles[i]
      if (this._matchesPattern(relativePath, pattern)) {
        // User has specified "excludeFiles" and this relativePath did match at least 1 exclusion.
        excludeFileCache[relativePath] = true
        return
      }
    }

    // User has specified excludeFiles but this relativePath did NOT match any exclusions.
    excludeFileCache[relativePath] = false
  }

  // The user has NOT specified an "excludeFiles" list. Continue processing like normal.
  return false
}

StandardFilter.prototype._matchesPattern = function (relativePath, pattern) {
  return minimatch(relativePath, pattern)
}

StandardFilter.prototype.optionsHash = function () {
  if (!this._optionsHash) {
    this._optionsHash = crypto.createHash('md5')
      .update(stringify(this.options), 'utf8')
      .update(stringify(this.rules) || '', 'utf8')
      .update(this.testGenerator.toString(), 'utf8')
      .update(this.logError.toString(), 'utf8')
      .update(this.escapeErrorString.toString(), 'utf8')
      .digest('hex')
  }

  return this._optionsHash
}

StandardFilter.prototype.cacheKeyProcessString = function (string, relativePath) {
  return this.optionsHash() + Filter.prototype.cacheKeyProcessString.call(this, string, relativePath)
}

module.exports = StandardFilter
