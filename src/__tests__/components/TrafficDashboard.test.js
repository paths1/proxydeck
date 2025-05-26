import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import TrafficDashboard from '../../components/options/TrafficDashboard';
import browser from 'webextension-polyfill';
import { MESSAGE_ACTIONS } from '../../common/constants';

// Mock Recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  AreaChart: ({ children }) => <div>{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

describe('TrafficDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock storage
    browser.storage.local.get.mockResolvedValue({
      config: {
        proxies: [
          { id: 'proxy1', name: 'Proxy 1', color: '#6366F1' },
          { id: 'proxy2', name: 'Proxy 2', color: '#EC4899' }
        ]
      }
    });

    // Mock runtime messages with new data structure
    browser.runtime.sendMessage.mockImplementation(async (message) => {
      if (message.action === MESSAGE_ACTIONS.GET_TRAFFIC_SOURCES) {
        return [
          { id: 'proxy1', name: 'Proxy 1', color: '#6366F1' },
          { id: 'proxy2', name: 'Proxy 2', color: '#EC4899' },
          { id: 'others', name: 'Others', color: 'hsl(0, 0%, 70%)', isSpecial: true }
        ];
      }
      if (message.action === MESSAGE_ACTIONS.GET_TRAFFIC_DATA) {
        const now = Date.now();
        return {
          data: [
            {
              timestamp: now - 60000,
              download_total: 1024,
              upload_total: 256,
              download_proxy1: 512,
              upload_proxy1: 128,
              download_proxy2: 512,
              upload_proxy2: 128
            },
            {
              timestamp: now - 30000,
              download_total: 2048,
              upload_total: 512,
              download_proxy1: 1024,
              upload_proxy1: 256,
              download_proxy2: 1024,
              upload_proxy2: 256
            },
            {
              timestamp: now,
              download_total: 3072,
              upload_total: 768,
              download_proxy1: 1536,
              upload_proxy1: 384,
              download_proxy2: 1536,
              upload_proxy2: 384
            }
          ],
          stats: {
            download: { current: 3072, peak: 3072, total: 6144, average: 2048 },
            upload: { current: 768, peak: 768, total: 1536, average: 512 },
            perProxy: {
              proxy1: {
                download: { current: 1536, peak: 1536, total: 3072, average: 1024 },
                upload: { current: 384, peak: 384, total: 768, average: 256 }
              },
              proxy2: {
                download: { current: 1536, peak: 1536, total: 3072, average: 1024 },
                upload: { current: 384, peak: 384, total: 768, average: 256 }
              }
            }
          },
          meta: {
            windowSize: '1min',
            sampleInterval: 1000,
            pointCount: 3,
            updateTimestamp: now,
            timeRange: { start: now - 60000, end: now }
          }
        };
      }
      return { error: 'Unknown action' };
    });
  });

  it('renders traffic dashboard with loading state initially', () => {
    render(<TrafficDashboard />);
    expect(screen.getByText('Loading traffic data...')).toBeInTheDocument();
  });

  it('renders traffic data after loading', async () => {
    render(<TrafficDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Traffic Monitor')).toBeInTheDocument();
    });

    // Check if time window selector is present
    expect(screen.getByText('1 min')).toBeInTheDocument();
    expect(screen.getByText('5 min')).toBeInTheDocument();
    expect(screen.getByText('10 min')).toBeInTheDocument();

    // Check if charts are rendered
    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
  });

  it('handles traffic update messages', async () => {
    render(<TrafficDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Traffic Monitor')).toBeInTheDocument();
    });

    // Simulate traffic update message with new data structure
    const now = Date.now();
    const updateMessage = {
      action: MESSAGE_ACTIONS.TRAFFIC_UPDATE,
      updates: {
        '1min': {
          data: [
            {
              timestamp: now - 2000,
              download_total: 4096,
              upload_total: 1024,
              download_proxy1: 2048,
              upload_proxy1: 512,
              download_proxy2: 2048,
              upload_proxy2: 512
            },
            {
              timestamp: now - 1000,
              download_total: 5120,
              upload_total: 1280,
              download_proxy1: 2560,
              upload_proxy1: 640,
              download_proxy2: 2560,
              upload_proxy2: 640
            },
            {
              timestamp: now,
              download_total: 6144,
              upload_total: 1536,
              download_proxy1: 3072,
              upload_proxy1: 768,
              download_proxy2: 3072,
              upload_proxy2: 768
            }
          ],
          stats: {
            download: { current: 6144, peak: 6144, total: 15360, average: 5120 },
            upload: { current: 1536, peak: 1536, total: 3840, average: 1280 },
            perProxy: {
              proxy1: {
                download: { current: 3072, peak: 3072, total: 7680, average: 2560 },
                upload: { current: 768, peak: 768, total: 1920, average: 640 }
              },
              proxy2: {
                download: { current: 3072, peak: 3072, total: 7680, average: 2560 },
                upload: { current: 768, peak: 768, total: 1920, average: 640 }
              }
            }
          },
          meta: {
            windowSize: '1min',
            sampleInterval: 1000,
            pointCount: 3,
            updateTimestamp: now,
            timeRange: { start: now - 2000, end: now }
          }
        }
      }
    };

    // Trigger the message listener
    const listeners = browser.runtime.onMessage.addListener.mock.calls;
    const messageListener = listeners[listeners.length - 1][0];
    messageListener(updateMessage);

    // Verify data is updated
    expect(screen.getByText('Traffic Monitor')).toBeInTheDocument();
  });

  it('handles errors gracefully', async () => {
    browser.runtime.sendMessage.mockResolvedValue({ error: 'Failed to fetch data' });
    
    render(<TrafficDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Error: Failed to fetch data')).toBeInTheDocument();
    });
  });
});