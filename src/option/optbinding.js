var _Athens = _Athens || {};
_Athens._BinderFactory = (function (document) {
    function Control(name, htmlControl, verifier, defaultValue) {
        this.name = name;
        this.verifier = verifier;
        this.event = new EventSource();
        this.bind2HtmlControl(htmlControl);

        if (defaultValue === undefined) {
            throw new Error("control's defaultValue cannot be undefined.");
        }
        this.defaultValue = defaultValue;
        this.set(defaultValue);
    }

    Control.supportedElements = {
        "input": 1,
        "select": 1,
        "textarea": 1,
        "radionodelist": 1
    };

    Control.prototype.thisCall = thisCall;

    Control.prototype.bind2HtmlControl = function (htmlControl) {
        this.htmlControl = htmlControl;
        var tagName = htmlControl.tagName || htmlControl.constructor.name;
        if (tagName) {
            tagName = tagName.toLowerCase();
            if (Control.supportedElements[tagName]) {
                this.type = tagName === "input" ? this.htmlControl.type : tagName;
            }
            else {
                throw new Error(tagName + " is not supported");
            }
        }

        switch (this.type) {
            case "radionodelist":
                Array.prototype.every.call(htmlControl, this.thisCall(function (control) {
                    control.addEventListener("change", this.thisCall(function (e) { return this.handleValueChange(); }));
                    return true;
                }, this));
                break;
            case "textarea":
            case "text":
                this.htmlControl.addEventListener("input", this.thisCall(function (e) { return this.handleInput(); }));
                // fall through
            default:
                this.htmlControl.addEventListener("change", this.thisCall(function (e) { return this.handleValueChange(); }));
        }
    }

    Control.State = {
        Default: 0,
        Custom: 1,
        Uncommited: 2,
        Invalid: 3
    };

    Control.prototype.getHtmlValue = function () {
        switch (this.htmlControl.type) {
            case "checkbox":
                return this.htmlControl.checked;
                break;
            default:
                return this.htmlControl.value;
                break;
        }
    }

    Control.prototype.setHtmlValue = function (value) {
        switch (this.htmlControl.type) {
            case "checkbox":
                this.htmlControl.checked = !!value;
                break;
            default:
                this.htmlControl.value = value;
        }
    }

    Control.prototype.handleValueChange = function () {
        var value = this.getHtmlValue();
        this.updateState(value);
    }

    Control.prototype.handleInput = function () {
        this.isDirty = true;
    }

    Control.prototype.updateState = function (value) {
        var oldValue = this.cacheValue;
        this.cacheValue = value;
        this.isDirty = false;
        if (value !== oldValue) {
            this.event.fire("valuechange", this.name, value);
        }

        var isValid = this.verify();
        var state = Control.State.Custom;
        if (!isValid) {
            state = Control.State.Invalid;
        }
        else if (value !== this.committedValue) {
            state = Control.State.Uncommited;
        }
        else if (value === this.defaultValue) {
            state = Control.State.Default;
        }

        var oldState = this.state;
        this.state = state;
        if (oldState !== state) {
            // for single control, use data-state to show hint themes
            // radionodelist is not covered
            if (this.type !== "radionodelist") {
                this.htmlControl.dataset.state = this.type + state;
            }
            this.event.fire("statechange", this.name, state);
        }
    }

    Control.prototype.set = function (value) {
        this.committedValue = value;
        this.setHtmlValue(value);
        this.updateState(value);
    }

    Control.prototype.revert = function () {
        this.setHtmlValue(this.committedValue);
        this.updateState(this.committedValue);
    }

    Control.prototype.set2Default = function () {
        this.setHtmlValue(this.defaultValue);
        this.updateState(this.defaultValue);
    }

    Control.prototype.get = function () {
        if (this.isDirty) {
            this.updateState(this.getHtmlValue());
        }
        return this.cacheValue;
    }

    Control.prototype.commit = function () {
        this.committedValue = this.cacheValue;
        this.updateState(this.committedValue);
    }

    Control.prototype.verify = function () {
        return this.verifier(this.get());
    }

    Control.prototype.addEventListener = function (name, func) {
        this.event.on(name, func);
    }

    //-----------------------------------------------------------------------------------

    function Binder(dataSource) {
        this.event = new EventSource();
        this.controls = [];
        this.controlMap = {};
        this.dataSource = dataSource;
        this.invalidMap = {};
        this.uncommittedMap = {};
    }

    Binder.prototype.thisCall = thisCall;

    Binder.prototype.addEventListener = function (name, func) {
        this.event.on(name, func);
    }

    Binder.prototype.bind = function () {
        var map = this.dataSource.map;
        var formElements = document.forms["optionsForm"];

        forEachProperty(
            map,
            function (def) {
                var name = def.name;
                var htmlControl = formElements[name];
                if (htmlControl) {
                    var control = new Control(
                        name,
                        htmlControl,
                        def.verifier ? def.verifier : this.getDefaultVerifier(name),
                        def.Default);
                    control.addEventListener("statechange", this.thisCall(this.handleControlStateChange));
                    // explicit call to reflect initial state
                    this.handleControlStateChange(name, control.state);
                    this.controls.push(control);
                    this.controlMap[name] = control;
                }
                return true;
            },
            this);
    }

    Binder.prototype.handleControlStateChange = function (name, state) {
        switch (state) {
            case Control.State.Invalid:
                this.invalidMap[name] = 1;
                delete this.uncommittedMap[name];
                break;
            case Control.State.Uncommited:
                this.uncommittedMap[name] = 1;
                delete this.invalidMap[name];
                break;
            default:
                delete this.invalidMap[name];
                delete this.uncommittedMap[name];
        }

        this.event.fire("statechange", this.hasInvalid(), this.hasUncommitted());
    }

    Binder.prototype.hasInvalid = function () {
        return Object.keys(this.invalidMap).length > 0;
    }

    Binder.prototype.hasUncommitted = function () {
        return Object.keys(this.uncommittedMap).length > 0;
    }

    Binder.prototype.getDefaultVerifier = function (name) {
        return function (value) {
            return true;
        };
    }
    
    Binder.prototype.load = function () {
        return this.dataSource.load()
            .then(this.thisCall(function (ds) {
                this.controls.every(function (control) {
                    var value = ds.config[control.name];
                    if (value) {
                        control.set(value);
                    }
                    return true;
                });
            }));
    }

    Binder.prototype.persist = function () {
        return new Promise(this.thisCall(function (resolve, reject) {
            var overrideConfig = {};
            var succeeded = this.controls.every(function (control) {
                if (control.verify()) {
                    var value = control.get();
                    if (value != control.defaultValue) {
                        overrideConfig[control.name] = value;
                    }
                    return true;
                }
                return false;
            });
            succeeded ? resolve(overrideConfig) : reject(new Error("invalid data"));
        }))
        .then(this.thisCall(function (overrideConfig) {
            return this.dataSource.save(overrideConfig).then(this.thisCall(function () {
                this.controls.every(function (control) {
                    control.commit();
                    return true;
                });
            }))
        }));
    }

    Binder.prototype.revert = function () {
        this.controls.every(function (control) {
            control.revert();
            return true;
        });
    }

    Binder.prototype.set2Default = function () {
        this.controls.every(function (control) {
            control.set2Default();
            return true;
        });
    }

    Binder.prototype.getControl = function (name) {
        return this.controlMap[name];
    }

    function createBinder(dataSource) {
        return new Binder(dataSource);
    }

    return {
        create: createBinder
    }
}(document));
