import { useLayoutEffect, useState } from "react"

export function useCardsPerWindowWidth(options: {
  cardWidth: number
  cardMargin: number
  containerMargin: number
}) {
  const { cardWidth, cardMargin, containerMargin } = options
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)

  useLayoutEffect(() => {
    const updateSize = () => {
      setWindowWidth(window.innerWidth)
    }
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  return Math.max(
    1,
    Math.floor(
      (windowWidth - containerMargin * 2 - cardMargin) /
        (cardWidth + cardMargin)
    )
  )
}
