var StandardFilter = require('./index')
var mergeTrees = require('broccoli-merge-trees')
var Funnel = require('broccoli-funnel')
var jsStringEscape = require('js-string-escape')

module.exports = {
  name: 'broccoli-standard',

  isDevelopingAddon: function() {
    return true;
  },

  lintTree: function (type, tree) {
    var standardOptions = this.app.options.standardOptions || {}

    if (standardOptions.disabled) {
      return tree
    }

    var project = this.project
    if (!standardOptions.testGenerator && project.generateTestFile) {
      standardOptions.testGenerator = function (relativePath, errors) {
        if (errors) {
          errors = jsStringEscape('\n' + errors)
        }

        return project.generateTestFile('Standard - ' + relativePath, [{
          name: 'should pass standard',
          passed: !errors,
          errorMessage: relativePath + ' should pass standard.' + errors
        }])
      }
    }

    var standardTree = new StandardFilter(tree, standardOptions)

    if (standardTree.bypass || standardTree.disableTestGenerator) {
      return tree
    }

    return standardTree
  },

  included: function (app) {
    var addonContext = this
    this.app = app
    this._super.included.apply(this, arguments)

    if (app.tests) {
      app.registry.add('js', {
        name: 'broccoli-standard',
        ext: 'js',
        toTree: function (tree, inputPath, outputPath, options) {
          var standardTree = addonContext.lintTree('unknown-type', tree)

          return mergeTrees([
            tree,
            new Funnel(standardTree, {
              srcDir: '/',
              destDir: outputPath + '/tests/'
            })
          ], { overwrite: true })
        }
      })
    }
  }
}
