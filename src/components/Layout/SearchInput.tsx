import React, { useMemo } from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import debounce from "decentraland-gatsby/dist/utils/function/debounce"

import "./SearchInput.css"

export default function SearchInput(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  const { onChange, placeholder, className, ...propsRest } = props

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange!(e)
  }

  const debouncedHandleChange = useMemo(
    () => debounce(handleChange, 350),
    [handleChange]
  )

  return (
    <input
      {...propsRest}
      placeholder={placeholder || "Search..."}
      className={TokenList.join(["search__input", className])}
      onChange={debouncedHandleChange}
    />
  )
}
