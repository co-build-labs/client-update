# EGA Policy Change Desk

Browser tool for in-force policy changes with Beneva. It walks an advisor through the request, pre-fills from the client's intake record, checks compliance, lists who signs and what to attach, then fills Beneva's own fillable PDF.

Everything runs in the browser. No client data is sent to any server. A draft of the current case is kept in the browser's local storage until you choose **Start blank**.

## Supported changes

| Change | Beneva form | Originals |
|---|---|---|
| Change of beneficiary | FIND0205A (2024-04) | 1 |
| Transfer of ownership (absolute assignment) | FIND0206A (2025-05) | 1 |
| Assignment of the contract (collateral) | FIND0072A (2023-01) | 2 |
| Revoking cession | FIND0203A (2023-01) | 2 |
| Pre-authorized debit | FIND0168A (2023-11) | 1 |

Not covered: policy reinstatement (FIND0117A, underwriting path), critical-illness beneficiaries, and Insured 2 beneficiaries on FIND0205A (see below).

## Files

- `index.html`: the app
- `mappings.js`: the carrier mapping layer. One plan builder per form turns the canonical change record into PDF field values, and `requirements()` derives signers, attachments and warnings.
- `forms/`: the blank Beneva PDFs the app fills

## Known Beneva form quirks (verified by rendering)

- FIND0205A p1 and FIND0206A section L: the field tagged `NOM_*` (last name) sits under the **First name** column. The mapping places values by where they appear on the page.
- FIND0205A p2: the Insured 2 revocable/irrevocable radios (`1`, `2`, `3`) are shared between the primary and contingent rows, so the app does not fill them.
- FIND0205A p4: `NOM_COMPLET_FIDUCIAIRE_1/2` are the policyowner signature-name lines.
- Several FIND0206A Yes/No groups are checkboxes, not radio groups. The filler selects buttons by export name, which works for both.
- No form has a fillable signature field. Signatures are wet or e-signed after generating.

## When Beneva updates a form

1. Replace the PDF in `forms/` with the same file name.
2. Fill a test case, open the result, and check every field lands in the right box. Field names can stay the same while positions change.
3. Update the plan builder in `mappings.js` if any field moved or was renamed.

## Adding another carrier

Add a PDF to `forms/`, write a plan builder for it in `mappings.js` and register it in `CHANGE_TYPES`. The steps, compliance checks and output stay the same.
