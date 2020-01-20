
function createInjectionCoordinator(configModel, tabModel, chrome) {
    var HostFrameExpandoName = "hostFrameId";
    var ContentPaneExpandoName = "paneFrameId";
    var event = new EventSource();

    // Should match PANEOWNER enum in pane.js.
    var PANEOWNER = {
        NONE: "none",
        ATHENS: "athens",
        LOOKUP: "lookup",
    };

    function injectContentPane(tabId) {
        return new Promise(function (resolve, reject) {
            chrome.tabs.insertCSS(
                tabId,
                {
                    file: "src/inject/inject.css",
                    runAt: "document_end"
                });
            chrome.tabs.executeScript(
                tabId,
                {
                    file: "src/messenger.js",
                    runAt: "document_end"
                });
            chrome.tabs.executeScript(
                tabId,
                {
                    file: "src/inject/inject.js",
                    runAt: "document_end"
                },
                function (result) {
                    resolve();
                });
        });
    }

    var panePort = Messenger.createDefaultMessenger(
        false, function (message, context, callback) {
            chrome.tabs.sendMessage(context.tabId, message, callback);
        },
        false, function (onReceive) {
            chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
                if (!(sender.frameId && sender.frameId > 0))
                    return;
                onReceive(message, {tabId: sender.tab.id}, sendResponse);
            });
        },
        "coordinator",
        "pane"
    );

    panePort.serv("getdata", function (params, context, responder) {
        var tabId = context.tabId;
        responder.done({
            state: tabModel.getExpando(tabId, "state") || 0,
            athensData: tabModel.getData(tabId),
            lookupData: tabModel.getSessionExpando(tabId, "lookup"),
            paneOwner: tabModel.getSessionExpando(tabId, "paneOwner")
        });
    });

    panePort.on("notifyclicked", function (dataId, context) {
        event.fire("notifyclicked", context.tabId, dataId);
    });

    panePort.on("openTab", function (url) {
        chrome.tabs.create({ url: url });
    });

    function updatePaneData(tabId, state, data, needFulData) {
        if (needFulData) {
            panePort.fire("dataupdated", { state: state, data: data }, { tabId: tabId });
        }
        else {
            panePort.fire("statechanged", { state: state, data: { id: data ? data.id : null } }, { tabId: tabId });
        }
    }

    function openAthensPane(tabId) {
        tabModel.setSessionExpando(tabId, "paneOwner", PANEOWNER.ATHENS);
        panePort.fire("openAthensPane", undefined, { tabId: tabId });
    }

    function openLookupPane(tabId, data) {
        tabModel.setSessionExpando(tabId, "paneOwner", PANEOWNER.LOOKUP);
        panePort.fire("openLookupPane", data, { tabId: tabId });
    }

    chrome.webRequest.onBeforeRequest.addListener(function (details) {
        console.log("Detected serviceFrame:" + details.tabId + "|" + details.frameId);
        tabModel.setExpando(details.tabId, HostFrameExpandoName, details.frameId);
        var regresult = /[\?&]url=([^&#]+)(?:&|$)/.exec(details.url);
        return {
            redirectUrl: regresult ? decodeURIComponent(regresult[1]) : "about:blank"
        }
    },
    {
        urls: [
            "chrome-extension://" + chrome.runtime.id + "/host?*"
        ],
        types: ["sub_frame"]
    },
    ["blocking"]);

    chrome.webRequest.onBeforeSendHeaders.addListener(function (details) {
        if (details.tabId > 0
            && tabModel.getExpando(details.tabId, HostFrameExpandoName) === details.frameId) {
            for (var i = 1; i < details.requestHeaders.length; i++) {
                if (details.requestHeaders[i].name === "User-Agent") {
                    details.requestHeaders[i].value += " " + configModel.config.common_ua;
                    break;
                }
            }
            details.requestHeaders.push({"name": "X-BingAthens-Client", "value": configModel.config.common_clientsig});
            return { requestHeaders: details.requestHeaders };
        }
    },
    {
        urls: ["https://*.bing.com/*"],
        types: ["sub_frame", "xmlhttprequest"]
    },
    ["blocking", "requestHeaders"]);

    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
        if (message && message.source === "pane" && message.command)
            handlePaneMessage(message, sender, sendResponse);
    });

    return {
        on: function () { event.on.apply(event, arguments); },
        inject: injectContentPane,
        openAthensPane: openAthensPane,
        updatePaneData: updatePaneData,
        openLookupPane: openLookupPane
    }
}