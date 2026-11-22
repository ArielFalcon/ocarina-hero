# Captions and hashtags

## Caption

One short line: the song's common name, the word "ocarina", one emoji, "Link in bio" (in the film's language). The film already shows the song, the site and that it is free; the feed shows only the first line, so long keyword captions add nothing. Example shape: `<Song> on Link's ocarina 🎶 Link in bio`.

## Hashtags

TikTok accepts 5. Choose in this order:

1. The account's proven tags: those present on its best-performing posts. Read them from the TikTok Studio content list (caption and views per post) at planning time; do not reuse an old list without checking.
2. One tag for the film's song or topic.
3. Never a near-dead tag (a few thousand videos or fewer).

Global tag size is not the criterion: a bigger tag can underperform on this account. When the account's data and global size disagree, the account wins.

Tag size, when needed, while logged in to tiktok.com (from a `www.tiktok.com/tag/...` page):

```js
fetch('https://www.tiktok.com/api/challenge/detail/?challengeName=TAG&aid=1988', { credentials: 'include' })
  .then(r => r.json()).then(j => j.challengeInfo.statsV2) // { videoCount, viewCount }
```

The `item_list` endpoint needs signed parameters and returns nothing.
