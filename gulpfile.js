var gulp = require("gulp");
var browserify = require("browserify");
var source = require('vinyl-source-stream');
var tsify = require("tsify");
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var buffer = require('vinyl-buffer');
var paths = {
    pages: ['src/*.html'],
    models: [
        'src/models/cube/cube.obj', 'src/models/cube/cube.mtl',
        'src/models/player/player.obj', 'src/models/player/player.mtl',
        'src/models/platform.obj', 'src/models/platform.mtl',
        'src/models/tree1.obj', 'src/models/tree1.mtl',
        'src/models/tree2.obj', 'src/models/tree2.mtl',
        'src/models/support.obj', 'src/models/support.mtl',
        'src/models/arrow.obj', 'src/models/arrow.mtl'
    ],
    sounds: [
        'src/sounds/lose.wav',
        'src/sounds/shoot.wav',
        'src/sounds/song.mp3',
        'src/sounds/win.wav',
    ],
    sprites: [
        'src/sprites/mute.png',
        'src/sprites/nonmute.png'
    ]
};

gulp.task("copy-html", function ()
{
    return gulp.src(paths.pages)
        .pipe(gulp.dest("dist"));
});

gulp.task("copy-models", function ()
{
    return gulp.src(paths.models)
        .pipe(gulp.dest("dist"));
});

gulp.task("copy-sounds", function ()
{
    return gulp.src(paths.sounds)
        .pipe(gulp.dest("dist"));
});

gulp.task("copy-sprites", function ()
{
    return gulp.src(paths.sprites)
        .pipe(gulp.dest("dist"));
});

gulp.task("default", ["copy-html", "copy-models", "copy-sounds", "copy-sprites"], function ()
{
    return browserify({
        basedir: '.',
        debug: true,
        entries: ['src/main.ts'],
        cache: {},
        packageCache: {}
    })
        .plugin(tsify)
        .bundle()
        .pipe(source('bundle.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({ loadMaps: true }))
        .pipe(uglify())
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest("dist"));
});
