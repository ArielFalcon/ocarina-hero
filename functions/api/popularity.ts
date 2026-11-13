// Pages Function for /api/popularity: GET returns the most popular songs, POST records one play.
import { handleGet, handlePost, type PopularityContext } from '../../src/server/popularity';

export const onRequestGet = (context: PopularityContext) => handleGet(context);
export const onRequestPost = (context: PopularityContext) => handlePost(context);
