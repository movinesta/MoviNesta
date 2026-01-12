// Updated schemaRegistry.ts
import Ajv from "npm:ajv@8.17.1";

const ajv = new Ajv({ allErrors: true, strict: false });
const schemaCache = new Map<string, any>();

export function validateSchemaPayload(schemaId: string, payload: unknown) {
  let validate = schemaCache.get(schemaId);

  if (!validate) {
    throw new Error(`Schema not registered: ${schemaId}`);
  }

  const valid = validate(payload);

  return {
    valid,
    errors: validate.errors ?? [],
  };
}

export function registerSchema(schemaId: string, schema: object) {
  const validate = ajv.compile(schema);
  schemaCache.set(schemaId, validate);
}
