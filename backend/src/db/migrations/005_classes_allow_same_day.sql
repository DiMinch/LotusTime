-- Migration: 005_classes_allow_same_day.sql
-- Adds the allow_same_day column to the classes table.
-- This field controls whether the scheduler can assign multiple
-- sessions of the same class to the same calendar day.

ALTER TABLE classes
ADD COLUMN IF NOT EXISTS allow_same_day BOOLEAN NOT NULL DEFAULT FALSE;
