import type { APIRoute } from 'astro';
import { songLastModified } from '../site/last-modified';
import { SITE_URL } from '../site/config';
import { sitemapXml } from '../site/song-pages';
import { hubs, pages } from '../site/songs';

export const GET: APIRoute = () => new Response(sitemapXml(SITE_URL, pages.map(song => song.id), songLastModified(), hubs), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
