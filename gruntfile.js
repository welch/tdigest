module.exports = function(grunt) {
    var pkg = grunt.file.readJSON('package.json');

    grunt.initConfig({
        gruntDry: {
            pkg: grunt.file.readJSON('package.json'),
            deps: {
                'bintrees': {
                    browserBuild: 'node_modules/bintrees/dist/rbtree.min.js'
                },
                'assert': {
                    browserBuild: 'node_modules/assert/assert.js',
                    testOnly: true
                },
                'better-assert': {
                    browserBuild: 'node_modules/better-assert/index.js',
                    testOnly: true
                }
            }
        }
    });
 
    grunt.task.loadNpmTasks('grunt-dry');

}
