import type { APIRoute } from 'astro';
import { themeInitScript } from '../ui/platforms';

export const GET: APIRoute = () => new Response(themeInitScript(), { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } });
