import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { InputWithBadge } from '@/components/ui/input-with-badge';
import { ValidatedInputWithBadge } from '@/components/ui/validated-input-with-badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { validateProxyConfig } from '../../utils.js';

// Simple toast replacement for notifications
const toast = {
  success: (message) => console.log('✅', message),
  error: (message) => console.error('❌', message),
  info: (message) => console.log('ℹ️', message)
};
// Lazy load routing configurator
const RoutingConfiguratorComponent = React.lazy(() => import(/* webpackChunkName: "routing-configurator" */ './RoutingConfiguratorCondensed'));
import browserCapabilities from '../../utils/feature-detection.js'; // Corrected import name

/**
 * @file ProxyForm.js
 * @description React component for editing the details of a single proxy configuration.
 * Includes fields for basic info, authentication, and routing configuration.
 * Also provides actions to save, undo, and test the proxy connection.
 */

/**
 * ProxyForm component.
 * Provides a form to edit proxy details.
 * @param {object} props - The component's props.
 * @param {object} props.proxy - The initial proxy data to populate the form.
 * @param {function} props.onSave - Callback function to save the proxy data.
 * @param {function} props.onUndo - Callback function to undo changes to the proxy data.
 * @param {function} props.onDelete - Callback function to delete the proxy (currently not directly used by this form's buttons).
 * @param {Array} props.existingProxies - Array of existing proxies for duplicate name checking.
 * @returns {JSX.Element} The rendered ProxyForm component.
 */
const ProxyForm = ({ proxy: initialProxyData, onSave, onUndo, onDelete, existingProxies = [], autoFocusName = false }) => {
  const [proxy, setProxy] = useState(initialProxyData || {
    name: '',
    host: '127.0.0.1',
    port: 1080,
    proxyType: 'socks5',
    enabled: false,
    auth: { username: '', password: '' },
    requireReauth: false,
    priority: 0,
    routingConfig: {
      useContainerMode: false,
      patterns: [],
      containers: []
    }
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [hasValidated, setHasValidated] = useState(false);
  const [originalValues, setOriginalValues] = useState(null);
  const [dirtyFields, setDirtyFields] = useState({});
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (initialProxyData) {
      setProxy(initialProxyData);
      setOriginalValues(initialProxyData);
      // When initialProxyData changes (e.g., after a save or undo from parent),
      // reset unsaved changes status.
      setHasUnsavedChanges(false);
      setDirtyFields({});
    }
  }, [initialProxyData]);

  useEffect(() => {
    // Check for unsaved changes whenever 'proxy' state changes,
    // but only if initialProxyData is actually set (i.e., not a new proxy form).
    if (initialProxyData) {
      // Simple JSON stringify comparison. For complex objects, a deep-equal function is more robust.
      const currentProxyString = JSON.stringify(proxy);
      const initialProxyString = JSON.stringify(initialProxyData);
      setHasUnsavedChanges(currentProxyString !== initialProxyString);
    } else {
      // If it's a new proxy form (no initialProxyData), any input is an "unsaved change"
      // until the first save. Or, consider it "unsaved" if any field is non-default.
      // For simplicity, let's assume new proxies always show as "unsaved" if any field is touched.
      // A more sophisticated check might compare against a "pristine" new proxy object.
      // For now, if there's no initialProxyData, any change from the default empty state is "unsaved".
      const defaultNewProxy = { name: '', host: '127.0.0.1', port: 1080, proxyType: 'socks5', enabled: false, auth: { username: '', password: '' }, requireReauth: false, priority: 0, routingConfig: { useContainerMode: false, patterns: [], containers: [] } };
      setHasUnsavedChanges(JSON.stringify(proxy) !== JSON.stringify(defaultNewProxy));
    }
  }, [proxy, initialProxyData]);

  useEffect(() => {
    if (autoFocusName && nameInputRef.current) {
      // Small delay to ensure the accordion animation has completed
      const timer = setTimeout(() => {
        nameInputRef.current.focus();
        nameInputRef.current.select();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [autoFocusName]);

  /**
   * Checks if a field value is different from its original value
   */
  const isFieldDirty = (fieldName, currentValue, originalValue) => {
    if (fieldName === 'auth.username' || fieldName === 'auth.password') {
      const authField = fieldName.split('.')[1];
      const original = originalValues?.auth?.[authField] || '';
      return currentValue !== original;
    }
    if (fieldName === 'routingConfig.useContainerMode') {
      const original = originalValues?.routingConfig?.useContainerMode || false;
      return currentValue !== original;
    }
    return currentValue !== (originalValue || '');
  };

  /**
   * Updates the dirty state for a specific field
   */
  const updateFieldDirtyState = (fieldName, isDirty) => {
    setDirtyFields(prev => {
      const newDirtyFields = { ...prev };
      if (isDirty) {
        newDirtyFields[fieldName] = true;
      } else {
        delete newDirtyFields[fieldName];
      }
      return newDirtyFields;
    });
  };

  /**
   * Validates a single field and updates the error state
   */
  const validateField = (fieldName, value) => {
    const errors = { ...fieldErrors };
    
    switch (fieldName) {
      case 'name':
        if (!value || value.trim() === '') {
          errors.name = 'Proxy name is required';
        } else {
          // Check for duplicate names (exclude current proxy if editing)
          const isDuplicate = existingProxies.some(existingProxy => 
            existingProxy.name.toLowerCase() === value.trim().toLowerCase() && 
            existingProxy.id !== proxy.id
          );
          if (isDuplicate) {
            errors.name = 'A proxy with this name already exists';
          } else {
            delete errors.name;
          }
        }
        break;
      case 'host':
        if (!value || value.trim() === '') {
          errors.host = 'Proxy host is required';
        } else {
          delete errors.host;
        }
        break;
      case 'port':
        if (!value || value === '') {
          errors.port = 'Port is required';
        } else if (isNaN(value) || value < 1 || value > 65535) {
          errors.port = 'Port must be between 1 and 65535';
        } else {
          delete errors.port;
        }
        break;
    }
    
    setFieldErrors(errors);
    return errors;
  };

  /**
   * Validates all fields using the existing validation function
   */
  const validateAllFields = () => {
    const validation = validateProxyConfig(proxy);
    const errors = {};
    
    if (validation.errors && validation.errors.length > 0) {
      validation.errors.forEach(error => {
        if (error.includes('name is required')) {
          errors.name = 'Proxy name is required';
        } else if (error.includes('host is required')) {
          errors.host = 'Proxy host is required';
        } else if (error.includes('Valid port number is required')) {
          errors.port = 'Valid port number is required';
        } else if (error.includes('Port must be between')) {
          errors.port = error;
        }
      });
    }
    
    // Additional duplicate name check
    if (proxy.name && proxy.name.trim() !== '') {
      const isDuplicate = existingProxies.some(existingProxy => 
        existingProxy.name.toLowerCase() === proxy.name.trim().toLowerCase() && 
        existingProxy.id !== proxy.id
      );
      if (isDuplicate) {
        errors.name = 'A proxy with this name already exists';
      }
    }
    
    setFieldErrors(errors);
    setHasValidated(true);
    return errors;
  };

  /**
   * Handles changes to standard input fields and updates the local proxy state.
   * @param {React.ChangeEvent<HTMLInputElement>} e - The input change event.
   */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const actualValue = type === 'checkbox' || type === 'switch' ? checked : value;
    
    if (name.startsWith('auth.')) {
      const authField = name.split('.')[1];
      setProxy(prev => ({
        ...prev,
        auth: { ...prev.auth, [authField]: value }
      }));
    } else {
      setProxy(prev => ({
        ...prev,
        [name]: actualValue
      }));
    }
    
    // Check if field is dirty
    if (originalValues) {
      const isDirty = isFieldDirty(name, actualValue, originalValues[name]);
      updateFieldDirtyState(name, isDirty);
    }
    
    // Validate the field on change if we've already started validation
    if (hasValidated) {
      validateField(name, value);
    }
  };

  /**
   * Handles field blur to trigger validation
   */
  const handleBlur = (e) => {
    const { name, value } = e.target;
    setHasValidated(true);
    validateField(name, value);
  };
  


  /**
   * Handles changes to the port input field, ensuring the value is a valid port number.
   * @param {React.ChangeEvent<HTMLInputElement>} e - The input change event.
   */
  const handlePortChange = (e) => {
    const { value } = e.target;
    // Allow empty string for clearing the input, or convert to number
    const portValue = value === '' ? '' : Number(value);
    if (value === '' || (!isNaN(portValue) && portValue >= 0 && portValue <= 65535)) {
      setProxy(prev => ({ ...prev, port: portValue }));
      
      // Check if field is dirty
      if (originalValues) {
        const isDirty = portValue !== originalValues.port;
        updateFieldDirtyState('port', isDirty);
      }
    }
    
    // Validate the port field on change if we've already started validation
    if (hasValidated) {
      validateField('port', portValue);
    }
  };
  
  /**
   * Handles port field blur to trigger validation
   */
  const handlePortBlur = (e) => {
    const { value } = e.target;
    setHasValidated(true);
    validateField('port', value);
  };

  /**
   * Handles changes to proxy type radio group
   */
  const handleProxyTypeChange = (value) => {
    setProxy(prev => ({ ...prev, proxyType: value }));
    
    // Check if field is dirty
    if (originalValues) {
      const isDirty = value !== originalValues.proxyType;
      updateFieldDirtyState('proxyType', isDirty);
    }
  };

  // Placeholder functions for actions
  /**
   * Calls the onSave prop to save the current proxy data.
   */
  const handleSave = () => {
    // Validate all fields before saving
    const errors = validateAllFields();
    
    if (Object.keys(errors).length > 0) {
      toast.error("Please fix validation errors before saving");
      // Focus on the first error field
      const firstErrorField = Object.keys(errors)[0];
      const element = document.querySelector(`[name="${firstErrorField}"]`);
      if (element) {
        element.focus();
      }
      return;
    }
    
    // Clean regex patterns before saving
    const cleanedProxy = { ...proxy };
    if (cleanedProxy.routingConfig?.patterns) {
      cleanedProxy.routingConfig.patterns = cleanedProxy.routingConfig.patterns
        .map(pattern => pattern.trimEnd())
        .filter(pattern => pattern.length > 0);
    }
    
    if (onSave) {
      onSave(cleanedProxy);
    }
  };

  /**
   * Handles Enter key press in Basic Information text fields to trigger save.
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      
      // Check if save is allowed (same conditions as Save button)
      const isSaveDisabled = Object.keys(fieldErrors).length > 0 || (!hasUnsavedChanges && !!initialProxyData);
      
      if (!isSaveDisabled) {
        handleSave();
      }
    }
  };

  /**
   * Resets the form to the initial proxy data and calls the onUndo prop.
   */
  const handleUndo = () => {
    if (initialProxyData) {
      setProxy(initialProxyData);
      setDirtyFields({}); // Clear all dirty field states
      setHasUnsavedChanges(false); // Reset unsaved changes flag
    }
    if (onUndo) {
      onUndo();
    }
  };

  const handleDelete = () => {
    // onDelete(proxy.id); // This is typically handled by ProxyItem/ProxiesSection
  };


  const isAuthenticationSupported = (proxyType) => {
    switch (proxyType) {
      case 'http':
        return browserCapabilities.proxyAuth.supportsHttpAuth;
      case 'https':
        return browserCapabilities.proxyAuth.supportsHttpsAuth;
      case 'socks4':
        return browserCapabilities.proxyAuth.supportsSocks4Auth;
      case 'socks5':
        return browserCapabilities.proxyAuth.supportsSocks5Auth;
      default:
        return false;
    }
  };

  const getAuthDisabledReason = (proxyType) => {
    switch (proxyType) {
      case 'socks4':
        return 'SOCKS4 does not support authentication';
      case 'socks5':
        return !browserCapabilities.proxyAuth.supportsSocks5Auth ? 
          'SOCKS5 authentication not supported in this browser' : null;
      default:
        return null;
    }
  };


  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <h3 className="text-lg font-medium mb-4">
            Basic Information
          </h3>
          <div className="space-y-3">
            {/* Name field with inline label */}
            <div className="grid grid-cols-12 gap-4 items-center">
              <Label htmlFor={`name-${proxy.id}`} className="col-span-1 text-right">
                Name
              </Label>
              <div className="col-span-11">
                <ValidatedInputWithBadge 
                  ref={nameInputRef} 
                  id={`name-${proxy.id}`} 
                  name="name" 
                  value={proxy.name} 
                  onChange={handleChange} 
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., My Home Proxy" 
                  error={fieldErrors.name}
                  showBadge={dirtyFields.name}
                />
              </div>
            </div>
            
            {/* Proxy Type with inline label */}
            <div className="grid grid-cols-12 gap-4 items-center">
              <Label className="col-span-1 text-right">
                Type
              </Label>
              <div className="col-span-11">
                <div className="flex items-center gap-4">
                  <RadioGroup 
                    value={proxy.proxyType} 
                    onValueChange={handleProxyTypeChange}
                    className="flex gap-4"
                  >
                    {['http', 'https', 'socks4', 'socks5'].map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <RadioGroupItem value={type} id={`proxyType-${type}-${proxy.id}`} />
                        <Label htmlFor={`proxyType-${type}-${proxy.id}`} className="text-sm font-normal uppercase">
                          {type}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {dirtyFields.proxyType && (
                    <Badge variant="default" size="sm" className="ml-4">
                      Unsaved
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* Host and Port with inline labels */}
            <div className="grid grid-cols-12 gap-4 items-center">
              <Label htmlFor={`host-${proxy.id}`} className="col-span-1 text-right">
                Host
              </Label>
              <div className="col-span-6">
                <ValidatedInputWithBadge 
                  id={`host-${proxy.id}`} 
                  name="host" 
                  value={proxy.host} 
                  onChange={handleChange} 
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., proxy.example.com" 
                  error={fieldErrors.host}
                  showBadge={dirtyFields.host}
                />
              </div>
              <Label htmlFor={`port-${proxy.id}`} className="col-span-1 text-right">
                Port
              </Label>
              <div className="col-span-4">
                <ValidatedInputWithBadge 
                  id={`port-${proxy.id}`} 
                  name="port" 
                  type="number" 
                  value={proxy.port} 
                  onChange={handlePortChange} 
                  onBlur={handlePortBlur}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., 8080" 
                  error={fieldErrors.port}
                  showBadge={dirtyFields.port}
                />
              </div>
            </div>
            
            {/* Username and Password with inline labels */}
            <div className="grid grid-cols-12 gap-4 items-center">
              <Label htmlFor={`username-${proxy.id}`} className="col-span-1 text-right">
                User
              </Label>
              <div className="col-span-5">
                <InputWithBadge 
                  id={`username-${proxy.id}`} 
                  name="auth.username" 
                  value={proxy.auth.username} 
                  onChange={handleChange} 
                  onKeyDown={handleKeyDown}
                  placeholder={isAuthenticationSupported(proxy.proxyType) ? "Optional" : "Not supported"}
                  disabled={!isAuthenticationSupported(proxy.proxyType)}
                  title={getAuthDisabledReason(proxy.proxyType)}
                  showBadge={dirtyFields['auth.username']}
                />
              </div>
              <Label htmlFor={`password-${proxy.id}`} className="col-span-1 text-right">
                Pass
              </Label>
              <div className="col-span-5">
                <InputWithBadge 
                  id={`password-${proxy.id}`} 
                  name="auth.password" 
                  type="password" 
                  value={proxy.auth.password} 
                  onChange={handleChange} 
                  onKeyDown={handleKeyDown}
                  placeholder={isAuthenticationSupported(proxy.proxyType) ? "Optional" : "Not supported"}
                  disabled={!isAuthenticationSupported(proxy.proxyType)}
                  title={getAuthDisabledReason(proxy.proxyType)}
                  showBadge={dirtyFields['auth.password']}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Suspense fallback={
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          <span className="ml-3 text-sm text-muted-foreground">Loading routing configuration...</span>
        </div>
      }>
        <RoutingConfiguratorComponent 
          proxy={proxy} 
          onChange={setProxy}
          originalRoutingConfig={originalValues?.routingConfig}
          dirtyFields={dirtyFields}
          updateFieldDirtyState={updateFieldDirtyState}
        />
      </Suspense>

      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="destructive" size="sm" onClick={() => onDelete(proxy.id)}>
          Delete Proxy
        </Button>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleUndo}
            disabled={!hasUnsavedChanges && !!initialProxyData}
            className={(!hasUnsavedChanges && !!initialProxyData) ? "opacity-50 cursor-not-allowed" : ""}
          >
            Undo
          </Button>
          <Button 
            onClick={handleSave} 
            variant={Object.keys(fieldErrors).length > 0 ? "destructive" : (hasUnsavedChanges ? "default" : "secondary")} 
            size="sm"
            disabled={Object.keys(fieldErrors).length > 0 || (!hasUnsavedChanges && !!initialProxyData)}
            title={Object.keys(fieldErrors).length > 0 ? "Please fix validation errors before saving" : ""}
          >
            Save
          </Button>
        </div>
      </div>
    </form>
  );
};

export default ProxyForm;