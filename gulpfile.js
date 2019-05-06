const gulp = require('gulp')
const postcss = require('gulp-postcss')
const autoprefixer = require('autoprefixer')
const cssnano = require('cssnano')
const sourcemaps = require('gulp-sourcemaps')
const bytediff = require('gulp-bytediff')
const browserSync = require('browser-sync').create()
const chalk = require('chalk');
const rename = require('gulp-rename');
const filter = require('gulp-filter');
const flatten = require('gulp-flatten')
const sizereport = require('gulp-sizereport')
const postcssCssVariables = require('postcss-css-variables')
const postcssImport = require('postcss-import')
const postcssColorModFunction = require('postcss-color-mod-function')

const paths = {
  srcDir: 'src/*',
  styles: { src: 'src/builds/*.css', dest: 'dist' },
  html: { src: 'index.html' },
}

// https://stackoverflow.com/a/20732091
function humanFileSize(size) {
  var i = Math.floor(Math.log(size) / Math.log(1024));
  return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
};

function formatByteMessage(source, data) {
  const prettyStartSize = humanFileSize(data.startSize)
  let message = '';

  if (data.startSize !== data.endSize) {
    const change = (data.savings > 0 ? 'saved' : 'gained')
    const prettySavings = humanFileSize(Math.abs(data.savings))
    let prettyEndSize = humanFileSize(data.endSize)

    if (data.endSize > data.startSize) prettyEndSize = chalk.yellow(prettyEndSize)
    if (data.endSize < data.startSize) prettyEndSize = chalk.green(prettyEndSize)

    message = chalk`${change} ${prettySavings} (${prettyStartSize} -> {bold ${prettyEndSize}})`
  } else message = chalk`kept original filesize. ({bold ${prettyStartSize}})`

  return chalk`{cyan ${(source.padStart(12, ' '))}}: {bold ${data.fileName}} ${message}`
}

function style() {
  const isLegacyOrStandalone = path => /standalone|legacy/.test(path)

  const excludeModern = filter(file => isLegacyOrStandalone(file.path), { restore: true })
  const excludeLegacy = filter(file => !isLegacyOrStandalone(file.path), { restore: true })

  const postcssColorMod = postcssColorModFunction({ stringifier: color => color.toRGBLegacy() })

  return (
    gulp
      .src(paths.styles.src)
      // Add sourcemaps
      .pipe(sourcemaps.init())
      // Resolve imports and calculated colors
      .pipe(postcss([postcssImport(), postcssColorMod]))

      // * Process legacy & standalone builds *
      .pipe(excludeModern)
      // Inline variable values so CSS works in legacy browsers
      .pipe(postcss([postcssCssVariables()]))
      // Calculate size before autoprefixing
      .pipe(bytediff.start())
      // autoprefix
      .pipe(postcss([autoprefixer()]))
      // Write the amount gained by autoprefixing
      .pipe(bytediff.stop((data) => formatByteMessage('autoprefixer', data)))
      .pipe(excludeModern.restore)

      // * Process modern builds *
      .pipe(excludeLegacy)
      // Calculate size before autoprefixing
      .pipe(bytediff.start())
      // autoprefix modern builds
      // TODO: Use separate browserslist to only apply prefixes needed in *modern* browsers
      .pipe(postcss([autoprefixer()]))
      // Write the amount gained by autoprefixing
      .pipe(bytediff.stop((data) => formatByteMessage('autoprefixer', data)))
      .pipe(excludeLegacy.restore)

      // Write the sourcemaps after making pre-minified changes
      .pipe(sourcemaps.write('.'))
      // Flatten output so files end up in dist/*, not dist/builds/*
      .pipe(flatten())
      // Write pre-minified styles
      .pipe(gulp.dest(paths.styles.dest))
      // Remove sourcemaps from the pipeline, only keep css
      .pipe(filter('**/*.css'))
      // Calculate size before minifying
      .pipe(bytediff.start())
      // Minify using cssnano
      .pipe(postcss([cssnano()]))
      // Write the amount saved by minifying
      .pipe(bytediff.stop((data) => formatByteMessage('cssnano', data)))
      // Rename the files have the .min suffix
      .pipe(rename({ suffix: '.min' }))
      // Write the sourcemaps after making all changes
      .pipe(sourcemaps.write('.'))
      // Write the minified files
      .pipe(gulp.dest(paths.styles.dest))
      .pipe(sizereport({ gzip: true, total: false, title: 'SIZE REPORT' }))
      // Stream any changes to browserSync
      .pipe(browserSync.stream())
  )
}

function reload() {
  browserSync.reload()
}

function watch() {
  style()

  browserSync.init({
    server: {
      baseDir: './',
    },
    startPath: 'index.html'
  })

  gulp.watch(paths.srcDir, style)
  gulp.watch([paths.srcDir, paths.html.src], reload)
}

module.exports.style = style
module.exports.watch = watch