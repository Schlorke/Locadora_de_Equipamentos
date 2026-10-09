"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import type {
  Props as DefaultLegendContentProps,
  LegendPayload,
} from "recharts/types/component/DefaultLegendContent";
import type {
  NameType,
  Payload as TooltipPayload,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ChartConfig } from "../contract/chart";

export type { ChartConfig } from "../contract/chart";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const;

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<
      typeof RechartsPrimitive.ResponsiveContainer
    >["children"];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = React.useState<{
    width: number;
    height: number;
  } | null>(null);

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;

      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref],
  );

  React.useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) {
      setDimensions(null);
      return;
    }

    let frame = 0;
    let stabilityTimer: ReturnType<typeof setTimeout> | null = null;

    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      const isValid = width > 0 && height > 0;

      if (isValid) {
        // Aguarda estabilização antes de atualizar dimensões
        if (stabilityTimer) clearTimeout(stabilityTimer);
        stabilityTimer = setTimeout(() => {
          setDimensions({ width, height });
        }, 50);
      } else {
        // Se não é válido, limpa dimensões
        setDimensions(null);
      }
    };

    // Primeira medição com pequeno delay para garantir que o DOM esteja pronto
    const initialMeasure = setTimeout(measure, 10);

    if (typeof ResizeObserver === "undefined") {
      const onResize = () => {
        // Limpa dimensões durante resize
        setDimensions(null);
        cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(measure);
      };
      window.addEventListener("resize", onResize);
      return () => {
        setDimensions(null);
        if (stabilityTimer) clearTimeout(stabilityTimer);
        clearTimeout(initialMeasure);
        window.removeEventListener("resize", onResize);
        cancelAnimationFrame(frame);
      };
    }

    const observer = new ResizeObserver(() => {
      // Limpa dimensões durante resize
      setDimensions(null);
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    });
    observer.observe(element);

    return () => {
      setDimensions(null);
      if (stabilityTimer) clearTimeout(stabilityTimer);
      clearTimeout(initialMeasure);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={setRefs}
        className={cn(
          // token-check-allow: seletores Recharts originais com #ccc e #fff
          "flex aspect-video justify-center text-xs w-full [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-polar-grid_[stroke='#ccc']_.recharts-layer]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:[&_.recharts-surface]:",
          className,
        )}
        // token-check-allow: altura minima original do container do grafico
        style={{ minHeight: "200px" }}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        {dimensions ? (
          <RechartsPrimitive.ResponsiveContainer
            width={dimensions.width}
            height={dimensions.height}
          >
            {children}
          </RechartsPrimitive.ResponsiveContainer>
        ) : (
          <div aria-hidden className="h-full w-full min-h-[200px]" />
        )}
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "Chart";

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, item]) => item.theme || item.color,
  );

  if (!colorConfig.length) {
    return null;
  }

  // SEGURANÇA: CSS gerado estaticamente é seguro
  // O CSS é gerado internamente a partir de configuração tipada (ChartConfig)
  // Não há entrada do usuário sendo injetada no CSS
  // As cores vêm de props tipadas ou valores estáticos do tema
  const cssContent = Object.entries(THEMES)
    .map(
      ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .filter(Boolean)
  .join("\n")}
}
`,
    )
    .join("\n");

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: cssContent,
      }}
    />
  );
};

interface ChartTooltipContentProps extends React.ComponentProps<"div"> {
  active?: boolean;
  payload?: TooltipPayload<ValueType, NameType>[];
  label?: NameType;
  labelFormatter?: (
    _label: NameType,
    _payload: TooltipPayload<ValueType, NameType>[],
  ) => React.ReactNode;
  labelClassName?: string;
  formatter?: (
    _value: ValueType,
    _name: NameType,
    _payload: TooltipPayload<ValueType, NameType>,
  ) => React.ReactNode;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: "line" | "dot" | "dashed";
  nameKey?: string;
  labelKey?: string;
}

const ChartTooltip = RechartsPrimitive.Tooltip;

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  ChartTooltipContentProps
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref,
  ) => {
    const { config } = useChart();

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null;
      }

      const [item] = payload;
      const key = `${labelKey || item?.dataKey || item?.name || "value"}`;
      const itemConfig = getPayloadConfigFromPayload(config, item, key);
      const value =
        !labelKey && typeof label === "string"
          ? config[label as keyof typeof config]?.label || label
          : itemConfig?.label;

      if (labelFormatter) {
        return (
          <div className={cn("font-medium", labelClassName)}>
            {labelFormatter &&
              label &&
              payload &&
              labelFormatter(label, payload)}
          </div>
        );
      }

      if (!value) {
        return null;
      }

      return <div className={cn("font-medium", labelClassName)}>{value}</div>;
    }, [
      label,
      labelFormatter,
      payload,
      hideLabel,
      labelClassName,
      config,
      labelKey,
    ]);

    if (!active || !payload?.length) {
      return null;
    }

    const nestLabel = payload.length === 1 && indicator !== "dot";

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className,
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className="grid gap-1.5">
          {payload.map(
            (item: TooltipPayload<ValueType, NameType>, index: number) => {
              const key = `${nameKey || item.name || item.dataKey || "value"}`;
              const itemConfig = getPayloadConfigFromPayload(config, item, key);
              const indicatorColor = color || item.payload.fill || item.color;

              return (
                <div
                  key={String(item.dataKey) || index}
                  className={cn(
                    "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                    indicator === "dot" && "items-center",
                  )}
                >
                  {formatter && item?.value !== undefined && item.name ? (
                    formatter(item.value, item.name, item)
                  ) : (
                    <>
                      {itemConfig?.icon ? (
                        <itemConfig.icon />
                      ) : (
                        !hideIndicator && (
                          <div
                            className={cn(
                              "shrink-0 rounded-[2px] border-[var(--color-border)] bg-[var(--color-bg)]",
                              {
                                "h-2.5 w-2.5": indicator === "dot",
                                "w-1": indicator === "line",
                                "w-0 border-[1.5px] border-dashed bg-transparent":
                                  indicator === "dashed",
                                "my-0.5": nestLabel && indicator === "dashed",
                              },
                            )}
                            style={
                              {
                                "--color-bg": indicatorColor,
                                "--color-border": indicatorColor,
                              } as React.CSSProperties
                            }
                          />
                        )
                      )}
                      <div
                        className={cn(
                          "flex flex-1 justify-between leading-none",
                          nestLabel ? "items-end" : "items-center",
                        )}
                      >
                        <div className="grid gap-1.5">
                          {nestLabel ? tooltipLabel : null}
                          <span className="text-muted-foreground">
                            {itemConfig?.label || item.name}
                          </span>
                        </div>
                        {item.value && (
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            {item.value.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            },
          )}
        </div>
      </div>
    );
  },
);
ChartTooltipContent.displayName = "ChartTooltip";

const ChartLegend = RechartsPrimitive.Legend;

interface ChartLegendContentProps extends React.ComponentProps<"div"> {
  payload?: readonly LegendPayload[];
  verticalAlign?: DefaultLegendContentProps["verticalAlign"];
  hideIcon?: boolean;
  nameKey?: string;
}

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  ChartLegendContentProps
>(
  (
    { className, hideIcon = false, payload, verticalAlign = "bottom", nameKey },
    ref,
  ) => {
    const { config } = useChart();

    if (!payload?.length) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-4",
          verticalAlign === "top" ? "pb-3" : "pt-3",
          className,
        )}
      >
        {payload.map((item: LegendPayload) => {
          const key = `${nameKey || item.dataKey || "value"}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);

          return (
            <div
              key={item.value}
              className={cn(
                "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground",
              )}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label}
            </div>
          );
        })}
      </div>
    );
  },
);
ChartLegendContent.displayName = "ChartLegend";

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string,
) {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const payloadPayload =
    "payload" in payload &&
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? payload.payload
      : undefined;

  let configLabelKey: string = key;

  if (
    key in payload &&
    typeof payload[key as keyof typeof payload] === "string"
  ) {
    configLabelKey = payload[key as keyof typeof payload] as string;
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
  ) {
    configLabelKey = payloadPayload[
      key as keyof typeof payloadPayload
    ] as string;
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key as keyof typeof config];
}

export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
};
