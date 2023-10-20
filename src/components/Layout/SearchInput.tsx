import React, { useMemo } from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import debounce from "decentraland-gatsby/dist/utils/function/debounce"

import "./SearchInput.css"

export default function SearchInput({
  onChange,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange!(e)
  }

  const debouncedHandleChange = useMemo(
    () => debounce(handleChange, 350),
    [handleChange]
  )

  return (
    <input
      {...rest}
      placeholder={rest.placeholder || "Search..."}
      className={TokenList.join(["search__input", rest.className])}
      onChange={debouncedHandleChange}
    />
  )
}
