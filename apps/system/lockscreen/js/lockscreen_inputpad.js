/**
  Copyright 2012, Mozilla Foundation

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
'use strict';

/**
 * XXX: Before we use real keyboard as input pad, we need this to
 * control the custom input pad. See Bug 1053680.
 **/
(function(exports) {
  /**
   * We still need the interface to notify the LockScreen.
   *
   * @param LockScreenFaçade
   **/
  var LockScreenInputpad = function(lockScreen) {
    this.lockScreen = lockScreen;
    this.configs = {
      padVibrationDuration: 50
    };
    this.states = {
      // Keep in sync with Dialer and Keyboard vibration
      padVibrationEnabled: false,
      passCodeEntered: '',
      passCodeErrorTimeoutPending: false
    };
  };
  LockScreenInputpad.prototype.start = function() {
    this.addEventListener('lockscreen-notify-passcode-validationfailed');
    this.addEventListener('lockscreen-notify-passcode-validationreset');
    this.addEventListener('lockscreen-notify-passcode-validationsuccess');
    // Need these to reset status.
    this.addEventListener('lockscreen-appclosed', this);
    this.addEventListener('lockscreen-inputappclosed', this);
    this.addEventListener('lockscreen-inputappopened', this);

    this.passcodeCode = document.getElementById('lockscreen-passcode-code');
    this.passcodePad = document.getElementById('lockscreen-passcode-pad');
    this.emergencyCallBtn = this.passcodePad.querySelector('a[data-key=e]');

    this.passcodePad.addEventListener('click', this);

    window.SettingsListener.observe('keyboard.vibration',
      false, (function(value) {
      this.states.padVibrationEnabled = !!value;
    }).bind(this));

    this.renderUI();
    return this;
  };

  /**
   * Rendering the whole UI, including waiting all necessary conditions.
   * So rendering functions all should be Promised.
   */
  LockScreenInputpad.prototype.renderUI = function() {
    return new Promise((resolve, reject) => {
      this.toggleEmergencyButton();
      this.updatePassCodeUI();
      resolve();
    });
  };

  LockScreenInputpad.prototype.toggleEmergencyButton = function() {
    if ('undefined' === typeof navigator.mozTelephony ||
        !navigator.mozTelephony) {
      this.disableEmergencyButton();
    } else {
      this.enableEmergencyButton();
    }
  };

  LockScreenInputpad.prototype.disableEmergencyButton = function() {
    this.emergencyCallBtn.classList.add('disabled');
  };

  LockScreenInputpad.prototype.enableEmergencyButton = function() {
    this.emergencyCallBtn.classList.remove('disabled');
  };

  LockScreenInputpad.prototype.handleEvent = function(evt) {
    switch (evt.type) {
      // The event flow from lockscreen.js is:
      // on pass code fail:
      //   - 'validationfailed' -> (validation timeout) -> 'validationreset'
      // on pass code success:
      //   - 'validationsuccess'
      case 'lockscreen-notify-passcode-validationfailed':
        this.states.passCodeErrorTimeoutPending = true;
        this.updatePassCodeUI();
        break;
      case 'lockscreen-notify-passcode-validationreset':
      case 'lockscreen-notify-passcode-validationsuccess':
        // Currently both validationreset and validationsuccess
        // just need to reset Inputpad's internal state.
        this.states.passCodeEntered = '';
        this.states.passCodeErrorTimeoutPending = false;
        this.updatePassCodeUI();
        break;
      case 'lockscreen-inputappopened':
      case 'lockscreen-inputappclosed':
        this.updatePassCodeUI();
        break;
      case 'click':
        var key = evt.target.dataset.key;
        if (!key &&
            ('div' === evt.target.tagName.toLowerCase() &&
             'a' === evt.target.parentNode.tagName.toLowerCase())
           ) {
          key = evt.target.parentNode.dataset.key;
        }
        if (!key) {
          break;
        }
        // Cancel the default action of <a>
        evt.preventDefault();
        // handlePassCodeInput triggers updatePassCode
        this.handlePassCodeInput(key);
        break;
    }
  };

  LockScreenInputpad.prototype.dispatchEvent = function(evt) {
    window.dispatchEvent(evt);
  };

  LockScreenInputpad.prototype.addEventListener = function(name, cb) {
    cb = cb || this;
    window.addEventListener(name, cb);
  };

  LockScreenInputpad.prototype.removeEventListener = function(name, cb) {
    cb = cb || this;
    window.removeEventListener(name, cb);
  };

  LockScreenInputpad.prototype.updatePassCodeUI =
  function(keyCode) {
    // keyCode value is getting captured in handlePassCodeInput() function.
    // No timeout when 'Backspace' is pressed.    
    // passcode to be visible for 1 second before changing to dot('.')
    const CODE_VISIBLE_TIMEOUT = 1000; 
    if (this.states.passCodeEntered) {
      this.passcodePad.classList.add('passcode-entered');
    } else {
      this.passcodePad.classList.remove('passcode-entered');
    }
    if (this.states.passCodeErrorTimeoutPending) {
      this.passcodeCode.classList.add('error');
    } else {
      this.passcodeCode.classList.remove('error');
    }
    var i = 4;
    while (i--) {
      var span = this.passcodeCode.childNodes[i];
      if (span) {
        if (this.states.passCodeEntered.length > i) {
        var value = this.states.passCodeEntered.substr(i, this.states.passCodeEntered.length);
        if ((this.states.passCodeEntered.length - 1 === i) && (keyCode && (keyCode !== 'b'))) {
          (function(aspan, currentValue) {
            aspan.textContent = currentValue;
            setTimeout(function() {
              aspan.textContent = '';
              aspan.dataset.dot = true;
            }, CODE_VISIBLE_TIMEOUT);
          })(span, value);
        } else {
          span.textContent = '';
          span.dataset.dot = true;
        }
        } else {
          delete span.dataset.dot;
        }
      }
    }
  };

  LockScreenInputpad.prototype.handlePassCodeInput =
  function(key) {
    // the last passkey should be visible before validation starts
    const CODE_VALIDATION_TIMEOUT = 1200;
    switch (key) {
      case 'e': // 'E'mergency Call
        this.lockScreen.invokeSecureApp('emergency-call');
        break;

      case 'c': // 'C'ancel
        this.dispatchEvent(new window.CustomEvent(
          'lockscreen-keypad-input', { detail: {
            key: key
          }
        }));
        break;

      case 'b': // 'B'ackspace for correction
        if (this.states.passCodeErrorTimeoutPending) {
          break;
        }
        this.states.passCodeEntered =
          this.states.passCodeEntered.substr(0,
            this.states.passCodeEntered.length - 1);
        this.updatePassCodeUI('b');
        break;

      default:
        if (this.states.passCodeErrorTimeoutPending) {
          break;
        }

        this.states.passCodeEntered += key;
        this.updatePassCodeUI('');

        if (this.states.padVibrationEnabled) {
          navigator.vibrate(this.configs.padVibrationDuration);
        }

        if (this.states.passCodeEntered.length === 4) {
          (function(value) {
            setTimeout(function() {
              this.lockScreen.checkPassCode(value);
            }, CODE_VALIDATION_TIMEOUT);
          })(this.states.passCodeEntered);
        }
        break;
    }
  };

  exports.LockScreenInputpad = LockScreenInputpad;
})(window);

