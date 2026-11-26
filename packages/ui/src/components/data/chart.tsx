import { useId, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { EmptyState } from "../empty-state.js";

export interface ChartDatum {
    readonly label: string;
    readonly value: number;
}

export interface ChartProps {
    readonly variant: "bar" | "line" | "sparkline";
    readonly title: string;
    readonly description?: string;
    readonly data: readonly ChartDatum[];
    readonly valueLabel?: string;
    readonly height?: number;
    readonly className?: string;
}

const AXIS_WIDTH = 480;

function formatTick(value: number): string {
    if (Math.abs(value) >= 1000) {
        return new Intl.NumberFormat("en", {
            notation: "compact",
            maximumFractionDigits: 1,
        }).format(value);
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function truncateLabel(label: string, maxLength: number): string {
    return label.length > maxLength ? `${label.slice(0, Math.max(maxLength - 1, 1))}…` : label;
}

export function Chart({
    variant,
    title,
    description,
    data,
    valueLabel = "Value",
    height,
    className,
}: ChartProps): ReactNode {
    const titleId = useId();
    const descriptionId = useId();

    if (data.length === 0) {
        return (
            <EmptyState
                title="No chart data"
                description="Provide at least one data point to display this chart."
                className={className ?? ""}
            />
        );
    }

    const maxValue = data.reduce((maximum, datum) => Math.max(maximum, datum.value), 0);
    const scaleMax = maxValue > 0 ? maxValue : 1;
    const isSparkline = variant === "sparkline";
    const chartHeight = height ?? (isSparkline ? 48 : 220);
    const padding = isSparkline
        ? { top: 4, right: 4, bottom: 4, left: 4 }
        : { top: 12, right: 12, bottom: 32, left: 52 };
    const plotWidth = AXIS_WIDTH - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;
    const baseline = padding.top + plotHeight;

    const xForIndex = (index: number): number => {
        if (data.length === 1) {
            return padding.left + plotWidth / 2;
        }
        return padding.left + (index / (data.length - 1)) * plotWidth;
    };

    const yForValue = (value: number): number =>
        padding.top + plotHeight - (Math.max(0, value) / scaleMax) * plotHeight;

    const barSlot = plotWidth / data.length;
    const barWidth = Math.max(barSlot * 0.6, 1);
    const linePoints = data
        .map((datum, index) => `${xForIndex(index)},${yForValue(datum.value)}`)
        .join(" ");
    const ticks = [0, scaleMax / 2, scaleMax];

    return (
        <figure className={cn("flex flex-col gap-2", className)} data-slot="chart">
            <figcaption className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-ink">{title}</span>
                {description === undefined ? null : (
                    <span className="text-xs text-ink-muted">{description}</span>
                )}
            </figcaption>
            <svg
                role="img"
                aria-labelledby={`${titleId} ${descriptionId}`}
                viewBox={`0 0 ${AXIS_WIDTH} ${chartHeight}`}
                className="h-auto w-full"
                preserveAspectRatio="xMidYMid meet"
            >
                <title id={titleId}>{title}</title>
                <desc id={descriptionId}>
                    {description ?? `${variant} chart of ${valueLabel.toLowerCase()}.`}
                </desc>

                {isSparkline ? null : (
                    <g className="text-line">
                        {ticks.map((tick) => {
                            const y = yForValue(tick);
                            return (
                                <g key={tick}>
                                    <line
                                        x1={padding.left}
                                        x2={AXIS_WIDTH - padding.right}
                                        y1={y}
                                        y2={y}
                                        stroke="currentColor"
                                        strokeWidth={1}
                                    />
                                    <text
                                        x={padding.left - 6}
                                        y={y + 3}
                                        textAnchor="end"
                                        fontSize={9}
                                        fill="currentColor"
                                        className="text-ink-subtle"
                                    >
                                        {formatTick(tick)}
                                    </text>
                                </g>
                            );
                        })}
                        {valueLabel.length > 0 ? (
                            <text
                                x={12}
                                y={padding.top + plotHeight / 2}
                                textAnchor="middle"
                                fontSize={9}
                                fill="currentColor"
                                transform={`rotate(-90 12 ${padding.top + plotHeight / 2})`}
                                className="text-ink-subtle"
                            >
                                {valueLabel}
                            </text>
                        ) : null}
                    </g>
                )}

                {variant === "bar" ? (
                    <g className="text-primary">
                        {data.map((datum, index) => {
                            const x = padding.left + index * barSlot + (barSlot - barWidth) / 2;
                            const y = yForValue(datum.value);
                            return (
                                <rect
                                    key={datum.label}
                                    x={x}
                                    y={y}
                                    width={barWidth}
                                    height={Math.max(baseline - y, 0)}
                                    fill="currentColor"
                                />
                            );
                        })}
                    </g>
                ) : (
                    <g className="text-primary">
                        {data.length > 1 ? (
                            <polyline
                                points={linePoints}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        ) : null}
                        {data.map((datum, index) => (
                            <circle
                                key={datum.label}
                                cx={xForIndex(index)}
                                cy={yForValue(datum.value)}
                                r={isSparkline ? 1.5 : 2.5}
                                fill="currentColor"
                            />
                        ))}
                    </g>
                )}

                {isSparkline
                    ? null
                    : data.map((datum, index) => (
                          <text
                              key={`label-${datum.label}`}
                              x={
                                  variant === "bar"
                                      ? padding.left + index * barSlot + barSlot / 2
                                      : xForIndex(index)
                              }
                              y={chartHeight - 10}
                              textAnchor={
                                  variant === "line"
                                      ? index === 0
                                          ? "start"
                                          : index === data.length - 1
                                            ? "end"
                                            : "middle"
                                      : "middle"
                              }
                              fontSize={9}
                              fill="currentColor"
                              className="text-ink-subtle"
                          >
                              {truncateLabel(datum.label, 12)}
                          </text>
                      ))}
            </svg>
            <table className="sr-only">
                <caption>{title}</caption>
                <thead>
                    <tr>
                        <th scope="col">Label</th>
                        <th scope="col">{valueLabel}</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((datum) => (
                        <tr key={`table-${datum.label}`}>
                            <th scope="row">{datum.label}</th>
                            <td>{datum.value}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </figure>
    );
}
