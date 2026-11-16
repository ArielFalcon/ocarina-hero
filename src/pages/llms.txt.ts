import type { APIRoute } from 'astro';
import { SITE_URL } from '../site/config';
import { llmsTxt } from '../site/song-pages';
import { groups, hubs } from '../site/songs';

export const GET: APIRoute = () => new Response(llmsTxt(SITE_URL, groups, hubs), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
