// Since Object.keys creates a separate array,
// this function is safe to modify the current property
// but the change won't be reflected during iteration
var forEachProperty = function (obj, func, thisObj) {
    var keys = Object.keys(obj);
    return keys.every(function (key) {
        return func.call(this, obj[key], key);
    }, thisObj);
}
//--------------------------------------------------------------------------

var thisCall = function (func, thisObj) {
    var _this = thisObj ? thisObj : this;
    return function () {
        return func.apply(_this, arguments);
    }
};
//--------------------------------------------------------------------------

function EventSource() {
    this.registrar = {};
}

EventSource.prototype.fire = function (name) {
    var target = name && this.registrar[name];
    if (target) {
        var args = Array.prototype.slice.call(arguments, 1);
        target.every(function (func) {
            func.apply(null, args);
            return true;
        });
    }
}

EventSource.prototype.on = function (name, callback) {
    if (!name || !callback || typeof callback !== "function") return;

    var target = this.registrar[name];
    if (!target) {
        this.registrar[name] = target = [];
    }
    target.push(callback);
}
//--------------------------------------------------------------------------

function ajax(settings) {
    var promises = [
        new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open(settings.method || "GET", settings.url, true);
            xhr.responseType = settings.responseType || "";
            if (settings.headers) {
                var keys = Object.keys(settings.headers);
                for (var i = 0; i < keys.length; i++) {
                    if (keys[i] && settings.headers[keys[i]]) {
                        xhr.setRequestHeader(keys[i], settings.headers[keys[i]]);
                    }
                }
            }

            xhr.onload = function () {
                if (xhr.status < 400
                    && xhr.response) {
                    resolve(xhr);
                }
                else {
                    reject(new Error("download failed"));
                }
            }

            xhr.onerror = function () {
                reject(new Error("XHR error"));
            };
            xhr.send();
        }),
        new Promise(function (resolve, reject) {
            var timer = (settings.timeout > 0 && setTimeout(function () {
                clearTimeout(timer);
                reject(new Error("timed out"));
            }, settings.timeout));
        })
    ];
    return Promise.race(promises);
}
//--------------------------------------------------------------------------

function Cache(capacity, shrinksize){
    var table = {};
    var queue = [];
    if (capacity < 1 || shrinksize < 1 || capacity < shrinksize)
        throw new RangeError("invalid capacity and shrinksize");
    
    function shrink() {
        if (queue.length == capacity) {
            for (var i = 0; i < shrinksize; i++) {
                delete table[queue.shift().key];
            }
        }
    }
    this.add = function(key, value) {
        shrink();
        if (key && !table.hasOwnProperty(key)) {
            var entry = {key:key, value:value};
            table[key] = entry;
            queue.push(entry);
            return entry;
        }
    }
    this.get = function(key) {
        if (!key) return null;
        var entry = table[key];
        return entry ? entry.value : null;
    }
}

var SELECTIONTYPE = {
    UNKNOWN: 0,
    TEXT: 1,
    LINK: 2,
    IMAGE: 3
};