import React from "react"

type CloseProps = React.SVGAttributes<SVGElement> & {
  type?: "primary" | "secondary" | "filled"
}

export const Close = React.memo(
  ({ type = "primary", ...props }: CloseProps) => {
    return (
      <>
        {type === "primary" && (
          <svg viewBox="0 0 25 24" fill="none" {...props}>
            <g id="CloseFilled">
              <path
                id="Vector"
                d="M19.791 6.41L18.381 5L12.791 10.59L7.20102 5L5.79102 6.41L11.381 12L5.79102 17.59L7.20102 19L12.791 13.41L18.381 19L19.791 17.59L14.201 12L19.791 6.41Z"
                fill="#FCFCFC"
              />
            </g>
          </svg>
        )}
        {type === "secondary" && (
          <svg viewBox="0 0 24 24" fill="none" {...props}>
            <g id="CloseFilled">
              <path
                id="Vector"
                d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
                fill="black"
                fillOpacity="0.56"
              />
            </g>
          </svg>
        )}
        {type === "filled" && (
          <svg viewBox="0 0 32 32" fill="none" {...props}>
            <circle opacity="0.5" cx="16" cy="16" r="16" fill="#161518" />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M23.7661 9.93531C24.1569 9.54497 24.1573 8.91175 23.7669 8.52103L23.4874 8.24129C23.0971 7.85062 22.464 7.85031 22.0733 8.24061L16.0015 14.3057L9.93615 8.23474C9.54584 7.84406 8.91273 7.84376 8.522 8.23405L8.24222 8.51352C7.85145 8.90387 7.85111 9.53708 8.24147 9.9278L14.3067 15.9986L8.23503 22.0636C7.84426 22.4539 7.84392 23.0871 8.23428 23.4779L8.51377 23.7576C8.90408 24.1483 9.53719 24.1486 9.92792 23.7583L15.9997 17.6932L22.065 23.7642C22.4553 24.1548 23.0885 24.1551 23.4792 23.7648L23.759 23.4854C24.1497 23.095 24.1501 22.4618 23.7597 22.0711L17.6945 16.0003L23.7661 9.93531Z"
              fill="white"
            />
          </svg>
        )}
      </>
    )
  }
)
