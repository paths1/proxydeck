/**
 * Manages the proxy editing form UI
 * Handles loading proxy data, form validation, and tracking changes
 */
export class ProxyEditor {
  constructor(options) {
    // DOM elements
    this.proxyNameInput = options.proxyNameInput;
    this.proxyEnabledToggle = options.proxyEnabledToggle;
    this.proxyHostInput = options.proxyHostInput;
    this.proxyPortInput = options.proxyPortInput;
    this.usernameInput = options.usernameInput;
    this.passwordInput = options.passwordInput;
    this.requireReauthCheckbox = options.requireReauthCheckbox;
    
    // UI Manager for showing unsaved indicators
    this.uiManager = options.uiManager;
    
    // Callbacks
    this.onFieldChange = options.onFieldChange || (() => {});
    
    // Current proxy being edited
    this.currentProxy = null;
    
    // Original values for change tracking
    this.originalValues = {};
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners for form fields
   */
  setupEventListeners() {
    // Name field
    if (this.proxyNameInput) {
      this.proxyNameInput.addEventListener("input", () => {
        this.handleFieldChange('name', this.proxyNameInput.value.trim());
      });
    }
    
    // Enabled toggle
    if (this.proxyEnabledToggle) {
      this.proxyEnabledToggle.addEventListener("change", (event) => {
        event.stopPropagation();
        this.handleFieldChange('enabled', this.proxyEnabledToggle.checked);
      });
    }
    
    // Host field
    if (this.proxyHostInput) {
      this.proxyHostInput.addEventListener("input", () => {
        this.handleFieldChange('host', this.proxyHostInput.value.trim());
      });
    }
    
    // Port field
    if (this.proxyPortInput) {
      this.proxyPortInput.addEventListener("input", () => {
        this.handleFieldChange('port', parseInt(this.proxyPortInput.value));
      });
    }
    
    // Username field
    if (this.usernameInput) {
      this.usernameInput.addEventListener("input", () => {
        this.handleFieldChange('username', this.usernameInput.value.trim());
      });
    }
    
    // Password field
    if (this.passwordInput) {
      this.passwordInput.addEventListener("input", () => {
        this.handleFieldChange('password', this.passwordInput.value);
      });
    }
    
    // Require reauth checkbox
    if (this.requireReauthCheckbox) {
      this.requireReauthCheckbox.addEventListener("change", (event) => {
        event.stopPropagation();
        this.handleFieldChange('requireReauth', this.requireReauthCheckbox.checked);
      });
    }
  }
  
  /**
   * Handle field change and show unsaved indicator
   * @param {string} field - Field name that changed
   * @param {any} value - New value
   */
  handleFieldChange(field, value) {
    if (!this.currentProxy) return;
    
    let hasChanged = false;
    
    // Determine if the value has changed from original
    switch (field) {
      case 'name':
        hasChanged = value !== this.originalValues.name;
        break;
      case 'enabled':
        hasChanged = value !== this.originalValues.enabled;
        break;
      case 'host':
        hasChanged = value !== this.originalValues.host;
        break;
      case 'port':
        hasChanged = value !== this.originalValues.port;
        break;
      case 'username':
        hasChanged = value !== this.originalValues.username;
        break;
      case 'password':
        hasChanged = value !== this.originalValues.password;
        break;
      case 'requireReauth':
        hasChanged = value !== this.originalValues.requireReauth;
        break;
    }
    
    // Show unsaved indicator
    if (this.uiManager) {
      const fieldMap = {
        'name': 'proxyName',
        'enabled': 'proxyEnabled',
        'host': 'proxyHost',
        'port': 'proxyPort',
        'username': 'username',
        'password': 'password',
        'requireReauth': 'reauth'
      };
      
      this.uiManager.showUnsavedIndicator(fieldMap[field], hasChanged);
    }
    
    // Notify parent of change
    this.onFieldChange(field, value);
  }
  
  /**
   * Load proxy data into the form
   * @param {Object} proxyData - Proxy configuration to load
   */
  loadProxy(proxyData) {
    this.currentProxy = proxyData;
    
    if (!proxyData) {
      this.clearForm();
      this.disableForm();
      this.originalValues = {};
      return;
    }
    
    this.enableForm();
    
    // Store original values for change tracking
    this.originalValues = {
      name: proxyData.name || "",
      enabled: proxyData.enabled !== false,
      host: proxyData.host || "",
      port: proxyData.port || 1080,
      username: proxyData.username || "",
      password: proxyData.password || "",
      requireReauth: proxyData.requireReauth || false
    };
    
    // Populate form fields
    this.proxyNameInput.value = this.originalValues.name;
    this.proxyEnabledToggle.checked = this.originalValues.enabled;
    this.proxyHostInput.value = this.originalValues.host;
    this.proxyPortInput.value = this.originalValues.port;
    this.usernameInput.value = this.originalValues.username;
    this.passwordInput.value = this.originalValues.password;
    this.requireReauthCheckbox.checked = this.originalValues.requireReauth;
    
    // Reset all unsaved indicators
    if (this.uiManager) {
      this.uiManager.resetAllUnsavedIndicators();
    }
  }
  
  /**
   * Get proxy data from form fields
   * @returns {Object} Proxy data object
   */
  getProxyDataFromForm() {
    return {
      name: this.proxyNameInput.value.trim(),
      enabled: this.proxyEnabledToggle.checked,
      host: this.proxyHostInput.value.trim(),
      port: parseInt(this.proxyPortInput.value, 10),
      username: this.usernameInput.value.trim(),
      password: this.passwordInput.value,
      requireReauth: this.requireReauthCheckbox.checked
    };
  }
  
  /**
   * Validate core proxy fields
   * @returns {Object} Validation result {isValid: boolean, errors: Array}
   */
  validateCoreFields() {
    const data = this.getProxyDataFromForm();
    const errors = [];
    
    if (!data.name) {
      errors.push({
        field: 'name',
        message: 'Please enter a proxy name to identify this configuration'
      });
    }
    
    if (!data.host) {
      errors.push({
        field: 'host',
        message: 'Please enter a proxy host address (e.g., socks5.example.com or 192.168.1.1)'
      });
    }
    
    if (isNaN(data.port) || data.port < 1 || data.port > 65535) {
      errors.push({
        field: 'port',
        message: 'Invalid port number. Please enter a number between 1 and 65535'
      });
    }
    
    // Check for incomplete credentials
    if ((data.username && !data.password) || (!data.username && data.password)) {
      errors.push({
        field: 'credentials',
        message: 'Incomplete credentials. Please provide both username and password, or neither.'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
  
  /**
   * Clear all form fields
   */
  clearForm() {
    this.proxyNameInput.value = "";
    this.proxyEnabledToggle.checked = true;
    this.proxyHostInput.value = "";
    this.proxyPortInput.value = "1080";
    this.usernameInput.value = "";
    this.passwordInput.value = "";
    this.requireReauthCheckbox.checked = false;
    
    // Reset original values
    this.originalValues = {};
    
    if (this.uiManager) {
      this.uiManager.resetAllUnsavedIndicators();
    }
  }
  
  /**
   * Enable all form fields
   */
  enableForm() {
    this.proxyNameInput.disabled = false;
    this.proxyEnabledToggle.disabled = false;
    this.proxyHostInput.disabled = false;
    this.proxyPortInput.disabled = false;
    this.usernameInput.disabled = false;
    this.passwordInput.disabled = false;
    this.requireReauthCheckbox.disabled = false;
  }
  
  /**
   * Disable all form fields
   */
  disableForm() {
    this.proxyNameInput.disabled = true;
    this.proxyEnabledToggle.disabled = true;
    this.proxyHostInput.disabled = true;
    this.proxyPortInput.disabled = true;
    this.usernameInput.disabled = true;
    this.passwordInput.disabled = true;
    this.requireReauthCheckbox.disabled = true;
  }
  
  /**
   * Focus on a specific field (usually for validation errors)
   * @param {string} fieldName - Name of the field to focus
   */
  focusField(fieldName) {
    const fieldMap = {
      'name': this.proxyNameInput,
      'host': this.proxyHostInput,
      'port': this.proxyPortInput,
      'username': this.usernameInput,
      'password': this.passwordInput
    };
    
    const field = fieldMap[fieldName];
    if (field) {
      field.focus();
    }
  }
  
  /**
   * Destroy the editor and clean up
   */
  destroy() {
    this.currentProxy = null;
    this.clearForm();
  }
}