var _Athens = _Athens || {};
_Athens._OptionsDataSourceFactory = (function (_Athens) {
    function OptionsDataSource(isModifier) {
        this.overrideConfig = null;
        this.config = {};
        this.connect(isModifier);
        this.map = {};
    }

    OptionsDataSource.optionsStorageName = "athensOptions";

    OptionsDataSource.prototype.thisCall = thisCall;

    OptionsDataSource.prototype.registerOne = function (entry) {
        this.map[entry.name] = entry;
        this.config[entry.name] = entry.Default;
    }

    OptionsDataSource.prototype.register = function (submap) {
        if (Array.isArray(submap)) {
            submap.every(function (entry) {
                this.registerOne(entry);
                return true;
            }, this);
        }
        else {
            this.registerOne(submap);
        }
    }

    OptionsDataSource.prototype.normalizeConfig = function (overrideConfig) {
        var config = {};

        forEachProperty(
            this.map,
            function (mapentry, key) {
                config[key] = mapentry.Default;
                return true;
            });

        forEachProperty(
            overrideConfig,
            function (value, key) {
                var mapentry = this.map[key];
                if (!mapentry
                    || mapentry.Default === value
                    || mapentry.verifier && !mapentry.verifier(value)) {
                    delete overrideConfig[key];
                }
                else {
                    config[key] = value;
                }
                return true;
            }, this);

        return {
            config: config,
            overrideConfig: overrideConfig
        };
    }

    OptionsDataSource.prototype.load = function (force) {
        return new Promise(this.thisCall(function (resolve, reject) {
            if (this.overrideConfig && !force) {
                resolve(null);
                return;
            }
            chrome.storage.local.get(
                OptionsDataSource.optionsStorageName,
                function (config) {
                    var overrideConfig = !chrome.runtime.lastError && config ? config[OptionsDataSource.optionsStorageName] : {};
                    resolve(overrideConfig);
                });
        }))
        .catch(function () {
            return {};
        })
        .then(this.thisCall(function (overrideConfig) {
            if (overrideConfig) {
                var configs = this.normalizeConfig(overrideConfig);
                this.overrideConfig = configs.overrideConfig;
                this.config = configs.config;
            }
            return this;
        }));
    }

    OptionsDataSource.prototype.save = function (overrideConfig) {
        return new Promise(this.thisCall(function (resolve, reject) {
            configs = this.normalizeConfig(overrideConfig);
            var entry = {};
            entry[OptionsDataSource.optionsStorageName] = configs.overrideConfig;
            chrome.storage.local.set(entry, this.thisCall(function () {
                if (chrome.runtime.lastError) {
                    reject(new Error("storage failure"));
                }
                else {
                    this.overrideConfig = configs.overrideConfig;
                    this.config = configs.config;
                    this.commPort.fire("configChange");
                    resolve(this);
                }
            }));
        }));
    }

    OptionsDataSource.prototype.connect = function (isModifer) {
        if (isModifer) {
            this.commPort = Messenger.createDefaultMessenger(
                false, function (message, context, callback) {
                    chrome.runtime.sendMessage(message, callback);
                },
                false, function (onReceive) {
                },
                "options",
                "options");

        }
        else {
            commPort = Messenger.createDefaultMessenger(
                false, function (message, context, callback) {
                },
                false, function (onReceive) {
                    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
                        onReceive(message, sendResponse);
                    });
                },
                "options",
                "options");
            commPort.on("configChange", this.thisCall(function () {
                this.load(true);
            }));
        }
    }

    return {
        create: function (isModifier) {
            var ds = new OptionsDataSource(isModifier);
            ds.register(_Athens._AtOptions);
            return ds;
        }
    }
})(_Athens);
_Athens._AtOptions = [];