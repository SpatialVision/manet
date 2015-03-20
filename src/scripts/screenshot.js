
(function () {
"use strict";

    /* Modules & Constants */

    var DEF_ZOOM = 1,
        DEF_QUALITY = 1,
        DEF_DELAY = 100,
        DEF_WIDTH = 1024,
        DEF_HEIGHT = 768,
        DEF_JS_ENABLED = true,
        DEF_IMAGES_ENABLED = true,
        DEF_FORMAT = 'png',
        DEF_HEADERS = {},
        DEF_STYLES = 'body { background: #fff; }';


    /* Common functions */

    function isPhantomJs() {
        return console && console.log;
    }

    function argument(index) {
        return isPhantomJs() ? phantom.args[index] : system.args[index];
    }

    function log(message) {
        if (isPhantomJs()) {
            console.log(message);
        } else {
            system.stdout.write(message);
        }
    }

    function exit(page, e) {
        if (e) {
            log('Error: ' + e);
        }
        if (page) {
            page.close();
        }
        phantom.exit();
    }

    function def(o, d) {
        return ((o === null) || (typeof (o) === "undefined")) ? d : o;
    }

    function parseOptions(base64) {
        var options = JSON.parse(window.atob(base64));
        log('Script options: ' + JSON.stringify(options));

        return options;
    }


    /* Web page creation */

    function pageViewPortSize(options) {
        return {
            width: def(options.width, DEF_WIDTH),
            height: def(options.height, DEF_HEIGHT)
        };
    }

    function pageSettings(options) {
        return {
            javascriptEnabled: def(options.js, DEF_JS_ENABLED),
            loadImages: def(options.images, DEF_IMAGES_ENABLED),
            userName: options.user,
            password: options.password,
            userAgent: options.agent
        };
    }

    function pageClipRect(options) {
        var cr = options.clipRect;
        return (cr && cr.top && cr.left && cr.width && cr.height) ? cr : null;
    }

    function pageQuality(options, format) {
        // XXX: Quality parameter doesn't work for PNG files.
        if (format !== 'png') {
            var quality = def(options.quality, DEF_QUALITY);
            return isPhantomJs() ? String(quality * 100) : quality;
        }
        return null;
    }

    function createPage(options) {
        var page = webpage.create(),
            clipRect = pageClipRect(options);

        page.zoomFactor = def(options.zoom, DEF_ZOOM);
        page.customHeaders = def(options.headers, DEF_HEADERS);
        page.viewportSize = pageViewPortSize(options);
        page.settings = pageSettings(options);
        if (clipRect) {
            page.clipRect = clipRect;
        }

        page.onError = function (msg, trace) {
            console.log(msg);
            trace.forEach(function(item) {
                console.log('  ', item.file, ':', item.line);
            });
        };

        page.onConsoleMessage = function(msg, lineNum, sourceId) {
            console.log('CONSOLE: ' + msg
            + (lineNum && sourceId ? ' (from line #' + lineNum + ' in "' + sourceId + '")' : ''));
        };

        return page;
    }


    /* Screenshot rendering */

    function renderScreenshotFile(page, options, outputFile, onFinish) {
        var delay = def(options.delay, DEF_DELAY),
            format = def(options.format, DEF_FORMAT),
            quality = pageQuality(options, format);

        log('Waiting for: ' + delay);
        setTimeout(function () {
            try {
                var renderOptions = {
                    onlyViewport: !!options.height,
                    quality: quality,
                    format: format
                };

                if(options.elementid){
                    var elementRect = page.evaluate(function(id) {
                        var element = document.getElementById(id);
                        if(element){
                            return element.getBoundingClientRect();
                        }
                    }, options.elementid);

                    if(elementRect){
                        page.clipRect = elementRect;
                    }
                }

                page.render(outputFile, renderOptions);
                log('Rendered screenshot: ' + outputFile);
                onFinish(page);
            } catch (e) {
                onFinish(page, e);
            }
        }, delay);
    }

    function captureScreenshot(base64, outputFile, onFinish) {
        try {
            var url,
                options = parseOptions(base64),
                hashbang = options.hashbang,
                page = createPage(options);

            hashbang = hashbang.indexOf('/') === 0 ? hashbang : '/' + hashbang;
            url = options.url + (options.hashbang ? '#' + options.hashbang : '');

            log('URL:' + url);

            page.open(url, function () {
                try {
                    addStyles(page, DEF_STYLES);
                    renderScreenshotFile(page, options, outputFile, onFinish);
                } catch (e) {
                    onFinish(page, e);
                }
            });
        } catch (e) {
            onFinish(null, e);
        }
    }

    function addStyles(page, styles) {
        page.evaluate(function(styles) {
            var style = document.createElement('style'),
                content = document.createTextNode(styles),
                head = document.head;

            style.setAttribute('type', 'text/css');
            style.appendChild(content);

            head.insertBefore(style, head.firstChild);
        }, styles);
    }

    /* Fire starter */

    var system = require('system'),
        webpage = require('webpage'),
        base64 = argument(0),
        outputFile = argument(1);

    captureScreenshot(base64, outputFile, exit);

})();
