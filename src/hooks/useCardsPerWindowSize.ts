import { useLayoutEffect, useState } from "react"

export function useCardsPerWindowSize(options: {
  cardWidth: number
  cardMargin: number
  containerMargin: number
}) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  useLayoutEffect(() => {
    function updateSize() {
      setWindowWidth(window.innerWidth)
    }
    window.addEventListener("resize", updateSize)
    updateSize()
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  const { cardWidth, cardMargin, containerMargin } = options

  const cardsPerRow = Math.floor(
    (windowWidth - containerMargin * 2 - cardMargin) / (cardWidth + cardMargin)
  )
  return cardsPerRow
}
