/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

/*global ActivityHandler, ThreadUI, ThreadListUI, MessageManager,
         Settings, LazyLoader, TimeHeaders, Information, SilentSms,
         PerformanceTestingHelper, App, Navigation, EventDispatcher,
         LocalizationHelper,
         InterInstanceEventDispatcher
*/

var Startup = {
  _lazyLoadScripts: [
    '/shared/js/settings_listener.js',
    '/shared/js/mime_mapper.js',
    '/shared/js/notification_helper.js',
    '/shared/js/option_menu.js',
    '/shared/js/gesture_detector.js',
    '/shared/js/settings_url.js',
    '/shared/js/mobile_operator.js',
    '/shared/js/multi_sim_action_button.js',
    '/shared/js/image_utils.js',
    '/shared/elements/gaia_sim_picker/script.js',
    'js/waiting_screen.js',
    'js/errors.js',
    'js/dialog.js',
    'js/error_dialog.js',
    'js/link_helper.js',
    'js/link_action_handler.js',
    'js/contact_renderer.js',
    'js/activity_picker.js',
    'js/information.js',
    'js/shared_components.js',
    'js/task_runner.js',
    'js/silent_sms.js',
    'js/recipients.js',
    'js/attachment.js',
    'js/attachment_renderer.js',
    'js/attachment_menu.js',
    'js/thread_ui.js',
    'js/subject_composer.js',
    'js/compose.js',
    'js/wbmp.js',
    'js/smil.js',
    'js/notify.js',
    'js/activity_handler.js',
    'js/localization_helper.js'
  ],

  _lazyLoadInit: function() {
    var lazyLoadPromise = LazyLoader.load(this._lazyLoadScripts).then(() => {
      LocalizationHelper.init();

      InterInstanceEventDispatcher.connect();

      // dispatch moz-content-interactive when all the modules initialized
      SilentSms.init();
      ActivityHandler.init();

      // Init UI Managers
      TimeHeaders.init();
      ThreadUI.init();
      Information.initDefaultViews();

      // Dispatch post-initialize event for continuing the pending action
      Startup.emit('post-initialize');
      window.performance.mark('contentInteractive');
      window.dispatchEvent(new CustomEvent('moz-content-interactive'));

      // Fetch mmsSizeLimitation and max concat
      Settings.init();

      window.performance.mark('objectsInitEnd');
      PerformanceTestingHelper.dispatch('objects-init-finished');
    });
    this._initHeaders();
    return lazyLoadPromise;
  },

  _initHeaders: function() {
    var headers = document.querySelectorAll('gaia-header[no-font-fit]');
    for (var i = 0, l = headers.length; i < l; i++) {
      headers[i].removeAttribute('no-font-fit');
    }
  },

  /**
  * We wait for the DOMContentLoaded event in the event sequence. After we
  * loaded the first panel of threads, we lazy load all non-critical JS files.
  * As a result, if the 'load' event was not sent yet, this will delay it even
  * more until all these non-critical JS files are loaded. This is fine.
  */
  init: function() {
    function initializeDefaultPanel(firstPageLoadedCallback) {
      Navigation.off('navigated', initializeDefaultPanel);

      ThreadListUI.init();
      ThreadListUI.renderThreads(firstPageLoadedCallback).then(() => {
        window.performance.mark('fullyLoaded');
        window.dispatchEvent(new CustomEvent('moz-app-loaded'));
        App.setReady();
      });
    }

    var loaded = function() {
      window.removeEventListener('DOMContentLoaded', loaded);

      window.performance.mark('navigationLoaded');
      window.dispatchEvent(new CustomEvent('moz-chrome-dom-loaded'));

      MessageManager.init();
      Navigation.init();

      // If initial panel is default one and app isn't run from notification,
      // then just navigate to it, otherwise we can delay default panel
      // initialization until we navigate to requested non-default panel.
      if (Navigation.isDefaultPanel() &&
        !navigator.mozHasPendingMessage('notification')) {
        Navigation.toDefaultPanel();
        initializeDefaultPanel(this._lazyLoadInit.bind(this));
      } else {
        Navigation.on('navigated', initializeDefaultPanel);

        this._lazyLoadInit();
      }

      // dispatch chrome-interactive when thread list related modules
      // initialized
      window.performance.mark('navigationInteractive');
      window.dispatchEvent(new CustomEvent('moz-chrome-interactive'));
    }.bind(this);

    window.addEventListener('DOMContentLoaded', loaded);
  }
};

EventDispatcher.mixin(Startup).init();
