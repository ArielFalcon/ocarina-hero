import type { APIRoute } from 'astro';
import { pages } from '../site/songs';

/** The popularity Function only scores songs listed here. */
export const GET: APIRoute = () => new Response(JSON.stringify(pages.map(song => song.id)), { headers: { 'Content-Type': 'application/json' } });
