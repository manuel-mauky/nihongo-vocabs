'use strict';

var browserify = require('browserify');
var gulp = require('gulp');
var source = require('vinyl-source-stream');
var babelify = require('babelify');

gulp.task('js', function () {
    browserify({
        entries: './src/js/app.js',
        debug: true
    })
    .transform(babelify)
    .bundle()
    .pipe(source('bundle.js'))
    .pipe(gulp.dest('./dist/js/'));
});

gulp.task('watch', function() {
	gulp.watch(['src/js/**/*.js'], ['js'])
});

gulp.task('default', ['watch','js']);
