# Changelog

All notable changes to this project are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `package.json` is ready for npm as `whatsapp-chat-button` (not published yet).

## [1.0.0] - 2026-11-13

### Added

- A floating WhatsApp button in one script tag: phone number, pre-filled message with `{url}` and `{title}`, position, offsets, size, colour and a label.
- Options as `data-` attributes or as `window.WhatsAppChatButtonConfig`.
- Greeting popup with name, subtitle, avatar, greeting text and a "Start chat" button, opened on click or after a delay.
- Show after N seconds or after scrolling; hide on phones or on desktops.
- JavaScript API: `init`, `open`, `close`, `show`, `hide`, `destroy`, `version`.
- Shadow DOM styles, a strict Content-Security-Policy and Trusted Types, keyboard and screen reader support, reduced motion, forced colours.
- An HTML and CSS only version.
- The generator page (GitHub Pages).

[Unreleased]: https://github.com/Replyze/whatsapp-chat-button/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Replyze/whatsapp-chat-button/tree/v1.0.0
