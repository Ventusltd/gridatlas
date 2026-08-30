# Atlas runtime

`atlas/index.html` is the stable composer. It fetches one immutable shell from `atlas/releases/`, verifies each listed cartridge with SHA-256, replaces only named cartridge slots, and writes the composed document.

The only mutable application pointer is `atlas/current.json`. New features must be bounded cartridges; do not copy the whole application.
