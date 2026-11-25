import { forwardRef } from "react";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerTrigger,
    type DrawerContentProps,
} from "./drawer.js";

export const Slideover = Drawer;
export const SlideoverTrigger = DrawerTrigger;
export const SlideoverClose = DrawerClose;

export interface SlideoverContentProps extends Omit<DrawerContentProps, "side"> {
    readonly side?: "left" | "right";
}

export const SlideoverContent = forwardRef<HTMLDivElement, SlideoverContentProps>(
    function SlideoverContent({ side = "right", ...rest }, ref) {
        return <DrawerContent ref={ref} side={side} {...rest} />;
    },
);
