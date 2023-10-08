import React from "react"

type CloseProps = React.SVGAttributes<SVGElement> & {
  type?: "primary" | "secondary"
}

export const Close = React.memo(({ type = "primary", ...props }: CloseProps) =>
  type === "primary" ? (
    <svg {...props} viewBox="0 0 24 24" fill="none">
      <g id="Icn/CloseIcon">
        <g id="Vector">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M18.7009 4.82038C19.3666 5.48719 19.3661 6.56779 18.6998 7.23397L6.75072 19.1802C6.08438 19.8464 5.00453 19.8459 4.33881 19.1791C3.67308 18.5123 3.67359 17.4317 4.33993 16.7655L16.289 4.81926C16.9553 4.15307 18.0352 4.15357 18.7009 4.82038Z"
            fill="#FCFCFC"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M18.7009 19.1795C18.0352 19.8463 16.9553 19.8468 16.289 19.1806L4.33993 7.23441C3.67359 6.56822 3.67309 5.48762 4.33881 4.82082C5.00453 4.15401 6.08438 4.15351 6.75072 4.81969L18.6998 16.7659C19.3661 17.4321 19.3666 18.5127 18.7009 19.1795Z"
            fill="#FCFCFC"
          />
        </g>
      </g>
    </svg>
  ) : (
    <svg {...props} viewBox="0 0 24 24" fill="none">
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
