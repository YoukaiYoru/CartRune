-- Migration: add barcode column to releases (EAN/UPC from ScreenScraper media or manual lookup)
-- AutoMigrate also adds it on startup; this file documents the schema change.

ALTER TABLE releases ADD COLUMN IF NOT EXISTS barcode VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_releases_barcode ON releases(barcode);