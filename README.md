# CRS Design System

A Penpot plugin that generates a design system presentation inside a Penpot file,
with a shared colour and typography library and a JSON file with the design
tokens.

Install by URL, drop your logo, press generate.

## What it is

The plugin is a small web application served over HTTPS. It is installed in
Penpot by pasting the URL of its `manifest.json`, and it runs inside the file you
have open. It draws presentation boards with a flexible layout and creates shared
library assets in the same operation.

It is not a script, not a browser extension and not a file generator that runs
outside Penpot.

## Install

1. Open Penpot in your browser and sign in.
2. Open or create a file, then open the plugin manager for that file.
3. Choose to install a plugin by URL.
4. Paste this manifest URL:

   ```
   https://CRS-DISENO.github.io/crs-design-system-penpot/manifest.json
   ```

5. Confirm. The plugin appears in the plugin menu.
6. Run it from that menu, drop your logo SVG on the window and press generate.

If the manifest does not load right after an update, wait a minute and try again:
the service that serves the URL needs a moment.

## What it generates

Three boards of 1280 px wide:

- **00 Portada**: the name, the purpose of the system and the five professional
  pillars.
- **01 Indice**: the menu of sections with a status column that tells which ones
  already exist.
- **02 Marca**: the logo in its three official variants with the rule for each
  one, the symbol and the playhead as interface resources, minimum sizes at real
  size, the clear space around the logo, usage rules, incorrect uses, allowed
  backgrounds and the shapes of the logo used as interface resources.

## Design tokens

`tokens.json` holds the portable form of the system:

```
https://CRS-DISENO.github.io/crs-design-system-penpot/tokens.json
```

It follows the Design Tokens Community Group schema: every token carries `$type`
and `$value`. It holds 19 colours, 8 typography styles and the spacing scale of
10 values. Because it is generated from the plugin code, the file and the
drawing cannot drift apart.

## Limitations

- The Penpot plugin API does not expose the Tokens tab. Colour and typography
  tokens are created as a shared library, and `tokens.json` is the portable form
  of the same values.
- The `version` field of `manifest.json` is the version of the manifest schema,
  which is `2`. It is not the version of the product.
- A plugin cannot read the local file system. The logo arrives by drag and drop.
- No native components with variants yet: the states are drawn as separate
  shapes.
- One pass only: it does not sync the changes you make on the canvas afterwards.
- The brand content and the tokens are built around CRS. Another brand means
  replacing values by hand.

## Trying it out

[docs/probar-el-plugin.md](docs/probar-el-plugin.md) is a short guide for anyone
who wants to test the plugin: what to do, what to expect and what to report.

## License

The plugin and the design system it generates belong to CRS Diseño. This
repository does not include a license file, so no license is granted by its
publication. For licensing questions write to `info@crsdiseno.com`.

## Contact

- Email: `info@crsdiseno.com`
- Profile: [github.com/CRS-DISENO](https://github.com/CRS-DISENO)
- Repository: [github.com/CRS-DISENO/crs-design-system-penpot](https://github.com/CRS-DISENO/crs-design-system-penpot)
