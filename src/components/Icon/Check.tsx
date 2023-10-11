import React from "react"

export type CheckIconProps = React.SVGAttributes<SVGElement>

export const Check = React.memo((props: CheckIconProps) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <g id="CheckFilled">
      <path
        id="Vector"
        d="M8.79499 15.875L4.62499 11.705L3.20499 13.115L8.79499 18.705L20.795 6.70504L19.385 5.29504L8.79499 15.875Z"
        fill="#FCFCFC"
      />
    </g>
  </svg>
))
