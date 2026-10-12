# Module 4 API contract

## Authentication and authorization
All protected endpoints require the active authenticated user session. The server must never trust client-provided user IDs. Authorization must be enforced by route guard and database policy.

## 1) Live location
### POST /api/jobs/[id]/location
Request body:
```json
{
  "latitude": 28.6139,
  "longitude": 77.2090,
  "accuracy": 12,
  "status": "sharing"
}
```

Rules:
- Only the assigned mechanic may submit.
- The request must be active and assigned.
- `latitude` and `longitude` must be valid coordinate values.
- Completed or cancelled jobs are rejected.
- Update is persisted with timestamp and latest location snapshot.

Response:
```json
{
  "success": true,
  "location": {
    "jobId": "...",
    "mechanicId": "...",
    "latitude": 28.6139,
    "longitude": 77.2090,
    "capturedAt": "2026-10-09T12:00:00Z",
    "status": "sharing"
  }
}
```

### GET /api/jobs/[id]/location/latest
Returns latest authorized location and stale-state metadata.

## 2) Chat
### GET /api/jobs/[id]/messages
Returns all authorized messages for the job, ordered by ascending or descending timestamp.

### POST /api/jobs/[id]/messages
Request body:
```json
{
  "text": "I am 2 minutes away."
}
```
Rules:
- trim and reject empty/blank text
- enforce max length (e.g. 2000 chars)
- persist before returning success
- prevent crossing into another job's conversation

## 3) Notifications
### GET /api/notifications
Returns unread count plus list of notifications.

### PATCH /api/notifications/[id]/read
Marks one notification as read.

## 4) Emergency contacts
### GET /api/emergency-contacts
Returns only the authenticated driver's emergency contacts.

### POST /api/emergency-contacts
Request body:
```json
{
  "name": "Amit Verma",
  "relationship": "Father",
  "phoneNumber": "+91 98765 43210"
}
```
Rules:
- Validate required fields.
- Normalize phone numbers where possible.
- Require owner scoping.

### PUT /api/emergency-contacts/[id]
Update a specific emergency contact owned by the authenticated driver.

### DELETE /api/emergency-contacts/[id]
Delete only if the record belongs to the authenticated driver.

## 5) SOS
### POST /api/sos
Request body:
```json
{
  "requestId": "...",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "reason": "Vehicle is stalled on a highway shoulder"
}
```
Rules:
- Store before success response.
- Allow submission without coordinates.
- Reject duplicate SOS events from same driver/request within a cooldown window.
- Save state transition to `sos_event_history`.

### GET /api/sos/[id]
Returns the SOS event and history for authorized participants.

### GET /api/admin/sos
Returns SOS queue for administrators.

### PATCH /api/admin/sos/[id]/acknowledge
Admin acknowledges the event; status changes to `ACKNOWLEDGED`.

### PATCH /api/admin/sos/[id]/resolve
Admin resolves, with notes.

## 6) Incident reports
### POST /api/incidents
Request body:
```json
{
  "category": "unsafe_behavior",
  "description": "Mechanic was aggressive and refused to explain diagnostic steps.",
  "requestId": "...",
  "jobId": "..."
}
```
Rules:
- category is required
- description is required
- request or job may be nullable if not tied to an active request
- stored before response is returned

### GET /api/incidents/mine
Returns incidents created by the authenticated user.

### GET /api/admin/incidents
Returns all incidents visible to admins.

### PATCH /api/admin/incidents/[id]
Admin can update status and resolution notes.

## Validation rules
- Coordinates must be within valid ranges.
- Message text must not be blank or beyond configured length.
- Notification duplicates must be prevented via dedupe key.
- Role access is enforced at the server side.
- Any setup relying on external SMS/email should be documented as optional, not assumed to be active.

## Error handling
Use consistent JSON responses:
```json
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "Only the assigned mechanic can update this location."
}
```
Recommended status codes:
- 400: invalid payload or state
- 401: unauthenticated
- 403: forbidden or not allowed
- 404: not found
- 409: duplicate or conflicting state
- 500: unexpected server error
