# Records computer QA — 2026-11-14

The archive now places the source document, clickable details and results inside one native dialog. Leads come only from displayed fields of the selected discovered document; manual search remains available.

## Browser verification

Tested locally at 1365 × 900 and 375 × 812 with a QA tutorial save:

- Invoice → FixRight Plumbing listing, bank statement → Harlow Creek Savings reply → FXR Services registry, without closing the computer.
- Opened returned records in the reader and pinned both supporting records; saved count remained two after closing/reopening.
- Manual unmatched query via Enter showed a visible explanation and a suggested detail from the source.
- Activated an inline Tina Ruiz clue using Enter. Empty search disabled the submit button.
- Historical Harlow Creek Savings results reopened without increasing the four-search count; another known result likewise left the five-search count unchanged.
- Selecting a historical query after scrolling to history returned results to scrollTop 0 and focused its heading.
- Opening a result on the narrow layout switched to the document, scrolled its reader to the top and focused #computer-source. No horizontal document overflow.
- Reload/resume retained queries and discovered records. Close/reopen retained current record and pins.
- No browser console errors during this session.

Screenshot: [records-computer.jpg](records-computer.jpg).

## Automated / independent checks

- 191 tests: search boundaries, visible clue extraction, aliases, formatted phones/orders/domains, overlapping text ranges, search reuse and newly unlocked historical results, plus existing verdict/save/game coverage.
- Independent code review confirmed all authored records remain reachable through visible clue buttons: tutorial 6/6, main 14/14.
- Two review findings (result scroll reset and source focus after opening) were fixed, verified in the browser and re-reviewed with no remaining important issue.
- Production build includes case validation and TypeScript checks. Browser walkthrough used the tutorial; main-case reachability was checked programmatically.
