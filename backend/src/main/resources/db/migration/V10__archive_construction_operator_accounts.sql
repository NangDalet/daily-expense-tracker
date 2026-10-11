-- Retain payment/audit attribution when an operator's login account is removed.
ALTER TABLE users ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;
