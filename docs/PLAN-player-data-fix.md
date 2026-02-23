# Plan: Fix Player Birth Date in Export/Import

The goal is to fix the issue where the birth date (`birthDate`) is missing during player data export and ensure it is correctly handled during importation.

## Analysis

- **Export**: `src/pages/PlayersPage.tsx` -> `handleExport` is missing the `birthDate` field in the mapping.
- **Import**: `src/components/shared/ImportPlayersDialog.tsx` already supports `birthDate` mapping and parsing, but `PlayersPage.tsx` -> `handleImport` uses a default date (`2000-01-01`) if it's missing.

## User Review Required
>
> [!IMPORTANT]
>
> - Should the birth date be exported in standard ISO format (`YYYY-MM-DD`) or a locale-specific format like `DD/MM/YYYY` for Excel users?
> - Should we include additional fields that are currently missing in the export (e.g., guardian info, bank details)?
> - Should the import process fail or show a warning if the birth date is missing, instead of using a default date?

## Proposed Changes

### [Component] Player Management

#### [MODIFY] [PlayersPage.tsx](file:///c:/Users/andre/Desktop/Proyectos%20Gemini/SanJavierAcademyManager/src/pages/PlayersPage.tsx)

- Update `handleExport` to include `birthDate` in the exported object.
- (Optional) Enhance `handleImport` to handle missing dates more gracefully if decided.

#### [MODIFY] [ImportPlayersDialog.tsx](file:///c:/Users/andre/Desktop/Proyectos%20Gemini/SanJavierAcademyManager/src/components/shared/ImportPlayersDialog.tsx)

- Verify `parseDate` and `isValidDate` logic to ensure robust date handling from different Excel formats.

## Verification Plan

### Manual Verification

1. **Export Test**:
   - Go to the Players page.
   - Click "Exportar".
   - Open the generated `.xlsx` file and verify that the "Fecha Nacimiento" column exists and contains correct data.
2. **Import Test**:
   - Modify the exported file or create a new one with valid birth dates.
   - Use the "Importar" button to upload the file.
   - Verify that the imported players have the correct birth date in their profiles.
3. **Empty Date Test**:
   - Try importing a file where some birth dates are missing.
   - Verify the behavior (either default date or error, based on user feedback).

## Agent Assignments

- **Orchestrator**: Coordinate the implementation and verification.
- **Backend Specialist**: Handle data mapping and Excel logic.
- **Frontend Specialist**: Verify UI feedback during import.
