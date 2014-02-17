var es = require('event-stream');
var cheerio = require('cheerio');
var _ = require('underscore');
var path = require('path');
var url = require('url');

/*
  optional arguments:
    autoMin (bool)          - minimize files with a data-min attribute [default=true]
    defaultMinFile (string) - if autoMin is true, use this min file for all files without a data-min attribute.
                              if defaultMinFile is null, use the src file name instead [default=null]
    updateHTML (bool)       - rewrite HTML files to point at the min files [default=true]
*/
module.exports = function(type, map, options) {
  opt = options || {};
  opt.autoMin = opt.autoMin || true;
  opt.updateHTML = opt.updateHTML || true;

  // try to determine if this is a remote url or a local reference
  var isLocal = function(srcPath) {
    var srcUrl = url.parse(srcPath, false, true);
    return !(srcUrl.hostname);
  };

  // ignore any elements that already point to a min file
  var isMin = function(srcPath) {
    return (srcPath.indexOf('.min') >= 0);
  };

  // create a resolved pathname relative to the globbing base
  var resolvePath = function(file, srcPath) {
    var normPath = path.normalize(srcPath);

    // are we an "absoulte path"? (e.g. /js/app.js)
    if (normPath.indexOf(path.sep) == 0) {
      return path.join(file.base, normPath);
    }

    return path.resolve(path.dirname(file.path), srcPath);
  };

  var baseNameNoExt = function(srcPath) {
    var extname = path.extname(srcPath);
    return path.basename(srcPath, extname);
  };

  // string util
  var replaceLastInstance = function(str, text, replaceText) {
    var idx = str.lastIndexOf(text);
    if (idx < 0) return str;
    var startStr = str.substring(0, idx);
    var endStr = str.substring(idx + (text.length));
    return (startStr + replaceText + endStr);
  };

  // generate the minFile path using the srcFile and data attribute
  var genMinFilePath = function(file, srcFile, minFile) {
    // are we an "absoulte path"?
    if (minFile.indexOf(path.sep) == 0) {
      return minFile;
    }

    // otherwise, just subsitute the minfile for the src file
    return replaceLastInstance(srcFile, path.basename(srcFile), minFile);
  };

  var addMinFileToMap = function(map, replacedMinFile, elem, file, srcFile, minFile, srcSelector) {
    var minFile = genMinFilePath(file, srcFile, minFile);
    var normMinFile = resolvePath(file, minFile).replace(file.base, "");
    var fullSrcFile = resolvePath(file, srcFile);

    // update the minFile map/object.
    var srcArray = map[normMinFile] || [];
    if (srcArray.indexOf(fullSrcFile) < 0) {
      srcArray.push(fullSrcFile);
    }
    map[normMinFile] = srcArray;

    // change the HTML dom (either update to .min file, or remove depending on
    // if we have seen this min file before in this HTML file)
    if (opt.updateHTML) {
      if (!replacedMinFile[normMinFile]) {
        elem.removeAttr('data-min');
        elem.attr(srcSelector, path.normalize(minFile));
        replacedMinFile[normMinFile] = true;
      }
      else {
        elem.remove();
      }
    }
  };

  var minMapFunc = function(map, replacedMinFile, elem, file, srcFile, minFile, srcSelector) {

    // if there is no data-min attribute, use a default minFile unless instructed otherwise
    if (srcFile && minFile) {
      addMinFileToMap(map, replacedMinFile, elem, file, srcFile, minFile, srcSelector);
    }
    else if (opt.autoMin && !(elem.attr('data-no-min')) && srcFile && isLocal(srcFile) && !isMin(srcFile)) {
      if (opt.defaultMinFile) {
        minFile = opt.defaultMinFile;
      }
      else {
        var baseName = baseNameNoExt(srcFile);
        minFile = replaceLastInstance(srcFile, baseName, (baseName + ".min"));
      }
      addMinFileToMap(map, replacedMinFile, elem, file, srcFile, minFile, srcSelector);
    }
  };

  var handleFile = function(file, callback) {
    // prevent repeats of same min file in an html file
    var replacedMinFile = {};
    var $ = cheerio.load(file.contents);

    var handleFunc = function(type, elemSelector, srcSelector) {
      $(elemSelector).each(function(idx, elem) {
        var $elem = $(elem);
        var srcFile = $elem.attr(srcSelector);
        var minFile = $elem.attr('data-min');

        if (!map[type]) map[type] = {};
        minMapFunc(map[type], replacedMinFile, $elem, file, srcFile, minFile, srcSelector);
      });
    };

    var typeArray;
    if (_.isArray(type)) typeArray = type;
    else if (_.isString(type)) typeArray = [type];
    else return callback(new Error("Unsupported type paramter type supplied"), undefined);

    var isErr = false;
    typeArray.forEach(function(type) {
      if (type === 'js') handleFunc(type, 'script', 'src');
      else if (type === 'css') handleFunc(type, 'link[rel=stylesheet]', 'href');
      else {
        isErr = true;
        return callback(new Error("Unsupported type paramter type supplied"), undefined);
      }
    });
    if (isErr) return;

    if (opt.updateHTML) file.contents = new Buffer($.html());
    return callback(null, file);
  }

  return es.map(handleFile);
};