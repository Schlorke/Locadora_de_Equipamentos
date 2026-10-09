-- A signed agreement is historical evidence. Mutable delivery metadata is limited to
-- the first move from a provider URL to a private, tenant-owned storage reference.
CREATE FUNCTION preserve_signed_contract() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'SIGNED' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'SIGNED_CONTRACT_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
      OR NEW."rentalId" IS DISTINCT FROM OLD."rentalId"
      OR NEW.template IS DISTINCT FROM OLD.template
      OR NEW.content IS DISTINCT FROM OLD.content
      OR NEW."signedAt" IS DISTINCT FROM OLD."signedAt"
      OR NEW."signedBy" IS DISTINCT FROM OLD."signedBy"
      OR NEW."zapSignId" IS DISTINCT FROM OLD."zapSignId"
      OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
      RAISE EXCEPTION 'SIGNED_CONTRACT_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
    IF NEW."pdfUrl" IS DISTINCT FROM OLD."pdfUrl" AND (
      OLD."pdfUrl" LIKE 'private:%'
      OR NEW."pdfUrl" IS NULL
      OR OLD."tenantId" IS NULL
      OR NOT starts_with(NEW."pdfUrl", 'private:tenants/' || OLD."tenantId" || '/clients/')
    ) THEN
      RAISE EXCEPTION 'SIGNED_CONTRACT_ARCHIVE_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER signed_contract_immutability BEFORE UPDATE OR DELETE ON contracts
FOR EACH ROW EXECUTE FUNCTION preserve_signed_contract();
