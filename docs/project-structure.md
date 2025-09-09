# Project Structure

You can find a full documentation about the project's structure in the [`decentraland-gatsby` repository](https://github.com/decentraland/decentraland-gatsby#project-structure).

## Back and Front Ends

This project runs gatsby as front-end and a nodejs server as back-end both connected through a proxy:

- **Locally**: This proxy is defined in [`gatsby-config.js` (`proxy` prop)](https://www.gatsbyjs.com/docs/api-proxy/#gatsby-skip-here)
- **At servers**: This proxy is defined in `Pulumi.ts` (`servicePaths` prop)

## Routes

**Front-end** routes are defined using [gatsby routes](https://www.gatsbyjs.com/docs/reference/routing/creating-routes/#define-routes-in-srcpages) + [gatsby-plugin-intl](https://www.gatsbyjs.com/plugins/gatsby-plugin-intl/?=gatsby-plugin-intl), you can find each page in the `src/pages` directory.

**Back-end** routes are defined using `express` you can find each route in `src/entities/{Entity}/routes.ts` and those are imported at `src/server.ts`.
