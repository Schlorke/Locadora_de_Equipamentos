# SUPABASE RLS FIX GUIDE

## PROBLEM

Supabase is reporting security errors because Row Level Security (RLS) is not
enabled for tables exposed in the public schema.

## AFFECTED TABLES

- public.users
- public.accounts
- public.sessions
- public.verificationtokens
- public.addresses
- public.carts
- public.cart_items
- public.categories
- public.equipments
- public.equipment_units
- public.quotes
- public.quote_items
- public.rentals
- public.rental_items
- public.maintenances
- public.settings
- public.vehicles
- public.drivers
- public.payments
- public.deliveries
- public.notifications
- public.permissions
- public.audit_logs
- public.contracts

## FIX STEPS

1. Open the Supabase dashboard.
2. Go to SQL Editor and create a new query.
3. Copy the full contents of `supabase-rls-fix.sql` (repo root) into the editor.
4. Run the query.

## WHAT THE SCRIPT DOES

- Enables RLS on all affected public tables.
- Creates baseline policies:
  - Public read for categories and equipments.
  - User-owned access for addresses, carts, cart items, notifications, and
    quotes/rentals read.
  - Admin-only access for sensitive tables (accounts, sessions,
    verificationtokens, payments, settings, audit_logs, permissions, contracts,
    maintenance, vehicles, drivers).

## AFTER APPLYING

- The Supabase linter should report 0 RLS errors.
- The shield icons should appear on all listed tables.

## SECURITY NOTE

Do not paste real credentials in documentation. Use placeholders like
`postgresql://username:password@host:port/database`.
