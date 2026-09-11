"use client";
import { useId, useState } from "react";
export function Court({
  onShot,
  shots = [],
}: {
  onShot?: (x: number, y: number) => void;
  shots?: { id: string; x: number; y: number; made: boolean; color: string }[];
}) {
  const key = useId().replaceAll(":", "");
  const [cursor, setCursor] = useState({ x: 7, y: 7.5 }),
    [keyboard, setKeyboard] = useState(false);
  return (
    <svg
      viewBox="0 0 28 15"
      className={"court " + (onShot ? "interactive" : "")}
      role={onShot ? "button" : "img"}
      tabIndex={onShot ? 0 : undefined}
      aria-label={
        onShot
          ? "Position du tir. Cliquez sur le terrain, ou utilisez les flèches puis Entrée."
          : "Carte des positions de tirs"
      }
      onBlur={() => setKeyboard(false)}
      onKeyDown={
        onShot
          ? (e) => {
              if (
                ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                  e.key,
                )
              ) {
                e.preventDefault();
                setKeyboard(true);
                setCursor((c) => ({
                  x: Math.max(
                    0,
                    Math.min(
                      28,
                      c.x +
                        (e.key === "ArrowRight"
                          ? 0.25
                          : e.key === "ArrowLeft"
                            ? -0.25
                            : 0),
                    ),
                  ),
                  y: Math.max(
                    0,
                    Math.min(
                      15,
                      c.y +
                        (e.key === "ArrowDown"
                          ? 0.25
                          : e.key === "ArrowUp"
                            ? -0.25
                            : 0),
                    ),
                  ),
                }));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                onShot(cursor.x, cursor.y);
              }
            }
          : undefined
      }
      onClick={
        onShot
          ? (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              onShot(
                Math.max(
                  0,
                  Math.min(28, ((e.clientX - r.left) / r.width) * 28),
                ),
                Math.max(
                  0,
                  Math.min(15, ((e.clientY - r.top) / r.height) * 15),
                ),
              );
            }
          : undefined
      }
    >
      <defs>
        <pattern
          id={key + "floor"}
          width="1.4"
          height="15"
          patternUnits="userSpaceOnUse"
        >
          <rect width="1.4" height="15" fill="#243d36" />
          <rect width=".7" height="15" fill="#274139" />
        </pattern>
        <linearGradient id={key + "wash"}>
          <stop stopColor="#76b7da" stopOpacity=".12" />
          <stop offset=".5" stopColor="#76b7da" stopOpacity="0" />
          <stop offset="1" stopColor="#ee9987" stopOpacity=".1" />
        </linearGradient>
      </defs>
      <rect width="28" height="15" rx=".2" fill={`url(#${key}floor)`} />
      <rect width="28" height="15" fill={`url(#${key}wash)`} />
      <g fill="none" stroke="#9bb5a6" strokeWidth=".055" opacity=".7">
        <rect x=".05" y=".05" width="27.9" height="14.9" />
        <path d="M14 .05V14.95" />
        <circle cx="14" cy="7.5" r="1.8" />
        {[false, true].map((flip) => (
          <g
            key={String(flip)}
            transform={flip ? "translate(28 0) scale(-1 1)" : undefined}
          >
            <path d="M.05 5.05H5.8V9.95H.05" />
            <path d="M5.8 5.7A1.8 1.8 0 0 1 5.8 9.3" />
            <path strokeDasharray=".18 .2" d="M5.8 5.7A1.8 1.8 0 0 0 5.8 9.3" />
            <path d="M.05 .9H2.99A6.75 6.75 0 0 1 2.99 14.1H.05" />
            <path d="M1.575 6.25A1.25 1.25 0 0 1 1.575 8.75" />
            <path d="M.05 6.25H1.2V8.75H.05" />
          </g>
        ))}
      </g>
      <g fill="none" stroke="#e1e9dd" strokeWidth=".085">
        <path d="M1.2 6.6V8.4 M26.8 6.6V8.4" />
        <circle cx="1.575" cy="7.5" r=".225" />
        <circle cx="26.425" cy="7.5" r=".225" />
      </g>
      <text
        x="14"
        y="7.65"
        textAnchor="middle"
        fill="#a7beae"
        opacity=".3"
        fontSize=".6"
        fontWeight="800"
        letterSpacing=".02"
      >
        eM
      </text>
      {keyboard && (
        <g
          transform={`translate(${cursor.x},${cursor.y})`}
          stroke="#d0ed81"
          strokeWidth=".08"
        >
          <circle r=".35" fill="none" />
          <path d="M-.6 0H.6M0 -.6V.6" />
        </g>
      )}
      {shots.map((s) => (
        <g key={s.id} transform={`translate(${s.x},${s.y})`}>
          <circle
            r=".26"
            fill={s.made ? s.color : "#20342c"}
            stroke="#edf1ed"
            strokeWidth=".06"
          />
          {!s.made && (
            <path
              d="M-.12 -.12L.12 .12M.12 -.12L-.12 .12"
              stroke={s.color}
              strokeWidth=".06"
            />
          )}
        </g>
      ))}
    </svg>
  );
}
