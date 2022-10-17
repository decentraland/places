import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"

import "./ThumbDown.css"

export const ThumbDown = React.memo(function (
  props: React.SVGAttributes<SVGElement> & { active?: boolean }
) {
  return (
    <svg
      {...props}
      viewBox="2 1 20 20"
      className={TokenList.join([
        "icon-thumb-down",
        props.active && "active",
        props.className,
      ])}
    >
      <path d="M16.93,13.13V5.45A1.74,1.74,0,0,0,15.18,3.7H7.4A2.05,2.05,0,0,0,6.27,4,1.94,1.94,0,0,0,5.52,5L3.05,10.81a2.27,2.27,0,0,0-.2.89s-.29,2.59.77,2.59h6.54l.06,0s0,0,0,0l0,.05v0s-1,3.63-1,4,.94,2.06,1.36,1.78l5.64-5.65a2.21,2.21,0,0,0,.46-.68A2,2,0,0,0,16.93,13.13Z" />
      <rect
        x={!props.active ? "17.22" : "17.92"}
        y="3.78"
        width="3.22"
        height="10.07"
        rx="0.87"
      />
    </svg>
  )
})
