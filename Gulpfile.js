var gulp = require('gulp');
var Builder = require('systemjs-builder');

gulp.task('bundle', function () {
    var builder = new Builder('./src', './src/config.js');

    return builder.buildStatic('./src/tooly.js', './dist/tooly.js', {
        sourceMaps: false,
        minify: false,
        mangle: false
    });
});
gulp.task('default', ['bundle']);