module.exports = function(grunt) {
    var pkg = grunt.file.readJSON('package.json');

    grunt.initConfig({
        gruntDry: {
            pkg: grunt.file.readJSON('package.json'),
            deps: {
                'bintrees': {
                    browserBuild: 'node_modules/bintrees/dist/rbtree.min.js'
                },
                'chai': {
                    browserBuild: 'node_modules/chai/chai.js',
                    testOnly: true
                }
            }
        }
    });
 
    grunt.task.loadNpmTasks('grunt-dry');

}
