import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"

import "./Preview.css"

export const Preview = React.memo(function (
  props: React.SVGAttributes<SVGElement> & {
    active?: boolean
    noHover?: boolean
  }
) {
  return (
    <svg
      {...props}
      viewBox="0 0 16 16"
      className={TokenList.join([
        "icon-preview",
        props.active && "active",
        props.noHover && "no-hover",
        props.className,
      ])}
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M4.52456 3.78094C3.30426 4.73453 2.32749 5.88581 1.7463 6.64891L1.74297 6.65328L1.74296 6.65327C1.66679 6.75189 1.625 6.87388 1.625 7C1.625 7.12612 1.66679 7.24811 1.74296 7.34673L1.74632 7.35108L1.7463 7.35109C2.32749 8.11419 3.30426 9.26547 4.52456 10.2191C5.7542 11.18 7.14732 11.875 8.57776 11.875C10.0082 11.875 11.4013 11.18 12.631 10.2191C13.8512 9.26552 14.8279 8.11431 15.4091 7.3512C15.5705 7.13927 15.571 6.86171 15.4087 6.64829C14.8275 5.88519 13.8509 4.73427 12.631 3.78094C11.4013 2.82004 10.0082 2.125 8.57776 2.125C7.14732 2.125 5.7542 2.82004 4.52456 3.78094ZM16.056 6.15633L16.702 5.66434C16.0771 4.84388 15.0041 3.5731 13.6315 2.50052C12.2683 1.43524 10.5256 0.5 8.57776 0.5C6.62996 0.5 4.88719 1.43524 3.52398 2.50052C2.15253 3.57223 1.08013 4.84184 0.455047 5.66236C0.159802 6.04571 0 6.51626 0 7C0 7.48373 0.159793 7.95426 0.45502 8.33761C1.0801 9.15813 2.15251 10.4278 3.52398 11.4995C4.88719 12.5648 6.62996 13.5 8.57776 13.5C10.5256 13.5 12.2683 12.5648 13.6315 11.4995C15.0041 10.4269 16.0771 9.15612 16.702 8.33566L16.7021 8.33555C17.3065 7.5416 17.306 6.45904 16.7024 5.66496L16.056 6.15633Z"
      />
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M8.57813 4.96875C7.4663 4.96875 6.56097 5.87595 6.56097 7C6.56097 8.12405 7.4663 9.03125 8.57813 9.03125C9.68996 9.03125 10.5953 8.12405 10.5953 7C10.5953 5.87595 9.68996 4.96875 8.57813 4.96875ZM5.74847 7C5.74847 5.43166 7.01314 4.15625 8.57813 4.15625C10.1431 4.15625 11.4078 5.43166 11.4078 7C11.4078 8.56834 10.1431 9.84375 8.57813 9.84375C7.01314 9.84375 5.74847 8.56834 5.74847 7Z"
      />
    </svg>
  )
})