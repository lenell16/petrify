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

Load the generated `dist` directory as an unpacked extension from `chrome://extensions`. Open an individual Instagram post, reel, or story and use the **Save media** button at the bottom-right of the page.

Petrify uses Instagram's authenticated web responses and only works for media the signed-in browser session can view. Instagram's internal endpoints are not a supported public API and may change without notice.
