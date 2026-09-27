---
name: testing-petrify-extension
description: Tests the Petrify Chrome extension on live Instagram with agent-browser and Chrome for Testing. Use when verifying content-script injection, post/feed/reel/story controls, or an unpacked extension build.
---

# Test Petrify in Chrome for Testing

Use the installed Chrome for Testing executable, not the system Google Chrome: the latter can accept `--load-extension` yet show no installed extension. Run from the Petrify repository root.

1. Build the unpacked extension with `npm run build`. The extension directory is `dist`.
2. Launch a dedicated headed browser session with a persistent profile outside the repository:

   ```bash
   agent-browser --session petrify-ext --headed \
     --profile "$HOME/.agent-browser/petrify-extension-profile" \
     --executable-path "$HOME/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" \
     --extension "$PWD/dist" \
     open https://www.instagram.com/
   ```

   If this session is already running with different launch flags, close only `petrify-ext` and relaunch it. Do not copy a profile from a newer system Chrome into this older Chrome for Testing build.
3. Confirm the extension actually loaded, not just that the launch flag was passed:

   ```bash
   agent-browser --session petrify-ext eval '({root:!!document.querySelector("#petrify-root"),buttons:document.querySelectorAll(".petrify-save").length})'
   agent-browser --session petrify-ext tab new chrome://extensions/
   agent-browser --session petrify-ext snapshot -i
   ```

   `#petrify-root` must exist on Instagram and `chrome://extensions` must show Petrify enabled. Return to the Instagram tab with `agent-browser --session petrify-ext tab t1` (check `tab list` first if IDs differ).
4. Have the user sign in in **this Chrome for Testing window** if necessary. The system Chrome profile and this profile are separate. Never write cookies, passwords, or session state into the repository. The dedicated profile persists across threads at `~/.agent-browser/petrify-extension-profile`.
5. For live checks, inspect the actual page DOM and rendered controls; scroll or open posts, Reels, stories, and highlights as needed. Confirm native action buttons are inside `.petrify-action-slot` with `position: static`, not floating inside `#petrify-root`. Some feed posts have extra animated Repost icons inside the media; verify both Petrify buttons are in the same short footer `<section>`, not split between media and footer. Open a profile post by clicking its grid tile to check the modal separately from the standalone post URL: Instagram labels the modal share icon `Share Post` rather than `Share`. Grid buttons are the intentional hover-only exception. Capture and inspect screenshots for visual changes.
6. After rebuilding a changed extension, enable **Developer mode** on `chrome://extensions` before using Petrify's **Reload** control. Without Developer mode, reloading can disable the unpacked extension. Confirm it shows **On**, then reload Instagram before judging the new behavior. Reusing an already-open tab without reloading can test an old content script. Do not claim an end-to-end download check unless the real extension was loaded and the download request succeeded.
