/** Fields that belong to deferred artifact experiments. */
export interface DeferredCapsuleFields {
  doodleData?: unknown;
  trackUrl?: unknown;
  isPassDoodle?: unknown;
}

/** The pilot's contribution API accepts text and sealed text only. */
export function hasDeferredCapsuleFields(
  fields: DeferredCapsuleFields,
): boolean {
  return (
    fields.doodleData !== undefined ||
    fields.trackUrl !== undefined ||
    fields.isPassDoodle !== undefined
  );
}
