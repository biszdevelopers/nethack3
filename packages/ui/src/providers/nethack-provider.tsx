import type { ReactNode } from "react";
import { useColorMode, useLocale } from "../hooks/environment.js";
import { TooltipProvider } from "../components/tooltip.js";
import { ToastViewport } from "../components/toast-viewport.js";
import { OverlayViewport } from "../components/overlay-viewport.js";

export interface NethackProviderProps {
    readonly children: ReactNode;
    readonly locale?: string;
}

/**
 * Coordinates only genuinely global UI behavior: theme, locale, tooltips,
 * toast notifications, and programmatic overlays. Application state does not
 * belong here.
 */
export function NethackProvider({ children, locale }: NethackProviderProps): ReactNode {
    useColorMode();
    const localeState = useLocale();

    if (locale !== undefined && locale !== localeState.locale) {
        localeState.setLocale(locale);
    }

    return (
        <TooltipProvider delayDuration={200} skipDelayDuration={100}>
            {children}
            <ToastViewport />
            <OverlayViewport />
        </TooltipProvider>
    );
}
