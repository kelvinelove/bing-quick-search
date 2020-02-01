/*
 * IApiStratefy @interface
function IApiStratefy() { };

 * register an API with return value of {@code name} with {@code handler}.
 * @param {string} name Name of API.
 * @param {function({any} data, {Responder} responder)} handler Handler serving request.
 *      Handler
 *      @param {any} data Parameter for this API.
 *      @param {Responder} responder. object to return result.
 *          Responder.prototype.done(result);
 *              @param {any, opt} result. Result of execution.
 *          Responder.prototype.fail(result);
 *              @param {any, opt} result. Optional data for failure.
IApiStratefy.prototype.reply = function (name, callback) { };

 * register an API without return value of {@code name} with {@code handler}.
 * @param {string} name Name of API.
 * @param {function({any} data)} handler Handler.
 *      Handler
 *      @param {any} data Parameter for this API.
IApiStratefy.prototype.listen = function (name, callback) { };

 * invoke an API of {@code name} with {@code data} and receive result with {@code setResult}.
 * @param {string} name Name of API.
 * @param {any} data API parameter data.
 * @param {function({boolean} result, {any} data)} setResult Function to receive result. Optional for API w/o return value.
IApiStratefy.prototype.invoke = function (name, data, setResult) { };

 * invoke an API from a packed request and receive result with {@code setResult}.
 * @param {packed} packed Packed request originated from {@code pack} method of the same strategy.
 * @param {function({boolean} result, {any} data)} setResult Function to receive result. Optional for API w/o return value.
IApiStratefy.prototype.invokePacked = function (packed, setResult) { };

* Pack arguments into a single object. Used to pack request or result before delivering as a single JSON.
* @params {any} any Any number of any JSON serializable parameters.
IApiStratefy.prototype.pack = function (...) { };

* Unpack a packed originated from {@code pack} method.
* @param {packed} packed Packed request originated from {@code pack} method of the same strategy.
* @param {function(...)} callback Function to receive unpacked individual parameters.
IApiStratefy.prototype.unpack = function (packed, callback) { };
*/

/*
 * DefaultApiStrategy definition
 * @constructor @implements IApiStratefy
 * Note for reply method:
 *   If setResult is set for an API w/o return value, a dummy stub will return undefined data with correspondent succeeded flag.
 */
function DefaultApiStrategy() {
    var apiMap = {};

    this.reply = function (name, callback) {
        this.register(apiMap, name, callback, true);
    }

    this.listen = function (name, callback) {
        this.register(apiMap, name, callback, false);
    }

    this.invoke = function (name, params, context, setResult) {
        this.lookupAndInvoke(apiMap, name, params, context, setResult);
    }
}

DefaultApiStrategy.prototype.pack = function () {
    return {
        params: Array.prototype.slice.call(arguments)
    };
};

DefaultApiStrategy.prototype.unpack = function (packed, callback /*(param1, param2, ...)*/ ) {
    if (packed && packed.params && Array.isArray(packed.params)) {
        callback.apply(null, packed.params);
    } else {
        console.error("DefaultApiStrategy: invalid packed data:" + packed);
        callback();
    }
}

/**
 * Helper method to register an API
 **/
DefaultApiStrategy.prototype.register = function (apiMap, name, callback, expectResult) {
    if (name) {
        apiMap[name] = {
            expectResult: expectResult,
            callback: callback
        };
    }
}

/**
 * Helper method to lookup and call an API
 * If setResult is set for an API w/o return value, a dummy stub will return undefined data with correspondent succeeded flag.
 **/
DefaultApiStrategy.prototype.lookupAndInvoke = function (apiMap, name, params, context, setResult) {
    var entry = apiMap[name];
    if (entry) {
        var responder = {
            fail: function (result) {
                setResult && setResult(false, result);
            },
            done: function (result) {
                setResult && setResult(true, result);
            }
        };

        if (entry.expectResult) {
            try {
                entry.callback(params, context, responder);
            } catch (e) {
                responder.fail();
            }
        } else {
            try {
                entry.callback(params, context);
                responder.done();
            } catch (e) {
                responder.done();
            };
        }
    } else {
        console.error("API not found:" + name);
    }
}

DefaultApiStrategy.prototype.invokePacked = function (packed, context, setResult) {
    var _this = this;
    this.unpack(packed, function (name, params) {
        if (name) {
            _this.invoke(name, params, context, setResult);
        }
    })
}

//-------------------------------------------------------------------------------------------
/*
 * IMessenger @interface
function IMessenger() { };

 * call a remote function of {@code name} with {@code data} with {@code callback}.
 * @param {string} name Name of API.
 * @param {any} data API parameter data.
 * @param {function({boolean} result, {any} data)} callback Callback to receive result.
 *      Callback
 *      @param {boolean} result API execution succeeded or not.
 *      @param {any} data Result.
IMessenger.prototype.call = function (name, data, callback) { };

 * fire a remote notification of {@code name} with {@code data}.
 * @param {string} name Name of API.
 * @param {any} data API parameter data.
IMessenger.prototype.fire = function (name, data) { };

 * register a remotely callable function of {@code name} with {@code handler}.
 * @param {string} name Name of API.
 * @param {function({any} data, {function({boolean} result, {any} data)} setResult)} handler Handler serving request.
 *      Handler
 *      @param {any} data Parameter for this API.
 *      @param {function({boolean} result, {any} data)} setResult. Callback to return result.
 *          setResult callback
 *          @param {boolean} result Whether execution succeeded.
 *          @param {any} data API execution result.
IMessenger.prototype.serv = function (name, callback) { };

 * register a remotely notification listener of {@code name} with {@code handler}.
 * @param {string} name Name of API.
 * @param {function({any} data)} handler Handler invoked by notification.
 *      Handler
 *      @param {any} data Parameter for this API.
IMessenger.prototype.on = function (name, callback) { };
*/

/*
 * Messenger definition
 * @constructor @implements IMessenger
 * @param {IApiStrategy} conversationStrategy conversation strategy
 */
function Messenger(conversationStrategy) {
    var apiImpl = new DefaultApiStrategy();

    this.call = function (name, params, context, callback) {
        conversationStrategy.request(
            apiImpl.pack(name, params),
            context,
            function (packed) {
                apiImpl.unpack(packed, callback);
            });
    }

    this.fire = function (name, params, context) {
        conversationStrategy.post(apiImpl.pack(name, params), context);
    }

    this.serv = function (name, handler) {
        apiImpl.reply(name, handler);
    }

    this.on = function (name, handler) {
        apiImpl.listen(name, handler);
    }

    conversationStrategy.onRequest = function (message, context, sendResponse) {
        apiImpl.invokePacked(
            message,
            context,
            sendResponse ? function (result, data) {
                sendResponse(apiImpl.pack(result, data));
            } : null);
    }
}
//-----------------------------------------------------------------------------------------------------------

/*
 * IConversationStrategy @interface
 * Implements abstraction of callables w/ or w/o return value between two parties.
function IConversationStrategy() { };

 * Issue a request for return value.
 * @param {any} request Request data.
 * @param {function({any} data)} callback Callback to receive data.
 *      Callback
 *      @param {any} data Return data.
IConversationStrategy.prototype.request = function (request, callback) { };

 * Issue a request w/o return value.
 * @param {any} request Request data.
IConversationStrategy.prototype.post = function (request) { };

 * Event of incoming request.
 * @param {function({any} request, {function({any} response)} sendResponse)} handler Handler to handle incoming request.
 *      Handler
 *      @param {any} request Incoming request.
 *      @param {function({any} response)} sendResponse Function for handler to return response to the reqeust, if needed.
IConversationStrategy.prototype.onRequest = handler;
*/

function DefaultConversationStrategy(incoming, outgoing) {
    var _this = this;
    var apiImpl = new DefaultApiStrategy();
    var calltrack = {
        callmap: {},
        callcount: 0
    };

    if (incoming.connectless) {
        var postResultHandler = this.getPostHandler(apiImpl, outgoing, "call_result");
        apiImpl.listen("call", function (message, context) {
            _this.invokeRequestHandler(message.request, context, function (result) {
                postResultHandler({
                    id: message.id,
                    result: result
                });
            });
        });
    } else {
        apiImpl.reply("call", function (message, context, responder) {
            _this.invokeRequestHandler(message, context, function (result) {
                responder.done(result);
            });
        });
    }

    if (outgoing.connectless) {
        apiImpl.listen("call_result", this.getPostResultHandler(calltrack));
    }

    apiImpl.listen("notify", function (params, context) {
        _this.invokeRequestHandler(params, context);
    });

    this.request = this.getCallHandler(apiImpl, outgoing, calltrack);
    this.post = this.getPostHandler(apiImpl, outgoing, "notify");

    incoming.onMessage = function (message, context, sendResponse) {
        apiImpl.invokePacked(
            message,
            context,
            sendResponse ?
            function (result, data) {
                if (result) {
                    sendResponse(data);
                }
            } : null);
    }
}

DefaultConversationStrategy.prototype.getPostResultHandler = function (calltrack) {
    return function (data) {
        if (calltrack.callmap.hasOwnProperty(data.id)) {
            var callback = calltrack.callmap[data.id];
            delete calltrack.callmap[data.id];
            try {
                callback && callback(data.result);
            } catch (e) {};
        }
    }
};

DefaultConversationStrategy.prototype.getCallHandler = function (apiImpl, outgoing, calltrack) {
    if (outgoing.connectless) {
        return function (request, context, callback) {
            calltrack.callcount = calltrack.callcount++ % 0x1000;
            calltrack.callmap[calltrack.callcount] = callback;
            outgoing.send(apiImpl.pack("call", {
                id: calltrack.callcount,
                request: request
            }), context);
        }
    } else {
        return function (request, context, callback) {
            outgoing.send(apiImpl.pack("call", request), context, callback);
        }
    }
}

DefaultConversationStrategy.prototype.getPostHandler = function (apiImpl, outgoing, command) {
    return function (message, context) {
        outgoing.send(apiImpl.pack(command, message), context);
    }
}

DefaultConversationStrategy.prototype.invokeRequestHandler = function (params, context, setResponse) {
    if (this.onRequest) {
        this.onRequest(params, context, setResponse);
    }
};

//------------------------------------------------------------------------------------------------
var Port = {
    connectless: undefined
};
Port.getFilteredCall = function (filter, filterfuncName, callee) {
    return filter ? function (message) {
        var params = Array.prototype.slice.call(arguments, 1);
        filter[filterfuncName](message, function (filteredMessage) {
            params.unshift(filteredMessage),
                callee.apply(null, params);
        });
    } : callee;
};

function ConnectedInPort(listen, filter) {
    this.connectless = false;
    var _this = this;
    listen(this.getFilteredCall(filter, "onReceive", function (message, context, sendResponse) {
        _this.onMessage(message, context, sendResponse);
    }));
}

function ConnectedOutPort(send, filter) {
    this.connectless = false;
    this.send = this.getFilteredCall(filter, "onSend", send);
}

function ConnectlessOutPort(send, filter) {
    this.connectless = true;
    this.send = this.getFilteredCall(filter, "onSend", send);
}

function ConnectlessInPort(listen, filter) {
    this.connectless = true;
    var _this = this;
    listen(this.getFilteredCall(filter, "onReceive", function (message, context) {
        _this.onMessage(message, context);
    }));
}

ConnectedOutPort.prototype = ConnectedInPort.prototype = ConnectlessOutPort.prototype = ConnectlessInPort.prototype = Port;

function NamedEndsFilter(signature, localName, remoteName) {
    this.signature = signature;
    this.localName = localName;
    this.remoteName = remoteName;
};

NamedEndsFilter.prototype.onSend = function (message, callback) {
    callback({
        sig: this.signature,
        source: this.localName,
        dest: this.remoteName,
        message: message
    });
}

NamedEndsFilter.prototype.onReceive = function (message, callback) {
    if (message && message.sig === this.signature && message.dest === this.localName) {
        callback(message.message);
    }
}

Messenger.createDefaultMessenger = function (issendconnectless, sendfun, isreceiveconnectless, bindfunc, localName, remoteName) {
    var filter = new NamedEndsFilter("53e51946-4b94-4648-9ada-1629e4f0f8d1", localName, remoteName);

    var inPort = isreceiveconnectless ?
        new ConnectlessInPort(bindfunc, filter) :
        new ConnectedInPort(bindfunc, filter);

    var outPort = issendconnectless ?
        new ConnectlessOutPort(sendfun, filter) :
        new ConnectedOutPort(sendfun, filter);

    return new Messenger(new DefaultConversationStrategy(inPort, outPort));
}