var es = require('event-stream');
var cheerio = require('cheerio');
var path = require('path');
var url = require('url');

module.exports = function(type, map, options) {
  opt = options || {};
  opt.autoMin = opt.autoMin || true;

  var isLocal = function(srcPath) {
    var srcUrl = url.parse(srcPath, false, true);
    return (typeof srcUrl.hostname === 'undefined' || srcUrl.hostname === null);
  };

  var isMin = function(srcPath) {
    return (srcPath.indexOf('.min') >= 0);
  };

  var resolvePath = function(file, srcPath) {
    var normPath = path.normalize(srcPath);

    // are we an "absoulte path"?
    if (normPath.indexOf(path.sep) == 0) {
      return path.join(file.base, normPath);
    }

    return path.resolve(path.dirname(file.path), srcPath);
  };

  var baseNameNoExt = function(srcPath) {
    var extname = path.extname(srcPath);
    return path.basename(srcPath, extname);
  };

  var replaceLastInstance = function(str, text, replaceText) {
    var idx = str.lastIndexOf(text);
    if (idx < 0) return str;
    var startStr = str.substring(0, idx);
    var endStr = str.substring(idx + (text.length));
    return (startStr + replaceText + endStr);
  }

  var addMinFileToMap = function(replacedMinFile, elem, file, srcFile, minFile) {
    var minFile = replaceLastInstance(srcFile, path.basename(srcFile), path.basename(minFile));
    var normMinFile = resolvePath(file, minFile).replace(file.base, "");
    var fullSrcFile = resolvePath(file, srcFile);
    var srcArray = map[normMinFile] || [];
    if (srcArray.indexOf(fullSrcFile) < 0) {
      srcArray.push(fullSrcFile);
    }
    map[normMinFile] = srcArray;

    console.log("minFile: " + minFile + ", normMinFile: " + normMinFile + ", srcFile: " + srcFile);

    // change dom (either update to .min file, or remove)
    if (!replacedMinFile[normMinFile]) {
      elem.removeAttr('data-min');
      elem.attr('src', minFile);
      replacedMinFile[normMinFile] = true;
    }
    else {
      elem.remove();
    }
  };

  var minMapFunc = function(file, callback) {
    if (type === 'js') {
      // prevent repeats of same min file
      var replacedMinFile = {};

      var util = require('util');
      console.log("type = js, file.cwd: " + file.cwd + ", file.base: " + file.base + ", file.path: " + file.path);

      var $ = cheerio.load(file.contents);
      $('script').each(function(idx, elem) {
        var $elem = $(elem);
        var srcFile = $elem.attr('src');
        var minFile = $elem.attr('data-min');

        console.log("srcFile: " + srcFile + ", minFile: " + minFile + ", isLocal: " + isLocal(srcFile));

        if (srcFile && minFile) {
          console.log("minMap1: " + srcFile + ", " + minFile);
          addMinFileToMap(replacedMinFile, $elem, file, srcFile, minFile);
        }
        else if (opt.autoMin && !($elem.attr('data-no-min')) && srcFile && isLocal(srcFile) && !isMin(srcFile)) {
          if (opt.defaultMinFile) {
            minFile = opt.defaultMinFile;
          }
          else {
            var baseName = baseNameNoExt(srcFile);
            minFile = replaceLastInstance(srcFile, baseName, (baseName + ".min"));
          }
          console.log("minMap2: " + baseName + ", " + srcFile + ", " + minFile);
          addMinFileToMap(replacedMinFile, $elem, file, srcFile, minFile);
        }
      });

      file.contents = new Buffer($.html());
      console.log('map: ' + util.inspect(map))
      return callback(null, file);
    }
    else if (type === 'css') {

    }
  };

  return es.map(minMapFunc);
};