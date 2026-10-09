"use client";

import { type FC, useEffect, useRef, useState } from "react";
import type { GridMotionProps } from "../contract/grid-motion";

const GridMotion: FC<GridMotionProps> = ({
  items = [],
  gradientColor = "black" /* token-check-allow: gradiente radial original do grid-motion */,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mouseXRef = useRef<number>(
    typeof window !== "undefined" ? window.innerWidth / 2 : 0,
  );
  const totalItems = 28;
  const defaultItems = Array.from(
    { length: totalItems },
    (_, index) => `Item ${index + 1}`,
  );
  const combinedItems =
    items.length > 0 ? items.slice(0, totalItems) : defaultItems;

  const [gsapLoaded, setGsapLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let isMounted = true;
    let idleCallbackId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const loadGsap = async () => {
      try {
        const loadWhenIdle = () => {
          if (!isMounted) return;

          import("gsap")
            .then((_gsap) => {
              if (!isMounted) return;
              setGsapLoaded(true);
            })
            .catch((error) => {
              console.error("Erro ao carregar GSAP:", error);
            });
        };

        if ("requestIdleCallback" in window) {
          idleCallbackId = requestIdleCallback(loadWhenIdle, { timeout: 1000 });
        } else {
          timeoutId = setTimeout(loadWhenIdle, 100);
        }
      } catch (error) {
        console.error("Erro ao carregar GSAP:", error);
      }
    };

    void loadGsap();

    return () => {
      isMounted = false;
      if (idleCallbackId !== null && "cancelIdleCallback" in window) {
        cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    if (!gsapLoaded || typeof window === "undefined") return;

    let isMounted = true;
    let handleMouseMove: ((_e: MouseEvent) => void) | null = null;
    let removeAnimationLoop: (() => void) | null = null;

    import("gsap")
      .then(({ gsap }) => {
        if (!isMounted) return;

        gsap.ticker.lagSmoothing(0);

        handleMouseMove = (_e: MouseEvent): void => {
          mouseXRef.current = _e.clientX;
        };

        const updateMotion = (): void => {
          if (!isMounted) return;

          const maxMoveAmount = 300;
          const baseDuration = 0.8;
          const inertiaFactors = [0.6, 0.4, 0.3, 0.2];

          rowRefs.current.forEach((row, index) => {
            if (row && isMounted) {
              const direction = index % 2 === 0 ? 1 : -1;
              const moveAmount =
                ((mouseXRef.current / window.innerWidth) * maxMoveAmount -
                  maxMoveAmount / 2) *
                direction;

              gsap.to(row, {
                x: moveAmount,
                duration:
                  baseDuration +
                  (inertiaFactors[index % inertiaFactors.length] ?? 0.2),
                ease: "power3.out",
                overwrite: "auto",
              });
            }
          });
        };

        if (!isMounted) return;

        removeAnimationLoop = gsap.ticker.add(updateMotion);
        if (handleMouseMove) {
          window.addEventListener("mousemove", handleMouseMove);
        }
      })
      .catch((error) => {
        console.error("Erro ao carregar GSAP:", error);
      });

    return () => {
      isMounted = false;

      if (handleMouseMove) {
        window.removeEventListener("mousemove", handleMouseMove);
      }
      if (removeAnimationLoop) {
        removeAnimationLoop();
      }
    };
  }, [gsapLoaded]);

  return (
    <div ref={gridRef} className="h-full w-full overflow-hidden">
      <section
        className="relative flex h-screen w-full items-center justify-center overflow-hidden"
        style={{
          background: `radial-gradient(circle, ${gradientColor} 0%, transparent 100%)`,
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-[4] bg-[length:250px]"></div>
        <div className="relative z-[2] grid h-full w-full origin-center grid-cols-1 grid-rows-4 gap-4 flex-none">
          {Array.from({ length: 4 }, (_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid grid-cols-7 gap-4"
              style={{ willChange: "transform, filter" }}
              ref={(el) => {
                if (el) rowRefs.current[rowIndex] = el;
              }}
            >
              {Array.from({ length: 7 }, (_, itemIndex) => {
                const content = combinedItems[rowIndex * 7 + itemIndex];
                return (
                  <div key={itemIndex} className="relative">
                    <div
                      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[10px] bg-[#111] text-[1.5rem] text-white" /* token-check-allow: celula escura original do grid-motion */
                    >
                      {typeof content === "string" &&
                      content.startsWith("http") ? (
                        <div
                          className="absolute left-0 top-0 h-full w-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${content})` }}
                        ></div>
                      ) : (
                        <div className="z-[1] p-4 text-center">{content}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="pointer-events-none relative left-0 top-0 h-full w-full"></div>
      </section>
    </div>
  );
};

export { GridMotion };
export default GridMotion;
