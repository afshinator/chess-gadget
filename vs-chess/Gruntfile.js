module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    opts: {
      path: '.',
      name: 'vs-chess'
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

  grunt.registerTask('default', ['vulcanize']);
};
