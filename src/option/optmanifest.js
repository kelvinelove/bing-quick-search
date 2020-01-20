(function (options) {
    var CommonSettings = [
        {
            name: "common_version",
            verifier: function (value) {
                return /^[1-9][0-9]*$/.test(value);
            },
            Default: "4"
        },
        {
            name: "common_ua",
            verifier: function (value) {
                return !!value;
            },
            Default: "(ServiceUI 5)"
        },
        {
            name: "common_clientsig",
            verifier: function (value) {
                return /^[\w]+$/.test(value);
            },
            Default: "ChromeExtension"
        }
    ];
    Array.prototype.push.apply(options, CommonSettings);
})(_Athens._AtOptions);

(function (options) {
    var AllowlistSettings = [
        {
            name: "allowlist_host",
            verifier: function (value) {
                return /^https?:\/\/(?:[a-zA-Z0-9]+(?:[a-zA-Z0-9\-]*[a-zA-Z0-9]+)?.)*[a-zA-Z0-9]+(?:[a-zA-Z0-9\-]*[a-zA-Z0-9]+)?(?:\:\d+)?$/.test(value);
            },
            Default: "https://www.bing.com"
        },
        {
            name: "allowlist_endpoint",
            verifier: function (value) {
                return /^(?:[a-zA-Z0-9\.\-~!\$&'\(\)\*\+,;=\:@]+\/)*[a-zA-Z0-9\.\-~!\$&'\(\)\*\+,;=\:@]+$|^$/.test(value);
            },
            Default: "cortanaassist/rules"
        },
        {
            name: "allowlist_params",
            verifier: function (value) {
                return true;
            },
            Default: ""
        },
        {
            name: "allowlist_bypass",
            verifier: function (value) {
                return true;
            },
            Default: false
        },
        {
            name: "allowlist_version",
            verifier: function (value) {
                return typeof (value) === "number" && value > 2;
            },
            Default: 4
        },
        {
            name: "allowlist_version",
            verifier: function (value) {
                return typeof (value) === "number" && value > 2;
            },
            Default: 4
        }
    ];
    Array.prototype.push.apply(options, AllowlistSettings);
})(_Athens._AtOptions);

(function (options) {
    var QuerySettings = [
        {
            name: "query_host",
            verifier: function (value) {
                return /^https?:\/\/(?:[a-zA-Z0-9]+(?:[a-zA-Z0-9\-]*[a-zA-Z0-9]+).)*[a-zA-Z0-9]+(?:[a-zA-Z0-9\-]*[a-zA-Z0-9]+)(?:\:\d+)?$/.test(value);
            },
            Default: "https://www.bing.com"
        },
        {
            name: "query_endpoint",
            verifier: function (value) {
                return /^(?:[a-zA-Z0-9\.\-~!\$&'\(\)\*\+,;=\:@]+\/)*[a-zA-Z0-9\.\-~!\$&'\(\)\*\+,;=\:@]+$|^$/.test(value);
            },
            Default: "cortanaassist/search"
        },
        {
            name: "query_params",
            verifier: function (value) {
                return true;
            },
            Default: ""
        }
    ];
    Array.prototype.push.apply(options, QuerySettings);
})(_Athens._AtOptions);

(function (options) {
    var LookupSettings = [
        {
            name: "lookup_host",
            verifier: function (value) {
                return /^https?:\/\/(?:[a-zA-Z0-9]+(?:[a-zA-Z0-9\-]*[a-zA-Z0-9]+).)*[a-zA-Z0-9]+(?:[a-zA-Z0-9\-]*[a-zA-Z0-9]+)(?:\:\d+)?$/.test(value);
            },
            Default: "https://www.bing.com"
        },
        {
            name: "lookup_text_endpoint",
            verifier: function (value) {
                return /^(?:[a-zA-Z0-9\.\-~!\$&'\(\)\*\+,;=\:@]+\/)*[a-zA-Z0-9\.\-~!\$&'\(\)\*\+,;=\:@]+$|^$/.test(value);
            },
            Default: "widget/insights/lookup"
        },
        {
            name: "lookup_image_endpoint",
            verifier: function (value) {
                return /^(?:[a-zA-Z0-9\.\-~!\$&'\(\)\*\+,;=\:@]+\/)*[a-zA-Z0-9\.\-~!\$&'\(\)\*\+,;=\:@]+$|^$/.test(value);
            },
            Default: "images/detail/search"
        },
        {
            name: "lookup_link_endpoint",
            verifier: function (value) {
                return /^(?:[a-zA-Z0-9\.\-~!\$&'\(\)\*\+,;=\:@]+\/)*[a-zA-Z0-9\.\-~!\$&'\(\)\*\+,;=\:@]+$|^$/.test(value);
            },
            Default: "widget/insights/lookup"
        },
        {
            name: "lookup_params_url",
            verifier: function (value) {
                return true;
            },
            Default: ""
        },
        {
            name: "lookup_params_post",
            verifier: function (value) {
                return true;
            },
            Default: ""
        }
    ];
    Array.prototype.push.apply(options, LookupSettings);
})(_Athens._AtOptions);