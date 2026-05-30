# [1.6.0](https://github.com/dtmirizzi/pi-openrouter-multimodal/compare/v1.5.3...v1.6.0) (2026-05-30)


### Features

* update repo logo with OpenRouter-inspired design ([6a6208d](https://github.com/dtmirizzi/pi-openrouter-multimodal/commit/6a6208d9bb04dfc737229d1aa1b283a930684e14))

## [1.5.3](https://github.com/dtmirizzi/pi-openrouter-multimodal/compare/v1.5.2...v1.5.3) (2026-05-30)


### Bug Fixes

* improve model fetching and selector ([1cf2309](https://github.com/dtmirizzi/pi-openrouter-multimodal/commit/1cf2309e033be8570a5bbf1b13139e3fc0017fc2))

## [1.5.2](https://github.com/dtmirizzi/pi-openrouter-multimodal/compare/v1.5.1...v1.5.2) (2026-05-30)


### Bug Fixes

* restore scoped package name @dtmirizzi/pi-openrouter-multimodal ([f6a22d4](https://github.com/dtmirizzi/pi-openrouter-multimodal/commit/f6a22d4d2535844698ec364c27daa9d2d09d1df8))

## [1.5.1](https://github.com/dtmirizzi/pi-openrouter-multimodal/compare/v1.5.0...v1.5.1) (2026-05-30)


### Bug Fixes

* add top-level index.ts entry point so Pi shows package name instead of 'src' ([ffae98c](https://github.com/dtmirizzi/pi-openrouter-multimodal/commit/ffae98c62da10cbdba599228a918c3880ab75689))

# [1.5.0](https://github.com/dtmirizzi/pi-openrouter-multimodal/compare/v1.4.1...v1.5.0) (2026-05-30)


### Features

* dynamic model selection per modality with OpenRouter API fetch ([3259ae1](https://github.com/dtmirizzi/pi-openrouter-multimodal/commit/3259ae134cea75bc4d03bb4b1740bd750ada2054))

## [1.4.1](https://github.com/dtmirizzi/pi-openrouter-multimodal/compare/v1.4.0...v1.4.1) (2026-05-30)


### Bug Fixes

* persist state on session shutdown and compaction ([18abbdf](https://github.com/dtmirizzi/pi-openrouter-multimodal/commit/18abbdff68033a7494af38979edc8c1b3b813599))

# [1.4.0](https://github.com/dtmirizzi/pi-openrouter-multimodal/compare/v1.3.2...v1.4.0) (2026-05-30)


### Features

* add logo assets (SVG + PNG) ([0ba8320](https://github.com/dtmirizzi/pi-openrouter-multimodal/commit/0ba832021f7bf4f768ccf313fea151975a17548c))

## [1.3.2](https://github.com/dtmirizzi/pi-openrouter-multimodal/compare/v1.3.1...v1.3.2) (2026-05-30)


### Bug Fixes

* update smoke test for scoped package name ([1454511](https://github.com/dtmirizzi/pi-openrouter-multimodal/commit/1454511dd3344f6863e2d99d829efc3841fdb018))

## [1.3.1](https://github.com/dtmirizzi/pi-openrouter-multimodal/compare/v1.3.0...v1.3.1) (2026-05-30)


### Bug Fixes

* unterminated string in image_understand promptGuidelines ([55e6762](https://github.com/dtmirizzi/pi-openrouter-multimodal/commit/55e6762c9f2ffc4113bb74d77d78770276fc42ac))

# [1.3.0](https://github.com/dtmirizzi/pi-openrouter-multimodal/compare/v1.2.1...v1.3.0) (2026-05-30)


### Features

* add image_understand, video_understand, pdf_read tools ([709fd28](https://github.com/dtmirizzi/pi-openrouter-multimodal/commit/709fd282f4290330b11416877fda7b9193a9f2fb))

## [1.2.1](https://github.com/dtmirizzi/pi-openrouter-multimodal/compare/v1.2.0...v1.2.1) (2026-05-30)


### Bug Fixes

* include helpers.ts in npm files, simplify smoke test ([d78ca45](https://github.com/dtmirizzi/pi-openrouter-multimodal/commit/d78ca45e6e973d10046dae482af86ec07adf5142))

# [1.2.0](https://github.com/dtmirizzi/pi-openrouter-multimodal/compare/v1.1.0...v1.2.0) (2026-05-30)


### Features

* add image_generate, tts_speak, stt_transcribe tools ([e2a78c4](https://github.com/dtmirizzi/pi-openrouter-multimodal/commit/e2a78c44ab5f48e9340ec992fc039d807a92e849))

# [1.1.0](https://github.com/dtmirizzi/pi-openrouter-multimodal/compare/v1.0.0...v1.1.0) (2026-05-29)


### Features

* configurable status bar — verbose/compact toggle in /web-tools ([56b415c](https://github.com/dtmirizzi/pi-openrouter-multimodal/commit/56b415c7e162843dc2f2bb0138c4f0e13254d393))

# 1.0.0 (2026-05-29)


### Features

* initial release — web_search and web_fetch server tools ([777f655](https://github.com/dtmirizzi/pi-openrouter-multimodal/commit/777f655d339804d5590c7ce64ab45a0d447cebd0))

# Changelog

## [0.1.0] - 2026-05-29

### Initial Release

- `web_search` tool for real-time web search via OpenRouter
- `web_fetch` tool for fetching URL content via OpenRouter
- Independently toggleable with `/web-search`, `/web-fetch`, `/web-tools` commands
- Persistent state across sessions and branch navigation
- Configurable search/fetch engine selection
- Domain filtering support
