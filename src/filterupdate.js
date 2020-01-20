importScripts('commondefs.js');
importScripts('filterdefs.js');
importScripts('messenger.js');

var _Updater = (function (indexedDB) {
    var ALLOWLISTSPEC = {
        HASHOFFSET: 5 * 4,
        MAXHASHCOUNT: 99,
        MAXBITMAPSIZE: 5000000
    };

    var currentAllowlist = {};
    var commPort = Messenger.createDefaultMessenger(
        true, function (message) { self.postMessage(message); },
        true, function (onReceive) { self.onmessage = function (e) { onReceive(e.data); }; },
        "filterupdater",
        "filtermgr");

    function updateAllowlist(updateRequest, context, responder) {
        if (updateRequest) {
            updateAllowlistAsync(updateRequest)
            .then(function () {
                responder.done(currentAllowlist.etag);
                currentAllowlist = {};
            })
            .catch(function () {
                responder.fail();
                currentAllowlist = {};
            });
        }
        else {
            responder.fail();
        }
    }

    function updateAllowlistAsync(allowlistSettings) {
        return new Promise(function (resolve, reject) {
            if (currentAllowlist.pending) {
                reject(new Error("update pending"));
                return;
            }

            currentAllowlist.pending = true;
            currentAllowlist.etag = allowlistSettings.etag;
            currentAllowlist.urlDBName = allowlistSettings.urlDBName;

            downloadAllowlist(
                allowlistSettings.host,
                allowlistSettings.endpoint,
                allowlistSettings.params,
                allowlistSettings.clientsig,
                allowlistSettings.version)
            .then(function (data) {
                parseAllowlist(data);
                return save2Storage();
            })
            .then(function () {
                currentAllowlist.pending = false;
                resolve();
            })
            .catch(function (e) {
                currentAllowlist.pending = false;
                reject(e);
            });
        });
    }

    function save2Storage() {
        return new Promise(function (resolve, reject) {
            var request = indexedDB.deleteDatabase(currentAllowlist.urlDBName);
            request.onerror = request.onabort = function () { reject(new Error("DB delete error")) };
            request.onsuccess = function () { resolve(); };
        })
        .then(function () {
            return new Promise(function (resolve, reject) {
                var reqeust = indexedDB.open(currentAllowlist.urlDBName, 1);
                reqeust.onerror = function () { reject(new Error("DB open error")); };
                reqeust.onupgradeneeded = function (event) { resolve(event.target.result); };
            });
        })
        .then(function (db) {
            return new Promise(function (resolve, reject) {
                var transaction = db.createObjectStore(
                    _AllowlistStoreDefs.bloomfilterStoreName,
                    { keyPath: _AllowlistStoreDefs.bloomfilterStoreKeyName }).transaction;
                db.createObjectStore(
                    _AllowlistStoreDefs.urlPatternsStoreName,
                    { keyPath: _AllowlistStoreDefs.urlPatternsStoreKeyName })

                transaction.onerror = transaction.onabort = function () {
                    db.close();
                    reject(new Error("DB creation error"));
                };
                transaction.oncomplete = function () { resolve(db); };
            });
        })
        .then(function (db) {
            return new Promise(function (resolve, reject) {
                function addDomainEntry2Store(store, domain, pattern) {
                    var entry = {};
                    entry[_AllowlistStoreDefs.urlPatternsStoreKeyName] = domain;
                    entry[_AllowlistStoreDefs.urlPatternsStoreValueName] = pattern;
                    store.add(entry);
                }

                var transaction = db.transaction(
                        [
                            _AllowlistStoreDefs.bloomfilterStoreName,
                            _AllowlistStoreDefs.urlPatternsStoreName
                        ],
                        "readwrite");
                transaction.onerror = transaction.onabort = function () {
                    db.close();
                    reject(new Error("DB writing error"));
                };
                transaction.oncomplete = function () {
                    db.close();
                    resolve();;
                };

                var bloomfilterstore = transaction.objectStore(_AllowlistStoreDefs.bloomfilterStoreName);

                var entry = {};
                entry[_AllowlistStoreDefs.bloomfilterStoreKeyName] = _AllowlistStoreDefs.bloomfilterStoreEntryName;
                entry[_AllowlistStoreDefs.bloomfilterStoreBitmapName] = currentAllowlist.bitmap;
                entry[_AllowlistStoreDefs.bloomfilterStoreHashName] = currentAllowlist.hash;
                bloomfilterstore.add(entry);

                var urlstore = transaction.objectStore(_AllowlistStoreDefs.urlPatternsStoreName);
                for (var i = 0; i < currentAllowlist.denylist.length; i++) {
                    addDomainEntry2Store(urlstore, currentAllowlist.denylist[i], null);
                }
                if (currentAllowlist.urlfilter && Array.isArray(currentAllowlist.urlfilter)) {
                    for (var i = 0; i < currentAllowlist.urlfilter.length; i++) {
                        var domain = currentAllowlist.urlfilter[i].domain,
                            path = currentAllowlist.urlfilter[i].path;
                        if (domain && path) {
                            addDomainEntry2Store(urlstore, domain, path);
                        }
                    }
                }
            })
        });
    }

    function downloadAllowlist(host, endpoint, params, sig, version) {
        return ajax({
            url: [host, "/", endpoint, "?", "version=" + version, params ? "&" + params : ""].join(""),
            responseType: "arraybuffer",
            timeout: 10000,
            headers: {
                "X-BingAthens-Client": sig
            }
        })
        .then(function (xhr) {
            return new Promise(function (resolve, reject) {
                if (xhr.getResponseHeader("Content-Type") == "application/octet-stream") {
                    var etag = xhr.getResponseHeader("ETag");
                    if (etag && etag != currentAllowlist.etag) {
                        currentAllowlist.etag = etag;
                        resolve(xhr.response);
                    }
                    else {
                        reject(new Error("no new list found"));
                    }
                }
                else {
                    reject(new Error("invalid response from server"));
                }
            })
        });
    }

    function parseAllowlist(buffer) {
        var pos = ALLOWLISTSPEC.HASHOFFSET,
            view = new DataView(buffer);
        function getUint32() {
            var number = view.getUint32(pos, true);
            pos += 4;
            return number;
        }

        function getStringFromUTF8(uint8Array) {
            return decodeURIComponent(escape(String.fromCharCode.apply(null, uint8Array)));
        }

        var hashCount = getUint32();
        if (hashCount < 1 || hashCount > ALLOWLISTSPEC.MAXHASHCOUNT) {
            throw new RangeError("hashCount out of range");
        }

        var hash = [];
        for (var i = 0; i < hashCount; i++) {
            hash.push(getUint32())
        }
        currentAllowlist.hash = hash;

        var bitmapSize = getUint32();
        if (bitmapSize < 1 || bitmapSize > ALLOWLISTSPEC.MAXBITMAPSIZE) {
            throw new RangeError("bitmap size out of range");
        }
        currentAllowlist.bitmap = buffer.slice(pos, pos + bitmapSize);
        pos += bitmapSize;

        var denylistCount = getUint32();
        var rawUTF8 = new Uint8Array(buffer, pos),
            startindex = 0,
            endindex,
            denylist = [];
        for (; denylistCount > 0; denylistCount--) {
            endindex = startindex;
            for (; rawUTF8[endindex] != 0; endindex++);
            if (endindex > startindex) {
                denylist.push(getStringFromUTF8(rawUTF8.slice(startindex, endindex)));
            }
            startindex = endindex + 1;
        }
        currentAllowlist.denylist = denylist;
        pos += startindex;

        var urlFilterSize = getUint32();
        startindex += 4;
        if (rawUTF8.length < startindex + urlFilterSize) {
            throw new RangeError("invalid urlfilter size");
        }
        if (urlFilterSize > 0) {
            currentAllowlist.urlfilter = JSON.parse(getStringFromUTF8(rawUTF8.slice(startindex, startindex + urlFilterSize)));
            if (!Array.isArray(currentAllowlist.urlfilter)) {
                throw new TypeError("invalid urlfilter content");
            }
        }
    }

    function closeSelf() {
        self.close();
    }
    
    commPort.serv("update", updateAllowlist);
    commPort.on("close", closeSelf);
})(self.indexedDB);
