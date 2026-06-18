![logo](https://github.com/DryKillLogic/stremio-account-bootstrapper/blob/main/public/logo.png?raw=true)

# Stremio Account Bootstrapper

Stremio Account Bootstrapper lets you set up your Stremio/Nuvio account with just a few clicks by bootstrapping a preset into your account. It's handy for newcomers, those who want a solid foundation to build their setup on, or to speed up the process of setting up new accounts for family members or friends.

**WARNING: You will wipe the existing setup. Recommended to backup your current configuration before proceeding. Use it at your own risk. No support is provided.**

## Features

- Automated process of setting up an account in a couple of minutes.
- Option to select different presets: minimal, standard, full, all-in-one, http-only, no streams, and factory.
- Option to set the preset to different languages: English (US), Spanish (MX), Spanish (ES), Portuguese (BR), Portuguese (PT), French (FR), Italian (IT), German (DE), and Dutch (NL) are currently supported.
- Option to create a kid-friendly setup.
- Backup your current configuration or restore it.
- Better multilanguage support in Stremio/Nuvio.
- TMDB is the default metadata resolver. Cinemeta catalogs were removed without breaking any core functionality.
- RealDebrid, AllDebrid, Premiumize, Debrid-Link, and TorBox support.
- Multi-debrid services support.
- Multi-platform support. It currently supports Stremio and Nuvio.
- RPDB support.
- Ability to reset the account to a default state (factory preset).
- Optimized addons configuration.
- Sort addons and rename/delete catalogs (inherited from Addon Manager).

## How to Use

Run the app locally, open the URL shown by Vite, then sign in with the Stremio
account you want to manage.

```sh
pnpm install
pnpm run dev
```

The page has two separate backup/restore areas:

- **Installed account addons** backs up or restores the addon collection that is
  installed in the Stremio account.
- **Builder settings** exports or imports the editable form state: preset,
  language, debrid keys, advanced API keys, filters, and custom addon URLs.

Use both when you want a complete, easy-to-reapply setup.

## Safe Workflow

1. Log in to the target Stremio account.
2. Click **Backup configuration** before changing anything.
3. Click **Export settings** if the form contains keys or custom settings you
   want to reuse.
4. Choose the preset, language, debrid keys, filters, and addon options.
5. Click **Load addons preset**.
6. Review the addon list in **Customize addons**.
7. Apply the configuration to the account.
8. Open Stremio Web and test a known movie and a known series episode.

Do not skip the backup step. Applying a preset replaces the installed addon
collection for the selected account.

## Backup and Restore

### Account Addon Backups

Use **Backup configuration** to save the currently installed addon list. These
files are usually named like:

```text
stremio-account-backups/YYYY-MM-DD/.../*.private.json
```

Use **Restore configuration** to put that addon list back into the logged-in
account.

Important details:

- Restoring an account addon backup updates Stremio immediately.
- These files can contain private addon URLs with embedded API keys.
- If the keys can be parsed from known addon URL formats, the app fills the
  editable key fields.
- Some addons encrypt or hide their configuration. In that case, the installed
  addon still keeps working, but the plain key field cannot be recovered from
  the account backup.
- A backup with only default addons, such as Cinemeta, YouTube, WatchHub,
  OpenSubtitles, and Local Files, does not contain stream providers. Restoring
  that kind of file will remove stream sources until you restore or generate a
  stream-enabled profile again.

### Builder Settings Backups

Use **Export settings** to save the form state. This is the best format for
cloning your setup to another account because it preserves the values needed to
generate the same addon profile again.

Use **Import settings** to load that form state back into the UI. After import,
review the fields and apply the preset to the currently logged-in account.

Use this when:

- Moving the same setup to a new Stremio account.
- Rebuilding the addon list after changing a debrid key.
- Keeping a clean copy of your preferred preset, language, filters, and custom
  addon choices.

## Importing Settings to Another Account

1. Log out of the current account in this tool.
2. Log in to the new Stremio account.
3. Click **Import settings** and select the builder settings backup.
4. Remove keys you do not want on that account. For example, keep only TorBox
   for a TorBox-only account.
5. Click **Load addons preset**.
6. Review the addon list.
7. Apply the configuration.
8. Test Stremio Web with at least one movie and one series episode.

If you instead use **Restore configuration**, you restore the exact addon URLs
from the backup. That is useful for rollback, but builder settings are safer
when you want to intentionally change keys or services before applying.

## Keeping Keys Working

Debrid and metadata keys are private credentials. Treat any `.private.json`
backup like a password file.

Recommended maintenance:

- Keep a current builder settings backup after every successful configuration
  change.
- Keep a current account addon backup after every successful account restore.
- If you rotate a RealDebrid, TorBox, or other API key, update it in the form,
  export a new builder settings backup, regenerate the addon preset, and apply
  it to the account.
- If an addon starts returning no streams, verify the account still has stream
  addons installed before debugging individual sources.
- If a provider rate-limits you, reduce addon result limits rather than
  repeatedly refreshing the same title.
- Do not share `.private.json` files. They may contain working debrid or addon
  credentials inside URLs.

Quick checks when streams disappear:

1. Open the tool and log in to the affected account.
2. Use **Backup configuration** to capture the current state.
3. Confirm the account has stream addons such as AIOStreams, Torrentio,
   TorrentsDB, Comet, GuIndex, or similar.
4. If only default addons are installed, restore the last working account backup
   or import builder settings and apply the preset again.
5. Reload Stremio Web, or log out and back in, so the web app refreshes the
   addon collection.

## Changelog

View the [CHANGELOG.md](./CHANGELOG.md) to see what's new in each release.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur)

## Project Setup

```sh
pnpm install
```

### Compile and Hot-Reload for Development

```sh
pnpm run dev
```

### Compile and Minify for Production

```sh
pnpm run build
```

### Format code with Prettier

```sh
pnpm run format
```

## Credits

This tool is based on the original pancake3000 work and redd-ravenn fork, with the collaboration of Sleeyax and &#60;Code/&#62;. This idea couldn't have come to fruition without their contribution to the Stremio community 🙏.
