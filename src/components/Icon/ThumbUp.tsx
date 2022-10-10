import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"

import "./ThumbUp.css"

export const ThumbUp = React.memo(function (
  props: React.SVGAttributes<SVGElement> & { active: boolean }
) {
  return (
    <svg
      {...props}
      viewBox="2 1 20 20"
      className={TokenList.join([
        "icon-thumb-up",
        props.active && "active",
        props.className,
      ])}
    >
      <path d="M7.05,10.84v7.68a1.72,1.72,0,0,0,.51,1.24,1.75,1.75,0,0,0,1.24.52h7.78A2.06,2.06,0,0,0,18.46,19l2.47-5.86a2.27,2.27,0,0,0,.2-.89s.29-2.59-.77-2.59h-6.6l0,0,0,0V9.53s1-3.63,1-4S13.72,3.43,13.3,3.7L7.66,9.36A2,2,0,0,0,7.2,10,2,2,0,0,0,7.05,10.84Z" />
      <rect
        x={!props.active ? "3.53" : "2.83"}
        y="10.12"
        width="3.22"
        height="10.07"
        rx="0.87"
      />
    </svg>
  )
})
