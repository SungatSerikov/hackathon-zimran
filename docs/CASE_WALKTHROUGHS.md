# Case walkthroughs

Author and QA spoilers for the teammate-authored cases. People, businesses, transactions, addresses, and services are fictional. The case files preserve the teammate’s stories, character IDs, document IDs, art filenames, and search structure. Email/web domains use the reserved `.example` suffix.

## Tutorial — The Double Charge

- Case ID: `tutorial-double-charge`; case date: **10/12/2026**.
- Characters: Linda Park (`c_linda`), Dale Hughes (`c_dale`), Tina Ruiz (`c_tina`).
- Six documents; three initial documents: `d_invoice`, `d_bank`, `d_dale_email`.
- **Minimum: 2 searches.** The taught route below uses 3 because it first demonstrates searching the company name.

| Step | Exact archive query | Visible source | Opens |
| --- | --- | --- | --- |
| 1, onboarding | `FixRight Plumbing` | Initial invoice and its explicit search instructions | `d_ad` |
| 2 | `Harlow Creek Savings` | Initial bank statement’s title | `d_bank_letter` |
| 3 | `FXR Services LLC` | Second merchant on the initial bank statement | `d_registry` |

**Answer:** APPROVED → Tina Ruiz (`c_tina`) → “FixRight’s billing clerk charged Linda’s card a second time through her own company” (`m3`). Pin and submit **`d_registry` + `d_bank_letter`**.

The bank’s processor verification identifies Tina as the authenticated actor who manually submitted the second settled $480 charge, reused the original invoice, and had no additional authorization. The registry confirms her company ownership from the signed filing. Being a registered agent or simply having access to card details would not establish ownership or who actually charged the card; the strengthened records expressly close those gaps.

**False leads:** The two settled charges to different merchants rule out Dale’s suggested duplicate-processing error. Linda did not merely misread her statement. The correct refund is the extra **$480**, not the $960 total charged. The company advertisement and initial bank statement are useful context but are not an acceptable decisive pair on their own.

The invoice’s supplemental visible text teaches searching a company, following new references, pinning two proving records, and completing stamp + person + method + two clues. The supplemental invoice lines must be rendered through `body.body`.

## Main — The Missing Refund

- Case ID: `case-01-missing-refund`; case date: **10/22/2026**.
- Characters: Marcus Bell (`c_marcus`), Priya Shah (`c_priya`), Gloria Mendez (`c_gloria`), Kyle Denton (`c_kyle`), Ray Ortiz (`c_ray`).
- Fourteen documents; four initial documents: `d_receipt`, `d_label_email`, `d_store_reply`, `d_chat`.
- **Minimum: 3 searches.** A full investigation normally uses 4–6 or more; the optimal route is intentionally retained instead of inserting artificial unlocks.

| Step | Exact archive query | Visible source | Opens |
| --- | --- | --- | --- |
| 1 | `PG-77310452` | Initial return-label email | `d_tracking` |
| 2 | `880 Industrial Way` | Initial label email or tracking record | `d_unit_listing` |
| 3 | `QuickShip Returns LLC` | Warehouse tenant listing | `d_registry` |
| 4 | `northwind-returnshelp.example` | Sender domain in the initial label email | `d_whois` |
| 5, corroboration | `Northwind Outfitters` | Initial receipt and brief | `d_northwind_help`, `d_reviews` |
| 6, corroboration | `(937) 555-0142` | Company filing or domain lookup | `d_scam_ad` |

The shortest route omits the optional tracking and corroboration searches: **880 Industrial Way → QuickShip Returns LLC → northwind-returnshelp.example**. The domain lookup can be searched earlier; the first two must retain their order.

**Answer:** DENIED → Kyle Denton (`c_kyle`) → “A fake ‘Northwind support’ site sent Marcus a label to the scammer’s own warehouse” (`m3`). Pin and submit **`d_registry` + `d_whois`**.

The company filing proves Kyle owns QuickShip and operates at the destination address. The domain record’s dated, verified dispute supplement identifies Kyle as the domain administrator and fee beneficiary, ties his support account to Marcus’s exact order and tracking number, and confirms he impersonated Northwind without authorization. Neither a shared telephone number nor a business organizer’s name alone would establish the complete scheme. The claim against **Northwind** is denied because that retailer did not authorize or receive the return; Marcus is still a victim of Kyle’s separate deception.

**False lead — neighbor theft:** Marcus suspects Gloria because of missing summer packages. Tracking and the identity-checked drop-off log establish that this particular box entered the carrier’s custody and arrived at the address on the label. The neighbor forum provides context about the older thefts, but Gloria’s own account is not the decisive proof of what happened to this shipment.

**False lead — store delaying a refund:** Slow-refund reviews make this plausible. The initial official reply and the verified dispute response show Northwind never received this return. Its real help page provides a different return destination and free labels, whereas the impersonator charged $4.99 and used a private warehouse.

**False lead — carrier loss:** The tracking record shows delivery to the label’s exact destination, signed by K. DENTON. It was misdirected by the fake support service before shipping, not lost in transit.

Additional optional searches: `ParcelGo Store #212` or `Ray Ortiz` opens `d_parcelgo_note`; `Gloria Mendez` opens `d_forum`; `Kyle Denton` or `K. Denton` opens `d_court`. Earlier litigation is context, not proof of responsibility for Marcus’s parcel.

## Integration and fairness decisions

- The game requires exactly two distinct evidence documents. The teammate’s broad evidence arrays originally allowed weak pairs; each case now names only its two decisive records, while all other documents remain available as supporting clues.
- The main case’s **3-query optimal path** is below the original 4–6 search target. This is a documented pacing deviation, accepted to preserve the teammate’s freely branching search graph. The normal walkthrough has 4 substantive queries and 2 corroboration queries.
- Supplemental receipt facts previously existed only in flat search text. They now appear in visible `body.body`, and every document’s flat `text` is regenerated from its title and body.
- Domains are fictional; the phone range is reserved 555-01xx. The unrelated real fuel brand was replaced by Harlow Fuel. Chat timestamps include the year.
- `src/cases/cases.test.ts` verifies both playable routes, complete reachability, minimum search counts, body/search-text consistency, rejection of unsupported pairs, and visibility of the support-email domain without unlocking unseen companies.
- Run `npm run validate`, `npm test`, and `npm run build` for the final checks.
