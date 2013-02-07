(function () {

function inherit(C, P) {
    C.prototype = new P();
}

function Permissions() {
    // private API
    (function () {
        var _is_localstorage = (typeof localStorage !== 'undefined') ? true : false,
            _is_json = (typeof JSON !== 'undefined') ? true : false,
            _is_eventlistener = (typeof document.addEventListener !== 'undefined') ? true : false,
            _is_queryselector = (typeof document.querySelectorAll !== 'undefined') ? true : false;
        
        // create fake implementations for challenged browsers
        if (!_is_localstorage) {
            window.localStorage = {
                getItem: function (a) { return null; },
                setItem: function (a, b) {},
                removeItem: function (a) {}
            };
        }
        
        if (!_is_json) {
            window.JSON = {
                stringify: function(a) {},
                parse: function(a) {}
            };
        }
        
        if (!window.permissions_load_error &&
            (!_is_localstorage || !_is_json || !_is_eventlistener || !_is_queryselector)) {
            window.permissions_load_error = true;
            document.write(
                '<div id="warning">Warning: Your browser does not support all the features required:<ul>' +
                '<li>localStorage (' + _is_localstorage + ')</li>' +
                '<li>JSON (' + _is_json + ')</li>' +
                '<li>DOM2 Events (' + _is_eventlistener + ')</li>' +
                '<li>querySelectorAll (' + _is_queryselector + ')</li></ul></div>');
        }
        
        if (_is_localstorage && _is_json &&
            localStorage.getItem('feature_permissions') !== null) {
            navigator.feature_permissions = JSON.parse(localStorage.getItem('feature_permissions'));
        } else {
            // default features and permission levels for demo purposes
            navigator.feature_permissions = [
                    {feature: 'contacts', permission_level: -1, requested: false},
                    {feature: 'calendar', permission_level: -1, requested: false},
                    {feature: 'system',   permission_level: -1, requested: false}
            ];
        }
    }());
}

Permissions.prototype = (function () {
    // private API
    var _is_infobar_invoked = false,
        _success_callback = null,
        _error_callback = null; // TODO
    
    function _setFeaturePermission(feature, options) {
        var i, l;
        
        for (i = 0, l = navigator.feature_permissions.length; i < l; i++) {
            if (navigator.feature_permissions[i].feature === feature) {
                if (options.permission_level) {
                    navigator.feature_permissions[i].permission_level = options.permission_level;
                }
                if (options.requested) {
                    navigator.feature_permissions[i].requested = options.requested;
                }
            }
        }
    }
    
    function _createInfobar() {
        var infobar = document.createElement('div'),
            feature, permission_level, action, i, l;
            
        infobar.id = 'infobar';
        infobar.className = 'transition box_shadow_infobar';
        infobar.style.display = 'block';
        infobar.innerHTML +=
            '<div id="infobar_header">Allow ' + (window.location.hostname || 'localhost') +
            ' to access your:' +
            '<button id="close_infobar" class="close_button">X</button>' +
            '<div id="settings_container">' +
            '(<a href="javascript:void(0)" id="settings_link">advanced settings</a>)</div>' +
            '</div>';
        
        for (i = 0, l = navigator.feature_permissions.length; i < l; i++) {
            if (navigator.feature_permissions[i].requested) {
                feature = navigator.feature_permissions[i].feature;
                permission_level = navigator.feature_permissions[i].permission_level;
                action = (permission_level > 0) ? 'allow' : 'deny';
                action = (permission_level === -1) ? '' : action;
                                
                infobar.innerHTML += 
                    '<div class="feature_request background_transition" ' +
                    'style=\'background-color:' + _getElementStyleByAction(action).color + '\'>' +
                    '<button class="allow" id="allow_' + feature + '">Allow</button>' +
                    '<button class="deny" id="deny_' + feature + '">Deny</button>' +
                    feature + '</div>';
            }
        }
        
        if (_getRequestedFeatures().length > 1) {
            infobar.innerHTML +=
                '<div id="allow_deny_all">' +
                '<button class="allow" id="allow_all">Allow All</button>' +
                '<button class="deny" id="deny_all">Deny All</button>';
            infobar.innerHTML +=
                '<div id="ok_cancel">' +
                '<button id="ok">OK</button><button id="cancel">Cancel</button>' +
                '</div>';
        }
        
        document.body.appendChild(infobar);
        _delegateEvents(infobar);
        _showInfobar();
    }
    
    function _delegateEvents(infobar) {
        infobar.addEventListener('click', _infobarEventHandler, false);
    }
    
    function _infobarEventHandler(e) {
        var element = _getActionByEvent(e).element,
            action = _getActionByEvent(e).action,
            feature = _getActionByEvent(e).feature,
            requested_features = _getRequestedFeatures(),
            features_request_rows, i, l;
                
        function _success() {
            var response = _getResponse(navigator.feature_permissions);
            _success_callback(response);
            _persistFeaturePermissions();
            _hideInfobar();
        }
        
        if (!element) { return; }
        
        // inspect element.id and act on it
        switch (element.id) { // omit break, because we'll return on match
            case 'close_infobar': _hideInfobar(); return;
            case 'close_settings': _hideSettings(); return;
            case 'settings_link': _showSettings(); return;
            case 'ok': _success(); return;
            case 'cancel': _hideInfobar(); return;
        }
        
        // process all feature requests
        if (feature === 'all') {                    
            features_request_rows = document.querySelectorAll('.feature_request');
            for (i = 0, l = features_request_rows.length; i < l; i++) {
                features_request_rows[i].style.backgroundColor = _getElementStyleByAction(action).color;
            }
            
            for (i = 0, l = requested_features.length; i < l; i++) {
                _setFeaturePermission(requested_features[i],
                    {permission_level: _getPermissionLevelByActionName(action)});
            }
            
            _success();
        // process a single feature request
        } else {
            element.parentNode.style.backgroundColor = _getElementStyleByAction(action).color;
            _setFeaturePermission(feature,
                {permission_level: _getPermissionLevelByActionName(action)});
            
            if (requested_features.length > 1) {
                document.getElementById('allow_deny_all').style.display = 'none';
                document.getElementById('ok_cancel').style.display = 'block';
            } else {
                _success();
            }
        }
    }
    
    function _persistFeaturePermissions() {
        var i, l;
        
        // set requested flags to false before persistence
        for (i = 0, l = navigator.feature_permissions.length; i < l; i++) {
            navigator.feature_permissions[i].requested = false;
        }
        
        localStorage.setItem('feature_permissions', JSON.stringify(navigator.feature_permissions));
    }
    
    function _getActionByEvent(e) {
        var element = e.target || e.srcElement,
            action = element.id.split('_')[0] || null,
            feature = element.id.split('_')[1] || null,
            elementName = element.nodeName.toLowerCase();
            
        if (elementName !== 'button' && elementName !== 'a') { element = null; }
        
        return { element: element, action: action, feature: feature };
    }
    
    function _getElementStyleByAction(action) {
        var color;
        
        switch (action) {
            case 'allow':
                color = '#00C957';
                break;
            case 'deny':
                color = '#FF6A6A';
                break;
            default:
                color = 'transparent';
        }
        
        return { color: color };
    }
    
    function _getPermissionLevelByActionName(action) {
        switch (action) {
            case 'allow':
                return 2; // USER_ALLOWED
            case 'deny':
                return -2; // USER_DENIED
            default:
                return -1; // DEFAULT_DENIED
        }
    }
    
    function _getRequestedFeatures() {
        var requested_features = [];
        
        for (i = 0, l = navigator.feature_permissions.length; i < l; i++) {
            if (navigator.feature_permissions[i].requested) {
                requested_features.push(navigator.feature_permissions[i].feature);
            }
        }
        
        return requested_features;
    }
    
    function _hideInfobar() {
        var infobar = document.getElementById('infobar');
    
        // hide
        infobar.style.top = '-125px';
        document.body.style.marginTop = '0px';
        
        // destroy
        setTimeout(function () {
            document.body.removeChild(infobar);
        }, 500);
    }
    
    function _showInfobar() {
        var infobar = document.getElementById('infobar'),
            infobarHeight = parseInt(document.defaultView.
                getComputedStyle(infobar, null).getPropertyValue('height'), 10);
        
        infobar.style.top = '0px';
        document.body.style.marginTop = (infobarHeight + 40) + 'px';
    }

    function _hideSettings() {
        var settings = document.getElementById('settings_window');
        
        settings.style.display = 'none';
    }
    
    function _showSettings() {
        var settings_window = document.getElementById('settings_window'); 
        
        if (settings_window) {
            settings_window.style.display = 'block';
        } else {
            settings_window = document.createElement('div');
            settings_window.id = 'settings_window';
            settings_window.className ='box_shadow_window';
            // workaround: setTimeout() to allow removeItem() finish before reload() kicks in
            settings_window.innerHTML =
                '<button id="close_settings" class="close_button">X</button>' +
                '<div id="settings_header">Feature Permission Settings</div>' +
                '<button onclick="' +
                    'setTimeout(function() { localStorage.removeItem(\'feature_permissions\');' +
                    'document.location.reload(true);}, 0);' +
                '">Set to defaults</button>';
            
            document.body.appendChild(settings_window);
            _delegateEvents(settings_window);
        }
    }
    
    function _getResponse(feature_permissions) {
        var response = {}, i, l;
        
        for (i = 0, l = navigator.feature_permissions.length; i < l; i++) {
            if (navigator.feature_permissions[i].requested) {
                response[navigator.feature_permissions[i].feature] = {permission_level: navigator.feature_permissions[i].permission_level};
            }
        }
        
        return response;
    }
    
    function _getPrivilegedFeatures() {
        var privileged_features = [],
            i, l;
        
        for (i = 0, l = navigator.feature_permissions.length; i < l; i++) {
            privileged_features.push(navigator.feature_permissions[i].feature);
        }
        
        return privileged_features;
    }
    
    function _requestPermissionWarning(msg) {
        var logEl = document.getElementById('log');
        logEl.style.backgroundColor = '#FF6A6A';
        log(msg);
        window.scrollTo(0, 0);
        setTimeout(function () {
            logEl.style.backgroundColor = '#F0F0F0';
        }, 2000);
    }
    
    // public API
    return {
        USER_ALLOWED: 2,
        DEFAULT_ALLOWED: 1,
        DEFAULT_DENIED: -1,
        USER_DENIED: -2,
        privilegedFeatures: ['contacts', 'calendar', 'system'],
        
        permissionLevel: function (feature) {
            var i, l;
            
            for (i = 0, l = navigator.feature_permissions.length; i < l; i++) {
                if (navigator.feature_permissions[i].feature === (feature || this.feature)) {
                    return navigator.feature_permissions[i].permission_level;
                }
            }
            
            throw {
                name: 'Error',
                message: 'Feature "' + feature + '" is not known to the user agent.'
            };
        },
        
        requestPermission: function (success, error) {
            // infobar can be invoked once, set requested accordingly
            _setFeaturePermission(this.feature, {requested: !_is_infobar_invoked});
            
            if (typeof success === 'function' || typeof error === 'function') {
                if (_is_infobar_invoked) {
                    _requestPermissionWarning('The feature permissions infobar can be invoked ' +
                        'once per active browsing context. Reload the page to replay.');
                    return;
                }
                
                _is_infobar_invoked = true;
                _success_callback = success;
                _error_callback = error;
                _createInfobar();
            }
        }
    };

}());

function Contacts(feature) {
    this.feature = feature;
}

function Calendar(feature) {
    this.feature = feature;
}

function System(feature) {
    this.feature = feature;
}

inherit(Contacts, Permissions);
inherit(Calendar, Permissions);
inherit(System, Permissions);

navigator.contacts = new Contacts('contacts');
navigator.calendar = new Calendar('calendar');
navigator.system = new System('system');

}());