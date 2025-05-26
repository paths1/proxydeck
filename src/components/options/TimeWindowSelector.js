import React from 'react';
import { Button } from '../../components/ui/button';

const TimeWindowSelector = ({ selected, onChange }) => {
  const windows = [
    { value: '1min', label: '1 min' },
    { value: '5min', label: '5 min' },
    { value: '10min', label: '10 min' }
  ];

  return (
    <div className="flex space-x-2">
      {windows.map(window => (
        <Button
          key={window.value}
          variant={selected === window.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(window.value)}
        >
          {window.label}
        </Button>
      ))}
    </div>
  );
};

export default TimeWindowSelector;