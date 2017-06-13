/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: '<json:package.json>',
    concat: {
      dist: {
        src: ['inpoot.js', 'lib/resources/*.js'],
        dest: 'dist/inpoot.dist.js'
      }
    },
    uglify: {
        dist: {
        files: {
            'dist/inpoot.dist.min.js': ['dist/inpoot.dist.js']
          }
        }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  // Default task.
  grunt.registerTask('default', ['concat:dist', 'uglify:dist']);

};
