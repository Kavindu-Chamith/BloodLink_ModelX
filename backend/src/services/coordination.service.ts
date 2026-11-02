import { PoolClient } from 'pg';
import { pool } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';
import { HttpError } from '../transaction';

export function donationIntervalDays(): number {
  const days = Number(process.env.DONATION_INTERVAL_DAYS || 90);
  if (!Number.isInteger(days) || days < 1 || days > 730) throw new Error('Invalid DONATION_INTERVAL_DAYS');
  return days;
}

export function distanceSQL(a: string, b: string): string {
  // Aliases are internal constants, never user input. Clamp floating point roundoff.
  return `(6371 * acos(LEAST(1.0, GREATEST(-1.0,
    sin(radians(${a}.latitude::double precision)) * sin(radians(${b}.latitude::double precision)) +
    cos(radians(${a}.latitude::double precision)) * cos(radians(${b}.latitude::double precision)) *
    cos(radians((${a}.longitude - ${b}.longitude)::double precision))))))`;
}

export const donorEligibilitySQL = `dp.blood_group_verified AND dp.is_available
  AND dp.latitude IS NOT NULL AND dp.longitude IS NOT NULL
  AND COALESCE(dp.next_eligible_date, CURRENT_DATE) <= CURRENT_DATE
  AND (dp.last_donation_date IS NULL OR dp.last_donation_date + $2::integer <= CURRENT_DATE)
  AND NOT EXISTS (SELECT 1 FROM donations d WHERE d.donor_id = dp.user_id AND d.donation_date + $2::integer > CURRENT_DATE)`;

export async function matchedRequests(donorId: string, limit = 100) {
  return (await pool.query(`SELECT r.*, o.name AS hospital_name, o.address, o.contact_phone,
    o.branch_name, o.district, ${distanceSQL('dp', 'o')} AS distance_km,
    n.response_status, n.responded_at, n.closed_at,
    (SELECT COUNT(*)::integer FROM notifications a WHERE a.request_id = r.id AND a.response_status = 'accepted' AND a.closed_at IS NULL) AS accepted_donors
    FROM blood_requests r JOIN organizations o ON o.id = r.organization_id
    JOIN donor_profiles dp ON dp.user_id = $1 JOIN users u ON u.id = dp.user_id
    LEFT JOIN notifications n ON n.request_id = r.id AND n.donor_id = dp.user_id
    WHERE r.status = 'Active' AND r.approval_status = 'Approved' AND o.is_active AND o.verification_status = 'approved'
      AND u.status = 'active' AND u.role = 'donor' AND ${donorEligibilitySQL}
      AND dp.blood_group = r.blood_group
      AND o.latitude IS NOT NULL AND o.longitude IS NOT NULL
      AND ${distanceSQL('dp', 'o')} <= r.radius_km
    ORDER BY CASE r.priority WHEN 'Emergency' THEN 0 WHEN 'Urgent' THEN 1 ELSE 2 END,
      r.created_at DESC, r.id DESC LIMIT $3`, [donorId, donationIntervalDays(), limit])).rows;
}

export async function lockRequest(client: PoolClient, requestId: number) {
  const row = (await client.query('SELECT * FROM blood_requests WHERE id = $1 FOR UPDATE', [requestId])).rows[0];
  if (!row) throw new HttpError(404, 'Blood request not found');
  const organization = (await client.query('SELECT * FROM organizations WHERE id = $1 FOR SHARE', [row.organization_id])).rows[0];
  if (!organization?.is_active || organization.verification_status !== 'approved') throw new HttpError(409, 'Institution is not active and approved');
  return { ...row, hospital_name: organization.name };
}

export async function lockDonor(client: PoolClient, donorId: string | number) {
  const user = (await client.query('SELECT role, status FROM users WHERE id = $1 FOR UPDATE', [donorId])).rows[0];
  if (!user || user.role !== 'donor' || user.status !== 'active') throw new HttpError(403, 'An active donor is required');
  const donor = (await client.query('SELECT * FROM donor_profiles WHERE user_id = $1 FOR UPDATE', [donorId])).rows[0];
  if (!donor) throw new HttpError(404, 'Donor profile not found');
  return donor;
}

export async function assertRequestMatch(client: PoolClient, donorId: string, requestId: number) {
  const result = await client.query(`SELECT dp.user_id FROM donor_profiles dp
    JOIN blood_requests r ON r.id = $1 JOIN organizations o ON o.id = r.organization_id
    WHERE dp.user_id = $3 AND r.status = 'Active' AND r.approval_status = 'Approved'
      AND o.is_active AND o.verification_status = 'approved'
      AND ${donorEligibilitySQL} AND dp.blood_group = r.blood_group
      AND o.latitude IS NOT NULL AND o.longitude IS NOT NULL
      AND ${distanceSQL('dp', 'o')} <= r.radius_km`, [requestId, donationIntervalDays(), donorId]);
  if (!result.rowCount) throw new HttpError(409, 'A verified, available donor with a matching blood group, location and donation interval is required');
}

export async function audit(client: PoolClient, req: AuthRequest, action: string, targetType: string, targetId: string | number, metadata: object = {}) {
  await client.query(`INSERT INTO audit_logs(actor_user_id, action, target_type, target_id, metadata, ip_address)
    VALUES ($1, $2, $3, $4, $5, $6)`, [req.user!.id, action, targetType, targetId, JSON.stringify(metadata), req.ip || null]);
}

export async function queueNotificationPush(client: PoolClient, notificationIds: number[]) {
  if (!notificationIds.length) return;
  await client.query(`INSERT INTO push_delivery_jobs(notification_id, device_id)
    SELECT n.id, d.id FROM notifications n JOIN push_devices d ON d.user_id = n.donor_id
    WHERE n.id = ANY($1::integer[]) ON CONFLICT DO NOTHING`, [notificationIds]);
}

export async function dispatchMatches(client: PoolClient, requestId: number) {
  const matches = await client.query(`INSERT INTO notifications(request_id, donor_id, title, message)
    SELECT r.id, dp.user_id, 'Blood donation request', 'A verified institution has requested your blood group nearby. Open BloodLink for details.'
    FROM blood_requests r JOIN organizations o ON o.id = r.organization_id
    JOIN donor_profiles dp ON dp.blood_group = r.blood_group JOIN users u ON u.id = dp.user_id
    WHERE r.id = $1 AND r.status = 'Active' AND r.approval_status = 'Approved' AND o.is_active AND o.verification_status = 'approved'
      AND u.role = 'donor' AND u.status = 'active' AND ${donorEligibilitySQL}
      AND o.latitude IS NOT NULL AND o.longitude IS NOT NULL
      AND ${distanceSQL('dp', 'o')} <= r.radius_km
    ON CONFLICT (request_id, donor_id) DO UPDATE SET closed_at = NULL, sent_at = NOW(), read_at = NULL
      WHERE notifications.closed_at IS NOT NULL AND notifications.response_status = 'pending' RETURNING id`, [requestId, donationIntervalDays()]);
  await queueNotificationPush(client, matches.rows.map(row => row.id));
  return matches.rowCount || 0;
}
