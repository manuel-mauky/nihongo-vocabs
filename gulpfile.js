'use strict';

var browserify = require('browserify');
var gulp = require('gulp');
var gutil = require('gulp-util');
var source = require('vinyl-source-stream');
var reactify = require('reactify');

gulp.task('js', function () {
    browserify({
        entries: './src/js/app.js',
        debug: true
    })
    .transform(reactify)
    .bundle()
    .pipe(source('bundle.js'))
    .pipe(gulp.dest('./dist/js/'));
});

gulp.task('watch', function() {
	gulp.watch(['src/js/**/*.js'], ['js'])
});

gulp.task('default', ['watch','js']);
