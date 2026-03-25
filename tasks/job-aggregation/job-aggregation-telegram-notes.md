# Telegram Notes

## Purpose

This document collects Telegram-specific setup and debugging notes for the job aggregation pipeline.

The pipeline uses:

- one QA bot for QA posts
- one Developer bot for Developer posts
- one Telegram supergroup
- two forum topics inside that supergroup
- `getUpdates` for admin review callbacks and for discovering IDs during setup

## Important Security Note

Do not hardcode bot tokens in docs, source files, screenshots, or shared chat messages.

If a bot token was pasted into chat, browser history, or any public place, treat it as exposed and rotate it immediately using BotFather.

Store tokens only in:

- `.env` for local development
- GitHub Actions secrets for CI

## How To Inspect Telegram Updates

You can inspect raw Telegram updates in a browser or with `curl`.

Use this format:

```text
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
```

Example workflow:

1. Open the URL above in your browser using your bot token.
2. Send any message to a private chat, group, or topic where the bot is present.
3. Refresh the page.
4. Inspect the JSON response.

This is useful during setup because Telegram returns real IDs you need for configuration.

## What You Can Learn From `getUpdates`

From the returned JSON you can extract:

- `message.chat.id`
  - the chat or supergroup ID
  - this becomes `TELEGRAM_CHAT_ID`
- `message.message_thread_id`
  - the topic ID inside a forum-enabled supergroup
  - this becomes `QA_TOPIC_ID` or `DEV_TOPIC_ID`
- `message.from.id`
  - the user ID of the sender
  - this can be used as `ADMIN_CHAT_ID`
- `callback_query`
  - data from inline button clicks used by the review flow

## Typical Shapes In `getUpdates`

### Group message

```json
{
  "message": {
    "message_id": 12,
    "from": {
      "id": 123456789
    },
    "chat": {
      "id": -1001234567890,
      "title": "Jobs Group",
      "type": "supergroup"
    },
    "text": "test"
  }
}
```

### Topic message inside a supergroup forum

```json
{
  "message": {
    "message_id": 20,
    "message_thread_id": 101,
    "chat": {
      "id": -1001234567890,
      "title": "Jobs Group",
      "type": "supergroup"
    },
    "text": "hello topic"
  }
}
```

### Inline button callback

```json
{
  "callback_query": {
    "id": "1234567890",
    "from": {
      "id": 123456789
    },
    "data": "approve:42:qa"
  }
}
```

## Practical Setup Notes

### 1. Add the bot to the group

The bot must be a member of the target group or supergroup.

### 2. Disable privacy mode if needed

If the bot does not see expected group messages, check BotFather privacy settings.

### 3. Use a supergroup for topics

Topic IDs only exist in forum-enabled supergroups.

### 4. Send a manual test message first

Before wiring the pipeline, send a message manually and confirm that `chat.id` and `message_thread_id` appear in `getUpdates`.

## Mapping To Environment Variables

| Telegram field | Environment variable |
|---|---|
| `message.chat.id` | `TELEGRAM_CHAT_ID` |
| `message.message_thread_id` | `QA_TOPIC_ID` or `DEV_TOPIC_ID` |
| `message.from.id` | `ADMIN_CHAT_ID` |

Bot tokens come from BotFather and are stored as:

- `QA_BOT_TOKEN`
- `DEV_BOT_TOKEN`

## Current Project Usage

Relevant files:

- [src/publisher/telegram.js](src/publisher/telegram.js) for sendMessage, sendPhoto, getUpdates, and callbacks
- [src/review/review.js](src/review/review.js) for processing callback queries
- [src/review/reviewSender.js](src/review/reviewSender.js) for sending review messages with inline buttons
- [.env.example](.env.example) for required Telegram environment variables

## Recommended Setup Flow

1. Create both bots in BotFather.
2. Add bots to the target supergroup.
3. Create QA and Developer topics.
4. Send test messages into the group and into each topic.
5. Open `getUpdates` and copy:
   - chat ID
   - topic IDs
   - your admin user ID
6. Put those values into `.env`.
7. Run the pipeline locally.

## Limitation

`getUpdates` is enough for this project because the pipeline runs on a schedule and polls periodically. It is not intended to be a real-time webhook-based bot architecture.