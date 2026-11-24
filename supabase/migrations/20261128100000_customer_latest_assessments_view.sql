-- Latest assessment per customer in one read (replaces one query per
-- customer on the workspace home and the customer list).
-- security_invoker: the view runs with the caller's rights, so the RLS of
-- public.customer_assessments (customer.view, member-only) still applies.

create view public.customer_latest_assessments
with (security_invoker = true) as
select distinct on (a.tenant_id, a.customer_id) a.*
from public.customer_assessments a
order by a.tenant_id, a.customer_id, a.assessed_at desc, a.created_at desc, a.id desc;

revoke all on public.customer_latest_assessments from anon;
grant select on public.customer_latest_assessments to authenticated;

comment on view public.customer_latest_assessments is
  'Latest assessment per customer; security_invoker so customer_assessments RLS applies.';
