// Pages Function for /api/missed-searches: POST counts one search that found no song.
import { handlePost } from '../../src/server/missed-searches';
import type { PopularityContext } from '../../src/server/popularity';

export const onRequestPost = (context: PopularityContext) => handlePost(context);
