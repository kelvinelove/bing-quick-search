function createAthensDataProvider(configModel, tabModel, allowlistModel) {

    function queryData(tabId, sid, url) {
        var convid = Math.floor(Math.random() * 0x9fffffff) + 1;
        var queryUrl = [
            configModel.config.query_host, "/", configModel.config.query_endpoint,
            "?",
            "version=", configModel.config.common_version, "&",
            "convid=extension:", convid.toString(16), "&",
            "q=", encodeURIComponent(url),
            configModel.config.query_params ? "&" + configModel.config.query_params : ""
        ].join("");
                        
        ajax({
            url: queryUrl,
            responseType: "json",
            timeout: 10000,
            headers: {
                "X-BingAthens-Client": configModel.config.common_clientsig
            }
        })
        .then(function (xhr) {
            var data = xhr.response;
            if (data
                && xhr.getResponseHeader("Content-Type").indexOf("application/json;") >= 0
                && data.answerResponses
                && data.answerResponses.length > 0
                && data.answerResponses[0].pageSmartsResults
                && data.answerResponses[0].pageSmartsResults.pageSmarts
                && data.answerResponses[0].pageSmartsResults.pageSmarts.length > 0) {
                var pageSmart = data.answerResponses[0].pageSmartsResults.pageSmarts[0];
                if (isBingResponseValid(pageSmart)) {
                    var result = {
                        convid: convid,
                        id: pageSmart.id,
                        scenario: pageSmart.scenario,
                        message: pageSmart.cortanaMessage,
                        url: pageSmart.url.value
                    };
                    tabModel.setData(tabId, sid, result);
                }
            }
        });
    }
    
    function isBingResponseValid(data) {
        return data.id
            && data.url
            && data.url.value
            && data.cortanaMessage
            && data.scenario;
    }

    function fetchData4Tab(tabId, sid, url) {
        if (url) {
            if (allowlistModel.ready()) {
                allowlistModel.check(url)
                .then(function(result){
                    if (result) {
                        queryData(tabId, sid, url);
                    }
                });
            }
        }
    }
    
    tabModel.on("urlchanged", function (tabId, sid, url) {
        fetchData4Tab(tabId, sid, url);
    });
}