import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import PatternTextarea from '@/components/shared/PatternTextarea';
import { testStringAgainstPatterns } from '../../options/utils/patternValidationUtils';

/**
 * @file RegexRoutingForm.js
 * @description React component for configuring regex-based proxy routing rules.
 * Allows users to input regex patterns, test them, and view validation errors.
 */

/**
 * RegexRoutingForm component.
 * Provides a form for managing regex patterns for a proxy.
 * @param {object} props - The component's props.
 * @param {object} props.proxy - The proxy data object being configured.
 * @param {function} props.onChange - Callback function to update the parent proxy object
 *                                    when regex patterns change.
 * @returns {JSX.Element} The rendered RegexRoutingForm component.
 */
const RegexRoutingForm = ({ proxy, onChange, originalPatterns, dirtyFields, updateFieldDirtyState }) => {
  const [patterns, setPatterns] = useState(
    proxy?.routingConfig?.patterns ? proxy.routingConfig.patterns.join('\n') : ''
  );
  const [testString, setTestString] = useState('');
  const [testResultMsg, setTestResultMsg] = useState('');

  useEffect(() => {
    // Update local state if proxy data changes externally
    if (proxy?.routingConfig?.patterns) {
      const newPatterns = proxy.routingConfig.patterns.join('\n');
      if (newPatterns !== patterns) {
        setPatterns(newPatterns);
      }
    }
  }, [proxy?.routingConfig?.patterns]);

  const handlePatternsChange = (e) => {
    const newPatterns = e.target.value;
    setPatterns(newPatterns);
    if (onChange) {
      onChange(prevProxy => ({
        ...prevProxy,
        routingConfig: {
          ...prevProxy.routingConfig,
          patterns: newPatterns.split('\n')
        }
      }));
    }
    
    // Check if patterns are dirty
    if (updateFieldDirtyState && originalPatterns) {
      const originalPatternsString = originalPatterns.join('\n');
      const isDirty = newPatterns !== originalPatternsString;
      updateFieldDirtyState('routingConfig.patterns', isDirty);
    }
  };


  /**
   * Tests the current `testString` against the configured regex patterns.
   * Updates the `testResultMsg` state with the outcome of the test.
   */
  const handleTestPattern = () => {
    if (!testString) {
      setTestResultMsg('Please enter a string to test.');
      return;
    }
    if (!patterns) {
      setTestResultMsg('Please enter some patterns to test against.');
      return;
    }

    const result = testStringAgainstPatterns(testString, patterns);

    if (result.error) {
      setTestResultMsg(`Error: ${result.error}`);
    } else if (result.matched) {
      setTestResultMsg(`"${testString}" matches pattern: "${result.matchedPattern}"`);
    } else {
      setTestResultMsg(`"${testString}" does not match any pattern.`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`regex-patterns-${proxy?.id}`}>
          Regex Patterns (one per line, trailing spaces removed)
          {dirtyFields && dirtyFields['routingConfig.patterns'] && (
            <Badge variant="default" size="sm" className="ml-2">
              Unsaved
            </Badge>
          )}
        </Label>
        <PatternTextarea
          value={patterns}
          onChange={handlePatternsChange}
          placeholder="e.g., *.example.com&#10;sub.domain.net"
          rows={5}
          className="min-h-[120px] rounded-md border px-3 py-2 bg-transparent"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Use standard Regular Expression syntax.
        </p>
      </div>
      <div className="space-y-2 p-3 border rounded-md">
        <Label htmlFor={`regex-test-string-${proxy?.id}`}>Test Pattern</Label>
        <div className="flex gap-2">
          <Input
            id={`regex-test-string-${proxy?.id}`}
            value={testString}
            onChange={(e) => setTestString(e.target.value)}
            placeholder="Enter a URL or string to test"
            className="flex-grow"
          />
          <Button onClick={handleTestPattern} variant="outline" size="sm">Test</Button>
        </div>
        {testResultMsg && (
          <p className={`text-xs p-2 rounded-md ${testResultMsg.includes('matches pattern:') ? 'bg-primary/10 text-primary border-primary/30' : testResultMsg.includes('does not match') ? 'warning-message' : testResultMsg.includes('Error:') ? 'error-message' : 'bg-muted text-muted-foreground'}`}>
            {testResultMsg}
          </p>
        )}
      </div>
    </div>
  );
};

export default RegexRoutingForm;