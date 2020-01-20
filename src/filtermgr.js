function createAllowlistModel(configModel, chrome) {
    var NOTINITIALIZED = 0,
        INITIALIZING = 1,
        READY = 2,
        FAILED = 3;
    var storageNames = ["A", "B"],
        defaultSettings = {
            configKeyName: "athensDBConfig",
            urlDBNamePrefix: "atUrlDBName_",
            updateInterval: 604800000 // 7days
        };
        
    var event = new EventSource(),
        filterWorker = new Worker("/src/filterwkr.js"),
        filterWkrPort = Messenger.createDefaultMessenger(
            true, function (message) {
                filterWorker.postMessage(message);
            },
            true, function (onReceive) {
                filterWorker.onmessage = function (e) {
                    onReceive(e.data);
                };
            },
            "filtermgr",
            "filterwkr"),
        previousAllowlist = {
            etag: null,
            lastUpdate: 0
        },
        updateJob = {
            state: NOTINITIALIZED,
            storageName: null,
            lastUpdate: 0
        },
        readJob = {
            state: NOTINITIALIZED,
            storageName: null,
            lastUpdate: 0
        };


    function isValidConfig(config) {
        return config
            && (config.activeStoreName === storageNames[0] || config.activeStoreName === storageNames[1])
            && config.signature
            && typeof (config.lastUpdate) === "number";
    }

    function initDefaultNames() {
        readJob.storageName = null;
        updateJob.storageName = storageNames[0];
    }

    // This func assumes states are all in proper values and no job outstanding
    function initAllowlistUpdateStrategyAsync() {
        // based on previous execution
        if (readJob.state != NOTINITIALIZED) {
            if (readJob.storageName === storageNames[0]) {
                updateJob.storageName = storageNames[1];
            }
            else {
                updateJob.storageName = storageNames[0];
            }

            if (updateJob.state === READY) {
                previousAllowlist.etag = updateJob.etag;
                previousAllowlist.lastUpdate = updateJob.lastUpdate;
            }
            return new Promise({ read: false, update: true, updateDelay: 0 });
        }

        return new Promise(function (resolve, reject) {
            // this is the first one, so load from storage
            chrome.storage.local.get(
                defaultSettings.configKeyName,
                function (config) {
                    config = !chrome.runtime.lastError && config ? config[defaultSettings.configKeyName] : null;
                    if (isValidConfig(config)) {
                        previousAllowlist.etag = config.signature;
                        previousAllowlist.lastUpdate = config.lastUpdate;
                        if (config.activeStoreName === storageNames[0]) {
                            readJob.storageName = storageNames[0];
                            updateJob.storageName = storageNames[1];
                        }
                        else {
                            readJob.storageName = storageNames[1];
                            updateJob.storageName = storageNames[0];
                        }
                        resolve({ read: true, readDelay: 500, update: true, updateDelay: 10000 });
                    }
                    else {
                        initDefaultNames();
                        resolve({ read: false, update: true, updateDelay: 500 });
                    }
                });
        }).catch(function () {
            initDefaultNames();
            return { read: false, update: true, updateDelay: 500 };
        });
    }

    function initializeFilterAsync() {
        return new Promise(function (resolve, reject) {
            filterWkrPort.call(
                "init",
                {
                    "urlDBName": defaultSettings.urlDBNamePrefix + readJob.storageName,
                },
                null,
                function (success) {
                    success ? resolve() : reject();
                });
        });
    }

    function getTimer(delay) {
        return new Promise(function (resolve) {
            var timer = setTimeout(function () {
                clearTimeout(timer);
                resolve();
            }, delay)
        });
    }

    function kickoffFilterInit(delay) {
        if (readJob.state === INITIALIZING)
            return Promise.reject("another initialization in progress");
        if (!readJob.storageName)
            return Promise.reject("storageName missing");

        readJob.state = INITIALIZING;

        return getTimer(delay)
        .then(function () {
            readJob.lastUpdate = Date.now();
            return initializeFilterAsync();
        })
        .then(function () {
            readJob.state = READY;
        })
        .catch(function () {
            readJob.state = FAILED;
        });
    }

    function kickoffFilterUpdate(delay) {
        if (updateJob.state === INITIALIZING)
            return Promise.reject("another update in progress");
        if (previousAllowlist.lastUpdate && Date.now() < previousAllowlist.lastUpdate + defaultSettings.updateInterval)
            return Promise.resolve();

        updateJob.state = INITIALIZING;
        return getTimer(delay)
        .then(function () {
            return new Promise(function (resolve, reject) {
                var updater = new Worker("/src/filterupdate.js"),
                    updaterPort = Messenger.createDefaultMessenger(
                        true, function (message) { updater.postMessage(message); },
                        true, function (onReceive) { updater.onmessage = function (e) { onReceive(e.data); }; },
                        "filtermgr",
                        "filterupdater");

                updaterPort.call(
                    "update",
                    {
                        etag: previousAllowlist.etag,
                        urlDBName: defaultSettings.urlDBNamePrefix + updateJob.storageName,
                        host: configModel.config.allowlist_host,
                        endpoint: configModel.config.allowlist_endpoint,
                        params: configModel.config.allowlist_params,
                        clientsig: configModel.config.common_clientsig,
                        version: configModel.config.common_version
                    },
                    null,
                    function (success, signature) {
                        if (success) {
                            updateJob.etag = signature;
                            updateJob.lastUpdate = Date.now();
                            resolve();
                        }
                        else {
                            reject("update failed or aborted");
                        }
                        updaterPort.fire("close");
                    });
            });
        })
        .then(function () {
            updateConfig(updateJob);
        })
        .then(function () {
            updateJob.state = READY;
        })
        .catch(function () {
            updateJob.state = FAILED;
        });
    }

    function updateConfig(updateJob) {
        var entry = {};
        entry[defaultSettings.configKeyName] = {
            activeStoreName: updateJob.storageName,
            signature: updateJob.etag,
            lastUpdate: updateJob.lastUpdate
        }
        chrome.storage.local.set(entry);
    }

    function tryReinitFilterAfterUpdate() {
        if (updateJob.state === READY) {
            if ((readJob.state === READY || readJob.state === FAILED) && readJob.lastUpdate < updateJob.lastUpdate
                || readJob.state === NOTINITIALIZED) {
                readJob.storageName = updateJob.storageName;
                return kickoffFilterInit(1000); //re-read filter after 1s
            }
        }
        return Promise.resolve();
    }

    function checkUrl(url) {
        return new Promise(function (resolve, reject) {
            if (configModel.config.allowlist_bypass) {
                resolve(true);
                return;
            }

            if (readJob.state === READY) {
                filterWkrPort.call(
                    "lookup",
                    url,
                    null,
                    function (success, result) {
                        resolve(success? result : false);
                    });
            }
            else {
                reject();
            }
        });
    }

    function start() {
        if (readJob.state === INITIALIZING || updateJob.state === INITIALIZING)
            return;
        
        initAllowlistUpdateStrategyAsync()
        .then(function (strategy) {
            var promises = [];
            if (strategy.read) {
                promises.push(kickoffFilterInit(strategy.readDelay));
            }
            if (strategy.update){
                promises.push(kickoffFilterUpdate(strategy.updateDelay));
            }
            return Promise.all(promises);
        })
        .then(function () {
            return tryReinitFilterAfterUpdate();
        });
    }
    
    function isReady4Lookup() {
        return readJob.state === READY;
    }
    
    return {
        on: function () { event.on.apply(event, arguments); },
        start: start,
        check: checkUrl,
        ready: isReady4Lookup
    }
}