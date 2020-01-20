(function (window) {
    var ownContextMenu = false;
    var contextElement = null;

    var coordinatorPort = Messenger.createDefaultMessenger(
    true, function (message, context, callback) {
        chrome.runtime.sendMessage(message, callback);
    },
    true, function (onReceive) {
        chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
            onReceive(message, sendResponse);
        });
    },
    "lookupContextExtractor",
    "lookupDataProvider"
    );

    coordinatorPort.serv("getSelectedTextContext", function (params, context, responder) {
        if (ownContextMenu) {
            extractContext(responder);
        }
    });

    coordinatorPort.serv("getSelectedLinkContext", function (params, context, responder) {
        if (ownContextMenu && contextElement)
        {
            var currentNode = contextElement;
            //contextElement may focus on the child node inside of a link.
            while(currentNode){
                if (currentNode.tagName === "A"){
                    extractContext(responder, currentNode);
                    break;
                }
                currentNode = currentNode.parentNode;
            }
        }
    });

    var contentExtraction = new ContextExtraction();
    function extractContext(responder, node)
    {
        var contextData = contentExtraction.extractSelectionContext(node);
        if (contextData) {
            responder.done({
                contextData: contextData
            });
        }
    }

    coordinatorPort.serv("getSelectedImageContext", function (params, context, responder) {
        if (ownContextMenu && contextElement && contextElement.tagName === "IMG") {
            var contextData = {
                title: contextElement.title,
                alt: contextElement.alt,
                ref: document.ref ? document.ref : ""
            };
            responder.done({
                contextData: contextData
            });
        }
    });

    window.addEventListener("contextmenu", function (event) {
        ownContextMenu = true;
        contextElement = event.srcElement;
    }, true); //listen in capture phase

    window.addEventListener("blur", function () {
        ownContextMenu = false;
        contextElement = null;
    });
})(window);