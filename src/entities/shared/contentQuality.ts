import {
  SQL,
  SQLStatement,
} from "decentraland-gatsby/dist/entities/Database/utils"

import {
  MAP_FALLBACK_IMAGE_PATH,
  PLACEHOLDER_TITLES,
  WORLD_DEFAULT_THUMBNAIL_HASH,
  unwantedThumbnailHash,
} from "../Place/types"

/**
 * LIKE patterns for every image value produced by a fallback rather than by the scene: the Genesis
 * City map render (matched by its path, since its host is environment-dependent) and the placeholder
 * thumbnails, whose content hash can appear behind any content-server host.
 */
const PLACEHOLDER_IMAGE_PATTERNS = [
  `%${MAP_FALLBACK_IMAGE_PATH}%`,
  ...[WORLD_DEFAULT_THUMBNAIL_HASH, ...unwantedThumbnailHash].map(
    (hash) => `%${hash}%`
  ),
]

/**
 * Rejects a title that uses "test" as a whole word, which is how throwaway scenes name themselves.
 *
 * `\m` and `\M` are the word-start and word-end constraints of PostgreSQL's regular expressions;
 * `\b` is a backspace there, not a boundary. Written with doubled backslashes because a lone `\m`
 * in a JavaScript string literal collapses to `m`.
 */
const TEST_WORD_TITLE_REGEX = "\\mtest\\M"

/**
 * Require a destination to carry information of its own: an image and a title that the deployment
 * pipeline did not fill in for it.
 *
 * Curation wins over the check. A highlighted destination was chosen by a human, so whatever its
 * columns look like it stays in the feed.
 *
 * Emitted as a leading `AND` so it can be appended to an open WHERE clause, and every value is
 * bound as a parameter.
 *
 * @param highlighted - the curation flag, qualified with the table alias
 * @param image - the image *as the query returns it*; for worlds that is the COALESCE over the
 *   world column and the latest place's, never the world column alone. Null, empty and blank are
 *   all rejected: none of them gives the feed anything to render.
 * @param title - the title column, qualified with the table alias. A null, empty or blank title is
 *   rejected too: the deployment pipeline substitutes "Untitled" when a scene ships none, so a
 *   stored blank means the row predates that or came in through another path, and either way it
 *   names nothing.
 */
export function buildContentQualityCondition(
  highlighted: SQLStatement,
  image: SQLStatement,
  title: SQLStatement
): SQLStatement {
  return SQL`
        AND (
          ${highlighted} IS TRUE
          OR (
            ${image} IS NOT NULL
            AND TRIM(${image}) <> ''
            AND NOT (${image} LIKE ANY (${PLACEHOLDER_IMAGE_PATTERNS}::text[]))
            AND TRIM(COALESCE(${title}, '')) <> ''
            AND ${title} !~* ${TEST_WORD_TITLE_REGEX}
            AND LOWER(TRIM(${title})) <> ALL (${PLACEHOLDER_TITLES}::text[])
          )
        )`
}
