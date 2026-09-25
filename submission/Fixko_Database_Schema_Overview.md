# Fixko Database Schema Submission Overview

## System and Database Name
System Name: Fixko
Database Name: fixko

## Group Members
- [Group Member 1 - Full Name]
- [Group Member 2 - Full Name]
- [Group Member 3 - Full Name]

## Table Summary
- users – user accounts and system roles.
- rooms – campus room inventory.
- equipment – equipment records and condition.
- reports – main issue reports.
- comments – report discussion entries.
- ticket_status_histories – report status change log.
- feedback – user satisfaction feedback.
- repair_history – repair and maintenance log.
- notifications – user alerts and report updates.

## Key Mapping
Primary keys: every business table uses a surrogate AUTO_INCREMENT id (`users.id`, `rooms.id`, `equipment.id`, `reports.id`, `comments.id`, `ticket_status_histories.id`, `feedback.id`, `repair_history.id`, `notifications.id`).

Foreign keys reference the parent table and column shown in the ERD. `ON DELETE` semantics: `CASCADE` for dependent child records; `SET NULL` for nullable fields; `RESTRICT` for protected records that still have related data.

## Normalization Rationale
1NF: All column values are atomic; no repeating groups. Multi-valued data such as report comments, status transitions, and repair records are stored in separate child tables. Every table has a primary key.

2NF: No partial dependencies on the primary key. Each table stores data relevant to a single entity, and attributes depend on the whole table identity rather than part of it.

3NF: No transitive dependencies. Report status changes, maintenance actions, and feedback exist in separate tables, preventing unnecessary duplication and preserving integrity.
