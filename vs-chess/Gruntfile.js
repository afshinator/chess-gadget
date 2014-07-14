module.exports = function(grunt) {
  // module dependencies
  var join = require("path").join;

  var options = {
    path: '.',
    name: 'vs-chess'
  };

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    opts: {
      path: options.path,
      name: options.name
    },
    vulcanize: { /* works but requires a modified version of vulcanize module */
      dev: {
        options: {
          inline: true,
          excludes: {
            "scripts": [
              "../jquery/dist/jquery.js",
              "../underscore/underscore.js"
            ],
            "stripExcludes": true
          }
        },
        files: {
          '<%= opts.path %>/dist/<%= opts.name %>.html': ['<%= opts.path %>/<%= opts.name %>.html']
        }
      },
    }
  });

  grunt.loadNpmTasks('grunt-vulcanize');

  // need to create an empty dist folder
  grunt.registerTask('mkdir_dist', function(){
    grunt.file.mkdir( join(options.path, 'dist') );
  });

  grunt.registerTask('default', ['mkdir_dist', 'vulcanize']);
};
