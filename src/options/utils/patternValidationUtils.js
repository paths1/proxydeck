import { defaultPatternMatcher } from '../../modules/PatternMatcher';

/**
 * Validates a single regex pattern string.
 * @param {string} patternString - The regex pattern string to validate.
 * @returns {{isValid: boolean, error?: string}} An object indicating if the pattern is valid,
 *                                              and an error message if it's not.
 */
export const validateRegexPatternLine = (patternString) => {
  // Empty string is valid (empty line)
  if (!patternString || patternString === '') {
    return { isValid: true };
  }
  
  // Check if line contains only spaces
  if (patternString.trim() === '') {
    return { isValid: false, error: 'Line contains only spaces' };
  }
  
  // Check for trailing spaces
  if (patternString !== patternString.trimEnd()) {
    return { isValid: false, error: 'Trailing spaces detected' };
  }
  
  if (patternString.trim().startsWith('#')) {
    // Comment lines are valid (or ignorable)
    return { isValid: true };
  }

  try {
    // PatternMatcher's validatePattern is a bit complex for direct use here,
    // as it has options and might return the pattern itself.
    // A direct RegExp construction is simpler for basic validation.
    new RegExp(patternString);
    return { isValid: true };
  } catch (e) {
    return { isValid: false, error: e.message };
  }
};

/**
 * Tests a string against a list of regex patterns.
 * Patterns are provided as a single string, with each pattern on a new line.
 * @param {string} testString - The string to test.
 * @param {string} patternsMultiline - A string containing regex patterns, one per line.
 * @returns {{matched: boolean, error?: string, matchedPattern?: string}} An object indicating if the string matched,
 *                                                                      any error during testing, and which pattern matched.
 */
export const testStringAgainstPatterns = (testString, patternsMultiline) => {
  if (!testString) {
    return { matched: false, error: "Test string cannot be empty." };
  }
  if (!patternsMultiline) {
    return { matched: false, error: "Patterns cannot be empty." };
  }

  const patternLines = patternsMultiline.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('#'); // Ignore empty lines and comments
  });

  if (patternLines.length === 0) {
    return { matched: false, error: "No valid patterns provided." };
  }

  try {
    for (const pattern of patternLines) {
      // defaultPatternMatcher.testPattern is suitable here
      if (defaultPatternMatcher.testPattern(testString, pattern)) {
        return { matched: true, matchedPattern: pattern };
      }
    }
    return { matched: false };
  } catch (e) {
    // This catch is more for unexpected errors in testPattern itself,
    // as individual regex compilation errors should be caught by validateRegexPatternLine.
    console.error("Error during pattern testing:", e);
    return { matched: false, error: `Error during testing: ${e.message}` };
  }
};