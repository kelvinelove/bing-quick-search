function createContextExtractor(configModel) {
    var imageFormCode = "WNSIMM";
    var textFormCode = "WNSIPD";

    var panePort = Messenger.createDefaultMessenger(
        true, function (message, context, callback) {
            chrome.tabs.sendMessage(context.tabId, message, callback);
        },
        true, function (onReceive) {
            chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
                onReceive(message, { tabId: sender.tab.id }, sendResponse);
            });
        },
        "lookupDataProvider",
        "lookupContextExtractor"
    );

    function TextExtractor() {
    }

    TextExtractor.prototype.getLookupData = function (info, tab) {
        return new Promise(function (resolve, reject) {
            (info.selectionText && tab.title && tab.url) ? resolve(tab.id) : reject();
        }).then(function (tabId) {
            return getContext("getSelectedTextContext", tabId, null);
        }).then(function (context) {
            return createLookupData(context, tab);
        });
    }

    function LinkExtractor() {
    }

    LinkExtractor.prototype.getLookupData = function (info, tab) {
        return new Promise(function (resolve, reject) {
            (tab.title && tab.url) ? resolve(tab.id) : reject();
        }).then(function (tabId) {
            return getContext("getSelectedLinkContext", tabId, {selectedUrl: info.linkUrl});
        }).then(function (context) {
            return createLookupData(context, tab);
        });
    }

    function createLookupData(context, tab) {
        var query = context.selectedText;
        var lookupData = {
            postData: {
                context: context.fullContext,
                offset: context.startingIndex,
                query: query,
                title: tab.title,
                url: tab.url
            },
            url: getRequestUrl(configModel.config.lookup_text_endpoint, textFormCode, query)
        };
        return lookupData;
    }

    function ImageExtractor() {
    }

    ImageExtractor.prototype.getLookupData = function (info, tab) {
        return new Promise(function (resolve, reject) {
            (info.srcUrl && tab.title && tab.url) ? resolve(tab.id) : reject();
        }).then(function (tabId) {
            return getContext("getSelectedImageContext", tabId, null);
        }).then(function (context) {
            var lookupData = {
                postData: {
                    q: "imgurl:" + info.srcUrl,
                    purl: tab.url,
                    ptitle: tab.title,
                    title: context.title,
                    alt: context.alt,
                    ref: context.ref
                },
                url: getRequestUrl(configModel.config.lookup_image_endpoint, imageFormCode)
            };
            return lookupData;
        });
    }

    function getContext(event, tabId, params) {
        return new Promise(function (resolve, reject) {
            panePort.call(event, params, { tabId: tabId }, function (result, response) {
                if (result && response) {
                    if (response.contextData) {
                        resolve(response.contextData);
                    }
                }
                reject();
            });
        });
    }

    function getRequestUrl (path, formcode, query) {
        var queryUrl = [
            configModel.config.lookup_host, "/", path,
            "?",
            query ? "q=" + encodeURIComponent(query) + "&" : "",
            "form=" + formcode,
            "&cortanaEnabled=0",
            "&upsell=0",
            configModel.config.lookup_params_url ? "&" + configModel.config.lookup_params_url : ""
        ].join("");
        return queryUrl;
    };

    function ContextExtractor() {
    }

    ContextExtractor.prototype.thisCall = thisCall;

    var extractors = {};
    extractors[SELECTIONTYPE.TEXT] = new TextExtractor(configModel, panePort);
    extractors[SELECTIONTYPE.LINK] = new LinkExtractor(configModel, panePort);
    extractors[SELECTIONTYPE.IMAGE] = new ImageExtractor(configModel, panePort);
    ContextExtractor.prototype.extractors = extractors;

    ContextExtractor.prototype.getLookupData = function (info, tab) {
        return new Promise(this.thisCall(function (resolve, reject) {
            var type = this.getSelectionType(info);
            var extractor = this.extractors[type];
            extractor ? resolve(extractor) : reject();
        })).then(function (extractor) {
            return extractor.getLookupData(info, tab);
        })
    }

    ContextExtractor.prototype.getSelectionType = function (info) {
        if (info.selectionText) {
            return SELECTIONTYPE.TEXT;
        }

        if (info.mediaType && info.mediaType === "image") {
            return SELECTIONTYPE.IMAGE;
        }

        if (info.linkUrl)
        {
            return SELECTIONTYPE.LINK;
        }
    }

    return new ContextExtractor();
};