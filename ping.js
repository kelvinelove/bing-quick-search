var PingDate = "PingDate";
var ExtnVer = "ExtnVersion";
var MI = "MachineID";

var startIndex = navigator.userAgent.indexOf("(");
var endIndex = navigator.userAgent.indexOf(")");
var OS = navigator.userAgent.substring(startIndex  + 1, endIndex).replace(/\s/g, '');

var MachineID = localStorage.MachineID == undefined || localStorage.MachineID == "" || localStorage.MachineID == null ? guid() : localStorage.MachineID;
var browserLanguage = navigator.language;

var manifestData = chrome.runtime.getManifest();
var ExtensionName = manifestData.name.replace(/ /g, "").replace('&', 'and');
var ExtensionVersion = manifestData.version;
var ExtensionId = chrome.runtime.id;
var BrowserVersion = navigator.userAgent.split(" ");
var BrowserVersion = BrowserVersion[BrowserVersion.length - 2].replace("/", "");

chrome.runtime.onInstalled.addListener(function (details) {
	if (details.reason == 'install') {
        SendPingDetails("1");
        localStorage[ExtnVer] = ExtensionVersion;
    }
	else if (details.reason == 'update' && localStorage.ExtnVersion != chrome.runtime.getManifest().version) {
        SendPingDetails("3");
        localStorage[ExtnVer] = ExtensionVersion;
    }
});

chrome.tabs.onActivated.addListener(function () {
    if (localStorage.PingDate == "" || localStorage.PingDate != new Date().toDateString()) {
        SendPingDetails("2");
        localStorage[PingDate] = new Date().toDateString()
    }
});

function guid() {
    /** Function to create an unique machine id */
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    var MachineGUID = s4() + s4() + s4() + s4() + s4() + s4() + s4() + s4();
    MachineGUID = MachineGUID.toLocaleUpperCase();
    localStorage[MI] = MachineGUID;
    return MachineGUID;
}


function SendPingDetails(status) {
    /**
    * Function create and send a ping cosmos
    * @param {any} status
    */
	setTimeout(function () {
		var pc = localStorage.pc == undefined || localStorage.pc == "" || localStorage.pc == null ? "UWDF" : localStorage.pc;
		var pingURL = 'http://g.ceipmsn.com/8SE/44?';
		var tVData = 'TV=is' + pc + '|pk' + ExtensionName + '|tm' + browserLanguage + '|bv' + BrowserVersion + '|ex' + ExtensionId + '|es' + status;
		if (localStorage["channel"])
			tVData = tVData + "|ch" + localStorage["channel"];
		if (localStorage["muid"])
			tVData = tVData + "|mu" + localStorage["muid"];
		pingURL = pingURL + 'MI=' + MachineID + '&LV=' + ExtensionVersion + '&OS=' + OS + '&TE=37&' + tVData;
		pingURL = pingURL.replace(/\|/g, "%7c");  // For HTML Encoding
		pingURL = pingURL.replace(/\,/g, "%2c");  // For HTML Encoding
		var xhr = new XMLHttpRequest();
		xhr.open("GET", pingURL, true);
		xhr.send();
	},500);
};