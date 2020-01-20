(function (document, window, chrome) {
    var currentData, currentState;
    var mainpage, notifypane;

    // should match PANEOWNER enum in coordinator.js and values for data-owner in pane.css
    var PANEOWNER = {
        NONE: "none",
        ATHENS: "athens",
        LOOKUP: "lookup",
    };

    function measureText(text, maxWidth) {
        var canvas = document.getElementById("measureCanvas");
        var textbox = canvas.querySelector(".headertext");
        textbox.innerText = text;
        canvas.style.display = "block";
        var width = Math.ceil(textbox.getBoundingClientRect().width);
        canvas.style.display = "none";
        return maxWidth && (width > maxWidth) ? maxWidth : width;
    }

    function updateNotifyState(state) {
        if (!currentData)
            state = 0;

        if (state < 0 || state > 3 || currentState === state)
            return false;
        currentState = state;
        notifypane.dataset.style = (state === 3 ? "big" : "small");

        safeRefreshNotifyState(state);

        return true;
    }

    // Refreshs the notifystate for athens, will not change anything if pane is open with other data.
    function safeRefreshNotifyState(state)
    {
        // Only update mainpage if there is no owner or we are the owner.
        if(mainpage.dataset.owner === PANEOWNER.NONE || mainpage.dataset.owner === PANEOWNER.ATHENS) {
            if (state === 0) {
                mainpage.dataset.state = "none";
            }
            else {
                if (!mainpage.dataset.state || mainpage.dataset.state === "none") {
                    mainpage.dataset.state = "notify";
                }
            }        
            requestParentSizeChange();
        }
    }

    function updateData(data) {
        if (!currentData && !data
            || currentData && data && currentData.id === data.id)
            return false;

        currentData = data;
        var text = currentData ? currentData.message : "";
        document.getElementById("athensfrm").src = currentData ?
                                                    window.location.origin + "/host?url=" + encodeURIComponent(currentData.url) :
                                                    "about:blank";

        // auto adjust content
        var notifytext = document.getElementById("notifytext");
        notifytext.innerText = text;
        var maxWidth = window.getComputedStyle(notifytext).maxWidth;
        notifytext.style.width = measureText(text, maxWidth ? parseInt(maxWidth) : 0);

        return true;
    }

    var timer = null;
    function requestParentSizeChange() {
        // cancel previous async call if pending
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        var data = {};
        data.state = mainpage.dataset.state;
        if (data.state === "notify") {
                // set async job since we need to measure so better do it separately
                timer = setTimeout(function () {
                    clearTimeout(timer);
                    timer = null;
                    data.style = {};
                    data.style.width = mainpage.offsetWidth;
                    data.style.height = mainpage.offsetHeight;
                    injectPort.fire("setpanestyle", data);
                });
        } else {
            injectPort.fire("setpanestyle", data);
        }
    }

    function openPane(owner, text, url, data) {
        mainpage.dataset.owner = owner;
        var path = url ?
            window.location.origin + "/host?url=" + encodeURIComponent(url) :
            "about:blank";
        if (owner === PANEOWNER.LOOKUP) {
            postToFrame(path, data, "post", "lookupfrm");
        }
        else if (owner === PANEOWNER.ATHENS) {
            if (document.getElementById("athensfrm").src !== path) {
                document.getElementById("athensfrm").src = path;
            }
        }

        mainpage.dataset.state = "full";
        requestParentSizeChange();
    }

    function postToFrame(path, params, method, target) {
        var form = document.createElement("form");
        form.setAttribute("method", method);
        form.setAttribute("action", path);
        form.setAttribute("target", target);
        for(var key in params) {
            if(params.hasOwnProperty(key)) {
                var hiddenField = document.createElement("input");
                hiddenField.setAttribute("type", "hidden");
                hiddenField.setAttribute("name", key);
                hiddenField.setAttribute("value", params[key]);
                form.appendChild(hiddenField);
             }
        }

        document.body.appendChild(form);
        form.submit();
        form.parentNode.removeChild(form);
    }

    function collapsePane() {
        if(currentData) {
            mainpage.dataset.state = "notify";
        }
        else{
            mainpage.dataset.state = "none";
        }
        requestParentSizeChange();
    }

    var injectPort = Messenger.createDefaultMessenger(
        true, function (message) {
            parent.postMessage(message, "*");
        },
        true, function (onReceive) {
            // Do not receive any from inject
        },
        "pane",
        "inject");

    var coordinatorPort = Messenger.createDefaultMessenger(
        false, function (message, context, callback) {
            chrome.runtime.sendMessage(message, callback);
        },
        false, function (onReceive) {
            chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
                onReceive(message, sendResponse);
            });
        },
        "pane",
        "coordinator"
        );

    coordinatorPort.on("openAthensPane", function () {
        openAthensPane();
    });

    coordinatorPort.on("dataupdated", function (request) {
        // when data changed, change into notify status
        if (updateData(request.data)) {
            mainpage.dataset.state = "notify";
        }
        updateNotifyState(request.state);
    });

    function openAthensPane() {
        if (currentData) {
            openPane(PANEOWNER.ATHENS, currentData.message, currentData.url);
        }
    }

    function openLookupPane(data) {
        if(data) {
            openPane(PANEOWNER.LOOKUP, data.message, data.url, data.postData);
        }
    }

    coordinatorPort.on("openLookupPane", function (request) {
        openLookupPane(request);
    });

    coordinatorPort.on("statechanged", function (request) {
        if (currentData && request.data.id === currentData.id) {
            updateNotifyState(request.state);
        }
    });

    var onMessage = function(e) {
        if (e.origin !== "https://www.bing.com" || !e.data)
            return;
        if (e.data.type === "serviceUI" && e.data.event && e.data.message) {
            handleServiceUICall(e.data.event, e.data.message);
        }
    }

    function handleServiceUICall(event, message) {
        var data = JSON.parse(message);
        switch(event) {
            case "navigate":
                openNewTab(data.targetUrl);
                break;
            case "setCortanaText":
                // ignore
                break;
        }
    }

    function openNewTab(url) {
        coordinatorPort.fire("openTab", url);
    }

    var mouseTrack = {
        tracking: false,
        suppressClick: false,
        startX: 0,
        startY: 0
    };

    function onMouseMove(e) {
        // trigger mouseup if button already released. buttons & 1 means left button
        // e.button is not correct so we use .buttons here
        if ((e.buttons & 1) == 0) {
            onMouseUp();
            return;
        }

        mouseTrack.suppressClick = true;
        injectPort.fire("dragmove", { dx: e.screenX - mouseTrack.startX, dy: e.screenY - mouseTrack.startY });
    }

    function onMouseUp(e) {
        window.removeEventListener('mousemove', onMouseMove, true);
        window.removeEventListener('mouseup', onMouseUp, true);
        mouseTrack.tracking = false;
    }

    window.addEventListener('message', onMessage, false);

    window.onload = function () {
        mainpage = document.getElementById("mainpage");
        notifypane = document.getElementById("notifypane");
        coordinatorPort.call("getdata", null, null, function (result, response) {
            if (result && response) {
                updateData(response.athensData);
                updateNotifyState(response.state);
                switch (response.paneOwner) {
                    case PANEOWNER.ATHENS:
                        openAthensPane();
                        break;
                    case PANEOWNER.LOOKUP:
                        openLookupPane(response.lookupData);
                        break;
                }
            }
        });

        notifypane.addEventListener("click", function (event) {
            if (mouseTrack.suppressClick) {
                mouseTrack.suppressClick = false;
                return;
            }
            coordinatorPort.fire("notifyclicked", currentData.id);
        });

        document.getElementById("closeSidePane").addEventListener("click", collapsePane);

        window.addEventListener('mousedown', function (e) {
            // e.button === 0 means main button
            if (e.button === 0 && mainpage.dataset.state === "notify") {
                mouseTrack.tracking = true;
                mouseTrack.startX = e.screenX;
                mouseTrack.startY = e.screenY;
                injectPort.fire("dragstart");
                window.addEventListener('mousemove', onMouseMove, true);
                window.addEventListener('mouseup', onMouseUp, true);
            }
        }, true);
    }
})(window.document, window, chrome);