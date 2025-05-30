import { render, screen } from '@testing-library/preact';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable'; // Minimal import for context
import ProxyItem from '../../../components/options/ProxyItem';

// Mock child components and hooks
jest.mock('../../../components/options/ProxyForm', () => {
  // eslint-disable-next-line react/prop-types
  return function DummyProxyForm({ proxy }) {
    return <div data-testid="proxy-form">Proxy Form for {proxy.name}</div>;
  };
});


// Basic mock for useSortable as we are not testing dnd interactions here, just rendering
jest.mock('@dnd-kit/sortable', () => ({
  ...jest.requireActual('@dnd-kit/sortable'), // Import actual for SortableContext if needed by other tests
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

describe('ProxyItem', () => {
  const mockProxy = {
    id: 'proxy1',
    name: 'Draggable Proxy',
    host: 'drag.host.com',
    port: '9090',
    status: true,
    priority: 1,
    // Add other fields as expected by ProxyItem and its children if they were not mocked
  };

  const mockOnSave = jest.fn();
  const mockOnUndo = jest.fn();
  const mockOnDelete = jest.fn();

  // To provide DndContext and SortableContext which are required by ProxyItem's useSortable
  const renderWithDndContext = (ui) => {
    return render(
      <DndContext>
        <SortableContext items={[mockProxy.id]}>
          {ui}
        </SortableContext>
      </DndContext>
    );
  };

  test('renders proxy information and drag handle', () => {
    renderWithDndContext(
      <ProxyItem
        proxy={mockProxy}
        onSave={mockOnSave}
        onUndo={mockOnUndo}
        onDelete={mockOnDelete}
      />
    );

    // Check for proxy name and details
    expect(screen.getByText('Draggable Proxy')).toBeInTheDocument();
    expect(screen.getByText('(drag.host.com:9090)')).toBeInTheDocument();
    expect(screen.getByText('Priority: 1')).toBeInTheDocument();

    // Check for the drag handle
    expect(screen.getByRole('button', { name: /Drag to reorder proxy/i })).toBeInTheDocument();


    // Check for the drag handle (GripVertical icon)
    // Since lucide-react icons are SVGs, we can check for its aria-label or a more specific selector
    expect(screen.getByLabelText('Drag to reorder proxy')).toBeInTheDocument();
    // Check if the GripVertical SVG is rendered (more robust check might involve specific SVG content)
    expect(screen.getByLabelText('Drag to reorder proxy').querySelector('svg')).toBeInTheDocument();


    // Check if the AccordionTrigger is present (it wraps the main display part)
    // The text content of the trigger will be a concatenation of its children
    expect(screen.getByRole('button', { name: /Draggable Proxy/i })).toBeInTheDocument();


    // AccordionContent (ProxyForm mock) is not visible by default
    expect(screen.queryByTestId('proxy-form')).not.toBeInTheDocument();
  });


  test('renders correctly with minimal proxy data', () => {
     const minimalProxy = { id: 'minProxy', priority: 2 }; // name, host, port are undefined
     renderWithDndContext(
      <ProxyItem
        proxy={minimalProxy}
        onSave={mockOnSave}
        onUndo={mockOnUndo}
        onDelete={mockOnDelete}
      />
    );
    expect(screen.getByText('Unnamed Proxy')).toBeInTheDocument();
    expect(screen.getByText('(No Host:No Port)')).toBeInTheDocument();
    expect(screen.getByText('Priority: 2')).toBeInTheDocument();
    // Check for the drag handle
    expect(screen.getByRole('button', { name: /Drag to reorder proxy/i })).toBeInTheDocument();
  });
});