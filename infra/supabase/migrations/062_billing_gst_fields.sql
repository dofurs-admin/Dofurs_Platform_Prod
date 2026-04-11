-- Migration: GST/Tax Compliance Fields for Billing Invoices
-- Adds CGST/SGST/IGST breakup, GSTIN, and HSN/SAC code support for Indian tax compliance

ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS cgst_inr numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_inr numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_inr numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gstin text,
  ADD COLUMN IF NOT EXISTS hsn_sac_code text,
  ADD COLUMN IF NOT EXISTS gst_invoice_number text;

-- GST invoice number format: GST/YYYY-YY/NNNNNN (e.g. GST/2024-25/000001)
CREATE SEQUENCE IF NOT EXISTS public.gst_invoice_seq START 1;

COMMENT ON COLUMN public.billing_invoices.cgst_inr IS 'Central GST component (9% for 18% GST rate)';
COMMENT ON COLUMN public.billing_invoices.sgst_inr IS 'State GST component (9% for 18% GST rate)';
COMMENT ON COLUMN public.billing_invoices.igst_inr IS 'Integrated GST for inter-state transactions';
COMMENT ON COLUMN public.billing_invoices.gstin IS 'GST Identification Number of the business';
COMMENT ON COLUMN public.billing_invoices.hsn_sac_code IS 'HSN code for goods or SAC code for services';
COMMENT ON COLUMN public.billing_invoices.gst_invoice_number IS 'GST-compliant invoice number format';
