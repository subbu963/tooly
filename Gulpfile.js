var gulp = require('gulp');
var argv = require('yargs').argv;
var RSVP = require('rsvp');
var Builder = require('systemjs-builder');

var DEFAULT_BUILD_PREFIX = './dist/tooly-';
var BUILD_SRC = './src/tooly.js';
var MODULE_TYPES_ALLOWED = ['cjs', 'amd', 'global'];
gulp.task('bundle', function () {
    var builder = new Builder('./src', './src/config.js');
    var modulesToBuild;
    if (argv.module === 'all') {
        modulesToBuild = MODULE_TYPES_ALLOWED;
    } else if (MODULE_TYPES_ALLOWED.indexOf(argv.module) > -1) {
        modulesToBuild = [argv.module];
    } else {
        throw new Error('Invalid module type ' + argv.module);
    }
    var buildPromises = [];
    for (var i = 0; i < modulesToBuild.length; i++) {
        var dest = DEFAULT_BUILD_PREFIX + modulesToBuild[i],
            min = true;
        if (modulesToBuild[i] === 'cjs') {
            dest = './index';
            min = false;
        }
        console.info('building ' + modulesToBuild[i] + ' module');
        buildPromises.push(
            builder.buildStatic(BUILD_SRC, dest + '.js', {
                sourceMaps: false,
                minify: false,
                mangle: false,
                format: modulesToBuild[i]
            })
        );
        if (min) {
            buildPromises.push(
                builder.buildStatic(BUILD_SRC, dest + '.min.js', {
                    sourceMaps: false,
                    minify: true,
                    mangle: true,
                    format: modulesToBuild[i]
                })
            );
        }
    }
    return RSVP.all(buildPromises);
});
gulp.task('default', ['bundle']);
//gulp.task('bundle', ['bundle-npm-module', 'bundle-standalone']);
