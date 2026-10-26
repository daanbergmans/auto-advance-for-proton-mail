<p align="center">
  <img src="icons/icon-128.png" width="96" alt="">
</p>

<h1 align="center">Auto-Advance for Proton Mail</h1>

<p align="center">
  A Firefox add-on that opens the next email automatically after you archive, delete or move the one you're reading in Proton Mail.
</p>

<p align="center">
  <a href="https://addons.mozilla.org/firefox/addon/auto-advance-for-proton-mail/">Get it on Firefox Add-ons</a>
</p>

---

Proton Mail's web app sends you back to the message list every time you archive or delete an email, so you have to click the next one yourself. This add-on brings Gmail-style auto-advance to Proton Mail: deal with an email and the next one opens straight away.

## Features

- **Works however you act on an email:** toolbar buttons, keyboard shortcuts (like `A` to archive or `T` to trash) and drag-and-drop to a folder.
- **Stays out of the way:** closing an email without removing it (Escape, back, mark as unread, adding a label) doesn't trigger anything.
- **Sensible at the end of the list:** if you remove the last email, it opens the one above instead.
- **Choose a direction:** advance to the email below (default) or above, in the add-on's options.
- **Private:** no data collection, no network requests, no tracking.

## Install

Install it from [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/auto-advance-for-proton-mail/).

Requires Firefox 140 or later.

## How it works

The add-on doesn't hook into Proton's buttons, which change whenever the interface is redesigned. Instead, a content script watches two things:

1. which email is open (its ID is in the page URL), and
2. which emails are in the message list.

When the open email closes **and** has disappeared from the list, it was archived, deleted, moved or marked as spam, so the add-on opens its neighbour. If the email closed but is still in the list, you just closed it, and nothing happens. Switching to another folder is also ignored.

All of this happens locally in the page. The only permission is `storage`, used to remember your options.

## Development

There's no build step. The repository is the extension.

1. Clone the repository.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Click **Load Temporary Add-on…** and select `manifest.json`.
4. Open [mail.proton.me](https://mail.proton.me) and try archiving an email.

To see what the add-on is doing, enable **Log to the browser console** in its options and open the browser console on the Proton Mail tab.

### Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension manifest (Manifest V3) |
| `content.js` | Detects removed emails and opens the next one |
| `options.html`, `options.js` | Options page (direction, debug logging) |
| `icons/` | Add-on icons |

### Packaging

```sh
zip -r proton-auto-advance.zip manifest.json content.js options.html options.js icons/*.png
```

## Troubleshooting

If nothing happens after archiving an email, Proton may have changed how its message list is built. Please [open an issue](../../issues) with:

- your Firefox version,
- whether you use conversation or message view, and
- the console output with debug logging enabled.

## Privacy

This add-on collects no data. It runs only on `mail.proton.me`, makes no network requests and stores nothing except your option choices, locally in your browser.

## License

[MIT](LICENSE)

---

*Not affiliated with or endorsed by Proton AG. Proton and Proton Mail are trademarks of Proton AG.*
