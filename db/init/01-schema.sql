-- ============================================================
-- DHAKA TESLA POOL
-- COMPLETE DATABASE SCHEMA (FINAL v3)
-- PostgreSQL / Supabase
--
-- v3 changes (on top of v2):
--   1. New trigger: joining a pool while it's still "open" now
--      automatically advances the ride from requested -> matched,
--      so the later open -> accepted cascade (matched -> accepted)
--      is always a legal transition.
--   2. cascade_pool_status_to_members() now also updates
--      pool_members.status to completed/cancelled alongside the
--      ride_requests it touches, so a finished pool can never
--      leave a member stuck at "active".
--   3. validate_pool_capacity() now only runs its capacity math
--      when a row is heading INTO 'active' status, and excludes
--      the row being written from its own seat sum - so
--      completing/cancelling a member never gets blocked by a
--      false "pool not open" or false "capacity exceeded" error.
--
-- This is idempotent and safe to re-run over your existing
-- Supabase database - no tables are dropped, only function
-- bodies and a couple of triggers are replaced.
-- ============================================================


-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- 2. ENUM TYPES
-- ============================================================

DO $$
BEGIN

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('passenger', 'driver');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_status') THEN
        CREATE TYPE vehicle_status AS ENUM ('active', 'inactive', 'maintenance');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ride_status') THEN
        CREATE TYPE ride_status AS ENUM (
            'requested', 'matched', 'accepted',
            'driver_arrived', 'started', 'completed', 'cancelled'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pool_status') THEN
        CREATE TYPE pool_status AS ENUM (
            'open', 'accepted', 'driver_arrived',
            'started', 'completed', 'cancelled'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status') THEN
        CREATE TYPE membership_status AS ENUM ('active', 'completed', 'cancelled');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE payment_method AS ENUM ('cash', 'teslapay');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
    END IF;

END
$$;


-- ============================================================
-- 3. UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- ============================================================
-- 4. USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 100),
    email TEXT NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx ON users (phone) WHERE phone IS NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_users_is_online ON users(is_online) WHERE role = 'driver';

-- ============================================================
-- 5. ZONES
-- ============================================================

CREATE TABLE IF NOT EXISTS zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 6. VEHICLES
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL,
    name TEXT NOT NULL,
    make TEXT NOT NULL DEFAULT 'Tesla',
    model TEXT NOT NULL,
    plate_number TEXT NOT NULL,
    capacity SMALLINT NOT NULL DEFAULT 3,
    status vehicle_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_vehicle_driver FOREIGN KEY (driver_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT vehicle_capacity_check CHECK (capacity BETWEEN 1 AND 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_plate_unique_idx ON vehicles (LOWER(plate_number));


-- ============================================================
-- 7. RIDE REQUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS ride_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passenger_id UUID NOT NULL,
    pickup_zone_id UUID NOT NULL,
    destination_zone_id UUID NOT NULL,
    seats_requested SMALLINT NOT NULL DEFAULT 1,
    estimated_distance_km NUMERIC(7,2),
    estimated_fare_paisa BIGINT NOT NULL DEFAULT 0,
    final_fare_paisa BIGINT,
    status ride_status NOT NULL DEFAULT 'requested',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    matched_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    driver_arrived_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_ride_passenger FOREIGN KEY (passenger_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ride_pickup_zone FOREIGN KEY (pickup_zone_id) REFERENCES zones(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ride_destination_zone FOREIGN KEY (destination_zone_id) REFERENCES zones(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ride_seats_check CHECK (seats_requested BETWEEN 1 AND 3),
    CONSTRAINT ride_estimated_distance_check CHECK (estimated_distance_km IS NULL OR estimated_distance_km >= 0),
    CONSTRAINT ride_estimated_fare_check CHECK (estimated_fare_paisa >= 0),
    CONSTRAINT ride_final_fare_check CHECK (final_fare_paisa IS NULL OR final_fare_paisa >= 0),
    CONSTRAINT ride_different_zones_check CHECK (pickup_zone_id <> destination_zone_id)
);


-- ============================================================
-- 8. POOLS
-- ============================================================

CREATE TABLE IF NOT EXISTS pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL,
    capacity_snapshot SMALLINT NOT NULL,
    status pool_status NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    driver_arrived_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_pool_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT pool_capacity_check CHECK (capacity_snapshot BETWEEN 1 AND 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_pool_per_vehicle
ON pools (vehicle_id)
WHERE status NOT IN ('completed', 'cancelled');


-- ============================================================
-- 9. POOL MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS pool_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL,
    ride_request_id UUID NOT NULL,
    seats_allocated SMALLINT NOT NULL,
    agreed_fare_paisa BIGINT NOT NULL,
    status membership_status NOT NULL DEFAULT 'active',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    CONSTRAINT fk_pool_member_pool FOREIGN KEY (pool_id) REFERENCES pools(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pool_member_ride FOREIGN KEY (ride_request_id) REFERENCES ride_requests(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT pool_member_seats_check CHECK (seats_allocated BETWEEN 1 AND 3),
    CONSTRAINT pool_member_fare_check CHECK (agreed_fare_paisa >= 0),
    CONSTRAINT unique_ride_in_pool UNIQUE (ride_request_id)
);


-- ============================================================
-- 10. RIDE STATUS HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS ride_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_request_id UUID NOT NULL,
    status ride_status NOT NULL,
    changed_by_user_id UUID,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_status_history_ride FOREIGN KEY (ride_request_id) REFERENCES ride_requests(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_status_history_user FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
);


-- ============================================================
-- 11. PAYMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_request_id UUID NOT NULL,
    amount_paisa BIGINT NOT NULL,
    method payment_method NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',
    transaction_reference TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_payment_ride FOREIGN KEY (ride_request_id) REFERENCES ride_requests(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT payment_amount_check CHECK (amount_paisa >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_ride_unique_idx ON payments (ride_request_id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_transaction_reference_unique_idx
ON payments (transaction_reference) WHERE transaction_reference IS NOT NULL;


-- ============================================================
-- 12. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_vehicles_driver ON vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_rides_passenger ON ride_requests(passenger_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON ride_requests(status);
CREATE INDEX IF NOT EXISTS idx_rides_pickup ON ride_requests(pickup_zone_id);
CREATE INDEX IF NOT EXISTS idx_rides_destination ON ride_requests(destination_zone_id);
CREATE INDEX IF NOT EXISTS idx_rides_requested_at ON ride_requests(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_pools_vehicle ON pools(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_pools_status ON pools(status);
CREATE INDEX IF NOT EXISTS idx_pool_members_pool ON pool_members(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_members_status ON pool_members(status);
CREATE INDEX IF NOT EXISTS idx_status_history_ride ON ride_status_history(ride_request_id);
CREATE INDEX IF NOT EXISTS idx_status_history_created ON ride_status_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);


-- ============================================================
-- 13. UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS users_updated_at_trigger ON users;
CREATE TRIGGER users_updated_at_trigger BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS vehicles_updated_at_trigger ON vehicles;
CREATE TRIGGER vehicles_updated_at_trigger BEFORE UPDATE ON vehicles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS ride_requests_updated_at_trigger ON ride_requests;
CREATE TRIGGER ride_requests_updated_at_trigger BEFORE UPDATE ON ride_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS pools_updated_at_trigger ON pools;
CREATE TRIGGER pools_updated_at_trigger BEFORE UPDATE ON pools
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS payments_updated_at_trigger ON payments;
CREATE TRIGGER payments_updated_at_trigger BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 14. VALIDATE DRIVER ROLE FOR VEHICLES
-- ============================================================

CREATE OR REPLACE FUNCTION validate_vehicle_driver()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.driver_id AND role = 'driver' AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Vehicle driver_id must belong to an active driver';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_vehicle_driver_trigger ON vehicles;
CREATE TRIGGER validate_vehicle_driver_trigger
BEFORE INSERT OR UPDATE OF driver_id ON vehicles
FOR EACH ROW EXECUTE FUNCTION validate_vehicle_driver();


-- ============================================================
-- 15. VALIDATE PASSENGER ROLE FOR RIDE REQUEST
-- ============================================================

CREATE OR REPLACE FUNCTION validate_ride_passenger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.passenger_id AND role = 'passenger' AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Ride passenger_id must belong to an active passenger';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_ride_passenger_trigger ON ride_requests;
CREATE TRIGGER validate_ride_passenger_trigger
BEFORE INSERT OR UPDATE OF passenger_id ON ride_requests
FOR EACH ROW EXECUTE FUNCTION validate_ride_passenger();


-- ============================================================
-- 16. VALIDATE POOL CAPACITY (v3 - fixes bug #3)
--
-- Only enforces capacity when a row is heading INTO 'active'
-- status (a genuine seat claim). Completing or cancelling a
-- member (status moving AWAY from 'active') always frees seats
-- and can never overflow capacity, so it now short-circuits
-- immediately instead of re-running the seat math. The seat sum
-- also now excludes the row being written, so an existing
-- active row can never be double-counted against itself.
-- ============================================================

CREATE OR REPLACE FUNCTION validate_pool_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_pool_capacity INTEGER;
    v_current_seats INTEGER;
    v_requested_seats INTEGER;
    v_pool_status pool_status;
BEGIN

    -- Transitions away from 'active' (completing/cancelling a
    -- member) never claim seats, so there is nothing to check.
    IF NEW.status <> 'active' THEN
        RETURN NEW;
    END IF;

    -- Row lock: makes the Nusrat-vs-Shirin last-seat race safe.
    SELECT capacity_snapshot, status
    INTO v_pool_capacity, v_pool_status
    FROM pools
    WHERE id = NEW.pool_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pool does not exist';
    END IF;

    -- Only a brand-new membership needs the pool to be 'open'.
    -- (An existing active row being adjusted, e.g. seats_allocated,
    -- doesn't need to re-check pool-openness.)
    IF TG_OP = 'INSERT' AND v_pool_status <> 'open' THEN
        RAISE EXCEPTION 'Cannot add a passenger to a pool that is not open';
    END IF;

    SELECT seats_requested
    INTO v_requested_seats
    FROM ride_requests
    WHERE id = NEW.ride_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ride request does not exist';
    END IF;

    IF NEW.seats_allocated > v_requested_seats THEN
        RAISE EXCEPTION 'Allocated seats cannot exceed requested seats';
    END IF;

    -- Sum seats held by OTHER active members only, excluding this
    -- row by id, so it is never counted against itself.
    SELECT COALESCE(SUM(seats_allocated), 0)
    INTO v_current_seats
    FROM pool_members
    WHERE pool_id = NEW.pool_id
      AND status = 'active'
      AND id <> NEW.id;

    IF v_current_seats + NEW.seats_allocated > v_pool_capacity THEN
        RAISE EXCEPTION
            'Pool capacity exceeded. Available seats: %',
            v_pool_capacity - v_current_seats;
    END IF;

    RETURN NEW;

END;
$$;

DROP TRIGGER IF EXISTS validate_pool_capacity_trigger ON pool_members;
CREATE TRIGGER validate_pool_capacity_trigger
BEFORE INSERT OR UPDATE OF pool_id, seats_allocated, status
ON pool_members
FOR EACH ROW EXECUTE FUNCTION validate_pool_capacity();


-- ============================================================
-- 17. VALID RIDE STATUS TRANSITIONS + AUTO TIMESTAMPS
-- ============================================================

CREATE OR REPLACE FUNCTION validate_ride_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN

    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    IF OLD.status = 'requested' AND NEW.status IN ('matched', 'cancelled') THEN
        NULL;
    ELSIF OLD.status = 'matched' AND NEW.status IN ('accepted', 'cancelled') THEN
        NULL;
    ELSIF OLD.status = 'accepted' AND NEW.status IN ('driver_arrived', 'cancelled') THEN
        NULL;
    ELSIF OLD.status = 'driver_arrived' AND NEW.status IN ('started', 'cancelled') THEN
        NULL;
    ELSIF OLD.status = 'started' AND NEW.status = 'completed' THEN
        NULL;
    ELSE
        RAISE EXCEPTION 'Invalid ride status transition: % -> %', OLD.status, NEW.status;
    END IF;

    IF NEW.status = 'matched' THEN
        NEW.matched_at = COALESCE(NEW.matched_at, NOW());
    ELSIF NEW.status = 'accepted' THEN
        NEW.accepted_at = COALESCE(NEW.accepted_at, NOW());
    ELSIF NEW.status = 'driver_arrived' THEN
        NEW.driver_arrived_at = COALESCE(NEW.driver_arrived_at, NOW());
    ELSIF NEW.status = 'started' THEN
        NEW.started_at = COALESCE(NEW.started_at, NOW());
    ELSIF NEW.status = 'completed' THEN
        NEW.completed_at = COALESCE(NEW.completed_at, NOW());
    ELSIF NEW.status = 'cancelled' THEN
        NEW.cancelled_at = COALESCE(NEW.cancelled_at, NOW());
    END IF;

    RETURN NEW;

END;
$$;

DROP TRIGGER IF EXISTS validate_ride_status_transition_trigger ON ride_requests;
CREATE TRIGGER validate_ride_status_transition_trigger
BEFORE UPDATE OF status ON ride_requests
FOR EACH ROW EXECUTE FUNCTION validate_ride_status_transition();


-- ============================================================
-- 18. VALID POOL STATUS TRANSITIONS + AUTO TIMESTAMPS
-- ============================================================

CREATE OR REPLACE FUNCTION validate_pool_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN

    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    IF OLD.status = 'open' AND NEW.status IN ('accepted', 'cancelled') THEN
        NULL;
    ELSIF OLD.status = 'accepted' AND NEW.status IN ('driver_arrived', 'cancelled') THEN
        NULL;
    ELSIF OLD.status = 'driver_arrived' AND NEW.status IN ('started', 'cancelled') THEN
        NULL;
    ELSIF OLD.status = 'started' AND NEW.status = 'completed' THEN
        NULL;
    ELSE
        RAISE EXCEPTION 'Invalid pool status transition: % -> %', OLD.status, NEW.status;
    END IF;

    IF NEW.status = 'accepted' THEN
        NEW.accepted_at = COALESCE(NEW.accepted_at, NOW());
    ELSIF NEW.status = 'driver_arrived' THEN
        NEW.driver_arrived_at = COALESCE(NEW.driver_arrived_at, NOW());
    ELSIF NEW.status = 'started' THEN
        NEW.started_at = COALESCE(NEW.started_at, NOW());
    ELSIF NEW.status = 'completed' THEN
        NEW.completed_at = COALESCE(NEW.completed_at, NOW());
    ELSIF NEW.status = 'cancelled' THEN
        NEW.cancelled_at = COALESCE(NEW.cancelled_at, NOW());
    END IF;

    RETURN NEW;

END;
$$;

DROP TRIGGER IF EXISTS validate_pool_status_transition_trigger ON pools;
CREATE TRIGGER validate_pool_status_transition_trigger
BEFORE UPDATE OF status ON pools
FOR EACH ROW EXECUTE FUNCTION validate_pool_status_transition();


-- ============================================================
-- 19. MARK RIDE AS MATCHED WHEN IT JOINS AN OPEN POOL (v3 - fixes bug #1)
--
-- Guarantees a ride is at 'matched' the moment it becomes a pool
-- member, regardless of what the application layer remembered to
-- set. This closes the gap that let the open -> accepted cascade
-- try an illegal requested -> accepted jump.
-- ============================================================

CREATE OR REPLACE FUNCTION mark_ride_matched_on_pool_join()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'active' THEN
        UPDATE ride_requests
        SET status = 'matched'
        WHERE id = NEW.ride_request_id
          AND status = 'requested';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mark_ride_matched_on_pool_join_trigger ON pool_members;
CREATE TRIGGER mark_ride_matched_on_pool_join_trigger
AFTER INSERT ON pool_members
FOR EACH ROW EXECUTE FUNCTION mark_ride_matched_on_pool_join();


-- ============================================================
-- 20. CASCADE POOL STATUS -> MEMBER RIDES + MEMBERSHIPS (v3 - fixes bug #2)
--
-- Now updates BOTH ride_requests and pool_members when a pool's
-- status changes, so a completed/cancelled pool can never leave
-- a membership row stranded at 'active'.
-- ============================================================

CREATE OR REPLACE FUNCTION cascade_pool_status_to_members()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN

    IF NEW.status = OLD.status THEN
        RETURN NEW;
    END IF;

    IF NEW.status IN ('accepted', 'driver_arrived', 'started') THEN

        UPDATE ride_requests
        SET status = NEW.status
        WHERE id IN (
            SELECT ride_request_id FROM pool_members
            WHERE pool_id = NEW.id AND status = 'active'
        )
        AND status <> NEW.status;

    ELSIF NEW.status = 'completed' THEN

        UPDATE ride_requests
        SET status = 'completed'
        WHERE id IN (
            SELECT ride_request_id FROM pool_members
            WHERE pool_id = NEW.id AND status = 'active'
        )
        AND status <> 'completed';

        UPDATE pool_members
        SET status = 'completed'
        WHERE pool_id = NEW.id AND status = 'active';

    ELSIF NEW.status = 'cancelled' THEN

        UPDATE ride_requests
        SET status = 'cancelled'
        WHERE id IN (
            SELECT ride_request_id FROM pool_members
            WHERE pool_id = NEW.id AND status = 'active'
        )
        AND status NOT IN ('completed', 'cancelled');

        UPDATE pool_members
        SET status = 'cancelled'
        WHERE pool_id = NEW.id AND status = 'active';

    END IF;

    RETURN NEW;

END;
$$;

DROP TRIGGER IF EXISTS cascade_pool_status_to_members_trigger ON pools;
CREATE TRIGGER cascade_pool_status_to_members_trigger
AFTER UPDATE OF status ON pools
FOR EACH ROW EXECUTE FUNCTION cascade_pool_status_to_members();


-- ============================================================
-- 21. SYNC POOL_MEMBER FARE -> RIDE_REQUEST.FINAL_FARE_PAISA
-- ============================================================

CREATE OR REPLACE FUNCTION sync_ride_final_fare()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE ride_requests
    SET final_fare_paisa = NEW.agreed_fare_paisa
    WHERE id = NEW.ride_request_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_ride_final_fare_trigger ON pool_members;
CREATE TRIGGER sync_ride_final_fare_trigger
AFTER INSERT OR UPDATE OF agreed_fare_paisa ON pool_members
FOR EACH ROW EXECUTE FUNCTION sync_ride_final_fare();


-- ============================================================
-- 22. ROW LEVEL SECURITY — INTENTIONALLY NOT USED
--
-- Express is the only client that talks to Postgres and connects
-- with a privileged role that bypasses RLS regardless, so RLS is
-- left off rather than silently blocking everything with no
-- policies defined. Access control is enforced entirely in the
-- Express layer (JWT auth + ownership checks on every route).
-- ============================================================


-- ============================================================
-- 23. OPTIONAL DEMO ZONES
-- ============================================================

INSERT INTO zones (code, name)
VALUES
    ('BANANI', 'Banani'),
    ('MOHAKHALI', 'Mohakhali'),
    ('GULSHAN1', 'Gulshan 1'),
    ('GULSHAN2', 'Gulshan 2'),
    ('DHAKA_UNIVERSITY', 'Dhaka University'),
    ('DHAHANMANDI', 'Dhanmondi'),
    ('UTTARA', 'Uttara'),
    ('FARMGATE', 'Farmgate'),
    ('MIRPUR10', 'Mirpur 10'),
    ('MOHAMMADPUR', 'Mohammadpur')
ON CONFLICT (code) DO NOTHING;