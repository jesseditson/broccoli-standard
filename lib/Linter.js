var Linter = require('standard-engine').linter

Linter.prototype.lintTextSync = function (text, opts) {
  opts = this.parseOpts(opts)
  return new this.eslint.CLIEngine(opts.eslintConfig).executeOnText(text)
}

module.exports = Linter
