(function (document, _Athens) {
    function initUI() {
        var applybutton = document.forms["optionsForm"]["submit"];
        var resetbutton = document.forms["optionsForm"]["reset"];
        var defaultbutton = document.forms["optionsForm"]["default"];

        function toggleApply(hasInvalid, hasUncommitted) {
            applybutton.disabled = hasInvalid || !hasUncommitted;
            resetbutton.disabled = !hasUncommitted;
        }
        binder.addEventListener("statechange", toggleApply);
        toggleApply(binder.hasInvalid(), binder.hasUncommitted());

        applybutton.addEventListener("click", function () {
            binder.persist().catch(function (e) {
                alert("Failed to save config:" + e.message);
            })
        });
        resetbutton.addEventListener("click", function () {
            binder.revert();
        });
        defaultbutton.addEventListener("click", function () {
            binder.set2Default();
        });

        function toggerBypassHint(name, value) {
            document.getElementById("allowlist_bypass_hint").dataset.hintstate = value ? "on" : "off";
        }
        var bypass = binder.getControl("allowlist_bypass");
        bypass.addEventListener("valuechange", toggerBypassHint);
        toggerBypassHint(bypass.get());
    }

    var dataSource = _Athens._OptionsDataSourceFactory.create(true);
    var binder = _Athens._BinderFactory.create(dataSource);

    Promise.all([
        dataSource.load(),
        new Promise(function (resolve) {
            document.addEventListener("DOMContentLoaded", function () {
                resolve();
            });
        })
    ])
    .then(function () {
        binder.bind();
        initUI();
        binder.load();
    });
})(document, _Athens);
_Athens = undefined;