function createTabModel(chrome) {
    var event = new EventSource();
    var tabs = {};

    function ensureTab(tabId) {
        var obj = tabs[tabId];
        if (!obj) {
            obj = tabs[tabId] = {
                id: tabId,
                sid: 0,
                permexpando: {},
                sessionexpando: {}
            };
        }
        return obj;
    }

    function enumerate(callback) {
        var keys = Object.keys(tabs);
        for (var i = 0; i < keys.length; i++) {
            callback(tabs[keys[i]]);
        }
    }

    function isCurrentSession(tabId, sid) {
        var tab = tabs[tabId];
        return (tab && tab.sid === sid);
    }

    function isActive(tabId, callback) {
        chrome.tabs.get(tabId, function (tab) {
            if (chrome.runtime.lastError || !tab || !tab.active) {
                callback(false, false);
                return;
            }

            chrome.windows.get(tab.windowId, { windowTypes: ["normal"] }, function (window) {
                callback(true, !chrome.lastError && window && window.focused);
            });
        })
    }

    function enumAllActiveTabId(callback) {
        chrome.tabs.query({ active: true, windowType: "normal" }, function (tabs) {
            if (!chrome.runtime.lastError && tabs && tabs.length > 0) {
                for (var i = 0; i < tabs.length; i++) {
                    callback(tabs[i].id);
                }
            }
        });
    }

    function setAthensData(tabId, sid, data) {
        var tabEntry = tabs[tabId];
        if (tabEntry.sid === sid) {
            tabEntry.atData = data;
            event.fire("dataupdated", tabId, data);
        }
    }
    
    function getAthensData(tabId) {
        return tabs[tabId] && tabs[tabId].atData;
    }
    
    function getTabSid(tabId) {
        return tabs[tabId] && tabs[tabId].sid;
    }

    function getExpando(tabId, key) {
        return tabs[tabId] && tabs[tabId].permexpando[key];
    }

    function setExpando(tabId, key, value) {
        var entry = tabs[tabId];
        if (entry) {
            if (value === undefined) {
                entry.permexpando[key] && delete entry.permexpando[key];
            }
            else {
                entry.permexpando[key] = value;
            }
        }
    }

    function setSessionExpando(tabId, key, value) {
        var entry = tabs[tabId];
        if(entry) {
            if (value === undefined) {
                entry.sessionexpando[key] && delete entry.sessionexpando[key];
            }
            else {
                entry.sessionexpando[key] = value;
            }
        }
    }

    function getSessionExpando(tabId, key) {
        return tabs[tabId] && tabs[tabId].sessionexpando[key];
    }

    function onUrlChanged(tabId, url) {
        var entry = tabs[tabId];
        entry.url = url;
        entry.sid++;
        entry.sessionexpando = {};
        setAthensData(tabId, entry.sid, null);
        event.fire("urlchanged", tabId, entry.sid, url);
    }

    chrome.webNavigation.onCommitted.addListener(function (details) {
        // only handle top level navigation
        if (details.frameId === 0) {
            // do a tab check, since this may be from a prerender invisible tab
            chrome.tabs.get(details.tabId, function (tab) {
                if (!chrome.runtime.lastError) {
                    var entry = ensureTab(details.tabId);
                    onUrlChanged(details.tabId, details.url);
                }
            })
        }
    },
    {});

    chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
        if (changeInfo.url) {
            var entry = ensureTab(tabId);
            // webNavigation.onCommitted could be already invoked and updated url
            // double check
            if (entry.url !== tab.url) {
                onUrlChanged(tabId, tab.url);
            }
        }
    });

    chrome.tabs.onActivated.addListener(function (activeInfo) {
        chrome.tabs.get(activeInfo.tabId, function (tab) {
            if (!chrome.lastError && tab) {
                chrome.windows.get(activeInfo.windowId, { windowTypes: ["normal"] }, function (window) {
                    if (!chrome.runtime.lastError && window) {
                        // only fire on recorded tabs
                        if (tabs[activeInfo.tabId]) {
                            event.fire("tabactivated", activeInfo.tabId, window.focused);
                        }
                    }
                });
            }
        });
    });

    chrome.windows.onFocusChanged.addListener(function (windowId) {
        if (windowId !== chrome.windows.WINDOW_ID_NONE) {
            chrome.tabs.query({
                active: true,
                windowId: windowId
            },
            function (tabarray) {
                if (!chrome.runtime.lastError && tabarray && tabarray.length > 0) {
                    if (tabs[tabarray[0].id]) {
                        event.fire("tabactivated", tabarray[0].id, true);
                    }
                }
            })
        }
    })

    chrome.tabs.onRemoved.addListener(function (tabId) {
        if (tabs[tabId]) {
            delete tabs[tabId];
        }
    });

    chrome.tabs.onReplaced.addListener(function (addedTabId, removedTabId) {
        if (tabs[removedTabId]) {
            delete tabs[removedTabId];
        }
        chrome.tabs.get(addedTabId, function(tab){
            if (!chrome.runtime.lastError) {
                var entry = ensureTab(addedTabId);
                onUrlChanged(addedTabId, tab.url);
            }
        })
    });

    return {
        enumerate: enumerate,
        getSid: getTabSid,
        enumActiveTabId: enumAllActiveTabId,
        getData: getAthensData,
        getExpando: getExpando,
        getSessionExpando: getSessionExpando,
        isActive: isActive,
        isCurrent: isCurrentSession,
        on: function () { event.on.apply(event, arguments); },
        setData: setAthensData,
        setExpando: setExpando,
        setSessionExpando: setSessionExpando,
    }
};

