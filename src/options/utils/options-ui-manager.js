export class OptionsUIManager {
  constructor() {
    this.statusTimeouts = new Map();
    this.unsavedFields = new Set();
    this.domRefs = {
      saveStatus: null,
      patternTestResult: null,
      addPatternResult: null,
      unsavedIndicators: new Map()
    };
  }

  initialize() {
    this.domRefs.saveStatus = document.getElementById('saveStatus');
    this.domRefs.patternTestResult = document.getElementById('patternTestResult');
    this.domRefs.addPatternResult = document.getElementById('addPatternResult');
    
    const unsavedIndicatorIds = [
      'proxyNameUnsaved', 'proxyEnabledUnsaved', 'proxyHostUnsaved', 
      'proxyPortUnsaved', 'usernameUnsaved', 'passwordUnsaved', 
      'reauthUnsaved', 'routingModeUnsaved', 'patternsUnsaved', 
      'containersUnsaved'
    ];
    
    unsavedIndicatorIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        const fieldName = id.replace('Unsaved', '');
        this.domRefs.unsavedIndicators.set(fieldName, element);
      }
    });
  }

  showSaveStatus(message, isError = false) {
    this.showStatusMessage('saveStatus', message, isError);
  }


  showPatternTestResult(message, isError = false) {
    this.showStatusMessage('patternTestResult', message, isError);
  }

  showAddPatternResult(message, isError = false) {
    this.showStatusMessage('addPatternResult', message, isError);
  }

  showStatusMessage(elementKey, message, isError = false) {
    const element = this.domRefs[elementKey];
    if (!element) return;

    if (this.statusTimeouts.has(elementKey)) {
      clearTimeout(this.statusTimeouts.get(elementKey));
    }

    element.textContent = message;
    element.className = isError ? 'status-message error' : 'status-message success';
    element.style.display = 'block';

    const timeout = setTimeout(() => {
      element.style.display = 'none';
      this.statusTimeouts.delete(elementKey);
    }, isError ? 8000 : 3000);

    this.statusTimeouts.set(elementKey, timeout);
  }

  getStatusIcon(success) {
    if (success) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>`;
    } else {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>`;
    }
  }

  showUnsavedIndicator(field, show) {
    const indicator = this.domRefs.unsavedIndicators.get(field);
    if (!indicator) return;

    if (show) {
      indicator.classList.add('visible');
      this.unsavedFields.add(field);
    } else {
      indicator.classList.remove('visible');
      this.unsavedFields.delete(field);
    }
  }

  resetAllUnsavedIndicators() {
    this.domRefs.unsavedIndicators.forEach((indicator, field) => {
      indicator.classList.remove('visible');
    });
    this.unsavedFields.clear();
  }

  hasUnsavedChanges() {
    return this.unsavedFields.size > 0;
  }

  getUnsavedFields() {
    return Array.from(this.unsavedFields);
  }

  handleOperationError(operation, error, alternativeMessage = '') {
    console.error(`Error in ${operation}:`, error);
    
    let errorMessage = alternativeMessage;
    if (!errorMessage) {
      errorMessage = error && error.message ? error.message : `Error in ${operation}`;
    }

    if (operation.includes('save') || operation.includes('Save')) {
      this.showSaveStatus(errorMessage, true);
    } else if (operation.includes('connection') || operation.includes('Connection')) {
      this.showConnectionStatus(errorMessage, true);
    } else if (operation.includes('pattern') && operation.includes('test')) {
      this.showPatternTestResult(errorMessage, true);
    } else if (operation.includes('pattern')) {
      this.showAddPatternResult(errorMessage, true);
    } else {
      this.showSaveStatus(errorMessage, true);
    }
  }

  disableForm(formId, message = 'Processing...') {
    const form = document.getElementById(formId);
    if (!form) return;

    const inputs = form.querySelectorAll('input, select, textarea, button');
    inputs.forEach(input => {
      input.disabled = true;
    });

    if (message) {
      this.showSaveStatus(message);
    }
  }

  enableForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    const inputs = form.querySelectorAll('input, select, textarea, button');
    inputs.forEach(input => {
      input.disabled = false;
    });
  }

  showConfirmation(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
    return new Promise((resolve) => {
      if (confirm(`${title}\n\n${message}`)) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  }

  updateButtonState(buttonId, options = {}) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    if (options.disabled !== undefined) {
      button.disabled = options.disabled;
    }

    if (options.text) {
      button.textContent = options.text;
    }

    if (options.icon) {
      button.innerHTML = `${options.icon} ${button.textContent}`;
    }

    if (options.loading) {
      button.innerHTML = `<span class="spinner"></span> ${button.textContent}`;
      button.disabled = true;
    }
  }
}