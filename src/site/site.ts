/** Path of a public file under the deployment base (`BASE_PATH`), which ends with a slash. */
export function assetUrl(path: string): string {
  return import.meta.env.BASE_URL + path;
}

export const SITE_NAME = 'Ocarina Hero';

export const HOME_DESCRIPTION = 'Play over 200 songs on the Zelda ocarina: button tabs for the ocarina of Ocarina of Time, from game, anime and film themes to pop hits. Listen, then practice with a controller or keyboard. Free, in your browser.';

export const SHARE_IMAGE = { path: 'og-image.jpg', type: 'image/jpeg', width: 1200, height: 630, alt: 'Ocarina Hero: an embroidered ocarina and a great tree woven into a forest-green tapestry.' } as const;

/** What a page tells browsers, search engines and link previews about itself. */
export interface PageHead {
  readonly title: string;
  readonly description: string;
  /** Absolute canonical address. */
  readonly url: string;
  /** Title of the share preview (Open Graph and Twitter). */
  readonly shareTitle: string;
  readonly structuredData: unknown;
}

/** JSON for a script data block: "<" is escaped so no value can close the script element. */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function homeHead(siteUrl: string): PageHead {
  return {
    title: 'Ocarina Hero · Play songs on the Zelda ocarina (Ocarina of Time tabs)',
    description: HOME_DESCRIPTION,
    url: siteUrl,
    shareTitle: SITE_NAME,
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', '@id': `${siteUrl}#website`, name: SITE_NAME, url: siteUrl, inLanguage: 'en' },
        {
          '@type': 'WebApplication', name: SITE_NAME, url: siteUrl, applicationCategory: 'GameApplication', applicationSubCategory: 'Music',
          operatingSystem: 'Any (web browser)', browserRequirements: 'Requires JavaScript', isAccessibleForFree: true,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          description: HOME_DESCRIPTION,
          featureList: [
            'Button tabs for the ocarina of The Legend of Zelda: Ocarina of Time',
            'Over 200 game, anime, film, pop and classic melodies',
            'Listen to each passage and practice it at 100%, 75% or 50% speed',
            'Play with a gamepad, the keyboard or the on-screen pad',
            'Import a MIDI file or a short recording as a playable tab',
          ],
        },
      ],
    },
  };
}
