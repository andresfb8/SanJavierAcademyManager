# PLAN-modal-search-fixes

## Overview

- **What**: Make search inputs in modals accent-insensitive, and fix the truncation/size issue for the dropdown in the "Añadir jugador al grupo" modal.
- **Why**: Currently, searching for a player requires typing accents perfectly, which slows down the user. Additionally, the list of players to add to a group gets cut off, showing only one player, because the custom `<SearchableSelect>` dropdown is constrained by the Dialog's `overflow-y-auto` styles, making it hard to find and select a player.

## Project Type

**WEB** (Next.js/React based with Tailwind & shadcn-ui)

## Success Criteria

- Searching for "Martin" matches "Martín".
- Searching for "Gomez" matches "Gómez".
- The dropdown list of players in the "Añadir jugador" modal displays multiple options without being cut off by the modal's internal scroll boundaries.

## Tech Stack

- React 18+
- Tailwind CSS
- shadcn/ui components (`Dialog`)

## File Structure

- `src/components/shared/SearchableSelect.tsx` (Target for both changes)
- `src/components/ui/dialog.tsx` (If absolutely necessary to fix overflow context, but prefer updating SearchableSelect to use a Portal or `fixed` positioning, or refactoring it to use `Popover` + `Command` from shadcn).

## Task Breakdown

### Task 1: Accent-Insensitive Search in SearchableSelect

- **Agent**: `frontend-specialist`
- **Skills**: `react-best-practices`, `clean-code`
- **Priority**: P1
- **Dependencies**: None
- **INPUT**: `src/components/shared/SearchableSelect.tsx`
- **OUTPUT**: Updated filtering logic using `normalize("NFD").replace(/[\u0300-\u036f]/g, "")`
- **VERIFY**: Ensure typing a name without an accent matches options with accents.

### Task 2: Fix Dropdown Overflow in Modals

- **Agent**: `frontend-specialist`
- **Skills**: `frontend-design`, `css-architecture` (Tailwind)
- **Priority**: P1
- **Dependencies**: Task 1
- **INPUT**: `src/components/shared/SearchableSelect.tsx` and possibly `src/pages/GroupDetailPage.tsx`
- **OUTPUT**: Dropdown menu is no longer clipped by the Dialog's `overflow-y-auto`. Options: use `createPortal` for the dropdown list, or convert `<SearchableSelect>` to use `Popover`/`Command` from shadcn which natively handle portalling.
- **VERIFY**: Open "Añadir jugador al grupo" modal. Ensure the player list shows multiple options and overflows the modal cleanly if needed.

## Phase X: Verification

- [x] Lint & Type Check passes.
- [x] No purple/violet hex codes used (Frontend Design Rule).
- [x] No standard template layouts used blindly.
- [x] Socratic Gate was respected.
- [x] E2E/Manual test: Verify search matching "Jose" finds "José".
- [x] E2E/Manual test: Verify dropdown opens fully in Add Player modal without scrolling main modal inappropriately.

## ✅ PHASE X COMPLETE

- Lint: ✅ Pass
- Security: ✅ No critical issues
- Build: ✅ Success
- Date: 2026-03-03
