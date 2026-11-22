# Captions and hashtags

## Caption

One short line: the song's common name, "ocarina", one emoji, "Link in bio" ("Link en la bio" in Spanish). The film already carries the song name, the URL and "free website"; the feed shows only the first line.

Examples (approved, November 2026):

- `Tetris on Link's ocarina 🎶 Link in bio`
- `Is your song on Link's ocarina? 🎶 Link in bio`
- `Wrong song? 📱💣 Link in bio`
- `Too early? 🎄 Link in bio`

The owner rejected long keyword captions ("How to play X, Y and Z on the ocarina in Zelda Ocarina of Time. 300+ songs free..."). The account's hit (663K views) used only "🎼 Link in bio!".

## Hashtags: exactly 5

TikTok accepts 5. Choose in this order:

1. The account's proven set, present on both hits (663K and 136K): `#zelda #zeldaocarinaoftime #thelegendofzelda #nintendo`.
2. One tag for the film's song or topic (`#tetris`, `#piratesofthecaribbean`, `#elchavodel8`, `#nokia`, `#mariahcarey`). It may replace `#nintendo` when a film needs two topic tags.
3. Never a near-dead tag (under about 5K videos).

Global tag size is not the criterion: `#ocarinaoftime` has more videos than `#zeldaocarinaoftime` worldwide, but the owner rejected it and it underperformed on this account.

Check a tag's size while logged in to tiktok.com (from a `www.tiktok.com/tag/...` page):

```js
fetch('https://www.tiktok.com/api/challenge/detail/?challengeName=TAG&aid=1988', { credentials: 'include' })
  .then(r => r.json()).then(j => j.challengeInfo.statsV2) // { videoCount, viewCount }
```

The `item_list` endpoint needs signed parameters and returns nothing; do not rely on it.
