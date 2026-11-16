import type { APIRoute } from 'astro';
import { SITE_URL } from '../site/config';
import { robotsTxt } from '../site/song-pages';

export const GET: APIRoute = () => new Response(robotsTxt(SITE_URL), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
