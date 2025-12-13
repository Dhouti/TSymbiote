import { useState, useEffect, useCallback } from 'react';
import { PANEL_CONFIG } from '../constants';

const { MIN_HEIGHT: MIN_PANEL_HEIGHT, MIN_VIEWPORT_MARGIN } = PANEL_CONFIG;

interface PanelResizeConfig {
  defaultHeight?: number;
  defaultExpandedPercentage?: number;
}

export function usePanelResize(config: PanelResizeConfig = {}) {
  const {
    defaultHeight = MIN_PANEL_HEIGHT,
    defaultExpandedPercentage = 0.5,
  } = config;

  const [statusPanelHeight, setStatusPanelHeight] = useState(defaultHeight);
  const [previousPanelHeight, setPreviousPanelHeight] = useState(
    Math.floor(window.innerHeight * defaultExpandedPercentage)
  );
  const [isDragging, setIsDragging] = useState(false);

  const isMinimized = statusPanelHeight <= MIN_PANEL_HEIGHT;

  const toggleMinimizePanel = useCallback(() => {
    if (isMinimized) {
      // Currently minimized, restore to previous height or 50% of window height
      const targetHeight = previousPanelHeight > MIN_PANEL_HEIGHT
        ? previousPanelHeight
        : Math.floor(window.innerHeight * defaultExpandedPercentage);
      setStatusPanelHeight(targetHeight);
    } else {
      // Currently expanded, save current height and minimize
      setPreviousPanelHeight(statusPanelHeight);
      setStatusPanelHeight(MIN_PANEL_HEIGHT);
    }
  }, [isMinimized, previousPanelHeight, statusPanelHeight, defaultExpandedPercentage]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  // Handle resize drag
  useEffect(() => {
    if (!isDragging) return;

    const handleResizeMove = (e: MouseEvent) => {
      e.preventDefault();
      const newHeight = window.innerHeight - e.clientY;
      if (newHeight >= MIN_VIEWPORT_MARGIN && newHeight <= window.innerHeight - MIN_VIEWPORT_MARGIN) {
        setStatusPanelHeight(newHeight);
      }
    };

    const handleResizeEnd = () => {
      setIsDragging(false);
    };

    // Add event listeners to the document for better capture
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging]);

  return {
    statusPanelHeight,
    setStatusPanelHeight,
    previousPanelHeight,
    setPreviousPanelHeight,
    isDragging,
    isMinimized,
    toggleMinimizePanel,
    handleResizeStart,
    minHeight: MIN_PANEL_HEIGHT,
  };
}
