/**
 * ResizeHandle component that provides a draggable resize handle for adjusting panel widths.
 * Supports both horizontal and vertical resize directions.
 */

import React from 'react';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  isActive: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({ direction, isActive, onMouseDown }) => {
  if (direction === 'vertical') {
    return (
      <div
        className={`absolute top-0 left-0 w-full h-1 cursor-row-resize z-[70] transition-colors ${
          isActive ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-500/30'
        }`}
        onMouseDown={onMouseDown}
      />
    );
  }

  return (
    <div
      className={`absolute top-0 right-0 w-1 h-full cursor-col-resize z-[20] transition-colors ${
        isActive ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-500/30'
      }`}
      onMouseDown={onMouseDown}
    />
  );
};
