// import { resolve } from "path";
import { variable } from "decentraland-gatsby-deploy/dist/pulumi/env"
import { buildGatsby } from "decentraland-gatsby-deploy/dist/recepies/buildGatsby"

export = async function main() {
  return {}
  // return buildGatsby({
  //   name: "places",
  //   usePublicTLD: process.env["USE_PUBLIC_TLD"] === "true",
  //   serviceImage: process.env["CI_REGISTRY_IMAGE"],
  //   serviceMemory: 1024,
  //   serviceEnvironment: [variable("NODE_ENV", "production")],
  //   servicePaths: ["/api/*"],
  //   useSecurityHeaders: true,
  // })
}
