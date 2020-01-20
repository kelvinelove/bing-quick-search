function createLookupView(contextExtractor, tabModel, chrome, coordinator) {
    var title = chrome.i18n.getMessage("lookupContextMenuTitle");

    function createContextMenu() {
        var contexts = ["selection","link", "image"];
        chrome.contextMenus.create({"title": title, "contexts": contexts, "onclick": handleContextMenuClick, documentUrlPatterns: ["*://*/*"]});
    }

    function handleContextMenuClick(info, tab) {
        var tabId = tab.id;
        coordinator.inject(tabId).then(function () {
            tabModel.isActive(tabId, function () {
                createLookup(info, tab);
            });
        });
    }

    function createLookup(info, tab) {
        var tabId = tab.id;
        var extractor = contextExtractor.getLookupData(info, tab).then(function (lookupData) {
            openPane(tabId, lookupData);
        });
    }

    function openPane(tabId, data) {
        tabModel.setSessionExpando(tabId, "lookup", data);
        coordinator.openLookupPane(tabId, data);
    }

    createContextMenu();
}