import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ProxyPopupItem from '../../../components/popup/ProxyPopupItem';

// Mock webextension-polyfill which is used by the useProxyToggle hook
jest.mock('webextension-polyfill', () => ({
  runtime: {
    sendMessage: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('ProxyPopupItem', () => {
  const mockProxy = {
    id: 'proxy1',
    name: 'Test Proxy 1',
    host: '127.0.0.1',
    port: '8080',
    enabled: true,
    priority: 1,
  };

  const mockOnToggle = jest.fn();

  beforeEach(() => {
    // Clear mock history before each test
    mockOnToggle.mockClear();
    require('webextension-polyfill').runtime.sendMessage.mockClear();
  });

  test('renders proxy information correctly', () => {
    render(<ProxyPopupItem proxy={mockProxy} isActive={true} onToggle={mockOnToggle} />);

    expect(screen.getByText('Test Proxy 1')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument(); // Active badge
    expect(screen.getByRole('switch')).toBeChecked();
  });

  test('renders correctly when proxy is not enabled', () => {
    const inactiveProxy = { ...mockProxy, enabled: false };
    render(<ProxyPopupItem proxy={inactiveProxy} isActive={false} onToggle={mockOnToggle} />);

    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  test('calls onToggle and browser.runtime.sendMessage when switch is clicked', async () => {
    render(<ProxyPopupItem proxy={mockProxy} isActive={true} onToggle={mockOnToggle} />);

    const switchControl = screen.getByRole('switch');
    fireEvent.click(switchControl);

    // Check if browser.runtime.sendMessage was called with correct parameters
    const browser = require('webextension-polyfill');
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1);
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      action: "toggleProxyState",
      proxyId: mockProxy.id,
      enabled: false, // Toggled from true to false
    });

    // Wait for promises to resolve if any (like the one in handleToggle)
    await screen.findByText('Test Proxy 1'); // Re-query to ensure component updates if any

    // Check if onToggle was called
    expect(mockOnToggle).toHaveBeenCalledTimes(1);
    expect(mockOnToggle).toHaveBeenCalledWith(mockProxy.id, false);
  });

  test('handles onToggle not being provided', async () => {
    render(<ProxyPopupItem proxy={mockProxy} isActive={true} />); // No onToggle prop

    const switchControl = screen.getByRole('switch');
    fireEvent.click(switchControl);

    const browser = require('webextension-polyfill');
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1);
    // No error should be thrown, and onToggle (which is undefined) should not be called
    await screen.findByText('Test Proxy 1');
    // mockOnToggle should not have been called as it wasn't passed
    expect(mockOnToggle).not.toHaveBeenCalled();
  });

  test('renders without priority-related elements when priority is undefined', () => {
    const proxyWithoutPriority = { ...mockProxy, priority: undefined };
    render(<ProxyPopupItem proxy={proxyWithoutPriority} isActive={true} onToggle={mockOnToggle} />);
    // Just ensure it renders the basic elements without error
    expect(screen.getByText('Test Proxy 1')).toBeInTheDocument();
  });

  test('renders without breaking when isActive is undefined', () => {
    render(<ProxyPopupItem proxy={mockProxy} onToggle={mockOnToggle} />); // isActive is undefined
    // Just ensure it renders without errors
    expect(screen.getByText('Test Proxy 1')).toBeInTheDocument();
  });
});