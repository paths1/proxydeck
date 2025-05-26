/**
 * Manages Firefox container selection UI
 * Loads available containers and handles selections
 */
export class ContainerSelector {
  constructor(options) {
    // DOM elements
    this.containerListElement = options.containerListElement;
    
    // UI Manager
    this.uiManager = options.uiManager;
    
    // Callback for container changes
    this.onContainersChange = options.onContainersChange || (() => {});
    
    // Current state
    this.firefoxContainers = [];
    this.selectedContainers = [];
    
    // Browser API (will be imported dynamically)
    this.browser = null;
  }
  
  /**
   * Initialize container selector
   */
  async init() {
    // Import browser API
    try {
      this.browser = await import('webextension-polyfill');
    } catch (error) {
      console.error('Failed to load browser API:', error);
      return;
    }
    
    await this.loadContainersFromBrowser();
    this.render();
  }
  
  /**
   * Load containers from Firefox API
   */
  async loadContainersFromBrowser() {
    if (!this.browser || !this.browser.contextualIdentities) {
      console.error('Container API not available');
      this.firefoxContainers = [];
      return;
    }
    
    try {
      const identities = await this.browser.contextualIdentities.query({});
      
      // Start with default container
      this.firefoxContainers = [{
        cookieStoreId: 'firefox-default',
        name: 'Default Container',
        color: 'grey',
        icon: 'fingerprint'
      }];
      
      // Add actual containers
      identities.forEach(identity => {
        this.firefoxContainers.push({
          cookieStoreId: identity.cookieStoreId,
          name: identity.name,
          color: identity.color,
          icon: identity.icon
        });
      });
      
      // Add private browsing container
      this.firefoxContainers.push({
        cookieStoreId: 'firefox-private',
        name: 'Private Browsing',
        color: 'purple',
        icon: 'incognito'
      });
      
    } catch (error) {
      console.error('Error loading Firefox containers:', error);
      this.firefoxContainers = [];
    }
  }
  
  /**
   * Render container list
   * @param {Array} allContainers - All available containers (optional)
   * @param {Array} selectedContainers - Currently selected containers (optional)
   */
  render(allContainers, selectedContainers) {
    if (!this.containerListElement) return;
    
    // Use provided containers or current state
    const containers = allContainers || this.firefoxContainers;
    const selected = selectedContainers || this.selectedContainers;
    
    this.containerListElement.innerHTML = '';
    
    if (containers.length === 0) {
      this.containerListElement.innerHTML = '<div class="empty-containers">No Firefox containers found.</div>';
      return;
    }
    
    containers.forEach(container => {
      const containerItem = document.createElement('div');
      containerItem.className = 'container-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `container-${container.cookieStoreId}`;
      checkbox.value = container.cookieStoreId;
      checkbox.checked = selected.includes(container.cookieStoreId);
      
      checkbox.addEventListener('change', () => {
        this.handleContainerToggle(container.cookieStoreId, checkbox.checked);
      });
      
      // Add container icon and color
      const iconSpan = document.createElement('span');
      iconSpan.className = 'container-icon';
      iconSpan.style.backgroundColor = this.getContainerColor(container.color);
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'container-name';
      nameSpan.textContent = container.name;
      
      containerItem.appendChild(checkbox);
      containerItem.appendChild(iconSpan);
      containerItem.appendChild(nameSpan);
      
      this.containerListElement.appendChild(containerItem);
    });
  }
  
  /**
   * Handle container selection toggle
   * @param {string} containerId - Container ID
   * @param {boolean} isChecked - Whether container is now checked
   */
  handleContainerToggle(containerId, isChecked) {
    if (isChecked) {
      if (!this.selectedContainers.includes(containerId)) {
        this.selectedContainers.push(containerId);
      }
    } else {
      const index = this.selectedContainers.indexOf(containerId);
      if (index > -1) {
        this.selectedContainers.splice(index, 1);
      }
    }
    
    // Show unsaved indicator
    this.uiManager.showUnsavedIndicator('containers', true);
    
    // Notify parent of change
    this.onContainersChange(this.selectedContainers);
  }
  
  /**
   * Get selected containers
   * @returns {Array} Array of selected container IDs
   */
  getSelectedContainers() {
    return [...this.selectedContainers];
  }
  
  /**
   * Set selected containers
   * @param {Array} containers - Array of container IDs to select
   */
  setSelectedContainers(containers) {
    this.selectedContainers = containers || [];
    this.render();
  }
  
  /**
   * Get container color for CSS
   * @param {string} colorName - Firefox container color name
   * @returns {string} CSS color value
   */
  getContainerColor(colorName) {
    const colorMap = {
      'blue': '#37adff',
      'turquoise': '#00c79a',
      'green': '#51cd00',
      'yellow': '#ffcb00',
      'orange': '#ff9f00',
      'red': '#ff613d',
      'pink': '#ff4bda',
      'purple': '#af51f5',
      'grey': '#888888',
      'gray': '#888888'
    };
    
    return colorMap[colorName] || '#888888';
  }
  
  /**
   * Reset UI to match current selection
   */
  resetUI() {
    this.render();
    this.uiManager.showUnsavedIndicator('containers', false);
  }
  
  /**
   * Clean up and destroy
   */
  destroy() {
    this.firefoxContainers = [];
    this.selectedContainers = [];
    
    if (this.containerListElement) {
      this.containerListElement.innerHTML = '';
    }
  }
}