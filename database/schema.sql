-- =============================================================================
-- BloodLink Database Schema
-- Smart Blood Donation Coordination System
-- Target DBMS: PostgreSQL 15+
-- =============================================================================
-- Fresh database setup in DataGrip:
-- 1. Create an empty PostgreSQL database, for example bloodlink_modelx.
-- 2. Select that database and its public schema as this file's execution target.
-- 3. Execute this ENTIRE file. If using manual transactions, commit on success.
-- 4. Set backend/.env DATABASE_URL to the same host, port, database and credentials.
--
-- This is plain PostgreSQL SQL: no psql commands or database creation is required.
-- It creates the current application tables, constraints and indexes, without
-- inserting users, institutions or blood requests. Run only on an empty schema;
-- use backend's npm run migrate for existing installations and migration tracking.
-- For an admin account, configure ADMIN_EMAIL / ADMIN_PASSWORD, then run
-- npm run seed from backend. Do not run npm run db:init after this script.
-- Transaction control is left to the caller so npm run db:init also works.

-- -----------------------------------------------------------------------------
-- 1. Organizations (Hospitals and Blood Banks)
-- -----------------------------------------------------------------------------
CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('hospital', 'bloodbank')),
  registration_evidence_url TEXT,
  address TEXT,
  contact_phone VARCHAR(20),
  district VARCHAR(50),
  contact_email VARCHAR(255),
  branch_name VARCHAR(100),
  parent_organization_id INTEGER REFERENCES organizations(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  verification_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  verified_by INTEGER,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. Users (Accounts: Donors, Hospital Staff, Blood Bank Staff, Admins)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('donor', 'hospital_staff', 'bloodbank_staff', 'admin')),
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  is_bank_account BOOLEAN NOT NULL DEFAULT false,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link organizations.verified_by to users(id) now that users exists
ALTER TABLE organizations ADD CONSTRAINT fk_org_verified_by
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 3. Donor Profiles (Detailed Donor Information for Matching & Reminders)
-- -----------------------------------------------------------------------------
CREATE TABLE donor_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  nic VARCHAR(20),
  phone VARCHAR(20),
  date_of_birth DATE,
  blood_group VARCHAR(5) CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  is_available BOOLEAN NOT NULL DEFAULT true,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  last_donation_date DATE,
  next_eligible_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 4. Donor Blood Group Verification Requests (Admin Review Workflow)
-- -----------------------------------------------------------------------------
CREATE TABLE donor_verifications (
  id SERIAL PRIMARY KEY,
  donor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  claimed_blood_group VARCHAR(5) NOT NULL CHECK (claimed_blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 5. Blood Stock Inventory (Hospital & Blood Bank Stock Management)
-- -----------------------------------------------------------------------------
CREATE TABLE blood_stocks (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  blood_group VARCHAR(5) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  available_units INTEGER NOT NULL DEFAULT 0 CHECK (available_units >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'Normal' CHECK (status IN ('Normal', 'Low', 'Critical')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, blood_group)
);

-- -----------------------------------------------------------------------------
-- 6. Blood Requests (Hospital Emergency & Routine Blood Requests)
-- -----------------------------------------------------------------------------
CREATE TABLE blood_requests (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  blood_group VARCHAR(5) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  required_units INTEGER NOT NULL CHECK (required_units > 0),
  priority VARCHAR(20) NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Normal', 'Urgent', 'Emergency')),
  radius_km NUMERIC(5, 2) NOT NULL DEFAULT 20.0,
  status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Fulfilled', 'Cancelled')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 7. Notifications & Donor Responses (Push Alerts Dispatched to Donors)
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
  donor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  response_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (response_status IN ('pending', 'accepted', 'declined')),
  responded_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 8. Donations (Donation Records for History & Eligibility Calculation)
-- -----------------------------------------------------------------------------
CREATE TABLE donations (
  id SERIAL PRIMARY KEY,
  donor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  units_donated INTEGER NOT NULL DEFAULT 1 CHECK (units_donated > 0),
  donation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 9. Audit Logs (Audit Trail for Sensitive Administrative Actions)
-- -----------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id INTEGER,
  metadata JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 10. Password Reset Tokens (OTP-based Password Recovery)
-- -----------------------------------------------------------------------------
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient lookup and cleanup
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- -----------------------------------------------------------------------------
-- 11. Refresh Tokens (Token Rotation & Blacklisting)
-- -----------------------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  family_id VARCHAR(64) NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient lookup and cleanup
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family_id ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- -----------------------------------------------------------------------------
-- 12. Registration OTPs (Phone/Email verification during signup)
-- -----------------------------------------------------------------------------
CREATE TABLE registration_otps (
  id SERIAL PRIMARY KEY,
  identifier VARCHAR(255) NOT NULL,
  identifier_type VARCHAR(10) NOT NULL CHECK (identifier_type IN ('email', 'phone')),
  otp_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_registration_otps_identifier ON registration_otps(identifier);
CREATE INDEX idx_registration_otps_expires_at ON registration_otps(expires_at);

-- Baseline hardening (also available as migration_002 for existing installs).
-- Fresh-install definitions only; legacy data changes belong in migrations.
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE registration_otps ADD COLUMN verification_token_hash TEXT;
ALTER TABLE password_reset_tokens ADD COLUMN verified_at TIMESTAMPTZ;
ALTER TABLE password_reset_tokens ADD COLUMN reset_token_hash TEXT;
ALTER TABLE donor_profiles ADD COLUMN blood_group_verified BOOLEAN NOT NULL DEFAULT false;

-- 13. Durable Password Reset Email Queue
CREATE TABLE password_reset_email_jobs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_until TIMESTAMPTZ
);
CREATE INDEX password_reset_email_jobs_pending ON password_reset_email_jobs (next_attempt_at) WHERE status IN ('pending', 'processing');

CREATE UNIQUE INDEX users_email_normalized_unique ON users (LOWER(BTRIM(email)));
CREATE UNIQUE INDEX donor_profiles_nic_unique ON donor_profiles (UPPER(BTRIM(nic))) WHERE nic IS NOT NULL;
CREATE UNIQUE INDEX donor_profiles_phone_unique ON donor_profiles (phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX donor_verifications_one_pending ON donor_verifications (donor_id) WHERE status = 'pending';
CREATE UNIQUE INDEX registration_otps_identifier_type_unique ON registration_otps (identifier, identifier_type);
CREATE UNIQUE INDEX registration_otps_proof_unique ON registration_otps (verification_token_hash) WHERE verification_token_hash IS NOT NULL;
CREATE UNIQUE INDEX password_reset_proof_unique ON password_reset_tokens (reset_token_hash) WHERE reset_token_hash IS NOT NULL;
CREATE INDEX refresh_tokens_active_session ON refresh_tokens (user_id, family_id, expires_at) WHERE NOT is_revoked;
CREATE INDEX donor_verifications_status_created ON donor_verifications (status, created_at);
CREATE INDEX organizations_status_created ON organizations (verification_status, created_at);
CREATE INDEX organizations_type_district ON organizations (type, district);
CREATE INDEX users_organization_id ON users (organization_id);
CREATE INDEX audit_logs_actor_user_id ON audit_logs (actor_user_id);
CREATE INDEX audit_logs_created_at ON audit_logs (created_at);

ALTER TABLE users
  ADD CONSTRAINT users_auth_counters_check CHECK (failed_login_attempts >= 0 AND token_version >= 0),
  ADD CONSTRAINT users_email_canonical_check CHECK (email = LOWER(BTRIM(email)) AND LENGTH(email) > 3);
ALTER TABLE donor_profiles
  ADD CONSTRAINT donor_profiles_latitude_check CHECK (latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT donor_profiles_longitude_check CHECK (longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT donor_profiles_eligibility_check CHECK (next_eligible_date IS NULL OR last_donation_date IS NULL OR next_eligible_date >= last_donation_date);
ALTER TABLE organizations
  ADD CONSTRAINT organizations_name_check CHECK (LENGTH(BTRIM(name)) > 0),
  ADD CONSTRAINT organizations_latitude_check CHECK (latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT organizations_longitude_check CHECK (longitude BETWEEN -180 AND 180);
ALTER TABLE blood_requests ADD CONSTRAINT blood_requests_radius_check CHECK (radius_km > 0);
ALTER TABLE registration_otps ADD CONSTRAINT registration_otps_attempts_check CHECK (attempts >= 0 AND max_attempts > 0);
ALTER TABLE password_reset_tokens
  ADD CONSTRAINT password_reset_attempts_check CHECK (attempts >= 0 AND max_attempts > 0),
  ADD CONSTRAINT password_reset_proof_check CHECK (reset_token_hash IS NULL OR verified_at IS NOT NULL);

ALTER TABLE organizations ADD CONSTRAINT organizations_not_own_parent CHECK (parent_organization_id IS NULL OR parent_organization_id <> id);
ALTER TABLE users ADD CONSTRAINT users_bank_account_role CHECK (NOT is_bank_account OR role = 'bloodbank_staff');
CREATE UNIQUE INDEX users_one_bank_account ON users(organization_id) WHERE is_bank_account;
CREATE INDEX organizations_parent ON organizations(parent_organization_id);

-- Operational workflows. Run transactionally through the migration runner.
ALTER TABLE donor_profiles ADD COLUMN IF NOT EXISTS district VARCHAR(50);
ALTER TABLE notifications ALTER COLUMN request_id DROP NOT NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'critical_need';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'urgent';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS request_id INTEGER REFERENCES blood_requests(id) ON DELETE SET NULL;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Closed requests cannot retain a live dispatch mission.
UPDATE notifications n SET closed_at = NOW()
FROM blood_requests r WHERE r.id = n.request_id AND r.status <> 'Active' AND n.closed_at IS NULL;
-- Unique indexes intentionally reject conflicting legacy records instead of deleting them.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_request_donor_unique ON notifications(request_id, donor_id);
CREATE UNIQUE INDEX IF NOT EXISTS notifications_one_active_mission ON notifications(donor_id)
  WHERE response_status = 'accepted' AND closed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_unique ON notifications(dedupe_key);
CREATE INDEX IF NOT EXISTS notifications_donor_sent ON notifications(donor_id, sent_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS blood_requests_organization_status ON blood_requests(organization_id, status, id DESC);
CREATE INDEX IF NOT EXISTS donations_donor_date ON donations(donor_id, donation_date DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS donations_request_donor_unique ON donations(request_id, donor_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS donors_matching ON donor_profiles(blood_group, next_eligible_date) WHERE blood_group_verified AND is_available;

CREATE TABLE IF NOT EXISTS verification_documents (
  id UUID PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  content BYTEA NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 5242880),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS verification_documents_owner ON verification_documents(owner_id);

CREATE TABLE IF NOT EXISTS coordinator_messages (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
  donor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS coordinator_messages_request ON coordinator_messages(request_id, id DESC);

CREATE TABLE IF NOT EXISTS push_devices (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE CHECK (length(token) BETWEEN 20 AND 4096),
  family_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS push_devices_user ON push_devices(user_id);
CREATE TABLE IF NOT EXISTS push_delivery_jobs (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES push_devices(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_until TIMESTAMPTZ,
  UNIQUE(notification_id, device_id)
);
CREATE INDEX IF NOT EXISTS push_delivery_jobs_pending ON push_delivery_jobs(next_attempt_at) WHERE status IN ('pending', 'processing');

CREATE TABLE IF NOT EXISTS download_tickets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_version INTEGER NOT NULL,
  family_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS download_tickets_expiry ON download_tickets(expires_at);

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  key_hash TEXT PRIMARY KEY,
  total_hits INTEGER NOT NULL CHECK (total_hits >= 0),
  reset_time TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limit_counters_expiry ON rate_limit_counters(reset_time);

-- New and existing open requests require explicit platform approval.
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'Pending'
  CHECK (approval_status IN ('Pending', 'Approved', 'Rejected'));
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS review_reason TEXT;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS reason VARCHAR(1000) NOT NULL DEFAULT '';
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS department VARCHAR(150) NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS blood_requests_review_queue ON blood_requests(approval_status, status, id DESC);

-- Release legacy dispatches until the request has been reviewed. Do not delete history.
UPDATE notifications n SET closed_at = NOW(), response_status = 'pending'
FROM blood_requests r WHERE n.request_id = r.id AND r.status = 'Active'
  AND r.approval_status = 'Pending' AND n.closed_at IS NULL;
UPDATE push_delivery_jobs j SET status = 'cancelled', lease_until = NULL
FROM notifications n JOIN blood_requests r ON r.id = n.request_id
WHERE j.notification_id = n.id AND r.approval_status <> 'Approved' AND j.status IN ('pending', 'processing');

CREATE TABLE IF NOT EXISTS health_alerts (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  donor_id INTEGER NOT NULL REFERENCES users(id),
  sent_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  subject VARCHAR(150) NOT NULL CHECK (length(subject) BETWEEN 1 AND 150),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
  notification_id INTEGER REFERENCES notifications(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS health_alerts_institution ON health_alerts(organization_id, id DESC);
