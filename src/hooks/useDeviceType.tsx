import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

type DeviceType = "mobile" | "tablet" | "desktop";

interface DeviceContextValue {
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

const DeviceContext = React.createContext<DeviceContextValue | undefined>(undefined);

function getDeviceType(width: number): DeviceType {
  if (width < MOBILE_BREAKPOINT) return "mobile";
  if (width < TABLET_BREAKPOINT) return "tablet";
  return "desktop";
}

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [deviceType, setDeviceType] = React.useState<DeviceType>(() => {
    if (typeof window !== "undefined") {
      return getDeviceType(window.innerWidth);
    }
    return "desktop";
  });

  React.useEffect(() => {
    const mobileQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const tabletQuery = window.matchMedia(
      `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`
    );

    const updateDeviceType = () => {
      setDeviceType(getDeviceType(window.innerWidth));
    };

    // Listen to media query changes
    mobileQuery.addEventListener("change", updateDeviceType);
    tabletQuery.addEventListener("change", updateDeviceType);

    // Initial check
    updateDeviceType();

    return () => {
      mobileQuery.removeEventListener("change", updateDeviceType);
      tabletQuery.removeEventListener("change", updateDeviceType);
    };
  }, []);

  const value = React.useMemo<DeviceContextValue>(
    () => ({
      deviceType,
      isMobile: deviceType === "mobile",
      isTablet: deviceType === "tablet",
      isDesktop: deviceType === "desktop",
    }),
    [deviceType]
  );

  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDeviceType(): DeviceContextValue {
  const context = React.useContext(DeviceContext);
  if (context === undefined) {
    throw new Error("useDeviceType must be used within a DeviceProvider");
  }
  return context;
}

// Optional: standalone hook for simple use cases
export function useDevice() {
  const [deviceType, setDeviceType] = React.useState<DeviceType>(() => {
    if (typeof window !== "undefined") {
      return getDeviceType(window.innerWidth);
    }
    return "desktop";
  });

  React.useEffect(() => {
    const mobileQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const tabletQuery = window.matchMedia(
      `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`
    );

    const updateDeviceType = () => {
      setDeviceType(getDeviceType(window.innerWidth));
    };

    mobileQuery.addEventListener("change", updateDeviceType);
    tabletQuery.addEventListener("change", updateDeviceType);
    updateDeviceType();

    return () => {
      mobileQuery.removeEventListener("change", updateDeviceType);
      tabletQuery.removeEventListener("change", updateDeviceType);
    };
  }, []);

  return {
    deviceType,
    isMobile: deviceType === "mobile",
    isTablet: deviceType === "tablet",
    isDesktop: deviceType === "desktop",
  };
}
