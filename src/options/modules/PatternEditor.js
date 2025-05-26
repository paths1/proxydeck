/**
 * Manages regex pattern editing UI
 * Handles line-by-line validation and pattern testing
 */
export class PatternEditor {
  constructor(options) {
    // DOM elements
    this.patternTextarea = options.patternTextarea;
    this.lineValidation = options.lineValidation;
    this.testPatternInput = options.testPatternInput;
    this.testPatternButton = options.testPatternButton;
    
    // UI Manager
    this.uiManager = options.uiManager;
    
    // Callback for pattern changes
    this.onPatternsChange = options.onPatternsChange || (() => {});
    
    // Pattern matcher for validation (will be imported dynamically)
    this.patternMatcher = null;
    
    // Current patterns
    this.patterns = [];
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Load pattern matcher
    this.loadPatternMatcher();
  }
  
  /**
   * Load pattern matcher dynamically
   */
  async loadPatternMatcher() {
    try {
      const { defaultPatternMatcher } = await import('../../modules/PatternMatcher.js');
      this.patternMatcher = defaultPatternMatcher;
      
      // Validate patterns if already loaded
      if (this.patterns.length > 0 || (this.patternTextarea && this.patternTextarea.value)) {
        this.validateAllTextareaPatterns();
      }
    } catch (error) {
      console.error('Failed to load PatternMatcher:', error);
    }
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    if (this.patternTextarea) {
      this.patternTextarea.addEventListener('input', () => {
        this.handlePatternChange();
      });
      
      this.patternTextarea.addEventListener('scroll', () => {
        this.syncValidationScroll();
      });
    }
    
    if (this.testPatternButton) {
      this.testPatternButton.addEventListener('click', () => {
        this.testPattern();
      });
    }
    
    if (this.testPatternInput) {
      this.testPatternInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.testPattern();
        }
      });
    }
  }
  
  /**
   * Load patterns into the textarea
   * @param {Array} patterns - Array of pattern strings
   */
  loadPatterns(patterns) {
    this.patterns = patterns || [];
    if (this.patternTextarea) {
      this.patternTextarea.value = this.patterns.join('\n');
      this.validateAllTextareaPatterns();
    }
  }
  
  /**
   * Get current patterns from textarea
   * @returns {Array} Array of pattern strings
   */
  getPatterns() {
    if (!this.patternTextarea) return [];
    
    const text = this.patternTextarea.value;
    const lines = text.split('\n');
    
    // Filter out empty lines and comments
    return lines.filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#');
    });
  }
  
  /**
   * Handle pattern change in textarea
   */
  handlePatternChange() {
    const newPatterns = this.getPatterns();
    
    // Show unsaved indicator
    this.uiManager.showUnsavedIndicator('patterns', true);
    
    // Validate patterns
    this.validateAllTextareaPatterns();
    
    // Notify parent of change
    this.onPatternsChange(newPatterns);
  }
  
  /**
   * Validate all patterns in the textarea
   */
  validateAllTextareaPatterns() {
    if (!this.patternTextarea || !this.lineValidation || !this.patternMatcher) {
      return;
    }
    
    const lines = this.patternTextarea.value.split('\n');
    const lineHeight = this.getLineHeight();
    
    // Clear previous validation
    this.lineValidation.innerHTML = '';
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        // Empty line or comment - no validation needed
        return;
      }
      
      // Validate pattern and get result
      let isValid = true;
      let errorMessage = '';
      
      try {
        // The PatternMatcher.validatePattern returns true/false, not an object
        isValid = this.patternMatcher.validatePattern(trimmedLine);
        if (!isValid) {
          // Try to create a regex to get the actual error message
          try {
            new RegExp(trimmedLine);
          } catch (e) {
            errorMessage = e.message;
          }
          if (!errorMessage) {
            errorMessage = 'Invalid regular expression';
          }
        }
      } catch (e) {
        isValid = false;
        errorMessage = e.message || 'Invalid pattern';
      }
      
      if (!isValid) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'line-validation-marker invalid';
        errorDiv.style.top = `${index * lineHeight}px`;
        
        const tooltip = document.createElement('span');
        tooltip.className = 'validation-tooltip';
        tooltip.textContent = errorMessage;
        errorDiv.appendChild(tooltip);
        
        this.lineValidation.appendChild(errorDiv);
      }
    });
  }
  
  /**
   * Test a pattern against current patterns
   */
  async testPattern() {
    if (!this.testPatternInput || !this.patternMatcher) return;
    
    const host = this.testPatternInput.value.trim();
    if (!host) {
      this.uiManager.showPatternTestResult('Please enter a hostname or IP to test', true);
      return;
    }
    
    try {
      const patterns = this.getPatterns();
      
      // Test against each pattern
      let matched = false;
      for (const pattern of patterns) {
        if (this.patternMatcher.testPattern(host, pattern)) {
          matched = true;
          break;
        }
      }
      
      const message = matched ? 
        `✓ "${host}" matches the routing patterns` : 
        `✗ "${host}" does not match any routing patterns`;
      
      this.uiManager.showPatternTestResult(message, !matched);
      
    } catch (error) {
      this.uiManager.showPatternTestResult(`Error testing pattern: ${error.message}`, true);
    }
  }
  
  /**
   * Sync validation panel scroll with textarea
   */
  syncValidationScroll() {
    if (this.lineValidation && this.patternTextarea) {
      this.lineValidation.scrollTop = this.patternTextarea.scrollTop;
    }
  }
  
  /**
   * Get line height of textarea
   * @returns {number} Line height in pixels
   */
  getLineHeight() {
    if (!this.patternTextarea) return 20;
    
    const style = window.getComputedStyle(this.patternTextarea);
    const lineHeight = style.lineHeight;
    
    // Handle different line-height values
    if (lineHeight === 'normal') {
      return Math.floor(parseInt(style.fontSize, 10) * 1.5);
    }
    
    if (lineHeight.includes('px')) {
      return parseInt(lineHeight, 10);
    }
    
    // If it's a number or em, calculate based on font size
    const fontSize = parseInt(style.fontSize, 10);
    const multiplier = parseFloat(lineHeight);
    
    return Math.floor(fontSize * (multiplier || 1.5));
  }
  
  /**
   * Reset UI to match current patterns
   */
  resetUI() {
    if (this.patterns && this.patternTextarea) {
      this.patternTextarea.value = this.patterns.join('\n');
      this.validateAllTextareaPatterns();
    }
    
    // Clear test input
    if (this.testPatternInput) {
      this.testPatternInput.value = '';
    }
    
    // Reset unsaved indicator
    this.uiManager.showUnsavedIndicator('patterns', false);
  }
  
  /**
   * Clean up and destroy
   */
  destroy() {
    this.patterns = [];
    this.patternMatcher = null;
    
    if (this.patternTextarea) {
      this.patternTextarea.value = '';
    }
    
    if (this.lineValidation) {
      this.lineValidation.innerHTML = '';
    }
    
    if (this.testPatternInput) {
      this.testPatternInput.value = '';
    }
  }
}