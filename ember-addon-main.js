var standardTrees = require('./index');

module.exports = {
  name: 'broccoli-standard',

  buildConsole: function() {
    var ui = this.ui;

    if (!ui) {
      this.console = console;
      return;
    }

    this.console = {
      log: function(data) {
        ui.writeLine(data);
      },

      error: function(data) {
        ui.writeLine(data, 'ERROR');
      }
    };
  },

  init: function() {
    this.buildConsole();
  },

  included: function included(app, parentAddon) {
    this._super.included.call(this, app, parentAddon);
    this.standardConfig = app.options.standard || {};
  },

  lintTree: function(type, tree) {
    var project = this.project;

    return standardTrees(tree, {
      options: this.standardConfig,
      description: 'Standard ' +  type,
      console: this.console,
      testGenerator: function(relativePath, passed, errors) {
        if (errors) {
          errors = "\\n" + this.escapeErrorString(errors);
        } else {
          errors = "";
        }

        return project.generateTestFile('Standard - ' + relativePath, [{
          name: 'should pass standard',
          passed: !!passed,
          errorMessage: relativePath + ' should pass standard.' + errors
        }]);
      }
    });
  }
};
