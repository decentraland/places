import { forTerminal } from "./scriptTerminalText"

describe("when printing deployment-authored text in a script report", () => {
  describe("and the text is ordinary", () => {
    it("should print it unchanged", () => {
      expect(forTerminal("My Cool Scene")).toBe("My Cool Scene")
    })
  })

  describe("and the text carries a colour sequence", () => {
    it("should drop it, so a title cannot recolour the report around it", () => {
      expect(forTerminal("\u001b[31mDanger\u001b[0m")).toBe("Danger")
    })
  })

  describe("and the text moves the cursor back over lines already printed", () => {
    it("should drop the movement and the erase", () => {
      expect(forTerminal("\u001b[2A\u001b[2KOverwritten")).toBe("Overwritten")
    })
  })

  describe("and the text retitles the terminal window", () => {
    it("should take the introducer with it, leaving the rest as plain text", () => {
      expect(forTerminal("\u001b]0;pwned\u0007Scene")).toBe(
        "0;pwned\ufffdScene"
      )
    })

    it("should replace the introducer even with nothing stripping the pair, since that is what makes this safe", () => {
      // CONTROL alone would leave "\ufffd0;pwned\ufffdScene": inert, just less readable
      expect(forTerminal("\u001b]0;pwned\u0007Scene")).not.toContain("\u001b")
    })
  })

  describe("and the text contains a newline", () => {
    it("should not let it forge a summary line the script never emitted", () => {
      expect(forTerminal("Scene\nErrored worlds:       0")).toBe(
        "Scene\ufffdErrored worlds:       0"
      )
    })
  })

  describe("and the text contains a carriage return", () => {
    it("should not let it rewrite the start of the line", () => {
      expect(forTerminal("Scene\rall good")).toBe("Scene\ufffdall good")
    })
  })

  describe("and two titles differ only by a control character", () => {
    it("should keep them distinguishable rather than collapse them into one", () => {
      expect(forTerminal("a\u0007b")).not.toBe(forTerminal("ab"))
    })
  })

  describe("and the text is longer than a log line should be", () => {
    it("should truncate it", () => {
      expect(forTerminal("x".repeat(500))).toBe(`${"x".repeat(120)}\u2026`)
    })
  })

  describe("and there is no text at all", () => {
    it("should say so rather than print the word null", () => {
      expect(forTerminal(null)).toBe("(none)")
    })
  })
})
