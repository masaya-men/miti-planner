import { createContext } from 'react';

// Context for mobile triggers — avoids prop leakage via cloneElement
// Extracted to its own file to prevent circular dependency (Layout ↔ Timeline)
export const MobileTriggersContext = createContext<{
    mobilePartyOpen: boolean;
    setMobilePartyOpen: (v: boolean) => void;
    mobileStatusOpen: boolean;
    setMobileStatusOpen: (v: boolean) => void;
    mobileToolsOpen: boolean;
    setMobileToolsOpen: (v: boolean) => void;
    mobileMenuOpen: boolean;
    setMobileMenuOpen: (v: boolean) => void;
    isHeaderCollapsed: boolean;
    setIsHeaderCollapsed: (v: boolean) => void;
    isHeaderNear: boolean;
    setIsHeaderNear: (v: boolean) => void;
}>({
    mobilePartyOpen: false,
    setMobilePartyOpen: () => { },
    mobileStatusOpen: false,
    setMobileStatusOpen: () => { },
    mobileToolsOpen: false,
    setMobileToolsOpen: () => { },
    mobileMenuOpen: false,
    setMobileMenuOpen: () => { },
    isHeaderCollapsed: false,
    setIsHeaderCollapsed: () => { },
    isHeaderNear: false,
    setIsHeaderNear: () => { },
});
