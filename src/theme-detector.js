(function() {
  // For popup pages, we need to ensure the theme is applied as soon as possible
  // and that the document is fully loaded
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const updateTheme = () => {
    if (darkQuery.matches) {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  };
  
  // Initial theme setup
  updateTheme();
  
  // Add a DOMContentLoaded listener to ensure theme is applied after DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    updateTheme();
  });
  
  // Listen for changes in color scheme preference
  darkQuery.addEventListener('change', () => {
    updateTheme();
  });
  
  // Apply theme again after delays to handle potential race conditions
  setTimeout(() => {
    updateTheme();
  }, 100);
  
  // Add an additional delay for popup which might have special timing needs
  setTimeout(() => {
    updateTheme();
  }, 500);
})();