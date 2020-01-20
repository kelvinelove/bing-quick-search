function createView(chrome, tabModel, coordinator) {
    var NONE = 0,
        VIEWED = 1,
        AVAILABLE = 2,
        BRANDNEW = 3;
        
    var icons = {
        "0": "",
        "1": {
            "19": "/images/pageaction_transparent_19x19.png",
            "38": "/images/pageaction_transparent_38x38.png"
        },
        "2": {
            "19": "/images/pageaction_teal_19x19.png",
            "38": "/images/pageaction_teal_38x38.png"
        },
        "3": {
            "19": "/images/pageaction_teal_19x19.png",
            "38": "/images/pageaction_teal_38x38.png"
        }
    };
    
    var dataCache = new Cache(2000, 100);
    function calculateUIState(dataId, focused) {
        if (dataId) {
            var entry = dataCache.get(dataId);
            if (entry) {
                state = entry.viewed ? VIEWED : AVAILABLE;
            }
            else if (focused) {
                state = BRANDNEW;
                dataCache.add(dataId, {});
            }
            else {
                state = AVAILABLE;
            }
        }
        else {
            state = NONE;
        }
        return state;
    }

    function updateNotificationUI(tabId, senddatatopane, focused) {
        var athensData = tabModel.getData(tabId) || null;
        var oldstate = tabModel.getExpando(tabId, "state");
        var state = calculateUIState(athensData ? athensData.id : null, focused);
        if (oldstate !== state) {
            tabModel.setExpando(tabId, "state", state);
            coordinator.updatePaneData(tabId, state, athensData, senddatatopane);

            if (state != NONE) {
                chrome.pageAction.show(tabId);
                chrome.pageAction.setIcon({ tabId: tabId, path: icons[state] });
                chrome.pageAction.setTitle({ tabId: tabId, title: athensData.message })
            }
            else {
                chrome.pageAction.hide(tabId);
            }
            return true;
        }
        return false;
    }

    function handleNotifyClick(tabId, atDataId) {
        var entry = dataCache.get(atDataId);
        if (!entry) {
            if (atDataId) {
                dataCache.add(atDataId, { viewed: true });
            }
        }
        else {
            entry.viewed = true;
        }
        updateNotificationUI(tabId, false, true);
        coordinator.openAthensPane(tabId);

        if (atDataId) {
            tabModel.enumActiveTabId(function (eachId) {
                if (eachId !== tabId) {
                    var atData = tabModel.getData(eachId);
                    if (atData && atData.id === atDataId) {
                        updateNotificationUI(eachId, false, false);
                    }
                }
            })
        }
    }

    chrome.pageAction.onClicked.addListener(function (tab) {
        var atData = tabModel.getData(tab.id);
        handleNotifyClick(tab.id, atData? atData.id : null);
    })

    tabModel.on("dataupdated", function (tabId, data) {
        if (data) {
            coordinator.inject(tabId)
            .then(function () {
                tabModel.isActive(tabId, function (active, focused) {
                    updateNotificationUI(tabId, true, focused);
                });
            });
        }
        else {
            updateNotificationUI(tabId, true);
        }
    });
    
    tabModel.on("tabactivated", function (tabId, focused) {
        updateNotificationUI(tabId, false, focused);
    });

    coordinator.on("notifyclicked", function (tabId, atDataId) {
        handleNotifyClick(tabId, atDataId);
    });
}