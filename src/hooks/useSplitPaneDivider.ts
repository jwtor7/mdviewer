/**
 * useSplitPaneDivider Hook
 *
 * Handles split view divider dragging logic for resizing panes.
 * Returns mouse event handlers for the divider element.
 */

import { useCallback } from 'react';

export interface UseSplitPaneDividerProps {
  splitDividerPosition: number;
  setSplitDividerPosition: (position: number) => void;
}

export interface UseSplitPaneDividerReturn {
  handleDividerMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const useSplitPaneDivider = ({
  splitDividerPosition,
  setSplitDividerPosition,
}: UseSplitPaneDividerProps): UseSplitPaneDividerReturn => {
  const handleDividerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = splitDividerPosition;
    // Capture container width at mousedown time (not during mousemove)
    const containerWidth = (e.currentTarget as HTMLElement).parentElement?.clientWidth || 1;

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const newWidth = Math.min(Math.max(20, startWidth + deltaPercent), 80);
      setSplitDividerPosition(newWidth);
    };

    const handleMouseUp = (): void => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [splitDividerPosition, setSplitDividerPosition]);

  return { handleDividerMouseDown };
};

export default useSplitPaneDivider;
