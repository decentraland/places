import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"

import "./Thumb.css"

export type ThumbDownProps = React.SVGAttributes<SVGElement> & {
  active?: boolean
  nohover?: boolean
}

export const ThumbDown = React.memo(function ({
  active,
  nohover,
  ...props
}: ThumbDownProps) {
  return (
    <svg
      {...props}
      className={TokenList.join([
        "icon-thumb",
        active && "active",
        nohover && "no-hover",
        props.className,
      ])}
    >
      <path
        className="path"
        d="M12.99 10.765L12.99 4.755C12.99 4.39 12.845 4.04 12.59 3.78C12.33 3.525 11.98 3.38 11.62 3.38L5.53 3.38C5.21 3.38 4.905 3.475 4.645 3.65C4.38 3.825 4.175 4.075 4.06 4.365L2.125 8.95C2.025 9.17 1.975 9.405 1.97 9.645C1.97 9.645 1.74 11.675 2.57 11.675L7.695 11.675C7.71 11.675 7.72 11.68 7.735 11.685C7.75 11.69 7.76 11.7 7.77 11.71C7.78 11.72 7.785 11.735 7.79 11.75C7.79 11.76 7.795 11.775 7.79 11.79C7.79 11.79 7.035 14.635 7.035 14.96C7.035 15.29 7.77 16.565 8.1 16.355L12.51 11.925C12.665 11.775 12.785 11.595 12.87 11.395C12.95 11.195 12.995 10.98 12.99 10.765Z"
        strokeWidth="1.56522"
      />
      <rect
        height="7.72555"
        rx="0.678049"
        strokeWidth="1.56522"
        transform="rotate(-180 17.3916 11.1055)"
        width="4.4146"
        x={!active ? "17.39" : "16.69"}
        y="11.1055"
      />
    </svg>
  )
})
