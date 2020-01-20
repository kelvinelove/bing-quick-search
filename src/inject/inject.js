var _bing_athens_agent = _bing_athens_agent || (function(){
    var settings;
    var pane;
    var paneHost = "chrome-extension://" + chrome.runtime.id;

    function resizePane(data) {
        var style;
        dragTrack.enable = false;
        switch (data.state) {
            case "notify":
                dragTrack.enable = true;
                var width = dragTrack.width = data.style.width + 1; // allow 1px rounding
                var height = dragTrack.height = data.style.height + 1;

                adjustNotifyPane();

                style = [
                    "width:", width, "px;",
                    "height:", height, "px;",
                    "border:0",
                    "padding:0;",
                    "background-color:transparent;",
                    "cursor:move;",
                    (dragTrack.left !== undefined) ? "left:" + dragTrack.left + "px;" : "",
                    (dragTrack.top !== undefined) ? "top:" + dragTrack.top + "px;" : ""
                ].join("");
                break;
            case "full":
                pane.style.left = pane.style.top = "";
                style = "width:373px; height:100%; background-color:white; border-" + chrome.i18n.getMessage("@@bidi_start_edge") + ":3px ridge;";
                break;
            default: // none
                style = "width:0px; height:0px";
                break;
        }
        pane.style.cssText = style;
    }

    function loadData() {
        pane = document.getElementById("_bing_athens_pane");
        if (!pane) {
            pane = document.createElement("iframe");
            pane.id = "_bing_athens_pane";
            document.body.appendChild(pane);
            pane.src = paneHost + "/src/inject/pane.html";
        }
    }

    var panePort = Messenger.createDefaultMessenger(
            true, function (message) {
                // do not send anything
            },
            true, function (onReceive) {
                window.addEventListener("message", function (e) {
                    if (event.origin !== paneHost || !event.data)
                        return;
                    onReceive(e.data);
                }, false);
            },
            "inject",
            "pane");

    panePort.on("setpanestyle", resizePane);
    panePort.on("dragstart", onPaneDragStart);
    panePort.on("dragmove", onPaneDragMove);

    loadData(); // only load data once.

    // Code to handle dragging.
    var dragTrack = {
        enable: false,
        left: undefined,
        top: undefined,
        startLeft: 0,
        startTop: 0,
        width: 0,
        height: 0
    };

    function adjustNotifyPane() {
        if (!dragTrack.enable)
            return;

        if (dragTrack.top === undefined || dragTrack.left === undefined) {
            pane.style.left = pane.style.top = "";
            return;
        }

        var pageWidth = document.documentElement.clientWidth,
            pageHeight = document.documentElement.clientHeight;

        if (dragTrack.left < 0){
            dragTrack.left = 0;
        } 
        else if (pageWidth > dragTrack.width
            && dragTrack.left + dragTrack.width > pageWidth) {
            dragTrack.left = pageWidth - dragTrack.width;
        }

        if (dragTrack.top < 0) {
            dragTrack.top = 0;
        }
        else if (pageHeight > dragTrack.height
            && dragTrack.top + dragTrack.height > pageHeight) {
            dragTrack.top = pageHeight - dragTrack.height;
        }

        pane.style.top = dragTrack.top + "px";
        pane.style.left = dragTrack.left + "px";
    }

    window.addEventListener("resize", function () {
        adjustNotifyPane();
    });

    function onPaneDragStart() {
        dragTrack.startLeft = pane.offsetLeft;
        dragTrack.startTop = pane.offsetTop;
    }

    function onPaneDragMove(data) {
        dragTrack.left = dragTrack.startLeft + data.dx;
        dragTrack.top = dragTrack.startTop + data.dy;
        adjustNotifyPane();
    }

    return true;
})();