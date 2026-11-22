# Scheduling in TikTok Studio (web)

Use a preview tab you open yourself, logged in to the owner's account. The browser time zone is Europe/Madrid; scheduled times are Madrid times.

## Upload one film

1. Open `https://www.tiktok.com/tiktokstudio/upload`; upload the MP4 to `input[type=file]`; wait for the text `Uploaded`.
2. Caption: `type` into `.public-DraftEditor-content` with `clear: true`, the whole caption including hashtags, ending with a space; then press Escape. Without the trailing space and Escape, a later click accepts a hashtag suggestion and changes the tag. Read the editor's text back.
3. Cover: click `Edit cover`, then `Upload cover`, upload the delivery JPG to `input[type=file][accept*=image]`, click `Save`. Check the modal closed.
4. Schedule: click the `Schedule` label; the first time a dialog "Allow your video to be saved for scheduled posting?" appears: `Allow`.
5. Date: click the date input, then the `span.day.valid` with the day inside `.calendar-wrapper`.
6. Time: click the time input. In the picker, `scrollIntoView` the hour item (`.tiktok-timepicker-option-text.tiktok-timepicker-left`), read its centre, click there; the first click after opening is often ignored, so re-scroll and click again until the input shows the hour. Same for minutes (`...-right`, value `00`). Read the input back.
7. Content check lite: it can hang over 10 minutes, and scheduling while it runs shows "Continue to post? ... Post now", which is ambiguous. Switch it off (the last switch) and schedule; TikTok still moderates at posting time.
8. Leave Comment and Reuse of content (duet, stitch) on; AI label off for stylised felt art; no location.
9. Click the `Schedule` button; wait for `/tiktokstudio/content` to list the caption with `Nov D, H:MM PM (GMT+1) Madrid`.

## Replace a scheduled post

Scheduled posts cannot be edited ("Scheduled posts cannot be edited"). Schedule the new copy first at the same time, then delete the old one:

- Find the old row by its caption; rows are 100 px tall. Hover the row, click the "more" button at the right end of the row (x about 1186 at 1280 px width); its menu (`Download`, `Delete`) opens about 80 px below the click. Check the menu sits under the row you meant.
- The confirm dialog does not name the post: confirm only after checking the row. Read the list back.

## Afterwards

- Post-time duties for the owner: answer comments in the first hour; pin a comment asking for the next song; reply to song requests with video replies.
- Measure at 2 h and 24 h: views, average watch time, profile visits, bio clicks, and the site's daily visits.
