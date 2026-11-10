# How a blood request works

BloodLink connects an authorized institution with potential volunteer donors.
The institution requests blood; the platform administrator approves the request;
matched donors decide whether to attend; institution staff confirm any collection.

## 1. The institution creates a request

Hospital or blood-bank staff sign into the web dashboard and choose Create Request.
They enter the stated blood group, required units, priority, reason, department,
matching radius, number of volunteers they want to contact, and response window.

Required units and volunteer target are different. For example, two requested units
and a target of ten volunteers do not mean ten donations have been collected.
Creating a request does not change stock.

## 2. The administrator reviews it

A newly submitted request is Pending. Donors cannot see or accept it yet.
The platform administrator can approve or reject it. Rejection includes a reason.
Expired requests cannot be approved for current outreach.

The supplied current-day demo request was already marked as a simulated approved
fixture. Requests created manually through the dashboard still use normal approval.

## 3. BloodLink finds potential volunteers

For an approved, open request at an active approved institution, the backend checks:

- The donor account is active and the stated blood group is verified.
- The stated group matches the requested group exactly for this outreach prototype.
- The donor has opted into outreach and is available.
- Availability was confirmed within the previous 30 days.
- A matching location is saved and lies inside the selected radius.
- The recorded donation interval has passed. The current application rule is 90 days.
- The donor has no other open accepted mission.

These are software coordination filters. Staff still assess whether a person may
donate when they arrive.

## 4. Coverage and notifications

The request details show cumulative counts within 10, 25 and 50 km, with a gap
against the volunteer target. Counts mean potential volunteers, not collected blood.
Stale profiles and declined responses are excluded from current candidate counts.

Only the selected request radius is used for dispatch. Seeing potential volunteers
in the 50 km coverage band does not mean a 25 km request contacts them. Coverage
helps staff decide whether a wider-radius request is needed.

Approval creates in-app notifications for current matches. Staff can later choose
Notify new matches to check again. Existing request/donor pairs are deduplicated.
An approved request can also appear in a donor's feed when their updated profile
starts matching, even before a subsequent notification dispatch.

Configured FCM can deliver a best-effort device alert for real records. Simulated
donors and requests never generate real push delivery. The current demo uses the
in-app inbox. This flow does not send an SMS or email blood appeal.

## 5. The donor sees and responds

New Alerts contains currently matching requests that the donor has not accepted or
declined. Its number is the number of cards in that list. The Notifications inbox
is separate: it can contain private messages, profile notices and older requests.
Reading an inbox message does not remove an available request.

Accepting a request moves it to Active and makes the response visible to the
institution. It does not create a donation record or add stock. A donor can have
one open accepted mission. Declining removes that request from New Alerts.

When the list is empty, the screen explains any profile action needed, such as
consent, verification, renewed availability, a location or a recorded interval.
For older accounts, turn availability on in Profile to record outreach consent.

## 6. The donor attends or changes their response

The donor can view directions and send a coordinator update, such as being delayed.
The institution sees that written update in request details. The En Route step is
a workflow label; it is not automatic live travel tracking.

If the donor cannot attend, they can cancel the mission. This changes their response
and releases their active-mission slot. It does not cancel the institution's request.

## 7. Staff confirm an actual collection

Staff assess the donor and, after collection, select Confirm donation. One confirmed
collection records one unit in this prototype. The backend checks the accepted
mission, group and configured interval again.

Confirmation adds a donation-history record, adds one stock unit, updates the recorded
last-donation and next-interval dates, and closes the donor's active mission.
Repeated confirmation of that same donor/request does not add another donation.

## 8. The request ends

Once confirmed collections meet the requested units, the request becomes Fulfilled
and its remaining missions are closed. Acceptance counts alone never fulfill it.

Staff can cancel a request earlier. When the response window expires, the request
stops matching and cannot be accepted, dispatched or confirmed. Worker cleanup closes
expired requests and their missions. Older notifications can remain as inbox history.
