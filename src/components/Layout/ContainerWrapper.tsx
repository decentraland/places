import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"

import "./ContainerWrapper.css"

export default React.memo(function ContainerWrapper(
  props: React.HTMLAttributes<HTMLDivElement>
) {
  return (
    <div
      {...props}
      className={TokenList.join(["ui container-wrapper", props.className])}
    />
  )
})
