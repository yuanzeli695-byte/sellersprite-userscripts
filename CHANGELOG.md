# Changelog

## Integrated Runner 0.3.4

- Added stable GitHub update and download metadata.
- Removed the personal default operator value.
- Replaced batch picker HTML interpolation with safe DOM option creation.
- Stabilized the script name so future version changes update in place.
- Replaced status-text polling with a versioned Collector run/result handshake.
- Removed automation query parameters from stored result URLs.
- Rejected Collector payloads unless both `decision=pass` and `pass70=true` agree with the metrics.
- Preserved a user pause across in-flight row updates and rechecked state before navigation.

## Traffic Collector 0.4.4

- Added stable GitHub update and download metadata.
- Added a runtime version constant so the panel and metadata stay aligned.
- Added versioned protocol, schema and run IDs for reliable Runner handoff.
- Published structured error results and cleared stale results before each run.
- Removed redundant Amazon `localStorage` persistence and sanitized result URLs.
- Scoped chart discovery and tooltip scanning to SellerSprite chart elements.
- Built chart events with the page's own event constructors.
- Counted only weeks with a parsed natural-share metric toward `weeksRead`.
