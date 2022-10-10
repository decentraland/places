import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"

import "./Heart.css"

export const Heart = React.memo(function (
  props: React.SVGAttributes<SVGElement> & { active: boolean }
) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      className={TokenList.join([
        "icon-heart",
        props.active && "active",
        props.className,
      ])}
    >
      <path d="M16.89,2.73a6,6,0,0,0-2.58.55,6.63,6.63,0,0,0-1.13.65,5.93,5.93,0,0,0-1,.93,6.33,6.33,0,0,0-1-.93A6.63,6.63,0,0,0,10,3.28a6.06,6.06,0,0,0-2.59-.55,5.54,5.54,0,0,0-2.2.4A5.74,5.74,0,0,0,2.11,6.25a5.87,5.87,0,0,0-.44,2.23c0,4.66,4.46,8.36,8.17,11.43l1.09.91a1.93,1.93,0,0,0,2.48,0l1-.83c3.73-3.08,8.26-6.83,8.26-11.52a5.87,5.87,0,0,0-.44-2.23A5.81,5.81,0,0,0,21,4.37,5.87,5.87,0,0,0,19.1,3.13,5.55,5.55,0,0,0,16.89,2.73Z" />
    </svg>
  )
})
