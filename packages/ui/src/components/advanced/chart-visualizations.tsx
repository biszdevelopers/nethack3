import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { Chart, type ChartProps } from "../data/chart.js";

export interface BarChartProps extends Omit<ChartProps, "variant"> {
    readonly showLegend?: boolean;
}

export interface LineChartProps extends Omit<ChartProps, "variant"> {
    readonly showLegend?: boolean;
}

function ChartLegend({ label }: { readonly label: string }): ReactNode {
    return (
        <ul aria-label="Legend" className="flex items-center gap-2 text-xs text-ink-muted">
            <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 rounded-sm bg-primary" />
                <span>{label}</span>
            </li>
        </ul>
    );
}

export function BarChart({
    showLegend = true,
    valueLabel,
    className,
    ...rest
}: BarChartProps): ReactNode {
    return (
        <div className={cn("flex flex-col gap-2", className)} data-slot="bar-chart">
            <Chart variant="bar" {...(valueLabel === undefined ? {} : { valueLabel })} {...rest} />
            {showLegend ? <ChartLegend label={valueLabel ?? "Value"} /> : null}
        </div>
    );
}

export function LineChart({
    showLegend = true,
    valueLabel,
    className,
    ...rest
}: LineChartProps): ReactNode {
    return (
        <div className={cn("flex flex-col gap-2", className)} data-slot="line-chart">
            <Chart variant="line" {...(valueLabel === undefined ? {} : { valueLabel })} {...rest} />
            {showLegend ? <ChartLegend label={valueLabel ?? "Value"} /> : null}
        </div>
    );
}
