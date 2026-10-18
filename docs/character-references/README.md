# Vichar Character Reference

## Current approved reference

- **Version:** `ravi-editorial-v1`
- **Status:** approved working baseline; may evolve in a future version
- **Source:** character reference sheet supplied by Ravi on 2026-10-18
- **Purpose:** server-selected visual reference for Vichar cartoon generation

The reference sheet includes front, three-quarter and profile views, expression examples, and scene examples. Preserve the recognizable face and proportions, warm medium-dark complexion, short textured approximately 50/50 silver-white and dark salt-and-pepper hair with no fade, rectangular glasses, light stubble, prominent ears, left-ear diamond stud, and lip/chin shape. Clothing, pose, expression and setting may vary with the thought.

## Asset handling

The source image has not yet been committed as a binary asset. Do not substitute an invented image or accept a client-provided URL. Before wiring the provider to an HTTP route:

1. Add the approved source image as a repository asset under this directory, using a stable filename such as `ravi-editorial-v1.png`.
2. Record its content hash and MIME type in this document.
3. Load the asset from a server-controlled location and pass its bytes/version to the provider adapter.
4. When the reference is materially revised, add a new version rather than silently replacing the approved asset.

This document records the decision; it does not claim that the image file is already stored in the repository.
