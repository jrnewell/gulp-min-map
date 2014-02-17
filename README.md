# gulp-min-map

gulp-min-map is a [gulp](https://github.com/wearefractal/gulp) plugin to create a file minification map of js and css in your HTML files.  It uses HTML5 data attributes to process the min files and optionally will rewrite the js and css links for you.

## Usage

gulp-min-map provide a plugin to retrieve the a minFile -> [sourceFile1, sourceFile2, ..] mapping.  You can pass this map object in a custom concat and/or minifcation gulp task.

```javascript
var minFiles = {};

gulp.task("deploy-html", function() {
  return gulp.src("build/**/*.html")
    .pipe(plumber())
    .pipe(minMap(['js', 'css'], minFiles))
    .pipe(gulp.dest('release'));
});

gulp.task("deploy-js", function() {
  var streams = [];
  var jsMinFiles = minFiles.js;
  for (var minFile in jsMinFiles) {
    if (jsMinFiles.hasOwnProperty(minFile)) {
      var stream = gulp.src(jsMinFiles[minFile])
        .pipe(stripDebug())
        .pipe(uglify())
        .pipe(concat(minFile))
        .pipe(header(headerText, {}))
        .pipe(gulp.dest('release'));
      streams.push(stream);
    }
  }

  return es.merge.apply(es, streams);
});
```

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License)