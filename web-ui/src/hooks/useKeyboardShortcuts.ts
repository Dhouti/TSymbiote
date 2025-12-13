import { useEffect, useCallback, type MutableRefObject } from 'react';
import { GraphCanvas } from 'reagraph';
import { PANEL_CONFIG, CAMERA_CONTROLS, DEFAULT_LAYOUT } from '../constants';

interface KeyboardShortcutsConfig {
  // Refs
  graphRef: MutableRefObject<React.ElementRef<typeof GraphCanvas> | null>;
  nodeRef: MutableRefObject<Map<string, any>>;
  contextMenuCloseRef: MutableRefObject<(() => void) | null>;

  // Modal states
  showQueryDNSModal: boolean;
  showPprofModal: boolean;

  // Panel state
  statusPanelHeight: number;
  previousPanelHeight: number;
  statusPanelOpen: boolean;
  setStatusPanelHeight: (height: number) => void;
  setPreviousPanelHeight: (height: number) => void;

  // Output data state
  outputData: Record<string, any>;
  selectedOutputHost: string | null;
  setSelectedOutputHost: (host: string) => void;

  // Layout state
  layoutType: string;
  layoutOptions: Array<{ value: string; label: string }>;
  setLayoutType: (type: string) => void;

  // Selection state
  hosts: string[];
  targetNodes: string[];
  setSelectedHosts: (hosts: Set<string>) => void;
  setSelectedTargets: (targets: Set<string>) => void;
  setGraphKey: (fn: (prev: number) => number) => void;

  // Modal close handlers
  closeQueryDNSModal: () => void;
  closePprofModal: () => void;
}

const MIN_PANEL_HEIGHT = PANEL_CONFIG.MIN_HEIGHT;
const PAN_SPEED = CAMERA_CONTROLS.PAN_SPEED;

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  const {
    graphRef,
    nodeRef,
    contextMenuCloseRef,
    showQueryDNSModal,
    showPprofModal,
    statusPanelHeight,
    previousPanelHeight,
    statusPanelOpen,
    setStatusPanelHeight,
    setPreviousPanelHeight,
    outputData,
    selectedOutputHost,
    setSelectedOutputHost,
    layoutType,
    layoutOptions,
    setLayoutType,
    hosts,
    targetNodes,
    setSelectedHosts,
    setSelectedTargets,
    setGraphKey,
    closeQueryDNSModal,
    closePprofModal,
  } = config;

  const handleEscapeKey = useCallback(() => {
    // Close context menu
    if (contextMenuCloseRef.current) {
      contextMenuCloseRef.current();
      contextMenuCloseRef.current = null;
    }
    // Close modals
    if (showQueryDNSModal) {
      closeQueryDNSModal();
    }
    if (showPprofModal) {
      closePprofModal();
    }
  }, [showQueryDNSModal, showPprofModal, closeQueryDNSModal, closePprofModal, contextMenuCloseRef]);

  const handleSpacebarKey = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    if (statusPanelHeight <= MIN_PANEL_HEIGHT) {
      const targetHeight = previousPanelHeight > MIN_PANEL_HEIGHT
        ? previousPanelHeight
        : Math.floor(window.innerHeight * 0.5);
      setStatusPanelHeight(targetHeight);
    } else {
      setPreviousPanelHeight(statusPanelHeight);
      setStatusPanelHeight(MIN_PANEL_HEIGHT);
    }
  }, [statusPanelHeight, previousPanelHeight, setStatusPanelHeight, setPreviousPanelHeight]);

  const handleTabKey = useCallback((e: KeyboardEvent) => {
    const hostKeys = Object.keys(outputData);
    if (hostKeys.length > 1 && selectedOutputHost) {
      e.preventDefault();
      const currentIndex = hostKeys.indexOf(selectedOutputHost);
      const nextIndex = e.shiftKey
        ? (currentIndex - 1 + hostKeys.length) % hostKeys.length
        : (currentIndex + 1) % hostKeys.length;
      setSelectedOutputHost(hostKeys[nextIndex]);
    }
  }, [outputData, selectedOutputHost, setSelectedOutputHost]);

  const handleBacktickKey = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    const currentIndex = layoutOptions.findIndex(opt => opt.value === layoutType);
    const nextIndex = e.shiftKey
      ? (currentIndex - 1 + layoutOptions.length) % layoutOptions.length
      : (currentIndex + 1) % layoutOptions.length;
    setLayoutType(layoutOptions[nextIndex].value);
  }, [layoutType, layoutOptions, setLayoutType]);

  const handleResetKey = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    nodeRef.current.clear();
    setLayoutType(DEFAULT_LAYOUT);
    setSelectedHosts(new Set(hosts));
    setSelectedTargets(new Set(targetNodes));
    setGraphKey(prev => prev + 1);
  }, [hosts, targetNodes, setSelectedHosts, setSelectedTargets, setLayoutType, setGraphKey, nodeRef]);

  const handleFitKey = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    graphRef.current?.fitNodesInView();
  }, [graphRef]);

  const handleWASDKeys = useCallback((key: string) => {
    switch (key) {
      case 'w':
        for (let i = 0; i < PAN_SPEED; i++) graphRef.current?.panDown();
        break;
      case 's':
        for (let i = 0; i < PAN_SPEED; i++) graphRef.current?.panUp();
        break;
      case 'a':
        for (let i = 0; i < PAN_SPEED; i++) graphRef.current?.panRight();
        break;
      case 'd':
        for (let i = 0; i < PAN_SPEED; i++) graphRef.current?.panLeft();
        break;
    }
  }, [graphRef]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
      const modalOpen = showQueryDNSModal || showPprofModal;

      if (e.key === 'Escape') {
        handleEscapeKey();
        return;
      }

      // All other shortcuts require no input field focus and no modal
      if (isInputField || modalOpen) return;

      switch (e.key) {
        case ' ':
          handleSpacebarKey(e);
          break;
        case 'Tab':
          if (statusPanelOpen) {
            handleTabKey(e);
          }
          break;
        case '`':
          handleBacktickKey(e);
          break;
        case 'r':
        case 'R':
          handleResetKey(e);
          break;
        case 'f':
        case 'F':
          handleFitKey(e);
          break;
        case 'w':
        case 'W':
        case 'a':
        case 'A':
        case 's':
        case 'S':
        case 'd':
        case 'D':
          handleWASDKeys(e.key.toLowerCase());
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    showQueryDNSModal,
    showPprofModal,
    statusPanelOpen,
    handleEscapeKey,
    handleSpacebarKey,
    handleTabKey,
    handleBacktickKey,
    handleResetKey,
    handleFitKey,
    handleWASDKeys,
  ]);
}
