import { parseContentServerUrl, parseScriptArgs } from "./scriptArgs"

describe("when parsing the arguments of a destructive world script", () => {
  describe("and no argument is given", () => {
    it("should preview rather than write, so a bare invocation cannot change production", () => {
      expect(parseScriptArgs([])).toEqual({
        dryRun: true,
        limit: null,
        worldName: null,
        connectionString: null,
      })
    })
  })

  describe("and --apply is given", () => {
    it("should commit", () => {
      expect(parseScriptArgs(["--apply"]).dryRun).toBe(false)
    })
  })

  describe("and --dry-run is given", () => {
    it("should preview, which is what it already asked for", () => {
      expect(parseScriptArgs(["--dry-run"]).dryRun).toBe(true)
    })
  })

  describe("and both --apply and --dry-run are given", () => {
    it("should refuse rather than pick one of two stated intentions", () => {
      expect(() => parseScriptArgs(["--apply", "--dry-run"])).toThrow(
        "contradict each other"
      )
    })
  })

  describe("and a flag is misspelled", () => {
    it("should refuse, since --dryrun would otherwise read as no flag at all", () => {
      expect(() => parseScriptArgs(["--dryrun"])).toThrow(
        "Unrecognized option: --dryrun"
      )
    })
  })

  describe("and a bare world name is given without its flag", () => {
    it("should refuse, since --apply myworld.dcl.eth reads as scoped but would run against every world", () => {
      expect(() => parseScriptArgs(["--apply", "myworld.dcl.eth"])).toThrow(
        "Unexpected argument: myworld.dcl.eth"
      )
    })
  })

  describe("and a stray token follows a flag that already took its value", () => {
    it("should refuse rather than ignore it", () => {
      expect(() =>
        parseScriptArgs(["--limit", "5", "myworld.dcl.eth"])
      ).toThrow("Unexpected argument: myworld.dcl.eth")
    })
  })

  describe("and the same flag is given twice", () => {
    it("should refuse rather than silently honour one of them", () => {
      expect(() =>
        parseScriptArgs([
          "--world-name",
          "a.dcl.eth",
          "--world-name",
          "b.dcl.eth",
        ])
      ).toThrow("--world-name was given more than once")
    })
  })

  describe("and a value happens to look like a world name", () => {
    it("should still take it as that flag's value", () => {
      expect(
        parseScriptArgs(["--world-name", "myworld.dcl.eth"]).worldName
      ).toBe("myworld.dcl.eth")
    })
  })

  describe("and --limit carries trailing characters", () => {
    it("should refuse rather than read the digits it happens to start with", () => {
      expect(() => parseScriptArgs(["--limit", "10abc"])).toThrow(
        "--limit requires a positive whole number"
      )
    })
  })

  describe("and --limit is given in exponent notation", () => {
    it("should refuse, since parseInt would read 1e9 as 1", () => {
      expect(() => parseScriptArgs(["--limit", "1e9"])).toThrow(
        "--limit requires a positive whole number"
      )
    })
  })

  describe("and --limit is zero", () => {
    it("should refuse, since a limit of nothing is not a limit", () => {
      expect(() => parseScriptArgs(["--limit", "0"])).toThrow(
        "--limit requires a positive whole number"
      )
    })
  })

  describe("and --limit is a whole number", () => {
    it("should take it", () => {
      expect(parseScriptArgs(["--limit", "5"]).limit).toBe(5)
    })
  })

  describe("and a flag expecting a value is followed by another flag", () => {
    it("should refuse rather than filter for a world named after that flag", () => {
      expect(() => parseScriptArgs(["--world-name", "--apply"])).toThrow(
        "--world-name requires a value"
      )
    })
  })

  describe("and a flag expecting a value ends the arguments", () => {
    it("should refuse rather than treat it as absent", () => {
      expect(() => parseScriptArgs(["--limit"])).toThrow(
        "--limit requires a value"
      )
    })
  })
})

describe("when reading the configured content server URL", () => {
  describe("and it is a plain https URL", () => {
    it("should take it", () => {
      expect(
        parseContentServerUrl("https://worlds-content-server.decentraland.org")
      ).toBe("https://worlds-content-server.decentraland.org")
    })
  })

  describe("and it has a trailing slash", () => {
    it("should strip it, since every path is appended to it", () => {
      expect(
        parseContentServerUrl(
          "https://worlds-content-server.decentraland.zone/"
        )
      ).toBe("https://worlds-content-server.decentraland.zone")
    })
  })

  describe("and it carries a second scheme", () => {
    it("should refuse, rather than resolve a host called http once per world", () => {
      expect(() =>
        parseContentServerUrl(
          "https://http://worlds-content-server.decentraland.zone"
        )
      ).toThrow("resolves to host 'http'")
    })
  })

  describe("and it has no scheme at all", () => {
    it("should refuse", () => {
      expect(() =>
        parseContentServerUrl("worlds-content-server.decentraland.zone")
      ).toThrow("is not a URL")
    })
  })

  describe("and it points somewhere that is not http", () => {
    it("should refuse", () => {
      expect(() => parseContentServerUrl("file:///etc/passwd")).toThrow(
        "only http and https"
      )
    })
  })

  describe("and it is a local stub", () => {
    it("should allow it, since that is how these scripts are rehearsed", () => {
      expect(parseContentServerUrl("http://localhost:4597")).toBe(
        "http://localhost:4597"
      )
    })
  })
})
