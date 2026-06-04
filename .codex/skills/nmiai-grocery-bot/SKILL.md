---
name: nmiai-grocery-bot
description: Build, run, and improve bots for the NMiAI 2026 Grocery Bot challenge. Use when working with Grocery Bot game clients, WebSocket game loop logic, action selection, order fulfillment strategy, multi-bot coordination, or protocol compliance for app.ainm.no/game.
---

# NMiAI Grocery Bot

## Overview

Use this skill to implement and iterate on a Grocery Bot agent that connects to `wss://game.ainm.no/ws?token=<jwt_token>`, receives `game_state`, and returns one action per bot each round.
Use `references/game_spec.md` for all protocol fields, legal actions, and hard game constraints.

## Workflow

1. Confirm runtime setup:
   - Use Python 3.10+.
   - Install dependencies (typically `websockets`).
   - Read token from environment variable (recommended) instead of hardcoding it.
2. Implement round loop:
   - Receive JSON state from WebSocket.
   - If message type is `game_over`, stop and print score.
   - Build exactly one action object per bot and send `{"actions": [...]}`.
3. Enforce rules:
   - Respect movement, pickup adjacency, drop-off position, and inventory limit.
   - Return valid actions within round timeout to avoid implicit `wait`.
4. Improve strategy incrementally:
   - Start with nearest-needed-item behavior.
   - Add collision-aware assignment and path planning for medium/hard/expert.
5. Validate behavior:
   - Run against all four difficulties.
   - Compare completed orders/items delivered per round.

## Implementation Invariants

- Always send one action per bot every round.
- Prefer deterministic decisions for reproducibility.
- Do not assume reconnect support (disconnect ends game).
- Keep per-round decision time well under 2 seconds.
- Keep protocol mapping explicit; do not rely on implicit defaults.

## What To Read First

- `references/game_spec.md` for message schema, rules, limits, and scoring.
- Workspace bot file (for example `bot.py`) for current strategy and architecture.

## Common Tasks

- Implement initial bot from protocol spec.
- Refactor `decide()` logic for multi-bot coordination.
- Add safe token handling via environment variables.
- Debug invalid actions and timeout issues.
- Tune movement/pickup priorities for higher score.

## Output Expectations

- Keep bot logic readable and testable.
- Favor explicit state-derived decisions over hidden heuristics.
- Document any non-obvious prioritization logic in code comments.
