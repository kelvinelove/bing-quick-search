(function (chrome) {
    var configModel = _Athens._OptionsDataSourceFactory.create();

    configModel.load().then(function (ds) {
        var _tabModel = createTabModel(chrome);
        var _allowlistModel = createAllowlistModel(configModel, chrome);
        var _dataProvider = createAthensDataProvider(configModel, _tabModel, _allowlistModel);
        var _coordinator = createInjectionCoordinator(configModel, _tabModel, chrome);
        var _view = createView(chrome, _tabModel, _coordinator);
        var _extractor = createContextExtractor(configModel);
        var _lookupView = createLookupView(_extractor, _tabModel, chrome, _coordinator);
        _allowlistModel.start();
    });
})(chrome);
