import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"

import "./Thumb.css"

export type ThumbUpProps = React.SVGAttributes<SVGElement> & {
  active?: boolean
  nohover?: boolean
}

export const ThumbUp = React.memo(function ({
  active,
  nohover,
  ...props
}: ThumbUpProps) {
  return (
    <svg
      {...props}
      className={TokenList.join([
        "icon-thumb",
        nohover && "no-hover",
        active && "active",
        props.className,
      ])}
    >
      <path
        className="path"
        d="M5.785 8.27V14.285C5.785 14.65 5.93 15 6.19 15.255C6.445 15.515 6.795 15.66 7.16 15.66H13.25C13.565 15.66 13.875 15.565 14.135 15.39C14.4 15.215 14.6 14.965 14.72 14.67L16.655 10.09C16.755 9.87 16.805 9.635 16.81 9.395C16.81 9.395 17.04 7.365 16.21 7.365H11.085C11.07 7.365 11.055 7.36 11.045 7.355C11.03 7.35 11.02 7.34 11.01 7.33C11 7.315 10.995 7.305 10.99 7.29C10.985 7.275 10.985 7.26 10.99 7.245C10.99 7.245 11.745 4.405 11.745 4.075C11.745 3.745 11.01 2.47 10.68 2.685L6.27 7.11C6.115 7.26 5.99 7.44 5.91 7.64C5.825 7.84 5.785 8.055 5.785 8.27Z"
        stroke="black"
        strokeWidth="1.56522"
      />
      <rect
        className="rect"
        height="7.72555"
        rx="0.678049"
        stroke="black"
        strokeWidth="1.56522"
        width="3.86278"
        x={!active ? "1.93" : "1.23"}
        y="7.62695"
      />
    </svg>
  )
})

export const ThumbUpFilled = React.memo(function () {
  return (
    <svg
      fill="none"
      height="25"
      viewBox="0 0 25 25"
      width="25"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        className="path"
        d="M7.06 10.795V19.145C7.06 19.65 7.26 20.135 7.62 20.495C7.975 20.85 8.46 21.05 8.965 21.05H17.425C17.865 21.055 18.29 20.925 18.655 20.68C19.02 20.435 19.3 20.09 19.465 19.685L22.15 13.32C22.29 13.015 22.365 12.685 22.365 12.35C22.365 12.35 22.69 9.53 21.535 9.53H14.42C14.4 9.53 14.38 9.53 14.36 9.52C14.34 9.51 14.325 9.5 14.31 9.485C14.3 9.47 14.29 9.45 14.285 9.43C14.28 9.41 14.28 9.39 14.285 9.37C14.285 9.37 15.33 5.425 15.33 4.965C15.33 4.51 14.31 2.74 13.855 3.035L7.73 9.185C7.515 9.39 7.345 9.64 7.23 9.92C7.115 10.195 7.055 10.495 7.06 10.795Z"
        fill="#161518"
      />
      <rect
        className="rect"
        fill="#161518"
        height="10.9489"
        rx="0.866396"
        width="3.50365"
        x="2.48145"
        y="10.0107"
      />
    </svg>
  )
})
