# X11 DPI codec provenance

`dpi.ts` and `dpi-map.ts` are adapted from HarukaYamamoto0/attack-shark-x11-driver, MIT licensed. The adjacent LICENSE preserves its copyright notice. `dpi.cjs` is the CommonJS bundle of those two editable files, built with esbuild. Rebuild with:

```sh
npx esbuild desktop/vendor/x11/dpi.ts --bundle --platform=node --format=cjs --outfile=desktop/vendor/x11/dpi.cjs
```

Reference commit: `e4d68c0a191bbbf5ac6cf3919d5fb9bdf0823a0f`.

Reference: https://github.com/HarukaYamamoto0/attack-shark-x11-driver

Family Gear implements its own native transport and snapshot-preserving writers. It does not use the reference's default settings builders or macro writer. The reference's macro write checksum excludes the final action byte, so macro editing needs additional capture/hardware verification before being enabled. Readback and protocol unit tests are not physical X11 verification.
