import { MODERN_PRIORITY_COLORS } from '../common/constants.js';

/**
 * Generates a color based on priority order with maximum contrast
 * @param {number} index - The index in the priority-sorted list (0 = highest priority)
 * @param {number} total - Total number of proxies
 * @returns {string} HSL color string
 */
export function getPriorityColor(index, total) {
  // For a single proxy, use the highest priority color
  if (total === 1) {
    return MODERN_PRIORITY_COLORS[0]; // Vibrant red-pink
  }
  
  // Calculate the color index to maximize contrast across the palette
  // Spread proxies evenly across the full 10-color range
  const maxIndex = MODERN_PRIORITY_COLORS.length - 1; // 9
  let colorIndex;
  
  if (total === 2) {
    // Use colors 0 and 9 for maximum contrast
    colorIndex = index === 0 ? 0 : maxIndex;
  } else {
    // Distribute evenly across the full range
    colorIndex = Math.round((index * maxIndex) / (total - 1));
  }
  
  return MODERN_PRIORITY_COLORS[colorIndex];
}

/**
 * Creates a map of proxy IDs to priority colors
 * @param {Array} proxies - Array of proxy objects with id and priority
 * @returns {Object} Map of proxy id to color
 */
export function createPriorityColorMap(proxies) {
  // Sort proxies by priority (lower number = higher priority)
  const sortedProxies = [...proxies].sort((a, b) => a.priority - b.priority);
  
  const colorMap = {};
  sortedProxies.forEach((proxy, index) => {
    colorMap[proxy.id] = getPriorityColor(index, sortedProxies.length);
  });
  
  return colorMap;
}