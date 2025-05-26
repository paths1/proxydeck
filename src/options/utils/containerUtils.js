import * as browser from 'webextension-polyfill';

/**
 * Fetches available Firefox contextual identities (containers).
 * Includes default and private browsing "containers" for completeness.
 * @returns {Promise<Array<{id: string, name: string, color?: string, icon?: string}>>}
 *          A promise that resolves with an array of container objects.
 *          Each object has `id` (cookieStoreId), `name`, and optional `color` and `icon`.
 *          Returns an empty array if the API is not available or an error occurs.
 */
export const fetchFirefoxContainers = async () => {
  if (!browser || !browser.contextualIdentities || typeof browser.contextualIdentities.query !== 'function') {
    return [];
  }

  try {
    const identities = await browser.contextualIdentities.query({});
    
    const containers = [
      {
        id: 'firefox-default', // Consistent ID for default
        name: 'Default (No Container)',
        color: 'grey', // Example color
        icon: 'fingerprint' // Example icon
      }
    ];

    identities.forEach(identity => {
      containers.push({
        id: identity.cookieStoreId,
        name: identity.name,
        color: identity.color,
        icon: identity.icon
      });
    });

    // Add a representation for private browsing
    containers.push({
      id: 'firefox-private', // Consistent ID for private
      name: 'Private Browsing',
      color: 'purple', // Example color
      icon: 'incognito' // Example icon
    });
    
    return containers;
  } catch (error) {
    console.error('Error loading Firefox containers:', error);
    // It might be useful to return a specific error indicator or a default set
    // depending on how the caller wants to handle this. For now, empty array.
    return [];
  }
};