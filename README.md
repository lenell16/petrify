# Petrify

Petrify is a Chrome extension that downloads media from the Instagram post, reel, or story currently open in the browser. Downloads are processed locally and saved under an account-specific path such as:

```text
Petrify/nasa/nasa_post_DAbC123_01.jpg
```

Carousel items retain their displayed order and may contain both images and videos.

## Development

```bash
npm install
npm test
npm run build
```

Load the generated `dist` directory as an unpacked extension from `chrome://extensions`. Use the save icon on an Instagram grid post, individual post, reel, or story to download its media.

Click the Petrify toolbar icon to open download settings. You can change the folder under Chrome's Downloads directory (including nested folders), or enable Chrome's native Save As dialog to choose a destination for each file. Chrome's downloads API does not allow a persistent arbitrary folder outside Downloads; change the browser-wide download location at `chrome://settings/downloads` if you need automatic downloads elsewhere.

Petrify uses Instagram's authenticated web responses and only works for media the signed-in browser session can view. Instagram's internal endpoints are not a supported public API and may change without notice.
