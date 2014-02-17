var es = require('event-stream');
var cheerio = require('cheerio');
var _ = require('underscore');
var path = require('path');
var url = require('url');

/*
  optional arguments:
    minAttr (string)        - HTML element attribute that specifies the min file name [default="data-min"]
    noMinAttr (string)      - if automMin is true, HTML element attribute that specifies to exclude this
                              element from min file processing [default="data-no-min"]
    autoMin (bool)          - minimize files without a data-min attribute [default=true]
    defaultMinFile (string) - if autoMin is true, use this min file for all files without a data-min attribute.
                              if defaultMinFile is null, use the src file name instead [default=null]
    updateHTML (bool)       - rewrite HTML files to point at the min files [default=true]
*/
module.exports = function(type, map, options) {
  opt = options || {};
  opt.minAttr = opt.minAttr || 'data-min';
  opt.noMinAttr = opt.noMinAttr || 'data-no-min';
  opt.autoMin = opt.autoMin || true;
  opt.updateHTML = opt.updateHTML || true;

  var handleFile = function(file, callback) {
    // prevent repeats of same min file in an html file
    var replacedMinFile = {};
    var $ = cheerio.load(file.contents);

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
    var resolvePath = function(srcPath) {
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
    var genMinFilePath = function(srcFile, minFile) {
      // are we an "absoulte path"?
      if (minFile.indexOf(path.sep) == 0) {
        return minFile;
      }

      // otherwise, just subsitute the minfile for the src file
      return replaceLastInstance(srcFile, path.basename(srcFile), minFile);
    };

    var addMinFileToMap = function(map, elem, srcFile, minFile, srcSelector) {
      var minFile = genMinFilePath(srcFile, minFile);
      var normMinFile = resolvePath(minFile).replace(file.base, "");
      var fullSrcFile = resolvePath(srcFile);

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
          elem.removeAttr(opt.minAttr);
          elem.attr(srcSelector, path.normalize(minFile));
          replacedMinFile[normMinFile] = true;
        }
        else {
          // remove any extra white space after element
          var nextElem = elem[0].next;
          if (nextElem.type === 'text' && nextElem.data.match(/^\s*$/)) {
            $(elem[0].next).remove();
          }
          elem.remove();
        }
      }
    };

    var handleFunc = function(type, elemSelector, srcSelector) {
      $(elemSelector).each(function(idx, elem) {
        var $elem = $(elem);
        var srcFile = $elem.attr(srcSelector);
        var minFile = $elem.attr(opt.minAttr);
        if (!map[type]) map[type] = {};

        // if there is no data-min attribute, use a default minFile unless instructed otherwise
        if (srcFile && minFile) {
          addMinFileToMap(map[type], $elem, srcFile, minFile, srcSelector);
        }
        else if (opt.autoMin && !($elem.attr(opt.noMinAttr)) && srcFile && isLocal(srcFile) && !isMin(srcFile)) {
          if (opt.defaultMinFile) {
            minFile = opt.defaultMinFile;
          }
          else {
            var baseName = baseNameNoExt(srcFile);
            minFile = replaceLastInstance(srcFile, baseName, (baseName + ".min"));
          }
          addMinFileToMap(map[type], $elem, srcFile, minFile, srcSelector);
        }
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