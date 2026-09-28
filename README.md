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

### Save to configured destinations with the companion

With Node.js installed, run this on the **same computer as Chrome**:

```bash
npm run companion -- start /absolute/path/to/archive
npm run companion -- status
npm run companion -- stop
```

On first start, the CLI creates `~/.petrify/destinations.json` with a local destination using Files SDK's `fs` adapter. `start` launches a detached server on `127.0.0.1:47631` and prints a pairing token. In the extension's download settings, select **Companion**, paste the token, choose a destination supplied by the companion, and save. The relative folder and Instagram account name are appended to that destination. Repeating a filename creates a numbered copy instead of overwriting it. The filesystem adapter also creates `.meta.json` sidecars beside saved files.

To register more destinations, stop the companion, edit `~/.petrify/destinations.json`, then run `npm run companion -- start` without a path. Each destination has a stable ID, display label, Files SDK provider slug, and adapter options. For example:

```json
{
  "destinations": [
    { "id": "local", "label": "Local archive", "provider": "fs", "options": { "root": "/absolute/path/to/archive" } },
    { "id": "backup", "label": "S3 backup", "provider": "s3", "options": { "bucket": "my-archive", "region": "us-east-1" } },
    { "id": "dropbox", "label": "Personal Dropbox", "provider": "dropbox", "options": {
      "configJson": {
        "refreshToken": { "$env": "PETRIFY_DROPBOX_REFRESH_TOKEN" },
        "appKey": { "$env": "PETRIFY_DROPBOX_APP_KEY" },
        "rootFolderPath": "/Petrify"
      }
    } }
  ]
}
```

Set Dropbox credentials in `~/.petrify/.env` (or the companion process environment), and restrict the file to your user (`chmod 600 ~/.petrify/.env`). S3 uses the AWS SDK credential chain, including environment variables or a shared AWS profile. For multiple accounts of the same provider, use distinct environment variable references in each destination's `options` / `configJson`. Keep credentials out of `destinations.json` and the extension. The companion validates configuration at startup and exposes only IDs, labels and provider names through its authenticated `GET /destinations` endpoint; edits take effect after a restart. The filesystem, S3 and Dropbox adapter dependencies are installed; other providers require installing their [optional peer dependencies](https://files-sdk.dev/docs/installation) first. Supported provider slugs and settings are documented in the [Files SDK provider catalog](https://files-sdk.dev/docs/providers).

The token is stored in `~/.petrify/companion.json` and Chrome's local extension storage; treat it as a password. Run the companion only on a trusted computer, on the **same computer as Chrome**. It must be running when you save media and does not start automatically when you log in. Its upload endpoint binds only to loopback.

Petrify uses Instagram's authenticated web responses and only works for media the signed-in browser session can view. Instagram's internal endpoints are not a supported public API and may change without notice.
