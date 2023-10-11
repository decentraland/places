import React from "react"

type CloseProps = React.SVGAttributes<SVGElement> & {
  type?: "primary" | "secondary"
}

export const Close = React.memo(({ type = "primary", ...props }: CloseProps) =>
  type === "primary" ? (
    <svg viewBox="0 0 25 24" fill="none" {...props}>
      <g id="CloseFilled">
        <path
          id="Vector"
          d="M19.791 6.41L18.381 5L12.791 10.59L7.20102 5L5.79102 6.41L11.381 12L5.79102 17.59L7.20102 19L12.791 13.41L18.381 19L19.791 17.59L14.201 12L19.791 6.41Z"
          fill="#FCFCFC"
        />
      </g>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <g id="CloseFilled">
        <path
          id="Vector"
          d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
          fill="black"
          fill-opacity="0.56"
        />
      </g>
    </svg>
  )
)
