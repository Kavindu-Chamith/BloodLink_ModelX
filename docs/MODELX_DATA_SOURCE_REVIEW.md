# ModelX 2 data-source review

Reviewed 10 November 2026 for competition use. No external records were downloaded or added to the repository during this review.

## Current project data

The checked-in CSVs are generated synthetic fixtures. They demonstrate application workflows but cannot support claims about actual blood-service demand, inventory, regional trends, or present-day conditions. Their approximate town-center coordinates also need a documented source or a clear statement that they were independently authored without copying a protected map/database.

## Candidate sources checked

| Source | What it offers | Reuse and freshness | Assessment |
|---|---|---|---|
| [Sri Lanka NBTS Annual Statistics Reports](https://nbts.health.gov.lk/annual-statistic-reports/) | Official national blood-service annual and cluster statistics; the site lists a 2024 report. | The [2024 report](https://nbts.health.gov.lk/wp-content/uploads/2025/10/Stat-Annual-Report-2024.pdf) says data are provided “as is,” prohibits unauthorized reproduction or modification, and reserves all rights. | Do not copy tables into this project or adapt them without written permission from NBTS. It is temporally useful but not currently cleared for reuse. |
| [WHO Global Status Report on Blood Safety and Availability 2025](https://www.who.int/publications/b/82618) | Cross-country aggregate data on blood collection and availability, based on national reporting. | WHO lists a [CC BY-NC-SA 3.0 IGO](https://creativecommons.org/licenses/by-nc-sa/3.0/igo/) license. The report covers data up to 2023, so it is historical rather than live; adaptation requires attribution and share-alike, and commercial use requires permission. | A possible basis for an explicitly historical, population-level comparison, subject to license conditions. It is not a current Sri Lankan stock feed or a substitute for local operational data. |
| [Sri Lanka Open Data Portal health-tagged datasets](https://data.gov.lk/search/field_tags/health-96/type/dataset?sort_by=changed) | The catalog lists health datasets, including hospital utilization data. | The health datasets found in the catalog are old (including 2014 and 2006–2013 series) and show “License Not Specified.” The portal’s [general data-sharing terms](https://data.gov.lk/about-data-sharing) describe broad reuse rights for public information, but dataset-specific third-party rights and privacy exclusions still apply. | Not a strong fit for a timely blood-donation insight without dataset-level rights and relevance checks. |

## What is still needed

Before adding real data, select a source with explicit reuse permission, retain its citation and retrieval date, document its reporting period and gaps, and keep personal or patient-level records out of the demo. A real-data feature must compute and explain an aggregate pattern for a named population-level user. Do not label synthetic application fixtures as real data or as current service conditions.

The official NBTS service says it operates monthly statistics reporting and daily stock monitoring systems, but these are operational systems and do not establish public data access permission. Request documented permission if the project needs those data.
