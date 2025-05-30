import { useState, useEffect, useRef } from 'preact/hooks';
import { validateRegexPatternLine } from '../../options/utils/patternValidationUtils';

const PatternTextarea = ({ 
  value, 
  onChange, 
  placeholder = "Enter patterns, one per line",
  className = "",
  rows = 5,
  ...props 
}) => {
  const [lineErrors, setLineErrors] = useState(new Map());
  const textareaRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    validatePatterns(value);
  }, [value]);

  const validatePatterns = (patterns) => {
    const lines = patterns.split('\n');
    const errors = new Map();
    
    lines.forEach((line, index) => {
      const validation = validateRegexPatternLine(line);
      if (!validation.isValid && validation.error) {
        errors.set(index, validation.error);
      }
    });
    
    setLineErrors(errors);
  };

  const handleScroll = () => {
    if (overlayRef.current && textareaRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const getLineHeight = () => {
    if (!textareaRef.current) return 22;
    
    // Create a temporary element to measure line height accurately
    const temp = document.createElement('div');
    temp.style.position = 'absolute';
    temp.style.visibility = 'hidden';
    temp.style.height = 'auto';
    temp.style.width = 'auto';
    temp.style.fontFamily = window.getComputedStyle(textareaRef.current).fontFamily;
    temp.style.fontSize = window.getComputedStyle(textareaRef.current).fontSize;
    temp.style.lineHeight = window.getComputedStyle(textareaRef.current).lineHeight;
    temp.innerHTML = 'A';
    
    document.body.appendChild(temp);
    const height = temp.offsetHeight;
    document.body.removeChild(temp);
    
    return height || 22;
  };

  const renderErrorIndicators = () => {
    if (lineErrors.size === 0 || !textareaRef.current) return null;
    
    const lineHeight = getLineHeight();
    const textareaStyle = window.getComputedStyle(textareaRef.current);
    const paddingTop = parseInt(textareaStyle.paddingTop, 10) || 8;
    
    return Array.from(lineErrors.entries()).map(([lineIndex, errorMessage]) => (
      <div key={lineIndex}>
        {/* Error line background highlight */}
        <div 
          className="pattern-error-line-bg absolute w-full"
          style={{ 
            top: `${paddingTop + (lineIndex * lineHeight)}px`,
            height: `${lineHeight}px`,
            left: '0px',
            right: '0px'
          }}
        />
        
        {/* Right-aligned error message */}
        <div 
          className="pattern-error-message absolute pointer-events-none"
          style={{ 
            right: '8px',
            top: `${paddingTop + (lineIndex * lineHeight) + (lineHeight / 2)}px`,
            transform: 'translateY(-50%)'
          }}
        >
          <div className="pattern-error-message-content">
            {errorMessage}
          </div>
        </div>
      </div>
    ));
  };

  return (
    <div className="relative pattern-textarea-container">
      {/* Main textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onScroll={handleScroll}
        placeholder={placeholder}
        rows={rows}
        className={`w-full font-mono text-sm resize-vertical ${className}`}
        style={{ 
          lineHeight: '1.4'
        }}
        {...props}
      />
      
      {/* Error overlay */}
      <div 
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none overflow-hidden"
      >
        {renderErrorIndicators()}
      </div>
    </div>
  );
};

export default PatternTextarea;