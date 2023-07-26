import React, { useCallback, useMemo } from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import debounce from "decentraland-gatsby/dist/utils/function/debounce"

import "./SearchInput.css"

export default function SearchInput(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  const { onChange } = props

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      debounce(() => onChange!(e), 350)
    },
    [onChange]
  )

  return (
    <input
      {...props}
      placeholder={props.placeholder || "Search..."}
      className={TokenList.join(["search__input", props.className])}
      onChange={handleChange}
    />
  )
}
